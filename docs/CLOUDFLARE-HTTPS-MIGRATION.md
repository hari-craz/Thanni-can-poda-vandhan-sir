# Hydronix Backend v2.0.0 — Cloudflare HTTPS Migration

## Overview
Hydronix backend has been migrated from MQTT to HTTPS-only communication via Cloudflare Tunnel. This document summarizes the changes made.

## Changes Applied

### 1. Removed MQTT Dependency
- **File**: `backend/requirements.txt`
  - Removed: `paho-mqtt` dependency
  - All MQTT imports and usage eliminated
  
- **File**: `backend/app/mqtt_client.py`
  - Converted to stub module with deprecation warnings
  - Original MQTT client code removed
  - Maintains backward compatibility if imported accidentally

- **File**: `backend/app/ingest.py`
  - Completely rewritten for HTTPS-only ingestion
  - New `ingest_sensor_data()` function for POST endpoint handling
  - Removed: MQTT message handler, threading, MQTT client initialization
  - Added: Quality scoring, anomaly detection, device status updates

### 2. Added HTTPS Enforcement Middleware
- **File**: `backend/app/main.py`
  - New middleware: `https_enforcement_and_security_headers()`
  - Enforces HTTPS-only requests (rejects plain HTTP)
  - Redirects HTTP to HTTPS with 301 status
  - Adds security headers: HSTS, X-Content-Type-Options, X-Frame-Options, etc.
  - Includes Cloudflare Tunnel identity headers

### 3. Configuration Updates
- **File**: `backend/app/config.py`
  - Added Cloudflare Tunnel settings:
    - `cloudflare_tunnel_enabled`: Enable/disable Cloudflare integration
    - `cloudflare_tunnel_url`: Tunnel endpoint URL
    - `cloudflare_api_token`: API authentication
    - `device_api_endpoint`: Public HTTPS URL for devices to POST to
  - Added HTTPS enforcement settings:
    - `https_only`: Reject HTTP requests (default: True)
    - `force_https_redirect`: 301 redirect HTTP→HTTPS
    - `hsts_max_age_seconds`: HSTS header duration (1 year)
    - `hsts_include_subdomains`: Include subdomains in HSTS
    - `hsts_preload`: Enable browser preload list

### 4. New Cloudflare Tunnel Integration Module
- **File**: `backend/app/cloudflare_tunnel.py` (NEW)
  - `CloudflareTunnelManager` class for tunnel operations
  - `verify_tunnel_connectivity()`: Health check Cloudflare connection
  - `send_valve_command()`: Send HTTPS commands to devices
  - `get_device_endpoint()`: Generate device-specific HTTPS URLs
  - `validate_https_url()`: Enforce HTTPS-only URLs
  - `get_tunnel_status()`: Return current configuration
  - Async-friendly for FastAPI integration

### 5. Startup Initialization
- **File**: `backend/app/main.py` (startup_event)
  - New Cloudflare Tunnel initialization on startup
  - Verifies tunnel connectivity
  - Logs configuration details
  - Handles initialization failures gracefully

## API Contract Changes

### Device Communication (HTTPS-Only)
**OLD (v1.x — MQTT):**
```
Device → MQTT Broker:1883
         Topic: hydronix/readings
         JSON: { device_id, ph, turbidity, tds, temperature, flow_rate }
```

**NEW (v2.0+ — HTTPS):**
```
Device → POST https://api.hydronix.local/v2/data
Headers:
  - Content-Type: application/json
  - X-API-Key: <device_api_key>
  - X-Timestamp: <ISO-8601 UTC timestamp>
  - X-Nonce: <random nonce>
  - X-Signature: <HMAC-SHA256 signature>
  
Body:
{
  "device_id": "HYDRO_001",
  "ph": 7.2,
  "turbidity": 3.1,
  "tds": 120,
  "temperature": 25.0,
  "flow_rate": 10.5,
  "timestamp": "2026-06-17T19:54:00Z",
  "seq_no": 1
}
```

### Response Format (Unchanged)
```json
{
  "ok": true,
  "accepted": 1,
  "rejected": 0,
  "quality_score": 85,
  "device_id": "HYDRO_001",
  "trace_id": "abc-123-def"
}
```

## Security Enhancements

1. **HSTS (HTTP Strict Transport Security)**
   - 1-year max-age duration
   - Includes subdomains
   - Preload-ready for browser lists

2. **HMAC Signature Validation**
   - All POST requests must include HMAC-SHA256 signature
   - Nonce-based replay attack prevention
   - Timestamp tolerance: ±5 minutes

3. **Rate Limiting**
   - Per-device: 100 req/min
   - Per-IP: 10,000 req/hour
   - Redis-backed sliding window counters

