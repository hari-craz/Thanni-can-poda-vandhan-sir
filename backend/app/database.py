from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime,
    JSON, ForeignKey, UniqueConstraint, CheckConstraint, Index, BigInteger, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from .config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    """Device (ESP32 unit) metadata and status."""
    __tablename__ = "devices"
    
    device_id = Column(String(50), primary_key=True)
    name = Column(String(255))
    location = Column(String(255))
    status = Column(String(20), default="offline", nullable=False)  # online, offline
    last_seen = Column(DateTime, default=datetime.utcnow)
    last_heartbeat = Column(DateTime)
    last_calibration_at = Column(DateTime)
    calibration_interval_days = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    firmware_version = Column(String(50))
    device_reset_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Calibration offsets and last smoothed readings stored as JSON
    calibration_offsets = Column(JSON, default={})
    last_smoothed_readings = Column(JSON, default={})

    sensor_data = relationship("SensorData", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="device", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("device_id ~ '^HYDRO_[0-9]{3}$'", name='check_device_id_format'),
        CheckConstraint("status IN ('online', 'offline')", name='check_status'),
    )


class APIKey(Base):
    """API keys for device authentication."""
    __tablename__ = "api_keys"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    name = Column(String(100))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    device = relationship("Device", back_populates="api_keys")


class SensorData(Base):
    """Raw and processed sensor readings."""
    __tablename__ = "sensor_data"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    device_reset_count = Column(Integer, default=0)
    seq_no = Column(BigInteger)
    ph = Column(Float)
    turbidity = Column(Float)
    tds = Column(Float)
    temperature = Column(Float)
    flow_rate = Column(Float)
    raw_ph = Column(Float)
    quality_score = Column(Integer, default=0)
    anomaly_flags = Column(JSON)  # e.g., {"out_of_range": true, "stuck": false}
    timestamp = Column(DateTime, nullable=False)  # Device UTC timestamp
    received_at = Column(DateTime, default=datetime.utcnow)  # Server receive time
    timestamp_source = Column(String(20), default="device")  # device, server_adjusted, server_only
    trace_id = Column(String(36))  # UUID for debugging request flow
    
    device = relationship("Device", back_populates="sensor_data")
    
    __table_args__ = (
        UniqueConstraint('device_id', 'device_reset_count', 'seq_no', name='unique_device_reading'),
        CheckConstraint("timestamp_source IN ('device', 'server_adjusted', 'server_only')", name='check_timestamp_source'),
        Index('idx_device_timestamp', 'device_id', 'timestamp'),
        Index('idx_timestamp', 'timestamp'),
        Index('idx_device_id', 'device_id'),
    )


class Alert(Base):
    """Alert events triggered by anomalies or threshold violations."""
    __tablename__ = "alerts"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    severity = Column(String(20), nullable=False)  # warning, critical, emergency
    message = Column(Text)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    reading_timestamp = Column(DateTime)
    acknowledged_at = Column(DateTime)
    acknowledged_by = Column(String(100))
    acknowledgement_message = Column(Text)
    escalation_level = Column(Integer, default=0)
    
    device = relationship("Device", back_populates="alerts")
    
    __table_args__ = (
        CheckConstraint("severity IN ('warning', 'critical', 'emergency')", name='check_alert_severity'),
        Index('idx_device_alert_status', 'device_id', 'triggered_at'),
    )


class AuditLog(Base):
    """Audit trail for security-critical operations."""
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(100))
    action = Column(String(100), nullable=False)  # provision, rotate_key, acknowledge_alert, etc.
    resource_type = Column(String(50))  # device, api_key, alert, etc.
    resource_id = Column(String(100))
    details = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))
    
    __table_args__ = (
        Index('idx_user_action', 'user_id', 'action'),
        Index('idx_resource', 'resource_type', 'resource_id'),
    )


def get_db():
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
