from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings from environment variables or .env file."""
    
    # Database
    database_url: str = "postgresql+psycopg2://hydronix:hydronix_pass@db:5432/hydronix_db"
    
    # MQTT
    mqtt_broker: str = "broker.hivemq.com"
    mqtt_port: int = 1883
    mqtt_use_tls: bool = False  # Set to True for port 8883
    mqtt_topic: str = "hydronix/sensor/+"
    mqtt_client_id: str = "hydronix_backend"
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None
    mqtt_keepalive: int = 60
    mqtt_queue_max: int = 1000  # Max in-memory queue size for incoming MQTT messages
    
    # Redis (for rate limiting and caching)
    redis_url: str = "redis://localhost:6379/0"
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_title: str = "Hydronix Backend API"
    api_version: str = "1.0.0"
    api_description: str = "Water monitoring system ingestion and query API"
    
    # Security
    api_key_expiry_days: int = 90
    api_key_rotation_grace_days: int = 7
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # CORS Configuration
    cors_origins: list = [
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:5173",
        "https://dashboard.hydronix.local"
    ]
    cors_allow_methods: list = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    cors_allow_headers: list = ["Content-Type", "Authorization", "X-API-Key"]
    
    # Rate Limiting
    rate_limit_per_device_minute: int = 100
    rate_limit_per_ip_hour: int = 10000
    
    # Device Configuration
    device_heartbeat_timeout_seconds: int = 120  # Mark as offline if no heartbeat in 2 min
    device_offline_escalation_minutes: list = [5, 15, 60]  # Escalation thresholds
    # Time drift handling (seconds)
    max_drift_seconds: int = 300  # If device timestamp differs from server by this much, use server time
    
    # Quality Score Thresholds (Rule-Based)
    quality_score_safe_ph_min: float = 6.5
    quality_score_safe_ph_max: float = 8.5
    quality_score_safe_turbidity_max: float = 5.0  # NTU
    quality_score_safe_tds_max: float = 300.0  # ppm
    quality_score_safe_temperature_min: float = 5.0  # Celsius
    quality_score_safe_temperature_max: float = 45.0  # Celsius
    quality_score_safe_flow_rate_max: float = 100.0  # L/min
    
    # Alert Thresholds
    alert_threshold_warning: int = 50
    alert_threshold_critical: int = 30
    alert_threshold_emergency: int = 10

    # Notifications
    notification_cooldown_minutes: int = 10  # dedupe: max 1 notification per device per this many minutes per severity
    notification_email_from: str = "no-reply@hydronix.local"
    notification_email_to: str = "ops@hydronix.local"  # single admin email; can be expanded
    smtp_host: Optional[str] = None
    smtp_port: int = 25
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None

    # EMA smoothing for noisy sensors
    smoothing_enabled: bool = True
    smoothing_alpha: float = 0.3  # EMA alpha (0-1). Higher = faster response

    # ML Service (Phase 2+)
    ml_service_enabled: bool = False
    ml_service_url: str = "http://ml-service:8000"
    ml_service_api_key: Optional[str] = None
    ml_confidence_threshold: float = 0.65
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # json or text
    
    # Environment
    environment: str = "development"  # development, staging, production
    
    # Admin user for OAuth2 (development default)
    admin_username: str = "admin"
    admin_password: str = "admin"  # change in production via env
    super_admin_email: str = "superadmin@hydronix.com"
    super_admin_password: str = "superadmin"

    # Storage paths
    reports_storage: str = "/storage/hydronix/reports"
    upload_storage: str = "/storage/hydronix/uploads"
    log_storage: str = "/storage/hydronix/logs"
    backup_storage: str = "/storage/hydronix/backups"

    # MinIO
    minio_endpoint: str = "minio"
    minio_port: int = 9000
    minio_access_key: str = "minio_admin"
    minio_secret_key: str = "minio_admin_secret"
    minio_bucket: str = "hydronix-bucket"

    # Logging / ELK
    log_to_elastic: bool = False
    elastic_url: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
