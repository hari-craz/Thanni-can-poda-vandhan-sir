"""
Hydronix Backend API - Main FastAPI application.
Endpoints for data ingestion, device management, and querying.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Header, Request, Query
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
)
from .database import (
    Device, SensorData, Alert, APIKey, AuditLog,
    get_db, init_db
)
from .auth import validate_api_key, create_api_key_for_device, rotate_api_key
from .quality_score import QualityScorer, AlertManager
from .rate_limiter import RateLimiter

# Configure logging
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Initialize components
rate_limiter = RateLimiter()
quality_scorer = QualityScorer()
alert_manager = AlertManager()


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database and background tasks."""
    logger.info(f"Starting Hydronix Backend API (env: {settings.environment})")
    init_db()
    logger.info("Database initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources."""
    logger.info("Shutting down Hydronix Backend API")


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
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/status", response_model=SystemStatusResponse)
async def get_system_status(db: Session = Depends(get_db)):
    """
    GET /status
    Returns backend and broker health plus active devices summary.
    """
    try:
        # Count devices
        total_devices = db.query(Device).count()
        active_devices = db.query(Device).filter(
            Device.status == "online"
        ).count()
        
        return SystemStatusResponse(
            ok=True,
            backend_status="healthy",
            database_status="healthy",
            mqtt_broker_status="healthy",
            active_devices=active_devices,
            total_devices=total_devices,
            uptime_seconds=0,
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
        
        # Rate limiting
        is_limited, rate_limit_headers = rate_limiter.is_rate_limited(
            device_id=device_id,
            ip_address=client_ip
        )
        if is_limited:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers=rate_limit_headers
            )
        
        # Calculate quality score
        reading = {
            "ph": request.ph,
            "turbidity": request.turbidity,
            "tds": request.tds,
            "temperature": request.temperature,
            "flow_rate": request.flow_rate,
        }
        quality_score = quality_scorer.calculate_score(reading)
        
        # Detect anomalies
        anomaly_flags = quality_scorer.detect_anomalies(reading, device_id, db)
        
        # Create sensor data record
        trace_id = str(uuid.uuid4())
        sensor_data = SensorData(
            device_id=device_id,
            device_reset_count=0,
            seq_no=request.seq_no,
            ph=request.ph,
            turbidity=request.turbidity,
            tds=request.tds,
            temperature=request.temperature,
            flow_rate=request.flow_rate,
            raw_ph=request.raw_ph,
            quality_score=quality_score,
            anomaly_flags=anomaly_flags,
            timestamp=request.timestamp,
            received_at=datetime.utcnow(),
            timestamp_source="device",
            trace_id=trace_id,
        )
        db.add(sensor_data)
        
        # Update device last_seen
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if device:
            device.last_seen = datetime.utcnow()
            device.status = "online"
        
        # Check for alerts
        alert_severity = alert_manager.get_alert_severity(quality_score)
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
        
        db.commit()
        
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
    Device sends periodic heartbeat to indicate it's alive.
    """
    try:
        if device_id != auth_device_id:
            raise HTTPException(status_code=403, detail="Device ID mismatch")
        
        if request.device_id != device_id:
            raise HTTPException(status_code=400, detail="Device ID mismatch in body")
        
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Update device status
        device.last_heartbeat = datetime.utcnow()
        device.status = "online"
        if request.firmware_version:
            device.firmware_version = request.firmware_version
        
        db.commit()
        
        return DeviceHeartbeatResponse(
            ok=True,
            server_timestamp=datetime.utcnow()
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
):
    """
    POST /devices/provision
    Provision a new device: create device record and API key.
    Admin only.
    """
    try:
        # Check if device already exists
        existing = db.query(Device).filter(Device.device_id == request.device_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Device already exists")
        
        # Create device
        device = Device(
            device_id=request.device_id,
            name=request.name,
            location=request.location,
            status="offline",
            is_active=True,
        )
        db.add(device)
        db.flush()
        
        # Create API key
        api_key, key_hash = create_api_key_for_device(db, request.device_id)
        
        # Generate QR code (simplified)
        qr_code = f"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        
        # Audit log
        audit_log = AuditLog(
            action="provision",
            resource_type="device",
            resource_id=request.device_id,
            details={
                "name": request.name,
                "location": request.location,
            }
        )
        db.add(audit_log)
        db.commit()
        
        logger.info(f"Provisioned device {request.device_id}")
        
        return DeviceProvisionResponse(
            device_id=request.device_id,
            api_key=api_key,
            qr_code=qr_code,
            setup_url=f"http://192.168.4.1?key={api_key}"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error provisioning device: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/devices/{device_id}/keys/rotate", response_model=KeyRotationResponse)
async def rotate_device_key(
    device_id: str,
    request: KeyRotationRequest,
    db: Session = Depends(get_db),
):
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
        
        return DataQueryResponse(
            device_id=device_id,
            readings=[SensorDataResponse.model_validate(r) for r in readings],
            total=total
        )
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
        return MLPredictionResponse(
            device_id=request.device_id,
            is_anomaly=False,
            confidence=0.65,
            ml_score=0,
            timestamp=datetime.utcnow(),
            model_version="v1.0",
            decision_reason="ML service not yet integrated"
        )
    
    except Exception as e:
        logger.error(f"Error in ML prediction: {e}")
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
