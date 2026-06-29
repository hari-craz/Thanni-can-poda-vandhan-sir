from pydantic import BaseModel, Field, validator, conlist
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class AlertSeverity(str, Enum):
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class TimestampSource(str, Enum):
    DEVICE = "device"
    SERVER_ADJUSTED = "server_adjusted"
    SERVER_ONLY = "server_only"


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class SensorDataIngestionRequest(BaseModel):
    """POST /data request schema (single reading)."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    ph: float = Field(..., ge=0, le=14)
    turbidity: float = Field(..., ge=0, le=1000)
    tds: float = Field(..., ge=0, le=10000)
    temperature: float = Field(..., ge=-50, le=150)
    flow_rate: float = Field(..., ge=0, le=10000)
    timestamp: datetime
    seq_no: Optional[int] = Field(None, ge=0)
    device_reset_count: Optional[int] = Field(0, ge=0)
    raw_ph: Optional[float] = None
    # Valve status fields
    valve_state: Optional[str] = Field(None, pattern="^(open|closed)$")
    valve_last_toggled: Optional[datetime] = None

    @validator('device_id')
    def validate_device_id(cls, v):
        if not v.startswith('HYDRO_'):
            raise ValueError('device_id must start with HYDRO_')
        return v

    class Config:
        json_json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "ph": 7.2,
                "turbidity": 3.1,
                "tds": 120,
                "temperature": 25.0,
                "flow_rate": 10.5,
                "timestamp": "2026-06-14T21:30:00Z",
                "seq_no": 9821,
                "valve_state": "open",
                "valve_last_toggled": "2026-06-14T21:15:00Z"
            }
        }


class DeviceHeartbeatRequest(BaseModel):
    """POST /devices/:device_id/heartbeat request (v2 firmware)."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    status: str = Field(..., pattern="^(online|offline)$")
    signal_strength: Optional[int] = None          # dBm
    sd_usage_percent: Optional[float] = Field(None, ge=0, le=100)
    sd_total_bytes: Optional[int] = Field(None, ge=0)
    sd_used_bytes: Optional[int] = Field(None, ge=0)
    uptime_seconds: Optional[int] = Field(None, ge=0)
    firmware_version: Optional[str] = None
    last_reading_at: Optional[str] = None          # ISO8601 string or 'never'
    low_storage: Optional[bool] = None
    # v2 firmware additions
    free_heap: Optional[int] = Field(None, ge=0)   # bytes free on ESP32 heap
    queued_records: Optional[int] = Field(None, ge=0)  # SD offline queue depth
    config_version: Optional[int] = Field(0, ge=0)    # last known server config version
    sensor_status: Optional[Dict[str, bool]] = None   # stuck sensor flags

    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "status": "online",
                "signal_strength": -65,
                "uptime_seconds": 86400,
                "firmware_version": "2.0.0",
                "free_heap": 180000,
                "queued_records": 0,
                "config_version": 3,
                "sensor_status": {"ph_stuck": False, "turbidity_stuck": False},
            }
        }


