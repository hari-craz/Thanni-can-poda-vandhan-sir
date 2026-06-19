"""
Hydronix Backend API - Main FastAPI application.
Endpoints for data ingestion, device management, and querying.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Header, Request, Query, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from . import database
from .config import settings
from .schemas import (
    SensorDataIngestionRequest,
    DataIngestionResponse,
    ErrorResponse,
    DeviceHeartbeatRequest,
    DeviceHeartbeatResponse,
    DeviceProvisionRequest,
    DeviceProvisionResponse,
    FirmwareUploadRequest,
    FirmwareInfoResponse,
    FirmwareStatusRequest,
    FirmwareCheckResponse,
    AlertAcknowledgementRequest,
    KeyRotationRequest,
    KeyRotationResponse,
    DevicesListResponse,
    DeviceResponse,
    DataQueryResponse,
    SensorDataResponse,
    AlertsListResponse,
    AlertResponse,
    AnomaliesListResponse,
    AnomalyResponse,
    CalibrationStatusResponse,
    SystemStatusResponse,
    MLPredictionRequest,
    MLPredictionResponse,
    DeviceRemoteConfigResponse,
    DeviceRemoteConfigUpdateRequest,
    ValveCommandRequest,
    ValveStatusResponse,
    ValveOperationResponse,
    ValveHistoryResponse,
    ValveCommandResponse,
)
import httpx
from .database import (
    Device, User, SensorData, Alert, APIKey, AuditLog, MLAnomaly,
    get_db, init_db, Firmware, DeviceRemoteConfig, SessionLocal, ValveOperation
)
from .auth import validate_api_key, create_api_key_for_device, rotate_api_key
from .quality_score import QualityScorer, AlertManager
from .rate_limiter import RateLimiter

# Configure logging
logging.basicConfig(level=settings.log_level)
# Try to configure structlog to output JSON for ELK-friendly logs; fall back to stdlib if structlog not installed
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

# Include WebSocket routes
try:
    from .ws_routes import router as ws_router
    app.include_router(ws_router)
except Exception:
    pass

# Include valve control routes
try:
    from .valve_routes import router as valve_router
    app.include_router(valve_router)
except Exception:
    pass

# Include user management routes
try:
    from .user_routes import router as user_router
    app.include_router(user_router)
except Exception as e:
    logger.error(f"Failed to include user_routes: {e}")


# Add CORS middleware (permissive for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTPS Enforcement & Security Headers Middleware (v2.0.0 Cloudflare Tunnel)
@app.middleware("http")
async def https_enforcement_and_security_headers(request: Request, call_next):
    """
    Enforce HTTPS-only communication and add security headers.
    Devices must connect via HTTPS (Cloudflare Tunnel).
    """
    # Skip enforcement for health checks and local testing
    path = request.url.path
    if path == "/health":
        response = await call_next(request)
        return response
    
    # In production, reject plain HTTP requests
    if settings.https_only and request.url.scheme == "http":
        if settings.force_https_redirect and not request.headers.get("X-Forwarded-Proto"):
            # 301 redirect to HTTPS if not behind proxy already
            return JSONResponse(
                status_code=301,
                content={"error": "HTTPS required"},
                headers={"Location": str(request.url).replace("http://", "https://", 1)}
            )
    
    # Process request
    response = await call_next(request)
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Add HSTS header (strict transport security)
    if settings.hsts_max_age_seconds > 0:
        hsts_value = f"max-age={settings.hsts_max_age_seconds}"
        if settings.hsts_include_subdomains:
            hsts_value += "; includeSubDomains"
        if settings.hsts_preload:
            hsts_value += "; preload"
        response.headers["Strict-Transport-Security"] = hsts_value
    
    # Cloudflare Tunnel identity headers
    response.headers["X-Backend-Version"] = "2.0.0"
    response.headers["X-Transport"] = "HTTPS-Cloudflare-Tunnel"
    
    return response

# Redis cache (initialised early; needed by HMAC middleware)
from .cache import RedisCache
cache = RedisCache(redis_url=settings.redis_url)

# HMAC Signature Validation Middleware (firmware v2.0.0)
# Must be added AFTER CORS so OPTIONS pre-flights bypass it.
if settings.hmac_validation_enabled:
    from .hmac_middleware import HMACSignatureMiddleware
    import hashlib as _hashlib

    async def _resolve_raw_api_key(x_api_key: str):
        """
        Look up the raw (plain-text) API key from the Redis cache.
        Returns the key itself when found (we store device_id keyed by sha256 of the key;
        for HMAC we need the raw key string that the device itself holds).
        The device sends its raw api_key in X-API-Key so we can use it directly as the
        HMAC signing secret – the server never stores the plain key but validates the
        HMAC using the provided key (bcrypt validation still happens in the route guard).
        """
        # Device sends raw key — we use it directly as HMAC secret.
        # bcrypt route-guard validates it independently.
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

# Register auth token endpoint
from .security import token_endpoint, get_current_admin, get_password_hash
app.post("/auth/token")(token_endpoint)
app.post("/auth/login")(token_endpoint)

@app.post("/auth/logout")
async def logout():
    return {"ok": True}

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
    # Generate a cache key from a secure fast hash of the API key
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    cache_key = f"apikey:device:{key_hash}"
    
    # Check cache
    try:
        cached_device_id = cache.get(cache_key)
        if cached_device_id is not None:
            if cached_device_id == "invalid":
                return None
            return cached_device_id
    except Exception as e:
        logger.warning(f"Failed to query API key cache: {e}")

    # If not cached, resolve from DB
    db = SessionLocal()
    try:
        device = validate_api_key(db, api_key)
        if device:
            # Cache positive result for 1 hour (3600 seconds)
            try:
                cache.set(cache_key, device.device_id, ex=3600)
            except Exception:
                pass
            return device.device_id
        else:
            # Cache negative result for 5 minutes (300 seconds) to prevent brute-forcing bcrypt
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
    # Bypass health, openapi specs and documentation endpoints
    if path in ("/health", "/docs", "/openapi.json", "/redoc") or path.startswith("/static"):
        return await call_next(request)

    # 1. Get client IP
    client_ip = "unknown"
    if request.client:
        client_ip = request.client.host

    # 2. Check client IP rate limit (10,000 requests/hour)
    is_limited, headers = rate_limiter.is_rate_limited(ip_address=client_ip)
    if is_limited:
        return JSONResponse(
            status_code=429,
            content={"detail": "IP rate limit exceeded. Max 10,000 requests/hour."},
            headers=headers
        )

    # 3. Check device rate limit if X-API-Key header is present
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

    # 4. Proceed with request
    response = await call_next(request)

    # 5. Append rate-limiting metadata headers to the response
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
        # Sleep for 24 hours (86400 seconds)
        await asyncio.sleep(86400)


@app.on_event("startup")
async def startup_event():
    """Initialize database and background tasks on v2.0.0 (HTTPS-only, no MQTT)."""
    logger.info(f"Starting Hydronix Backend API v2 (env: {settings.environment})")
    init_db()
    logger.info("Database initialized")

    # Migrate check constraint on startup
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

    # Migrate devices table to add latitude and longitude columns if they don't exist
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

    # Initialize Cloudflare Tunnel integration (HTTPS-only)
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
    
    device = validate_api_key(db, x_api_key)
    if not device:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return device.device_id


# ============================================================================
# HEALTH & STATUS ENDPOINTS
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


@app.get("/status", response_model=SystemStatusResponse)
async def get_system_status(db: Session = Depends(get_db)):
    """
    GET /status
    Returns backend health plus active device summary.
    MQTT broker status replaced with Redis cache status (v2.0.0).
    """
    try:
        total_devices = db.query(Device).count()
        active_devices = db.query(Device).filter(Device.status == "online").count()
        redis_ok = cache.is_available

        return SystemStatusResponse(
            ok=True,
            backend_status="healthy",
            database_status="healthy",
            cache_status="healthy" if redis_ok else "unavailable",
            active_devices=active_devices,
            total_devices=total_devices,
            uptime_seconds=0,
            transport="https",
        )
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============================================================================
# DATA INGESTION ENDPOINTS
# ============================================================================

@app.post("/data", response_model=DataIngestionResponse)
async def ingest_sensor_data(
    request: SensorDataIngestionRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip),
    device_id: str = Depends(get_device_id_from_auth),
):
    """
    POST /data
    Receive sensor data from device and store in database.
    Validates schema, calculates quality score, and triggers alerts.
    """
    try:
        # Device ID must match authenticated device
        if request.device_id != device_id:
            raise HTTPException(status_code=403, detail="Device ID mismatch")
        
        # Prepare reading values (apply EMA smoothing and calibration offsets if enabled)
        reading_raw = {
            "ph": request.ph,
            "turbidity": request.turbidity,
            "tds": request.tds,
            "temperature": request.temperature,
            "flow_rate": request.flow_rate,
        }

        # Fetch device for calibration/last_smoothed values
        device = db.query(Device).filter(Device.device_id == device_id).first()
        smoothed = reading_raw.copy()
        if settings.smoothing_enabled and device is not None:
            alpha = settings.smoothing_alpha
            last_smoothed = device.last_smoothed_readings or {}
            for k, v in reading_raw.items():
                last = last_smoothed.get(k)
                if last is not None:
                    smoothed[k] = alpha * v + (1 - alpha) * last
                else:
                    smoothed[k] = v
            # persist new smoothed values
            device.last_smoothed_readings = smoothed

        # Apply calibration offsets if present
        calibrated = smoothed.copy()
        if device is not None and getattr(device, 'calibration_offsets', None):
            offsets = device.calibration_offsets or {}
            for k, off in offsets.items():
                if k in calibrated and isinstance(off, (int, float)):
                    calibrated[k] = calibrated[k] + off

        # Calculate quality score on calibrated (smoothed) readings
        quality_score = quality_scorer.calculate_score(calibrated)
        
        # Detect anomalies using calibrated values
        anomaly_flags = quality_scorer.detect_anomalies(calibrated, device_id, db)

        # Ensure device variable exists for later updates
        if device is None:
            device = db.query(Device).filter(Device.device_id == device_id).first()

        # Validate duplicate by device_reset_count + seq_no
        if request.seq_no is not None:
            existing_reading = db.query(SensorData).filter(
                SensorData.device_id == device_id,
                SensorData.device_reset_count == (request.device_reset_count or 0),
                SensorData.seq_no == request.seq_no
            ).first()
            if existing_reading:
                logger.info(f"Duplicate reading received for {device_id} (seq_no: {request.seq_no})")
                return DataIngestionResponse(ok=True, accepted=0, rejected=1)

        # Apply NTP/time-drift handling
        server_now = datetime.utcnow()
        request_ts = request.timestamp
        if request_ts and request_ts.tzinfo is not None:
            request_ts = request_ts.replace(tzinfo=None)
            
        drift_seconds = abs((request_ts - server_now).total_seconds()) if request_ts else 0
        if drift_seconds > settings.max_drift_seconds:
            sensor_timestamp = server_now
            timestamp_source = "server_adjusted"
        else:
            sensor_timestamp = request_ts
            timestamp_source = "device"

        # Create sensor data record
        trace_id = str(uuid.uuid4())
        sensor_data = SensorData(
            device_id=device_id,
            device_reset_count=(request.device_reset_count or 0),
            seq_no=request.seq_no,
            ph=request.ph,
            turbidity=request.turbidity,
            tds=request.tds,
            temperature=request.temperature,
            flow_rate=request.flow_rate,
            raw_ph=request.raw_ph,
            quality_score=quality_score,
            anomaly_flags=anomaly_flags,
            timestamp=sensor_timestamp,
            received_at=server_now,
            timestamp_source=timestamp_source,
            trace_id=trace_id,
        )
        db.add(sensor_data)
        db.flush() # Assign ID to sensor_data
        
        # Call ML Service if enabled (Phase 2+)
        if settings.ml_service_enabled:
            try:
                ml_payload = {
                    "device_id": device_id,
                    "timestamp": sensor_data.timestamp.isoformat() + "Z",
                    "data": {
                        "ph": sensor_data.ph,
                        "turbidity": sensor_data.turbidity,
                        "solids": sensor_data.tds,
                        "temperature": sensor_data.temperature,
                        "flow_rate": sensor_data.flow_rate
                    }
                }
                ml_headers = {}
                if settings.ml_service_api_key:
                    ml_headers["x-api-key"] = settings.ml_service_api_key
                
                async with httpx.AsyncClient() as client:
                    ml_resp = await client.post(
                        f"{settings.ml_service_url}/predict",
                        json=ml_payload,
                        headers=ml_headers,
                        timeout=3.0
                    )
                
                if ml_resp.status_code == 200:
                    ml_data = ml_resp.json()
                    prediction = ml_data.get("prediction", 0)
                    score = ml_data.get("score", 0.0)
                    model_version = ml_data.get("model_version", "unknown")
                    
                    is_anomaly = (prediction == 1) and (score >= settings.ml_confidence_threshold)
                    decision_reason = f"ML prediction: {'Anomaly' if prediction == 1 else 'Normal'} (confidence: {score:.2f})"
                    
                    # Update sensor data anomaly flags
                    current_flags = anomaly_flags or {}
                    current_flags["ml_score"] = score
                    current_flags["ml_predicted_anomaly"] = (prediction == 1)
                    if is_anomaly:
                        current_flags["outlier"] = True
                        if "reasons" not in current_flags:
                            current_flags["reasons"] = []
                        current_flags["reasons"].append(f"ML Anomaly (confidence: {score:.2f})")
                    
                    sensor_data.anomaly_flags = current_flags
                    
                    # Log to ml_anomalies
                    ml_anomaly_rec = MLAnomaly(
                        device_id=device_id,
                        reading_id=sensor_data.id,
                        ml_score=prediction,
                        confidence=score,
                        model_version=model_version,
                        anomaly_reason=decision_reason,
                        alert_triggered=False,
                        prediction_timestamp=datetime.utcnow()
                    )
                    db.add(ml_anomaly_rec)
                    db.flush()
            except Exception as ml_err:
                logger.warning(f"Failed to run ML prediction during ingestion: {ml_err}")
        
        # Update device last_seen
        if device:
            device.last_seen = datetime.utcnow()
            device.status = "online"
        
        # Check for alerts (primary rule-based)
        alert_severity = alert_manager.get_alert_severity(quality_score)
        alert = None
        if alert_severity:
            alert_message = alert_manager.get_alert_message(quality_score, anomaly_flags)
            alert = Alert(
                device_id=device_id,
                severity=alert_severity,
                message=alert_message,
                triggered_at=datetime.utcnow(),
                reading_timestamp=request.timestamp,
            )
            db.add(alert)
            logger.warning(f"Alert for {device_id}: {alert_message}")
            db.flush()
            
        # Link ML anomaly to triggered alert if active
        if settings.ml_service_enabled and 'ml_anomaly_rec' in locals() and is_anomaly:
            # If a rule-based alert was triggered, link it; otherwise create a warnings alert
            if alert:
                ml_anomaly_rec.alert_triggered = True
                ml_anomaly_rec.alert_id = alert.id
            else:
                alert_message = f"ML WARNING: Anomaly predicted with {score:.2f} confidence"
                ml_warn = Alert(
                    device_id=device_id,
                    severity="warning",
                    message=alert_message,
                    triggered_at=datetime.utcnow(),
                    reading_timestamp=request.timestamp,
                )
                db.add(ml_warn)
                db.flush()
                ml_anomaly_rec.alert_triggered = True
                ml_anomaly_rec.alert_id = ml_warn.id
        
        db.commit()

        # Invalidate cache for this device
        try:
            invalidated = cache.invalidate_device(device_id)
            if invalidated:
                logger.info(f"Invalidated {invalidated} cache keys for {device_id}")
        except Exception:
            pass

        # Broadcast new reading to WebSocket clients (async, non-blocking)
        try:
            import asyncio
            payload = {
                "type": "reading",
                "device_id": device_id,
                "quality_score": quality_score,
                "timestamp": sensor_data.timestamp.isoformat(),
                "values": {
                    "ph": sensor_data.ph,
                    "turbidity": sensor_data.turbidity,
                    "tds": sensor_data.tds,
                    "temperature": sensor_data.temperature,
                    "flow_rate": sensor_data.flow_rate,
                }
            }
            asyncio.create_task(ws_manager.broadcast_json(payload))
        except Exception:
            pass

        # After commit, attempt to send notification (non-blocking)
        try:
            from .notifications import send_alert_notification
            if alert_severity and alert:
                # Use the same db session to check dedupe; do not block request on email send
                try:
                    send_alert_notification(db, alert)
                except Exception as e:
                    logger.warning(f"Notification sending failed: {e}")
        except Exception:
            # If import fails, skip notifications silently
            pass
        
        logger.info(
            f"Ingested reading from {device_id} (score: {quality_score}, "
            f"trace_id: {trace_id})"
        )
        
        return DataIngestionResponse(ok=True, accepted=1, rejected=0)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting sensor data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DEVICE MANAGEMENT ENDPOINTS
# ============================================================================

@app.post("/devices/{device_id}/heartbeat", response_model=DeviceHeartbeatResponse)
async def device_heartbeat(
    device_id: str,
    request: DeviceHeartbeatRequest,
    db: Session = Depends(get_db),
    auth_device_id: str = Depends(get_device_id_from_auth),
):
    """
    POST /devices/:device_id/heartbeat
    Device sends periodic heartbeat.  Response includes current server
    config_version so the device knows whether to call GET /config.
    v2: stores free_heap, queued_records, sd_usage, sensor_status flags.
    """
    try:
        if device_id != auth_device_id:
            raise HTTPException(status_code=403, detail="Device ID mismatch")
        if request.device_id != device_id:
            raise HTTPException(status_code=400, detail="Device ID mismatch in body")

        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Update core status
        device.last_heartbeat = datetime.utcnow()
        device.last_seen = datetime.utcnow()
        device.status = "online"

        if request.firmware_version:
            device.firmware_version = request.firmware_version
        if request.sd_usage_percent is not None:
            device.last_sd_usage_percent = request.sd_usage_percent
        if request.free_heap is not None:
            device.last_free_heap = request.free_heap
        if request.queued_records is not None:
            device.last_queued_records = request.queued_records

        # Log stuck-sensor flags to AuditLog if any are True
        if request.sensor_status and any(request.sensor_status.values()):
            stuck_sensors = [k for k, v in request.sensor_status.items() if v]
            audit = AuditLog(
                action="stuck_sensor_alert",
                resource_type="device",
                resource_id=device_id,
                details={"stuck": stuck_sensors},
            )
            db.add(audit)
            logger.warning(
                f"[HEARTBEAT] Device {device_id} reports stuck sensors: {stuck_sensors}"
            )

        # Determine current server config_version
        server_config_version = 0
        if device.remote_config:
            server_config_version = device.remote_config.config_version
        elif hasattr(device, 'config_version'):
            server_config_version = device.config_version

        db.commit()

        logger.info(
            f"[HB] {device_id} | heap={request.free_heap} | "
            f"queue={request.queued_records} | fw={request.firmware_version}"
        )

        return DeviceHeartbeatResponse(
            ok=True,
            server_timestamp=datetime.utcnow(),
            config_version=server_config_version,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing heartbeat: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/devices", response_model=DevicesListResponse)
async def list_devices(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    GET /devices
    Returns all devices with metadata and health state.
    """
    try:
        devices = db.query(Device).offset(skip).limit(limit).all()
        total = db.query(Device).count()
        
        return DevicesListResponse(
            devices=[DeviceResponse.model_validate(d) for d in devices],
            total=total
        )
    except Exception as e:
        logger.error(f"Error listing devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    db: Session = Depends(get_db),
):
    """Get a single device by ID."""
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return DeviceResponse.model_validate(device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting device: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/devices/provision", response_model=DeviceProvisionResponse)
async def provision_device(
    request: DeviceProvisionRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    POST /devices/provision (Admin only)
    Provision a new device: create device record, API key, and default remote config.
    """
    try:
        existing = db.query(Device).filter(Device.device_id == request.device_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Device already exists")

        device = Device(
            device_id=request.device_id,
            name=request.name,
            location=request.location,
            latitude=request.latitude,
            longitude=request.longitude,
            status="offline",
            is_active=True,
            firmware_channel="stable",
            config_version=0,
        )
        db.add(device)
        db.flush()

        # Create default remote config entry
        remote_cfg = DeviceRemoteConfig(
            device_id=request.device_id,
            sample_interval_sec=60,
            firmware_channel="stable",
            config_version=0,
        )
        db.add(remote_cfg)

        api_key, _ = create_api_key_for_device(db, request.device_id)

        qr_code = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        audit_log = AuditLog(
            action="provision",
            resource_type="device",
            resource_id=request.device_id,
            details={"name": request.name, "location": request.location},
        )
        db.add(audit_log)
        db.commit()

        logger.info(f"Provisioned device {request.device_id} with default remote config")

        return DeviceProvisionResponse(
            device_id=request.device_id,
            api_key=api_key,
            qr_code=qr_code,
            setup_url=f"https://192.168.4.1?key={api_key}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error provisioning device: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# REMOTE CONFIG ENDPOINTS (v2.0.0)
# ---------------------------------------------------------------------------

@app.get("/devices/{device_id}/config", response_model=DeviceRemoteConfigResponse)
async def get_device_remote_config(
    device_id: str,
    db: Session = Depends(get_db),
    auth_device_id: str = Depends(get_device_id_from_auth),
):
    """
    GET /devices/:device_id/config
    Device pulls its current server-side config when config_version has changed.
    Called by ESP32 firmware v2.0.0 after heartbeat indicates a newer config_version.
    """
    if device_id != auth_device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch")

    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    cfg = db.query(DeviceRemoteConfig).filter(
        DeviceRemoteConfig.device_id == device_id
    ).first()

    if not cfg:
        # Auto-create default config if missing (handles pre-v2 devices)
        cfg = DeviceRemoteConfig(
            device_id=device_id,
            sample_interval_sec=60,
            firmware_channel="stable",
            config_version=0,
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)

    return DeviceRemoteConfigResponse(
        device_id=cfg.device_id,
        config_version=cfg.config_version,
        sample_interval_sec=cfg.sample_interval_sec,
        firmware_channel=cfg.firmware_channel,
        ph_offset=cfg.ph_offset,
        turbidity_offset=cfg.turbidity_offset,
        tds_offset=cfg.tds_offset,
        temp_offset=cfg.temp_offset,
        flow_offset=cfg.flow_offset,
        updated_at=cfg.updated_at,
    )


@app.patch("/devices/{device_id}/config", response_model=DeviceRemoteConfigResponse)
async def update_device_remote_config(
    device_id: str,
    request: DeviceRemoteConfigUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    PATCH /devices/:device_id/config (Admin only)
    Update device remote config. Automatically increments config_version so the
    device will pull the new config on its next heartbeat.
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    cfg = db.query(DeviceRemoteConfig).filter(
        DeviceRemoteConfig.device_id == device_id
    ).first()
    if not cfg:
        cfg = DeviceRemoteConfig(device_id=device_id, config_version=0)
        db.add(cfg)
        db.flush()

    # Apply only supplied fields
    if request.sample_interval_sec is not None:
        cfg.sample_interval_sec = request.sample_interval_sec
    if request.firmware_channel is not None:
        cfg.firmware_channel = request.firmware_channel
    if request.ph_offset is not None:
        cfg.ph_offset = request.ph_offset
    if request.turbidity_offset is not None:
        cfg.turbidity_offset = request.turbidity_offset
    if request.tds_offset is not None:
        cfg.tds_offset = request.tds_offset
    if request.temp_offset is not None:
        cfg.temp_offset = request.temp_offset
    if request.flow_offset is not None:
        cfg.flow_offset = request.flow_offset

    # Bump version so device detects change on next heartbeat
    cfg.config_version += 1
    cfg.updated_by = str(admin_user)
    cfg.updated_at = datetime.utcnow()

    # Mirror top-level device.config_version for heartbeat response
    device.config_version = cfg.config_version

    audit = AuditLog(
        action="remote_config_update",
        resource_type="device",
        resource_id=device_id,
        details={
            "new_config_version": cfg.config_version,
            "changes": request.model_dump(exclude_none=True),
            "updated_by": str(admin_user),
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(cfg)

    logger.info(
        f"Remote config updated for {device_id} -> v{cfg.config_version} by {admin_user}"
    )

    return DeviceRemoteConfigResponse(
        device_id=cfg.device_id,
        config_version=cfg.config_version,
        sample_interval_sec=cfg.sample_interval_sec,
        firmware_channel=cfg.firmware_channel,
        ph_offset=cfg.ph_offset,
        turbidity_offset=cfg.turbidity_offset,
        tds_offset=cfg.tds_offset,
        temp_offset=cfg.temp_offset,
        flow_offset=cfg.flow_offset,
        updated_at=cfg.updated_at,
    )



# ---------------------------------------------------------------------------
# OTA / FIRMWARE ENDPOINTS (minimal implementation)
# ---------------------------------------------------------------------------

@app.post("/devices/{device_id}/firmware", response_model=FirmwareInfoResponse)
async def upload_firmware_metadata(
    device_id: str,
    request: FirmwareUploadRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    POST /devices/:device_id/firmware (Admin only)
    Register new firmware version in the Firmware table for a channel.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Deactivate previous firmware on same channel
        db.query(Firmware).filter(
            Firmware.device_id == device_id,
            Firmware.channel == getattr(request, 'channel', 'stable'),
            Firmware.is_active == True,
        ).update({"is_active": False})

        fw = Firmware(
            device_id=device_id,
            version=request.version,
            channel=getattr(request, 'channel', 'stable'),
            url=request.url,
            sha256=getattr(request, 'sha256', None),
            signature=request.signature,
            release_notes=request.release_notes,
            is_active=True,
            uploaded_at=datetime.utcnow(),
        )
        db.add(fw)

        audit = AuditLog(
            action="firmware_upload",
            resource_type="device",
            resource_id=device_id,
            details={"version": request.version, "url": request.url},
        )
        db.add(audit)
        db.commit()
        db.refresh(fw)

        return FirmwareInfoResponse(
            device_id=device_id,
            version=fw.version,
            url=fw.url,
            signature=fw.signature,
            uploaded_at=fw.uploaded_at,
            release_notes=fw.release_notes,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading firmware metadata: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices/{device_id}/firmware", response_model=FirmwareCheckResponse)
async def check_firmware_update(
    device_id: str,
    channel: str = Query("stable"),
    current_version: str = Query("0.0.0"),
    db: Session = Depends(get_db),
    auth_device_id: str = Depends(get_device_id_from_auth),
):
    """
    GET /devices/:device_id/firmware?channel=stable&current_version=2.0.0
    Called by ESP32 firmware to check if an OTA update is available for its channel.
    Returns update_available=True + download URL when a newer version exists.
    """
    if device_id != auth_device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch")

    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    fw = db.query(Firmware).filter(
        Firmware.device_id == device_id,
        Firmware.channel == channel,
        Firmware.is_active == True,
    ).order_by(Firmware.uploaded_at.desc()).first()

    if not fw:
        return FirmwareCheckResponse(
            device_id=device_id,
            update_available=False,
            current_version=current_version,
        )

    # Simple version comparison: if latest != current, update is available
    update_available = fw.version != current_version

    return FirmwareCheckResponse(
        device_id=device_id,
        update_available=update_available,
        current_version=current_version,
        latest_version=fw.version if update_available else None,
        url=fw.url if update_available else None,
        sha256=fw.sha256 if update_available else None,
        size_bytes=fw.size_bytes if update_available else None,
        release_notes=fw.release_notes if update_available else None,
    )



@app.post("/devices/firmware/upload", response_model=FirmwareInfoResponse)
async def upload_firmware(
    request: Request,
    device_id: str = Form(...),
    version: str = Form(...),
    signature: Optional[str] = Form(None),
    release_notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
):
    """
    POST /devices/firmware/upload (Admin Only)
    Uploads signed compiled .bin update to MinIO object store and registers it.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        content = await file.read()
        file_size = len(content)

        # Initialize MinIO client
        from minio import Minio
        import io
        try:
            minio_client = Minio(
                f"{settings.minio_endpoint}:{settings.minio_port}",
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=False
            )
            if not minio_client.bucket_exists(settings.minio_bucket):
                minio_client.make_bucket(settings.minio_bucket)
        except Exception as e:
            logger.error(f"MinIO init failed: {e}")
            raise HTTPException(status_code=500, detail=f"S3/MinIO service is unavailable: {e}")

        # Upload binary
        object_name = f"firmware/{device_id}/{version}/{file.filename}"
        try:
            minio_client.put_object(
                settings.minio_bucket,
                object_name,
                io.BytesIO(content),
                file_size,
                content_type="application/octet-stream"
            )
        except Exception as e:
            logger.error(f"MinIO put_object failed: {e}")
            raise HTTPException(status_code=500, detail=f"S3/MinIO upload failed: {e}")

        # Add to database
        fw = Firmware(
            device_id=device_id,
            version=version,
            url=object_name,
            signature=signature,
            release_notes=release_notes,
            uploaded_at=datetime.utcnow()
        )
        db.add(fw)
        
        # Add AuditLog entry
        audit = AuditLog(
            action="firmware_bin_upload",
            resource_type="device",
            resource_id=device_id,
            details={
                "version": version,
                "url": object_name,
                "signature": signature,
                "file_size": file_size,
            }
        )
        db.add(audit)
        db.commit()
        db.refresh(fw)

        download_url = f"{str(request.base_url).rstrip('/')}/devices/{device_id}/firmware/download?version={version}"
        return FirmwareInfoResponse(
            device_id=fw.device_id,
            version=fw.version,
            url=download_url,
            signature=fw.signature,
            uploaded_at=fw.uploaded_at,
            release_notes=fw.release_notes
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading firmware file: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices/{device_id}/firmware/latest", response_model=FirmwareInfoResponse)
async def get_latest_firmware(
    request: Request,
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    GET /devices/{device_id}/firmware/latest
    Consults the database for the newest binary version.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        fw = db.query(Firmware).filter(
            Firmware.device_id == device_id
        ).order_by(Firmware.uploaded_at.desc()).first()

        if not fw:
            raise HTTPException(status_code=404, detail="No firmware found for this device")

        download_url = f"{str(request.base_url).rstrip('/')}/devices/{device_id}/firmware/download?version={fw.version}"
        return FirmwareInfoResponse(
            device_id=fw.device_id,
            version=fw.version,
            url=download_url,
            signature=fw.signature,
            uploaded_at=fw.uploaded_at,
            release_notes=fw.release_notes
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching latest firmware: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices/{device_id}/firmware/download")
async def download_firmware(
    device_id: str,
    version: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    GET /devices/{device_id}/firmware/download
    Streams compiled firmware binary directly from MinIO object store.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        if version:
            fw = db.query(Firmware).filter(
                Firmware.device_id == device_id,
                Firmware.version == version
            ).first()
        else:
            fw = db.query(Firmware).filter(
                Firmware.device_id == device_id
            ).order_by(Firmware.uploaded_at.desc()).first()

        if not fw:
            raise HTTPException(status_code=404, detail="Firmware binary not found")

        # Initialize MinIO client
        from minio import Minio
        try:
            minio_client = Minio(
                f"{settings.minio_endpoint}:{settings.minio_port}",
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=False
            )
            data = minio_client.get_object(settings.minio_bucket, fw.url)
        except Exception as e:
            logger.error(f"MinIO get_object failed for {fw.url}: {e}")
            raise HTTPException(status_code=500, detail="Failed to retrieve binary from storage")

        from fastapi.responses import StreamingResponse
        filename = fw.url.split('/')[-1]
        return StreamingResponse(
            data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading firmware: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/devices/{device_id}/firmware/status")
async def report_firmware_status(
    device_id: str,
    request: FirmwareStatusRequest,
    db: Session = Depends(get_db)
):
    """
    POST /devices/{device_id}/firmware/status
    Report OTA results and active version. Updates device's firmware_version upon success.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Record update status in audit log
        audit = AuditLog(
            action="firmware_status",
            resource_type="device",
            resource_id=device_id,
            details={
                "status": request.status,
                "version": request.version,
                "error_message": request.error_message,
            }
        )
        db.add(audit)

        if request.status == "success":
            device.firmware_version = request.version
            logger.info(f"Device {device_id} successfully upgraded to version {request.version}")
        else:
            logger.warning(f"Device {device_id} failed firmware upgrade to {request.version}: {request.error_message}")

        db.commit()
        return {"ok": True, "status": request.status, "version": request.version}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating firmware status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/devices/{device_id}/keys/rotate", response_model=KeyRotationResponse)
async def rotate_device_key(
    device_id: str,
    request: KeyRotationRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """Rotate device key and broadcast key rotation event to WebSocket clients."""
    """
    POST /devices/:device_id/keys/rotate
    Rotate device API key (revoke old, issue new).
    Admin only.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        new_api_key, expires_at = rotate_api_key(db, device_id)
        
        # Audit log
        audit_log = AuditLog(
            action="rotate_key",
            resource_type="device",
            resource_id=device_id,
        )
        db.add(audit_log)
        db.commit()
        
        logger.info(f"Rotated API key for device {device_id}")
        
        # broadcast key rotation event
        try:
            import asyncio
            asyncio.create_task(ws_manager.broadcast_json({
                "type": "key_rotation",
                "device_id": device_id,
                "new_key_expires_at": expires_at.isoformat() if expires_at else None,
            }))
        except Exception:
            pass

        grace_days = settings.api_key_rotation_grace_days
        return KeyRotationResponse(
            new_key=new_api_key,
            old_key_revoked_in=grace_days,
            old_key_expires_at=expires_at,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rotating device key: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DATA QUERY ENDPOINTS
# ============================================================================

@app.get("/data/{device_id}", response_model=DataQueryResponse)
async def get_device_data(
    device_id: str,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    from_time: Optional[datetime] = Query(None),
    to_time: Optional[datetime] = Query(None),
):
    """GET /data/:device_id with optional Redis caching for paginated queries."""
    # Try cache key
    cache_key = f"device:{device_id}:data:{skip}:{limit}:{from_time}:{to_time}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    """
    GET /data/:device_id
    Returns readings for device, optionally filtered by time range.
    """
    try:
        query = db.query(SensorData).filter(SensorData.device_id == device_id)
        
        if from_time:
            query = query.filter(SensorData.timestamp >= from_time)
        if to_time:
            query = query.filter(SensorData.timestamp <= to_time)
        
        total = query.count()
        readings = query.order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
        result = DataQueryResponse(
            device_id=device_id,
            readings=[SensorDataResponse.model_validate(r) for r in readings],
            total=total
        )
        # Cache short-lived
        try:
            cache.set(cache_key, result.dict(), ex=30)
        except Exception:
            pass
        return result
    except Exception as e:
        logger.error(f"Error querying device data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/anomalies", response_model=AnomaliesListResponse)
async def get_anomalies(
    db: Session = Depends(get_db),
    device_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    GET /anomalies
    Get readings flagged as anomalous by rule engine or ML.
    """
    try:
        query = db.query(SensorData).filter(SensorData.anomaly_flags != None)
        
        if device_id:
            query = query.filter(SensorData.device_id == device_id)
        
        total = query.count()
        anomalies = query.order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
        
        result_anomalies = []
        for reading in anomalies:
            result_anomalies.append(AnomalyResponse(
                id=reading.id,
                device_id=reading.device_id,
                timestamp=reading.timestamp,
                values={
                    "ph": reading.ph,
                    "turbidity": reading.turbidity,
                    "tds": reading.tds,
                    "temperature": reading.temperature,
                    "flow_rate": reading.flow_rate,
                },
                anomaly_flags=reading.anomaly_flags or {}
            ))
        
        return AnomaliesListResponse(anomalies=result_anomalies, total=total)
    
    except Exception as e:
        logger.error(f"Error querying anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts", response_model=AlertsListResponse)
async def get_alerts(
    db: Session = Depends(get_db),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    GET /alerts
    Get alerts by severity/status (for escalation workflow).
    """
    try:
        query = db.query(Alert)
        
        if severity:
            query = query.filter(Alert.severity == severity)
        
        if status == "pending":
            query = query.filter(Alert.acknowledged_at == None)
        elif status == "acknowledged":
            query = query.filter(Alert.acknowledged_at != None)
        
        total = query.count()
        alerts = query.order_by(Alert.triggered_at.desc()).offset(skip).limit(limit).all()
        
        result_alerts = []
        for alert in alerts:
            minutes_unack = None
            if alert.acknowledged_at is None:
                minutes_unack = int((datetime.utcnow() - alert.triggered_at).total_seconds() / 60)
            
            result_alerts.append(AlertResponse(
                id=alert.id,
                device_id=alert.device_id,
                severity=alert.severity,
                message=alert.message,
                triggered_at=alert.triggered_at,
                reading_timestamp=alert.reading_timestamp,
                acknowledged_at=alert.acknowledged_at,
                acknowledged_by=alert.acknowledged_by,
                minutes_unacknowledged=minutes_unack,
            ))
        
        return AlertsListResponse(alerts=result_alerts, total=total)
    
    except Exception as e:
        logger.error(f"Error querying alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    request: AlertAcknowledgementRequest,
    db: Session = Depends(get_db),
):
    """
    POST /alerts/:id/acknowledge
    Mark an alert as acknowledged by user.
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = request.user_id
        alert.acknowledgement_message = request.acknowledgement_message
        
        # Audit log
        audit_log = AuditLog(
            action="acknowledge_alert",
            resource_type="alert",
            resource_id=str(alert_id),
            user_id=request.user_id,
            details={
                "device_id": alert.device_id,
                "message": request.acknowledgement_message,
            }
        )
        db.add(audit_log)
        db.commit()
        
        logger.info(f"Alert {alert_id} acknowledged by {request.user_id}")
        
        return {"ok": True, "acknowledged_at": alert.acknowledged_at}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices/{device_id}/calibration-status", response_model=CalibrationStatusResponse)
async def get_calibration_status(
    device_id: str,
    db: Session = Depends(get_db),
):
    """
    GET /devices/:device_id/calibration-status
    Check if device needs calibration.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        calibration_due_in_days = None
        needs_calibration = False
        calibration_overdue = False
        
        if device.last_calibration_at:
            days_since_calibration = (datetime.utcnow() - device.last_calibration_at).days
            calibration_due_in_days = max(0, device.calibration_interval_days - days_since_calibration)
            needs_calibration = days_since_calibration >= device.calibration_interval_days
            calibration_overdue = days_since_calibration > device.calibration_interval_days + 30
        else:
            needs_calibration = True
        
        return CalibrationStatusResponse(
            device_id=device_id,
            last_calibration_at=device.last_calibration_at,
            calibration_due_in_days=calibration_due_in_days,
            needs_calibration=needs_calibration,
            calibration_overdue=calibration_overdue,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting calibration status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict", response_model=MLPredictionResponse)
async def predict_anomaly(
    request: MLPredictionRequest,
    db: Session = Depends(get_db),
):
    """
    POST /predict
    Predict if a sensor reading is anomalous using ML ensemble (Phase 2+).
    Status: Research phase, not for primary alerts yet.
    """
    if not settings.ml_service_enabled:
        raise HTTPException(
            status_code=503,
            detail="ML service not enabled. Use rule-based scoring instead."
        )
    
    try:
        payload = {
            "device_id": request.device_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "data": {
                "ph": request.ph,
                "hardness": request.hardness,
                "solids": request.solids,
                "chloramines": request.chloramines,
                "sulfate": request.sulfate,
                "conductivity": request.conductivity,
                "organic_carbon": request.organic_carbon,
                "trihalomethanes": request.trihalomethanes,
                "turbidity": request.turbidity
            }
        }
        
        headers = {}
        if settings.ml_service_api_key:
            headers["x-api-key"] = settings.ml_service_api_key
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ml_service_url}/predict",
                json=payload,
                headers=headers,
                timeout=5.0
            )
            
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"ML Service error: {response.text}")
            
        res_data = response.json()
        prediction = res_data.get("prediction", 0)
        score = res_data.get("score", 0.0)
        model_version = res_data.get("model_version", "unknown")
        
        is_anomaly = (prediction == 1) and (score >= settings.ml_confidence_threshold)
        decision_reason = f"ML anomaly prediction (prediction: {prediction}, score: {score:.2f}, version: {model_version})"
        
        return MLPredictionResponse(
            device_id=request.device_id,
            is_anomaly=is_anomaly,
            confidence=score,
            ml_score=prediction,
            timestamp=datetime.utcnow(),
            model_version=model_version,
            decision_reason=decision_reason
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ML prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Calibration endpoints
from .schemas import CalibrationRequest, CalibrationResponse

@app.post("/devices/{device_id}/calibrate", response_model=CalibrationResponse)
async def post_calibration(
    device_id: str,
    request: CalibrationRequest,
    db: Session = Depends(get_db),
    auth_device_id: str = Depends(get_device_id_from_auth),
):
    """
    POST /devices/:device_id/calibrate
    Submit calibration offsets (admin or device). Stores offsets in device.calibration_offsets and updates last_calibration_at.
    """
    try:
        # For now, allow device-authenticated calibration or admin callers.
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        device.calibration_offsets = request.offsets
        device.last_calibration_at = request.calibrated_at or datetime.utcnow()
        db.commit()

        return CalibrationResponse(
            device_id=device_id,
            offsets=device.calibration_offsets or {},
            last_calibrated_at=device.last_calibration_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving calibration: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
    )
