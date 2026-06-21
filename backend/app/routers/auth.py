import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, Device, AuditLog, Alert
from ..schemas import KeyRotationRequest, KeyRotationResponse, AccessRequest
from ..auth import rotate_api_key
from ..config import settings
from ..security import token_endpoint, get_current_admin
from ..main import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# Proxy security token endpoints
router.post("/auth/token")(token_endpoint)
router.post("/auth/login")(token_endpoint)

@router.post("/auth/logout")
async def logout():
    return {"ok": True}

@router.post("/auth/request-access")
async def request_access(request: AccessRequest, db: Session = Depends(get_db)):
    # Find the first device to associate the alert with, or default to HYDRO_001
    device = db.query(Device).first()
    device_id = device.device_id if device else "HYDRO_001"
    
    alert = Alert(
        device_id=device_id,
        severity="warning",
        message=f"Access Request: {request.name} ({request.email}) requests {request.role} role. Reason: {request.reason}",
        triggered_at=datetime.utcnow(),
    )
    db.add(alert)
    db.commit()
    
    # Audit log entry
    audit = AuditLog(
        action="request_access",
        resource_type="user",
        resource_id=request.email,
        details={"name": request.name, "role": request.role, "reason": request.reason}
    )
    db.add(audit)
    db.commit()
    
    # Broadcast alert via websocket
    try:
        await ws_manager.broadcast_json({
            "type": "new_alert",
            "message": alert.message,
            "severity": alert.severity
        })
    except Exception:
        pass
        
    return {"ok": True, "message": "Access request submitted successfully. The Super Administrator has been notified."}

@router.post("/devices/{device_id}/keys/rotate", response_model=KeyRotationResponse)
async def rotate_device_key(
    device_id: str,
    request: KeyRotationRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
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