class DeviceProvisionRequest(BaseModel):
    """POST /devices/provision request (admin only)."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    name: str = Field(..., min_length=1, max_length=255)
    location: str = Field(..., min_length=1, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)


class AlertAcknowledgementRequest(BaseModel):
    """POST /alerts/:id/acknowledge request."""
    user_id: str = Field(..., min_length=1)
    acknowledgement_message: Optional[str] = None


class KeyRotationRequest(BaseModel):
    """POST /devices/:device_id/keys/rotate request (admin only)."""
    pass  # No body needed


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class DataIngestionResponse(BaseModel):
    """Response for POST /data."""
    ok: bool
    accepted: int
    rejected: int

    class Config:
        json_schema_extra = {
            "example": {
                "ok": True,
                "accepted": 1,
                "rejected": 0
            }
        }


class ErrorResponse(BaseModel):
    """Standard error response."""
    ok: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "ok": False,
                "error": "Validation error",
                "details": {
                    "field": "ph",
                    "reason": "ph must be between 0 and 14",
                    "value": 15.5
                }
            }
        }


class DeviceHeartbeatResponse(BaseModel):
    """Response for POST /devices/:device_id/heartbeat."""
    ok: bool
    server_timestamp: datetime
    # v2 additions: tells the device what server config version is current
    config_version: int = 0
    valve_status: str = "open"


class DeviceRemoteConfigResponse(BaseModel):
    """Response for GET /devices/:device_id/config."""
    device_id: str
    config_version: int
    sample_interval_sec: int
    firmware_channel: str
    ph_offset: float
    turbidity_offset: float
    tds_offset: float
    temp_offset: float
    flow_offset: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "config_version": 4,
                "sample_interval_sec": 60,
                "firmware_channel": "stable",
                "ph_offset": -0.05,
                "turbidity_offset": 0.0,
                "tds_offset": 2.0,
                "temp_offset": 0.0,
                "flow_offset": 0.0,
            }
        }


class DeviceRemoteConfigUpdateRequest(BaseModel):
    """PATCH /devices/:device_id/config — admin sets new remote config values."""
    sample_interval_sec: Optional[int] = Field(None, ge=5, le=3600)
    firmware_channel: Optional[str] = Field(None, pattern="^(stable|beta|canary)$")
    ph_offset: Optional[float] = None
    turbidity_offset: Optional[float] = None
    tds_offset: Optional[float] = None
    temp_offset: Optional[float] = None
    flow_offset: Optional[float] = None


class DeviceUpdateRequest(BaseModel):
    """PATCH /devices/:device_id — admin/superadmin updates device profile."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    is_active: Optional[bool] = None
    firmware_channel: Optional[str] = Field(None, pattern="^(stable|beta|canary)$")
    calibration_interval_days: Optional[int] = Field(None, ge=1, le=365)


class FirmwareCheckResponse(BaseModel):
    """Response for GET /devices/:device_id/firmware — device checks for OTA update."""
    device_id: str
    update_available: bool
    current_version: str   # version device reported
    latest_version: Optional[str] = None
    url: Optional[str] = None
    sha256: Optional[str] = None
    size_bytes: Optional[int] = None
    release_notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "update_available": True,
                "current_version": "2.0.0",
                "latest_version": "2.1.0",
                "url": "https://cdn.hydronix.com/firmware/hydro_2_1_0.bin",
                "sha256": "abc123...",
                "size_bytes": 1234567,
                "release_notes": "Reliability fixes.",
            }
        }


class DeviceProvisionResponse(BaseModel):
    """Response for POST /devices/provision."""
    device_id: str
    api_key: str
    qr_code: str  # Base64 encoded PNG
    setup_url: str


# ============================================================================
# FIRMWARE / OTA SCHEMAS
# ============================================================================

class FirmwareUploadRequest(BaseModel):
    """POST /devices/:device_id/firmware - metadata for OTA update."""
    version: str = Field(..., min_length=1)
    url: str = Field(..., min_length=5)
    signature: Optional[str] = None
    release_notes: Optional[str] = None


class FirmwareInfoResponse(BaseModel):
    """Response describing latest firmware metadata."""
    device_id: str
    version: str
    url: str
    signature: Optional[str]
    uploaded_at: datetime
    release_notes: Optional[str]

    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "version": "1.2.3",
                "url": "https://cdn.example.com/firmware/hydro_1_2_3.bin",
                "signature": None,
                "uploaded_at": "2026-06-15T12:00:00Z",
                "release_notes": "Bug fixes and stability improvements"
            }
        }


class FirmwareStatusRequest(BaseModel):
    """POST /devices/:device_id/firmware/status - ESP32 OTA status report."""
    status: str = Field(..., pattern="^(success|failed)$")
    version: str = Field(..., min_length=1)
    error_message: Optional[str] = None



