"""
Solenoid valve control logic for Hydronix.

Handles automatic safety cutoff and manual remote control.
Maintains audit trail of all valve operations.
"""
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .database import Device, SensorData, ValveOperation
from .quality_score import QualityScorer

logger = logging.getLogger(__name__)


class ValveState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class ValveTrigger(str, Enum):
    AUTO_SAFETY_CUTOFF = "auto_safety_cutoff"
    MANUAL_OPERATOR = "manual_operator"
    REMOTE_COMMAND = "remote_command"


class ValveActionResult(dict):
    """
    Result of a valve action that behaves both as a dictionary (for tests)
    and as a boolean (for FastAPI route compatibility).
    """
    def __bool__(self) -> bool:
        return self.get("success", False)


class ValveController:
    """Manages solenoid valve state and operations."""
    
    # Safety thresholds for automatic cutoff
    PH_MIN = 6.5
    PH_MAX = 8.5
    TURBIDITY_MAX = 5.0  # NTU
    TDS_MAX = 500  # ppm
    TEMP_MIN = 5.0  # Celsius
    TEMP_MAX = 50.0  # Celsius
    
    # Timing constants
    VALVE_TOGGLE_LOCKOUT_SEC = 2  # Prevent rapid toggles (solenoid burnout)
    RETRY_INTERVAL_MIN = 1  # Check if conditions improved every 1 minute
    STAY_CLOSED_THRESHOLD_MIN = 5  # If bad conditions persist >5 min, alert backend
    
    def __init__(self, db: Session):
        self.db = db
        self.scorer = QualityScorer()
    
    def should_auto_cutoff(self, 
                          ph: float, 
                          turbidity: float, 
                          tds: float, 
                          temperature: float) -> Tuple[bool, Optional[str]]:
        """
        Determine if valve should auto-close based on quality thresholds.
        
        Returns: (should_close, reason_string)
        """
        if ph < self.PH_MIN:
            return True, f"pH too low ({ph})"
        if ph > self.PH_MAX:
            return True, f"pH too high ({ph})"
        if turbidity > self.TURBIDITY_MAX:
            return True, f"Turbidity too high ({turbidity} NTU)"
        if tds > self.TDS_MAX:
            return True, f"TDS too high ({tds} ppm)"
        if temperature < self.TEMP_MIN:
            return True, f"Temperature too low ({temperature}°C)"
        if temperature > self.TEMP_MAX:
            return True, f"Temperature too high ({temperature}°C)"
        
        return False, None
    
    def check_valve_state_needed(self,
                                 device_id: str,
                                 ph: float,
                                 turbidity: float,
                                 tds: float,
                                 temperature: float,
                                 quality_score: int,
                                 current_valve_state: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Determine if valve state change is needed for this reading.
        
        Returns: (new_state or None, reason or None)
        """
        should_close, close_reason = self.should_auto_cutoff(ph, turbidity, tds, temperature)
        
        if should_close and current_valve_state == ValveState.OPEN:
            # Valve is open but conditions are unsafe -> close it
            return ValveState.CLOSED, close_reason
        
        if not should_close and current_valve_state == ValveState.CLOSED:
            # Conditions improved and valve is closed -> try to re-open
            return ValveState.OPEN, "Conditions improved, re-opening valve"
        
        # No change needed
        return None, None
    
    def log_valve_operation(self,
                           device_id: str,
                           action: str,  # 'open' or 'close'
                           triggered_by: str,  # ValveTrigger enum
                           quality_score: Optional[int] = None,
                           reason: Optional[str] = None,
                           operator_id: Optional[str] = None,
                           device_timestamp: Optional[datetime] = None) -> ValveOperation:
        """
        Record a valve operation in the database for audit trail.
        """
        op = ValveOperation(
            device_id=device_id,
            action=action,
            triggered_by=triggered_by,
            quality_score_at_trigger=quality_score,
            reason=reason,
            operator_id=operator_id,
            timestamp=device_timestamp or datetime.utcnow()
        )
        self.db.add(op)
        self.db.commit()
        
        logger.info(
            f"Valve operation logged: device={device_id}, action={action}, "
            f"triggered_by={triggered_by}, reason={reason}"
        )
        
        return op
    
    def execute_valve_action(self,
                            device_id: str,
                            action: str,  # 'open' or 'close'
                            triggered_by: str,
                            quality_score: Optional[int] = None,
                            reason: Optional[str] = None,
                            operator_id: Optional[str] = None) -> ValveActionResult:
        """
        Execute a valve state change and log it.
        
        Returns: ValveActionResult dict indicating success or failure
        """
        device = self.db.query(Device).filter_by(device_id=device_id).first()
        if not device:
            logger.error(f"Device {device_id} not found for valve control")
            return ValveActionResult(success=False, message=f"Device {device_id} not found")
        
        # Check if too soon since last toggle (debounce)
        if device.valve_last_toggled:
            elapsed_sec = (datetime.utcnow() - device.valve_last_toggled).total_seconds()
            if elapsed_sec < self.VALVE_TOGGLE_LOCKOUT_SEC:
                msg = f"Valve toggle rate limited for {device_id}: only {elapsed_sec:.1f}s since last toggle"
                logger.warning(msg)
                return ValveActionResult(success=False, message=msg)

        # Normalize action into valid valve operation value ('open' or 'close')
        normalized_action = None
        normalized_state = None
        
        if action == "close":
            normalized_action = "close"
            normalized_state = ValveState.CLOSED.value
        elif action == "open":
            normalized_action = "open"
            normalized_state = ValveState.OPEN.value
        elif action in ("open", "close"):
            normalized_action = action
            normalized_state = ValveState.OPEN.value if action == "open" else ValveState.CLOSED.value
        else:
            logger.error(f"Invalid valve action '{action}' for device {device_id}")
            return ValveActionResult(success=False, message=f"Invalid valve action '{action}'")
        
        # Update device valve state
        device.valve_status = normalized_state
        device.valve_last_toggled = datetime.utcnow()
        device.valve_close_reason = triggered_by if normalized_state == ValveState.CLOSED.value else None
        self.db.add(device)
        
        # Log the operation (use normalized_action for database constraint compliance)
        self.log_valve_operation(
            device_id=device_id,
            action=normalized_action,
            triggered_by=triggered_by,
            quality_score=quality_score,
            reason=reason,
            operator_id=operator_id
        )
        
        self.db.commit()
        
        logger.info(
            f"Valve state changed: device={device_id}, action={normalized_action}, "
            f"triggered_by={triggered_by}"
        )
        
        return ValveActionResult(success=True, new_state=normalized_state, message="Valve state changed successfully")
    
    def get_valve_status(self, device_id: str) -> Optional[dict]:
        """Get current valve status for a device."""
        device = self.db.query(Device).filter_by(device_id=device_id).first()
        if not device:
            return None
        
        return {
            "device_id": device_id,
            "valve_state": device.valve_status or ValveState.OPEN,
            "valve_last_toggled": device.valve_last_toggled,
            "valve_close_reason": device.valve_close_reason,
            "timestamp": datetime.utcnow()
        }
    
    def get_valve_history(self, device_id: str, limit: int = 50) -> list:
        """Get recent valve operations for a device."""
        operations = self.db.query(ValveOperation).filter_by(
            device_id=device_id
        ).order_by(desc(ValveOperation.timestamp)).limit(limit).all()
        
        return operations
    
    def send_remote_command(self, device_id: str, action: str, reason: Optional[str] = None) -> dict:
        """
        Send a remote valve control command to a device.
        
        In production, this would publish to MQTT or HTTP POST to device.
        For now, we format the command that would be sent.
        """
        command = {
            "device_id": device_id,
            "action": action,  # 'open' or 'close'
            "reason": reason or "manual_operator_request",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        logger.info(f"Remote valve command formatted: {command}")
        
        # TODO: Publish to MQTT or HTTP POST to device
        # Example: mqtt_client.publish(f"hydronix/{device_id}/valve/command", json.dumps(command))
        
        return command


# Singleton instance
_valve_controller: Optional[ValveController] = None


def get_valve_controller(db: Session) -> ValveController:
    """Get or create valve controller instance."""
    global _valve_controller
    if _valve_controller is None:
        _valve_controller = ValveController(db)
    return _valve_controller
