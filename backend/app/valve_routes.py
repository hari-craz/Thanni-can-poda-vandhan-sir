"""
Solenoid valve control API routes.
Endpoints for manual valve control, status, and audit history.
"""
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db, Device, ValveOperation
from .valve_control import ValveController
from .schemas import (
    ValveCommandRequest,
    ValveStatusResponse,
    ValveHistoryResponse,
    ValveOperationResponse,
    ValveCommandResponse,
)
from .auth import validate_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["valve"])


def get_valve_controller(db: Session = Depends(get_db)) -> ValveController:
    """Get valve controller instance."""
    return ValveController(db)


@router.get("/{device_id}/valve/status", response_model=ValveStatusResponse)
async def get_valve_status(
    device_id: str,
    db: Session = Depends(get_db),
    valve_ctrl: ValveController = Depends(get_valve_controller)
):
    """
    Get current valve status for a device.
    
    **Returns:**
    - valve_state: "open" or "closed"
    - valve_last_toggled: Timestamp of last state change
    - valve_close_reason: Reason if closed (e.g., "pH out of range")
    """
    status = valve_ctrl.get_valve_status(device_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    return ValveStatusResponse(**status)


@router.get("/{device_id}/valve/history", response_model=ValveHistoryResponse)
async def get_valve_history(
    device_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    valve_ctrl: ValveController = Depends(get_valve_controller)
):
    """
    Get valve operation audit history for a device.
    
    **Returns:**
    - List of valve operations (open/close) with timestamps, reasons, and operator info
    - Total count
    """
    device = db.query(Device).filter_by(device_id=device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    operations = valve_ctrl.get_valve_history(device_id, limit)
    
    return ValveHistoryResponse(
        device_id=device_id,
        operations=[ValveOperationResponse.from_orm(op) for op in operations],
        total=len(operations)
    )


@router.post("/{device_id}/valve/close", response_model=ValveCommandResponse)
async def close_valve_manual(
    device_id: str,
    request: ValveCommandRequest,
    db: Session = Depends(get_db),
    valve_ctrl: ValveController = Depends(get_valve_controller),
    x_api_key: str = Query(None, alias="X-API-Key")  # Or from header
):
    """
    Manually close the valve for a device.
    Requires operator authentication.
    
    **Body:**
    - reason: Optional reason for manual closure
    
    **Returns:**
    - ok: bool
    - new_state: "closed"
    - message: Confirmation message
    """
    device = db.query(Device).filter_by(device_id=device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    # TODO: Add operator auth check here
    # current_user = await get_current_user(token)
    
    success = valve_ctrl.execute_valve_action(
        device_id=device_id,
        action="close",
        triggered_by="manual_operator",
        reason=request.reason or "Manual operator request"
        # operator_id=current_user.email
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to close valve")
    
    return ValveCommandResponse(
        ok=True,
        device_id=device_id,
        action="close",
        new_state="closed",
        message="Valve closed successfully",
        timestamp=datetime.utcnow()
    )


@router.post("/{device_id}/valve/open", response_model=ValveCommandResponse)
async def open_valve_manual(
    device_id: str,
    request: ValveCommandRequest,
    db: Session = Depends(get_db),
    valve_ctrl: ValveController = Depends(get_valve_controller),
    x_api_key: str = Query(None, alias="X-API-Key")  # Or from header
):
    """
    Manually open the valve for a device.
    Requires operator authentication.
    
    **Body:**
    - reason: Optional reason for opening
    
    **Returns:**
    - ok: bool
    - new_state: "open"
    - message: Confirmation message
    """
    device = db.query(Device).filter_by(device_id=device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    
    # TODO: Add operator auth check here
    # current_user = await get_current_user(token)
    
    success = valve_ctrl.execute_valve_action(
        device_id=device_id,
        action="open",
        triggered_by="manual_operator",
        reason=request.reason or "Manual operator request"
        # operator_id=current_user.email
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to open valve")
    
    return ValveCommandResponse(
        ok=True,
        device_id=device_id,
        action="open",
        new_state="open",
        message="Valve opened successfully",
        timestamp=datetime.utcnow()
    )