class KeyRotationResponse(BaseModel):
    """Response for POST /devices/:device_id/keys/rotate."""
    new_key: str
    old_key_revoked_in: int  # Days until old key expires
    old_key_expires_at: datetime


class SensorDataResponse(BaseModel):
    """Single sensor data record."""
    id: int
    device_id: str
    ph: float
    turbidity: float
    tds: float
    temperature: float
    flow_rate: float
    timestamp: datetime
    received_at: datetime
    quality_score: int
    anomaly_flags: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class DeviceResponse(BaseModel):
    """Device with metadata."""
    device_id: str
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str  # online, offline
    last_seen: datetime
    firmware_version: Optional[str]
    last_sd_usage_percent: Optional[float] = None
    last_sd_total_bytes: Optional[int] = None
    last_sd_used_bytes: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DevicesListResponse(BaseModel):
    """Response for GET /devices."""
    devices: List[DeviceResponse]
    total: int


class DataQueryResponse(BaseModel):
    """Response for GET /data/:device_id."""
    device_id: str
    readings: List[SensorDataResponse]
    total: int


class AlertResponse(BaseModel):
    """Single alert record."""
    id: int
    device_id: str
    severity: str  # warning, critical, emergency
    message: str
    triggered_at: datetime
    reading_timestamp: Optional[datetime]
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]
    minutes_unacknowledged: Optional[int] = None

    class Config:
        from_attributes = True


class AlertsListResponse(BaseModel):
    """Response for GET /alerts."""
    alerts: List[AlertResponse]
    total: int


class AnomalyResponse(BaseModel):
    """Anomalous reading response."""
    id: int
    device_id: str
    timestamp: datetime
    values: Dict[str, float]
    anomaly_flags: Dict[str, Any]

    class Config:
        from_attributes = True


class AnomaliesListResponse(BaseModel):
    """Response for GET /anomalies."""
    anomalies: List[AnomalyResponse]
    total: int


class CalibrationStatusResponse(BaseModel):
    """Response for GET /devices/:device_id/calibration-status."""
    device_id: str
    last_calibration_at: Optional[datetime]
    calibration_due_in_days: Optional[int]
    needs_calibration: bool
    calibration_overdue: bool


class CalibrationRequest(BaseModel):
    """POST /devices/:device_id/calibrate - submit calibration offsets."""
    offsets: Dict[str, float]  # e.g., {"ph": -0.05, "tds": 2}
    calibrated_at: Optional[datetime] = None


class CalibrationResponse(BaseModel):
    device_id: str
    offsets: Dict[str, float]
    last_calibrated_at: Optional[datetime]

    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "offsets": {"ph": -0.05},
                "last_calibrated_at": "2026-06-15T12:00:00Z"
            }
        }


class LiveUserResponse(BaseModel):
    """Response for a single live user session."""
    email: str
    name: str
    role: str
    last_active: float


class PublicViewerResponse(BaseModel):
    """Response for a single active public explorer session."""
    viewer_id: str
    location: str
    last_active: float


class ExplorerPingRequest(BaseModel):
    """POST /explorer/ping request."""
    viewer_id: str


class SystemStatusResponse(BaseModel):
    """Response for GET /status."""
    ok: bool
    backend_status: str        # healthy, degraded, unhealthy
    database_status: str
    cache_status: str          # redis status (replaces mqtt_broker_status)
    active_devices: int
    total_devices: int
    uptime_seconds: int
    traffic_in_mbps: float
    traffic_out_mbps: float
    cpu_usage_pct: float
    memory_usage_pct: float
    db_connections: int
    live_users: List[LiveUserResponse]
    public_viewers: List[PublicViewerResponse]
    server_timestamp: float
    transport: str = "https"  # always https in v2

    class Config:
        json_schema_extra = {
            "example": {
                "ok": True,
                "backend_status": "healthy",
                "database_status": "healthy",
                "cache_status": "healthy",
                "active_devices": 5,
                "total_devices": 10,
                "uptime_seconds": 864000,
                "traffic_in_mbps": 1.5,
                "traffic_out_mbps": 0.45,
                "cpu_usage_pct": 12.5,
                "memory_usage_pct": 42.1,
                "db_connections": 8,
                "live_users": [
                    {
                        "email": "superadmin@hydronix.local",
                        "name": "Super Administrator",
                        "role": "superadmin",
                        "last_active": 1782027219.0
                    }
                ],
                "public_viewers": [
                    {
                        "viewer_id": "guest_a4b9",
                        "location": "Adyar, Chennai",
                        "last_active": 1782027219.0
                    }
                ],
                "transport": "https",
            }
        }




