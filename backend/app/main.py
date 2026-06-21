"""
Hydronix Backend API - Main FastAPI application.
"""
import logging
import uuid
import structlog
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from . import database
from .config import settings
from .database import (
    Device, User, get_db, init_db, SessionLocal, AuditLog
)
from .security import get_current_admin, get_password_hash
from .quality_score import QualityScorer, AlertManager
from .rate_limiter import RateLimiter
from .cache import RedisCache

# Configure logging
logging.basicConfig(level=settings.log_level)
_use_structlog = False
try:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
    )
    logger = structlog.get_logger(__name__)
    _use_structlog = True
except Exception:
    logger = logging.getLogger(__name__)
    logger.warning("structlog not available, using stdlib logging fallback")

# Initialize FastAPI
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
)

# Add CORS middleware aligned with settings configuration
allow_credentials = True
if "*" in settings.cors_origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# HTTPS Enforcement & Security Headers Middleware (v2.0.0 Cloudflare Tunnel)
@app.middleware("http")
async def https_enforcement_and_security_headers(request: Request, call_next):
    """
    Enforce HTTPS-only communication and add security headers.
    Devices must connect via HTTPS (Cloudflare Tunnel).
    """
    path = request.url.path
    if path == "/health":
        response = await call_next(request)
        return response
    
    if settings.https_only and request.url.scheme == "http":
        if settings.force_https_redirect and not request.headers.get("X-Forwarded-Proto"):
            return JSONResponse(
                status_code=301,
                content={"error": "HTTPS required"},
                headers={"Location": str(request.url).replace("http://", "https://", 1)}
            )
    
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    if settings.hsts_max_age_seconds > 0:
        hsts_value = f"max-age={settings.hsts_max_age_seconds}"
        if settings.hsts_include_subdomains:
            hsts_value += "; includeSubDomains"
        if settings.hsts_preload:
            hsts_value += "; preload"
        response.headers["Strict-Transport-Security"] = hsts_value
    
    response.headers["X-Backend-Version"] = "2.0.0"
    response.headers["X-Transport"] = "HTTPS-Cloudflare-Tunnel"
    
    return response

# Redis cache (initialised early; needed by HMAC middleware)
cache = RedisCache(redis_url=settings.redis_url)

# HMAC Signature Validation Middleware (firmware v2.0.0)
if settings.hmac_validation_enabled:
    from .hmac_middleware import HMACSignatureMiddleware
    async def _resolve_raw_api_key(x_api_key: str):
        return x_api_key if x_api_key else None

    app.add_middleware(
        HMACSignatureMiddleware,
        cache=cache,
        get_raw_api_key_fn=_resolve_raw_api_key,
    )

# Trace ID middleware (adds X-Trace-Id and binds to structlog context)
@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    try:
        if _use_structlog:
            structlog.contextvars.bind_contextvars(trace_id=trace_id)
    except Exception:
        pass
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    try:
        if _use_structlog:
            structlog.contextvars.clear_contextvars()
    except Exception:
        pass
    return response

# Initialize components
rate_limiter = RateLimiter()
quality_scorer = QualityScorer()
alert_manager = AlertManager()

# WebSocket connections manager
class WebSocketManager:
    def __init__(self):
        self.active = set()

    async def connect(self, websocket):
        await websocket.accept()
        self.active.add(websocket)

    def disconnect(self, websocket):
        try:
            self.active.remove(websocket)
        except KeyError:
            pass

    async def broadcast_json(self, message: dict):
        import asyncio
        coros = []
        for ws in list(self.active):
            try:
                coros.append(ws.send_json(message))
            except Exception:
                try:
                    self.disconnect(ws)
                except Exception:
                    pass
        if coros:
            await asyncio.gather(*coros, return_exceptions=True)

ws_manager = WebSocketManager()


async def get_device_id_cached(api_key: str) -> Optional[str]:
    """Retrieve device ID from API key, using Redis cache to avoid slow bcrypt hashes."""
    if not api_key:
        return None
        
    import hashlib
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    cache_key = f"apikey:device:{key_hash}"
    
    try:
        cached_device_id = cache.get(cache_key)
        if cached_device_id is not None:
            if cached_device_id == "invalid":
                return None
            return cached_device_id
    except Exception as e:
        logger.warning(f"Failed to query API key cache: {e}")

    db = SessionLocal()
    try:
        from .auth import validate_api_key
        device = validate_api_key(db, api_key)
        if device:
            try:
                cache.set(cache_key, device.device_id, ex=3600)
            except Exception:
                pass
            return device.device_id
        else:
            try:
                cache.set(cache_key, "invalid", ex=300)
            except Exception:
                pass
            return None
    finally:
        db.close()


