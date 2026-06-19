import logging
import io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, Form, UploadFile, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db, Device, Firmware, AuditLog
from ..config import settings
from ..schemas import (
    FirmwareUploadRequest,
    FirmwareInfoResponse,
    FirmwareStatusRequest,
    FirmwareCheckResponse,
)
from ..main import get_device_id_from_auth, get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["firmware"])


@router.post("/devices/{device_id}/firmware", response_model=FirmwareInfoResponse)
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


@router.get("/devices/{device_id}/firmware", response_model=FirmwareCheckResponse)
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


@router.post("/devices/firmware/upload", response_model=FirmwareInfoResponse)
async def upload_firmware(
    request: Request,
    device_id: str = Form(...),
    version: str = Form(...),
    signature: Optional[str] = Form(None),
    release_notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
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


@router.get("/devices/{device_id}/firmware/latest", response_model=FirmwareInfoResponse)
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


@router.get("/devices/{device_id}/firmware/download")
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


@router.post("/devices/{device_id}/firmware/status")
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