# ============================================================================
# ML MODEL SCHEMAS (Phase 2+)
# ============================================================================

class MLPredictionRequest(BaseModel):
    """POST /predict request."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    ph: float = Field(..., ge=0, le=14)
    hardness: float
    solids: float
    chloramines: float
    sulfate: float
    conductivity: float
    organic_carbon: float
    trihalomethanes: float
    turbidity: float = Field(..., ge=0)


class MLPredictionResponse(BaseModel):
    """Response for POST /predict."""
    device_id: str
    is_anomaly: bool
    confidence: float = Field(..., ge=0, le=1)
    ml_score: int  # 0 or 1
    timestamp: datetime
    model_version: str
    decision_reason: str

    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "is_anomaly": False,
                "confidence": 0.78,
                "ml_score": 0,
                "timestamp": "2026-06-14T21:43:00Z",
                "model_version": "v1.0",
                "decision_reason": "Reading is normal (confidence: 0.78)"
            }
        }


# ============================================================================
# USER SCHEMAS
# ============================================================================

class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    role: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# SOLENOID VALVE SCHEMAS
# ============================================================================

class ValveCommandRequest(BaseModel):
    """POST /devices/{device_id}/valve/close or /valve/open request."""
    reason: Optional[str] = None  # Optional reason for manual operation


class ValveStatusResponse(BaseModel):
    """Response for GET /devices/{device_id}/valve/status."""
    device_id: str
    valve_state: str  # open, closed
    valve_last_toggled: Optional[datetime] = None
    valve_close_reason: Optional[str] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "valve_state": "open",
                "valve_last_toggled": "2026-06-17T20:05:00Z",
                "valve_close_reason": None,
                "timestamp": "2026-06-17T20:10:00Z"
            }
        }


class ValveOperationResponse(BaseModel):
    """Single valve operation record."""
    id: int
    device_id: str
    action: str  # open, close
    triggered_by: str  # auto_safety_cutoff, manual_operator, remote_command
    quality_score_at_trigger: Optional[int] = None
    reason: Optional[str] = None
    operator_id: Optional[str] = None
    timestamp: datetime
    received_at: datetime
    
    class Config:
        from_attributes = True


class ValveHistoryResponse(BaseModel):
    """Response for GET /devices/{device_id}/valve/history."""
    device_id: str
    operations: List[ValveOperationResponse]
    total: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "HYDRO_001",
                "operations": [
                    {
                        "id": 42,
                        "device_id": "HYDRO_001",
                        "action": "close",
                        "triggered_by": "auto_safety_cutoff",
                        "quality_score_at_trigger": 45,
                        "reason": "pH out of range (6.2)",
                        "operator_id": None,
                        "timestamp": "2026-06-17T20:05:00Z",
                        "received_at": "2026-06-17T20:05:10Z"
                    }
                ],
                "total": 1
            }
        }


class ValveCommandResponse(BaseModel):
    """Response for POST /devices/{device_id}/valve/close or /open."""
    ok: bool
    device_id: str
    action: str  # close or open
    new_state: str  # open or closed
    message: str
    timestamp: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "ok": True,
                "device_id": "HYDRO_001",
                "action": "close",
                "new_state": "closed",
                "message": "Valve closed successfully",
                "timestamp": "2026-06-17T20:05:00Z"
            }
        }


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogsListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int


class AccessRequest(BaseModel):
    name: str
    email: str
    role: str
    reason: str