4. **TLS Enforcement**
   - HTTP requests receive 301 redirect to HTTPS
   - `https_only=True` in config rejects plain HTTP
   - Suitable for Cloudflare Tunnel deployment

## Environment Configuration

Add these to `backend/.env` for Cloudflare deployment:

```env
# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_URL=https://hydronix-tunnel.example.com
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_TUNNEL_ID=<tunnel-uuid>

# Device API Endpoint (public URL)
DEVICE_API_ENDPOINT=https://api.hydronix.local/v2

# HTTPS Enforcement
HTTPS_ONLY=true
FORCE_HTTPS_REDIRECT=true
HSTS_MAX_AGE_SECONDS=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Optional: disable HMAC validation during migration testing
HMAC_VALIDATION_ENABLED=true
```

## Device Firmware Changes Required

Devices must be updated to send HTTPS POST requests instead of MQTT:

1. Replace MQTT client code with HTTPS HTTP client
2. Implement HMAC-SHA256 request signing (see firmware spec)
3. Update endpoint URL to `device_api_endpoint` setting
4. Include headers: `X-API-Key`, `X-Timestamp`, `X-Nonce`, `X-Signature`
5. Fallback to SD card buffering if HTTPS fails (existing behavior)
6. Test with `HMAC_VALIDATION_ENABLED=false` during transition

## Migration Path

### Phase 1: Backend Ready (COMPLETED)
- ✅ Remove MQTT dependencies
- ✅ Add HTTPS enforcement middleware
- ✅ Configure Cloudflare Tunnel
- ✅ HMAC signature validation active
- ✅ Backward compatibility: `/data` POST endpoint ready

### Phase 2: Device Updates (IN PROGRESS)
- 🔄 Update firmware to send HTTPS POST
- 🔄 Test HMAC signing implementation
- 🔄 Deploy firmware to devices in staging
- 🔄 Verify device→backend HTTPS connectivity

### Phase 3: Production Rollout
- ✅ Monitor device connectivity during migration
- ✅ Disable MQTT broker (removed from docker-compose)
- ✅ Archive MQTT configuration (mqtt/config/ retained for reference only)
- ⏳ Verify 100% device HTTPS coverage

## Testing Cloudflare Tunnel Setup

### Verify HTTPS Enforcement
```bash
# Should receive 301 redirect
curl -i http://localhost:8000/data

# Should work (direct HTTPS)
curl -i https://api.hydronix.local/v2/health
```

### Test Device Ingestion
```bash
curl -X POST https://api.hydronix.local/v2/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: hydro_HYDRO_001_abc123" \
  -H "X-Timestamp: 2026-06-17T19:54:00Z" \
  -H "X-Nonce: random-nonce-here" \
  -H "X-Signature: <hmac-sha256-here>" \
  -d '{
    "device_id": "HYDRO_001",
    "ph": 7.2,
    "turbidity": 3.1,
    "tds": 120,
    "temperature": 25.0,
    "flow_rate": 10.5,
    "timestamp": "2026-06-17T19:54:00Z",
    "seq_no": 1
  }'
```

### Check Cloudflare Tunnel Status
```bash
curl https://api.hydronix.local/v2/status
```

Expected response:
```json
{
  "ok": true,
  "backend_status": "healthy",
  "database_status": "healthy",
  "cache_status": "healthy",
  "active_devices": 5,
  "total_devices": 42,
  "transport": "https"
}
```

## Rollback Plan

If issues occur during migration:

1. **Revert Code**: Git checkout previous version with MQTT support
2. **Enable MQTT**: Uncomment paho-mqtt in requirements.txt
3. **Update Config**: Set `HMAC_VALIDATION_ENABLED=false` temporarily
4. **Restart Backend**: `docker-compose up --build backend`
5. **Device Fallback**: Devices will automatically retry MQTT if HTTPS fails

## Files Modified

- ✅ `backend/app/ingest.py` — HTTPS ingestion handler
- ✅ `backend/app/config.py` — Cloudflare & HTTPS settings
- ✅ `backend/app/main.py` — HTTPS middleware + Cloudflare init
- ✅ `backend/app/mqtt_client.py` — Deprecation stub
- ✅ `backend/requirements.txt` — Removed paho-mqtt
- ✅ `backend/app/cloudflare_tunnel.py` — NEW: Tunnel integration

## Next Steps

1. **Update Firmware**: Implement HTTPS POST in ESP32 device code
2. **Test Integration**: Run end-to-end tests with Cloudflare Tunnel
3. **Staging Deployment**: Deploy to staging environment for 2-week soak
4. **Production Rollout**: Gradual device firmware rollout to production
5. **Monitoring**: Track device connectivity and error rates during transition

---

**Version**: 2.0.0  
**Date**: 2026-06-18  
**Status**: Backend HTTPS-Ready, MQTT Broker Removed, Awaiting Full Device Firmware Rollout
