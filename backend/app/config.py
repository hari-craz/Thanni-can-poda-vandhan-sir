from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings from environment variables or .env file."""
    
    # Database
    database_url: str = "postgresql+psycopg2://hydronix:hydronix_pass@db:5432/hydronix_db"
    
    # Redis (for rate limiting, caching, and HMAC nonce dedup)
    redis_url: str = "redis://localhost:6379/0"
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_title: str = "Hydronix Backend API"
    api_version: str = "2.0.0"  # Bumped: MQTT removed, HTTPS-only
    api_description: str = "Water monitoring system — HTTPS/Cloudflare Tunnel transport"
    
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
    # HMAC signature headers added in v2
    cors_allow_headers: list = [
        "Content-Type", "Authorization", "X-API-Key",
        "X-Timestamp", "X-Nonce", "X-Signature",
    ]

    # HMAC Signature Validation (firmware v2.0.0)
    hmac_timestamp_tolerance_sec: int = 300   # ±5 minutes
    hmac_nonce_ttl_sec: int = 600             # Nonce dedup window
    hmac_validation_enabled: bool = True      # Set False only during migration testing
    
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

    # Slack and Twilio SMS Gateway Integrations
    slack_webhook_url: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_from: Optional[str] = None
    twilio_phone_to: Optional[str] = None

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
    
    # Cloudflare Tunnel Configuration (HTTPS-only transport)
    cloudflare_tunnel_enabled: bool = True  # Set False to disable Cloudflare integration
    cloudflare_tunnel_url: Optional[str] = None  # e.g., "https://hydronix-tunnel.example.com"
    cloudflare_api_token: Optional[str] = None  # Cloudflare API token for programmatic access
    cloudflare_zone_id: Optional[str] = None  # Cloudflare Zone ID
    cloudflare_tunnel_id: Optional[str] = None  # Tunnel UUID
    
    # Device API Endpoint (public URL for devices to POST to)
    device_api_endpoint: str = "https://api.hydronix.local/v2"
    device_api_timeout_sec: int = 30  # HTTP request timeout
    device_max_payload_size_bytes: int = 8192  # Max POST body size
    
    # HTTPS Enforcement
    https_only: bool = True  # Reject HTTP requests (v2.0.0+)
    force_https_redirect: bool = True  # 301 redirect HTTP to HTTPS
    hsts_max_age_seconds: int = 31536000  # 1 year HSTS policy
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