@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    """Global sliding-window rate limiting middleware using Redis."""
    path = request.url.path
    if path in ("/health", "/docs", "/openapi.json", "/redoc") or path.startswith("/static"):
        return await call_next(request)

    client_ip = "unknown"
    if request.client:
        client_ip = request.client.host

    is_limited, headers = rate_limiter.is_rate_limited(ip_address=client_ip)
    if is_limited:
        return JSONResponse(
            status_code=429,
            content={"detail": "IP rate limit exceeded. Max 10,000 requests/hour."},
            headers=headers
        )

    api_key = request.headers.get("X-API-Key")
    if api_key:
        device_id = await get_device_id_cached(api_key)
        if device_id:
            is_limited_device, device_headers = rate_limiter.is_rate_limited(device_id=device_id)
            headers.update(device_headers)
            if is_limited_device:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Device rate limit exceeded for {device_id}. Max 100 requests/minute."},
                    headers=headers
                )

    response = await call_next(request)
    for k, v in headers.items():
        response.headers[k] = v

    return response


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

async def partition_manager_loop():
    """Background loop to periodically run partition creation and pruning."""
    import asyncio
    while True:
        try:
            logger.info("Running database partition manager background task")
            database.setup_database_partitions()
            database.prune_database_partitions()
        except Exception as e:
            logger.error(f"Error in partition manager background task: {e}")
        await asyncio.sleep(86400)


@app.on_event("startup")
async def startup_event():
    """Initialize database and background tasks on v2.0.0 (HTTPS-only, no MQTT)."""
    logger.info(f"Starting Hydronix Backend API v2 (env: {settings.environment})")
    init_db()
    logger.info("Database initialized")

    from sqlalchemy import text
    try:
        db_session = SessionLocal()
        db_session.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;"))
        db_session.execute(text("ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('superadmin', 'admin', 'user'));"))
        db_session.commit()
        db_session.close()
        logger.info("Database check constraint migration complete")
    except Exception as e:
        logger.warning(f"Failed to migrate database check constraint: {e}")

    try:
        db_session = SessionLocal()
        for col in ["latitude", "longitude"]:
            try:
                db_session.execute(text(f"ALTER TABLE devices ADD COLUMN {col} FLOAT;"))
                db_session.commit()
            except Exception:
                db_session.rollback()
        db_session.close()
        logger.info("Database latitude/longitude columns migration complete")
    except Exception as e:
        logger.warning(f"Failed to migrate database columns: {e}")

    try:
        from .cloudflare_tunnel import init_cloudflare_tunnel
        await init_cloudflare_tunnel()
    except Exception as e:
        logger.error(f"Failed to initialize Cloudflare Tunnel: {e}")
    
    import asyncio
    asyncio.create_task(partition_manager_loop())

    db = next(get_db())
    try:
        if db.query(User).count() == 0:
            if settings.super_admin_email and settings.super_admin_password:
                hashed = get_password_hash(settings.super_admin_password)
                super_admin = User(
                    email=settings.super_admin_email.lower().strip(),
                    hashed_password=hashed,
                    role="superadmin",
                    name="Super Administrator"
                )
                db.add(super_admin)
                db.commit()
                logger.info("Bootstrap: Created Super Admin account")
            else:
                logger.warning("Bootstrap: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set.")
    except Exception as e:
        logger.error(f"Failed to bootstrap superadmin: {e}")
        db.rollback()
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down Hydronix Backend API v2")


# ============================================================================
# DEPENDENCY INJECTIONS
# ============================================================================

async def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    if request.client:
        return request.client.host
    return "unknown"


async def get_device_id_from_auth(
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """Extract and validate device ID from API key."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    from .auth import validate_api_key
    device = validate_api_key(db, x_api_key)
    if not device:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return device.device_id


# ============================================================================
# HEALTH ENDPOINT
# ============================================================================

@app.get("/health")
async def health():
    """Health check endpoint (HMAC-exempt)."""
    redis_ok = cache.is_available
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "transport": "https",
        "cache": "connected" if redis_ok else "unavailable",
    }


# ============================================================================
# EXCEPTION HANDLER
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": exc.detail,
            "details": None,
        },
        headers=getattr(exc, "headers", None),
    )


# ============================================================================
# ROUTER REGISTRATIONS
# ============================================================================

from .routers import auth, devices, telemetry, valves, alerts, firmware, users, ws

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(telemetry.router)
app.include_router(valves.router)
app.include_router(alerts.router)
app.include_router(firmware.router)
app.include_router(users.router)
app.include_router(ws.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
    )
