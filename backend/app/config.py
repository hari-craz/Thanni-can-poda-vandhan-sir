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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
