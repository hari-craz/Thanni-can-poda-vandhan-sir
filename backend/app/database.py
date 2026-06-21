import sys
import os
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime,
    JSON, ForeignKey, UniqueConstraint, CheckConstraint, Index, BigInteger, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from .config import settings

is_testing = "pytest" in sys.modules or os.environ.get("TESTING") is not None


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """User accounts for web/admin access."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="admin") # superadmin, admin
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint("role IN ('superadmin', 'admin', 'user')", name='check_user_role'),
    )


class Device(Base):
    """Device (ESP32 unit) metadata and status."""
    __tablename__ = "devices"

    device_id = Column(String(50), primary_key=True)
    name = Column(String(255))
    location = Column(String(255))
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String(20), default="offline", nullable=False)  # online, offline
    last_seen = Column(DateTime, default=datetime.utcnow)
    last_heartbeat = Column(DateTime)
    last_calibration_at = Column(DateTime)
    calibration_interval_days = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    firmware_version = Column(String(50))
    firmware_channel = Column(String(20), default="stable")  # stable | beta | canary
    device_reset_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Calibration offsets and last smoothed readings stored as JSON
    calibration_offsets = Column(JSON, default={})
    last_smoothed_readings = Column(JSON, default={})
    # Remote-config versioning — incremented by admin when config is pushed
    config_version = Column(Integer, default=0, nullable=False)
    # Diagnostic fields from v2 firmware heartbeats
    last_free_heap = Column(Integer)       # bytes
    last_queued_records = Column(Integer)  # SD queue depth
    last_sd_usage_percent = Column(Float)
    # Solenoid valve fields
    valve_status = Column(String(20), default="open", nullable=False)  # open, closed
    valve_last_toggled = Column(DateTime)
    valve_close_reason = Column(String(255))  # auto_safety_cutoff, manual_operator, remote_command

    sensor_data = relationship("SensorData", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="device", cascade="all, delete-orphan")
    firmwares = relationship("Firmware", back_populates="device", cascade="all, delete-orphan")
    remote_config = relationship("DeviceRemoteConfig", back_populates="device",
                                 uselist=False, cascade="all, delete-orphan")
    valve_operations = relationship("ValveOperation", back_populates="device", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("device_id LIKE 'HYDRO_%'", name='check_device_id_format'),
        CheckConstraint("status IN ('online', 'offline')", name='check_status'),
        CheckConstraint("valve_status IN ('open', 'closed')", name='check_valve_status'),
        CheckConstraint(
            "firmware_channel IN ('stable', 'beta', 'canary')",
            name='check_firmware_channel',
        ),
    )


class APIKey(Base):
    """API keys for device authentication."""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False, index=True)
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
    
    id = Column(Integer, primary_key=True, autoincrement=True)
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
    timestamp = Column(DateTime, primary_key=not is_testing, nullable=False)  # Device UTC timestamp, part of composite primary key only in prod
    received_at = Column(DateTime, default=datetime.utcnow)  # Server receive time
    timestamp_source = Column(String(20), default="device")  # device, server_adjusted, server_only
    trace_id = Column(String(36))  # UUID for debugging request flow
    # Solenoid valve fields
    valve_state = Column(String(20))  # open, closed (from device report)
    valve_last_toggled = Column(DateTime)  # Last time valve state changed
    
    device = relationship("Device", back_populates="sensor_data")
    
    __table_args__ = (
        UniqueConstraint('device_id', 'device_reset_count', 'seq_no', 'timestamp', name='unique_device_reading'),
        CheckConstraint("timestamp_source IN ('device', 'server_adjusted', 'server_only')", name='check_timestamp_source'),
        Index('idx_device_timestamp', 'device_id', 'timestamp'),
        Index('idx_timestamp', 'timestamp'),
        Index('idx_device_id', 'device_id'),
        {
            'postgresql_partition_by': 'RANGE (timestamp)'
        }
    )


class Alert(Base):
    """Alert events triggered by anomalies or threshold violations."""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
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
    
    id = Column(Integer, primary_key=True, autoincrement=True)
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


class MLAnomaly(Base):
    """Tracking of ML anomalies for monitoring and model validation."""
    __tablename__ = "ml_anomalies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    reading_id = Column(Integer, nullable=True)  # Logical FK to sensor_data.id
    ml_score = Column(Integer, default=0)  # 0 or 1
    confidence = Column(Float)
    model_version = Column(String(50))
    anomaly_reason = Column(String(255))
    alert_triggered = Column(Boolean, default=False)
    prediction_timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_ml_device', 'device_id'),
    )


class ValveOperation(Base):
    """Audit trail for all solenoid valve state changes (auto and manual)."""
    __tablename__ = "valve_operations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    action = Column(String(10), nullable=False)  # open, close
    triggered_by = Column(String(50), nullable=False)  # auto_safety_cutoff, manual_operator, remote_command
    quality_score_at_trigger = Column(Integer)  # Quality score when valve toggled
    reason = Column(Text)  # Human-readable reason (e.g., "pH out of range (6.2)")
    operator_id = Column(String(100))  # User email if manual action
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)  # When action occurred (device time)
    received_at = Column(DateTime, default=datetime.utcnow)  # Server receive time
    
    device = relationship("Device", back_populates="valve_operations")
    
    __table_args__ = (
        CheckConstraint("action IN ('open', 'close')", name='check_valve_action'),
        CheckConstraint("triggered_by IN ('auto_safety_cutoff', 'manual_operator', 'remote_command')", name='check_valve_trigger'),
        Index('idx_valve_device_timestamp', 'device_id', 'timestamp'),
        Index('idx_valve_device', 'device_id'),
    )


class Firmware(Base):
    """Firmware packages uploaded for OTA updates."""
    __tablename__ = "firmwares"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=False)
    version = Column(String(50), nullable=False)
    channel = Column(String(20), default="stable")   # stable | beta | canary
    url = Column(String(512), nullable=False)
    sha256 = Column(String(64))                       # SHA-256 of the binary
    signature = Column(String(255))
    size_bytes = Column(Integer)
    release_notes = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)         # Only active firmware is served

    device = relationship("Device", back_populates="firmwares")

    __table_args__ = (
        CheckConstraint(
            "channel IN ('stable', 'beta', 'canary')",
            name='check_firmware_channel',
        ),
        Index('idx_firmware_device_channel', 'device_id', 'channel'),
    )


class DeviceRemoteConfig(Base):
    """
    Server-side configuration that devices pull via GET /devices/{id}/config.
    Edited by admins; version is bumped on every change.
    ESP32 firmware compares its cached config_version with the heartbeat
    response and pulls a fresh config when behind.
    """
    __tablename__ = "device_remote_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(
        String(50), ForeignKey("devices.device_id"),
        nullable=False, unique=True,
    )
    # Operational config pushed to device
    sample_interval_sec = Column(Integer, default=60)
    firmware_channel = Column(String(20), default="stable")
    ph_offset = Column(Float, default=0.0)
    turbidity_offset = Column(Float, default=0.0)
    tds_offset = Column(Float, default=0.0)
    temp_offset = Column(Float, default=0.0)
    flow_offset = Column(Float, default=0.0)
    # Version counter — increment to push new config to device
    config_version = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(100))   # admin email

    device = relationship("Device", back_populates="remote_config")

    __table_args__ = (
        Index('idx_remote_config_device', 'device_id'),
    )



def get_db():
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_database_partitions():
    """Ensure monthly partitions exist for the next 12 months (PostgreSQL declarative partitioning)."""
    if engine.dialect.name != "postgresql":
        return

    from sqlalchemy import text
    from datetime import datetime
    
    now = datetime.utcnow().replace(day=1)
    
    with engine.begin() as conn:
        # Create partitions for the next 12 months
        for i in range(12):
            y = (now.year + (now.month - 1 + i) // 12)
            m = ((now.month - 1 + i) % 12) + 1
            start = datetime(y, m, 1)
            if m == 12:
                end = datetime(y + 1, 1, 1)
            else:
                end = datetime(y, m + 1, 1)
                
            partition_name = f"sensor_data_{y}_{str(m).zfill(2)}"
            
            # Create partition of the parent table
            create_partition_sql = f"""
            CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF sensor_data
            FOR VALUES FROM ('{start.strftime("%Y-%m-%d")}') TO ('{end.strftime("%Y-%m-%d")}');
            """
            conn.execute(text(create_partition_sql))


def prune_database_partitions():
    """Drop partitions older than 12 months (retaining current month + past 11 months)."""
    if engine.dialect.name != "postgresql":
        return

    from sqlalchemy import text
    from datetime import datetime
    
    now = datetime.utcnow().replace(day=1)
    
    # Calculate cutoff date: keep current month + previous 11 months (total 12 months)
    m = now.month - 11
    y = now.year
    if m <= 0:
        y -= (abs(m) // 12) + 1
        m = 12 - (abs(m) % 12)
    cutoff_date = datetime(y, m, 1)
    
    get_partitions_sql = """
    SELECT child.relname AS partition_name
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    WHERE parent.relname = 'sensor_data';
    """
    
    with engine.begin() as conn:
        result = conn.execute(text(get_partitions_sql)).fetchall()
        for row in result:
            partition_name = row[0]
            if partition_name.startswith("sensor_data_"):
                parts = partition_name.split("_")
                if len(parts) >= 4:
                    try:
                        py = int(parts[2])
                        pm = int(parts[3])
                        part_date = datetime(py, pm, 1)
                        if part_date < cutoff_date:
                            drop_sql = f"DROP TABLE IF EXISTS {partition_name};"
                            conn.execute(text(drop_sql))
                    except ValueError:
                        pass


def init_db():
    """Create all tables and setup partitions."""
    Base.metadata.create_all(bind=engine)
    try:
        setup_database_partitions()
        prune_database_partitions()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to auto-setup database partitions: {e}")
