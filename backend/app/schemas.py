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
                "seq_no": 9821
            }
        }


class DeviceHeartbeatRequest(BaseModel):
    """POST /devices/:device_id/heartbeat request."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    status: str = Field(..., pattern="^(online|offline)$")
    signal_strength: Optional[int] = None  # dBm
    sd_usage_percent: Optional[float] = Field(None, ge=0, le=100)
    uptime_seconds: Optional[int] = Field(None, ge=0)
    firmware_version: Optional[str] = None
    last_reading_at: Optional[datetime] = None


class DeviceProvisionRequest(BaseModel):
    """POST /devices/provision request (admin only)."""
    device_id: str = Field(..., pattern=r"^HYDRO_\d{3}$")
    name: str = Field(..., min_length=1, max_length=255)
    location: str = Field(..., min_length=1, max_length=255)


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
    status: str  # online, offline
    last_seen: datetime
    firmware_version: Optional[str]
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


class SystemStatusResponse(BaseModel):
    """Response for GET /status."""
    ok: bool
    backend_status: str  # healthy, degraded, unhealthy
    database_status: str
    mqtt_broker_status: str
    active_devices: int
    total_devices: int
    uptime_seconds: int

    class Config:
        json_schema_extra = {
            "example": {
                "ok": True,
                "backend_status": "healthy",
                "database_status": "healthy",
                "mqtt_broker_status": "healthy",
                "active_devices": 5,
                "total_devices": 10,
                "uptime_seconds": 864000
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
