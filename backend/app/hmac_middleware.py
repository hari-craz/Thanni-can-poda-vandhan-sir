"""
Hydronix Backend — HMAC-SHA256 signature validation middleware.

Every request from an ESP32 device (identified by X-API-Key) is expected to carry:
    X-API-Key:   <device api key>
    X-Timestamp: <unix epoch seconds (UTC)>
    X-Nonce:     <8-hex-char random string>
    X-Signature: <HMAC-SHA256 hex of signing message>

Signing message format (matches firmware v2.0.0):
    METHOD\\nPATH\\nTIMESTAMP\\nNONCE\\nBODY_SHA256

Validation rules:
  1. X-Timestamp must be within ±HMAC_TIMESTAMP_TOLERANCE_SEC of server UTC.
  2. X-Nonce must not have been seen within the past NONCE_TTL_SEC seconds
     (Redis nonce dedup set).  Falls back to allowing if Redis unavailable.
  3. HMAC-SHA256 of signing message (keyed by raw api_key) must match
     X-Signature.

Non-device routes (admin, auth, dashboard) are excluded from HMAC check via
the HMAC_EXEMPT_PREFIXES list — they still require their own JWT/admin auth.
"""

import hashlib
import hmac
import logging
import time
from typing import Optional
from .time_sync import time_synchronizer

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ── Tuning constants ──────────────────────────────────────────────────────────
HMAC_TIMESTAMP_TOLERANCE_SEC = 300   # ±5 minutes
NONCE_TTL_SEC                = 600   # 10 minutes dedup window
NONCE_KEY_PREFIX             = "hmac:nonce:"

# Routes that bypass HMAC check (admin/dashboard endpoints)
HMAC_EXEMPT_PREFIXES = (
    "/auth/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/health",
    "/status",
    "/static",
    "/devices/provision",
    "/admin",
    "/users",
    "/alerts",          # alert management is admin-only (JWT guarded)
    "/anomalies",
    "/predict",
)


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256_hex(key: str, message: str) -> str:
    return hmac.new(
        key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class HMACSignatureMiddleware(BaseHTTPMiddleware):
    """
    Validates HMAC-SHA256 request signatures sent by ESP32 firmware v2.0.0.

    Constructor args:
        app:         Starlette/FastAPI app
        cache:       RedisCache instance (for nonce dedup; None = dedup skipped)
        get_api_key: async callable(request) -> Optional[str] raw api_key string,
                     used as the HMAC signing key.
                     Typically resolves X-API-Key header via Redis/DB lookup.
    """

    def __init__(self, app, *, cache=None, get_raw_api_key_fn=None):
        super().__init__(app)
        self._cache = cache
        self._get_raw_key = get_raw_api_key_fn  # callable(x_api_key: str) -> str|None

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip HMAC for non-device routes
        if any(path.startswith(p) for p in HMAC_EXEMPT_PREFIXES):
            return await call_next(request)

        # Skip if no X-API-Key header — other auth layers will reject appropriately
        x_api_key = request.headers.get("X-API-Key", "")
        if not x_api_key:
            return await call_next(request)

        # Pull HMAC headers
        x_timestamp = request.headers.get("X-Timestamp", "")
        x_nonce     = request.headers.get("X-Nonce", "")
        x_signature = request.headers.get("X-Signature", "")

        # ── Graceful degradation: if firmware didn't send HMAC headers ──────────
        # This allows old firmware (v1.x) to still work during rollout.
        # Remove this block after full fleet migration.
        if not x_timestamp or not x_nonce or not x_signature:
            logger.debug(
                "HMAC headers absent for %s %s — passing through (legacy device?)",
                request.method, path,
            )
            return await call_next(request)

        # ── 1. Timestamp validation ──────────────────────────────────────────────
        try:
            ts = int(x_timestamp)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid X-Timestamp — must be Unix epoch integer."},
            )

        server_now = int(time_synchronizer.get_current_time())
        drift = abs(server_now - ts)
        if drift > HMAC_TIMESTAMP_TOLERANCE_SEC:
            logger.warning(
                "HMAC timestamp drift %ds exceeds tolerance %ds (device=%s)",
                drift, HMAC_TIMESTAMP_TOLERANCE_SEC, x_api_key[:8],
            )
            return JSONResponse(
                status_code=401,
                content={
                    "detail": f"Request timestamp too old or too far ahead "
                              f"(drift: {drift}s, tolerance: {HMAC_TIMESTAMP_TOLERANCE_SEC}s). "
                              "Sync device clock via NTP."
                },
            )

        # ── 2. Nonce dedup (Redis) ───────────────────────────────────────────────
        if self._cache and self._cache.client:
            nonce_key = f"{NONCE_KEY_PREFIX}{x_api_key[:16]}:{x_nonce}"
            try:
                # SET NX (only if not exists) with TTL
                was_new = self._cache.client.set(
                    nonce_key, "1", ex=NONCE_TTL_SEC, nx=True
                )
                if not was_new:
                    logger.warning(
                        "Replayed nonce detected: nonce=%s device_key=%s...",
                        x_nonce, x_api_key[:8],
                    )
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Replayed request detected (duplicate nonce)."},
                    )
            except Exception as e:
                logger.warning("Redis nonce check failed (%s) — skipping dedup.", e)
        else:
            logger.debug("Redis unavailable — nonce dedup skipped for %s", path)

        # ── 3. HMAC-SHA256 signature validation ─────────────────────────────────
        # Read body (must be done before call_next consumes it)
        body_bytes = await request.body()
        body_hash  = _sha256_hex(body_bytes)

        # Look up the raw (un-hashed) API key string for signing
        raw_key: Optional[str] = None
        if self._get_raw_key:
            try:
                raw_key = await self._get_raw_key(x_api_key)
            except Exception as e:
                logger.warning("get_raw_api_key_fn raised: %s", e)

        if raw_key is None:
            # Cannot validate signature without the raw key — pass through.
            # The downstream route will still validate the key via bcrypt.
            logger.debug("Raw API key not resolvable for HMAC — skipping signature check.")
            return await call_next(request)

        sign_message = (
            f"{request.method}\n"
            f"{path}\n"
            f"{x_timestamp}\n"
            f"{x_nonce}\n"
            f"{body_hash}"
        )
        expected_sig = _hmac_sha256_hex(raw_key, sign_message)

        if not hmac.compare_digest(expected_sig, x_signature.lower()):
            logger.warning(
                "HMAC signature mismatch for %s %s (device key prefix: %s...)",
                request.method, path, x_api_key[:8],
            )
            return JSONResponse(
                status_code=401,
                content={"detail": "Request signature invalid."},
            )

        logger.debug("HMAC OK: %s %s drift=%ds", request.method, path, drift)
        return await call_next(request)
