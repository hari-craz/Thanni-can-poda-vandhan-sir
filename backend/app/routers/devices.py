import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session

from ..database import (
    get_db, Device, AuditLog, DeviceRemoteConfig,
    SensorData, Alert, ValveOperation, MLAnomaly, APIKey, Firmware
)
from ..auth import validate_api_key, create_api_key_for_device
from ..config import settings
from ..schemas import (
    SystemStatusResponse,
    DevicesListResponse,
    DeviceResponse,
    DeviceProvisionRequest,
    DeviceProvisionResponse,
    DeviceRemoteConfigResponse,
    DeviceRemoteConfigUpdateRequest,
    DeviceHeartbeatResponse,
    DeviceHeartbeatRequest,
    CalibrationStatusResponse,
    CalibrationRequest,
    CalibrationResponse,
    DeviceUpdateRequest,
)
from ..main import cache, get_device_id_from_auth, get_current_admin
from ..security import get_current_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["devices"])


@router.get("/status", response_model=SystemStatusResponse)
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


@router.get("/devices", response_model=DevicesListResponse)
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


@router.get("/devices/{device_id}", response_model=DeviceResponse)
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


@router.post("/devices/provision", response_model=DeviceProvisionResponse)
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


@router.get("/devices/{device_id}/config", response_model=DeviceRemoteConfigResponse)
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


@router.patch("/devices/{device_id}/config", response_model=DeviceRemoteConfigResponse)
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


@router.post("/devices/{device_id}/heartbeat", response_model=DeviceHeartbeatResponse)
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


@router.get("/devices/{device_id}/calibration-status", response_model=CalibrationStatusResponse)
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


@router.post("/devices/{device_id}/calibrate", response_model=CalibrationResponse)
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


@router.patch("/devices/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    request: DeviceUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    PATCH /devices/{device_id}
    Update device metadata (name, location, latitude, longitude, firmware_channel, etc.).
    Admin/Superadmin only.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Update fields if provided
        if request.name is not None:
            device.name = request.name
        if request.location is not None:
            device.location = request.location
        if request.latitude is not None:
            device.latitude = request.latitude
        if request.longitude is not None:
            device.longitude = request.longitude
        if request.is_active is not None:
            device.is_active = request.is_active
        if request.firmware_channel is not None:
            device.firmware_channel = request.firmware_channel
        if request.calibration_interval_days is not None:
            device.calibration_interval_days = request.calibration_interval_days

        device.updated_at = datetime.utcnow()

        # Audit log
        audit = AuditLog(
            action="update",
            resource_type="device",
            resource_id=device_id,
            details=request.model_dump(exclude_none=True),
            user_id=admin_user,
        )
        db.add(audit)
        db.commit()
        db.refresh(device)

        logger.info(f"Device {device_id} updated by {admin_user}")
        return DeviceResponse.model_validate(device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating device {device_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/devices/{device_id}")
async def delete_device(
    device_id: str,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    DELETE /devices/{device_id}
    Delete device entirely. Cascades automatically to SensorData, Alerts, etc.
    Admin/Superadmin only.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Delete non-cascaded referencing records to avoid integrity errors
        db.query(MLAnomaly).filter(MLAnomaly.device_id == device_id).delete()

        # Delete device record (cascades to other tables)
        db.delete(device)

        # Audit log
        audit = AuditLog(
            action="delete",
            resource_type="device",
            resource_id=device_id,
            details={"name": device.name, "location": device.location},
            user_id=admin_user,
        )
        db.add(audit)
        db.commit()

        logger.info(f"Device {device_id} and all related data deleted by {admin_user}")
        return {"ok": True, "message": f"Device {device_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting device {device_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices/{device_id}/data/clear")
async def clear_device_data(
    device_id: str,
    db: Session = Depends(get_db),
    superadmin_user: str = Depends(get_current_superadmin),
):
    """
    POST /devices/{device_id}/data/clear
    Clear all telemetry data, alerts, and valve operations for a device.
    Superadmin only.
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Delete associated records
        db.query(SensorData).filter(SensorData.device_id == device_id).delete()
        db.query(Alert).filter(Alert.device_id == device_id).delete()
        db.query(ValveOperation).filter(ValveOperation.device_id == device_id).delete()
        db.query(MLAnomaly).filter(MLAnomaly.device_id == device_id).delete()

        # Reset device runtime statistics
        device.status = "offline"
        device.last_seen = datetime.utcnow()
        device.last_heartbeat = None
        device.last_free_heap = None
        device.last_queued_records = None
        device.last_sd_usage_percent = None
        device.valve_status = "open"
        device.valve_last_toggled = None
        device.valve_close_reason = None
        device.last_smoothed_readings = {}

        # Audit log
        audit = AuditLog(
            action="clear_device_data",
            resource_type="device",
            resource_id=device_id,
            user_id=superadmin_user,
        )
        db.add(audit)
        db.commit()

        logger.info(f"All data for device {device_id} cleared by Super Admin {superadmin_user}")
        return {"ok": True, "message": f"All data for device {device_id} cleared successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing data for device {device_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/database/clear")
async def clear_full_database(
    db: Session = Depends(get_db),
    superadmin_user: str = Depends(get_current_superadmin),
):
    """
    POST /admin/database/clear
    Truncate/delete all operational database tables (except users).
    Superadmin only.
    """
    try:
        # Delete from tables in order of dependency
        db.query(SensorData).delete()
        db.query(Alert).delete()
        db.query(ValveOperation).delete()
        db.query(MLAnomaly).delete()
        db.query(AuditLog).delete()
        db.query(APIKey).delete()
        db.query(DeviceRemoteConfig).delete()
        db.query(Firmware).delete()
        db.query(Device).delete()

        # Users table is intentionally kept intact.

        # Log this database reset in the clean audit logs
        audit = AuditLog(
            action="clear_database",
            resource_type="database",
            resource_id="all",
            user_id=superadmin_user,
            details={"status": "completed"}
        )
        db.add(audit)
        db.commit()

        logger.info(f"Full operational database cleared by Super Admin {superadmin_user}")
        return {"ok": True, "message": "Entire database (except users) cleared successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing full database clear: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

