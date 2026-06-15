"""
Authentication and security utilities.
"""
import bcrypt
import secrets
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from .database import APIKey, Device
from .config import settings


def hash_api_key(api_key: str, salt_rounds: int = 12) -> str:
    """Hash an API key using bcrypt."""
    salt = bcrypt.gensalt(rounds=salt_rounds)
    return bcrypt.hashpw(api_key.encode(), salt).decode()


def verify_api_key(provided_key: str, stored_hash: str) -> bool:
    """Verify an API key against its hash."""
    return bcrypt.checkpw(provided_key.encode(), stored_hash.encode())


def generate_api_key(device_id: str) -> str:
    """Generate a new API key for a device."""
    # Format: hydro_<device_id>_<random_token>
    random_suffix = secrets.token_urlsafe(32)
    return f"hydro_{device_id}_{random_suffix}"


def validate_api_key(db: Session, api_key: str) -> Optional[Device]:
    """
    Validate an API key and return the associated device.
    Returns None if invalid or expired.
    """
    # Try to find a matching key
    api_key_record = db.query(APIKey).filter(
        APIKey.key_hash == hash_api_key(api_key),  # This won't work - need exact match
    ).first()
    
    # Better approach: fetch candidate keys and verify
    api_key_records = db.query(APIKey).filter(
        APIKey.is_active == True,
        APIKey.revoked_at == None,
    ).all()
    
    for record in api_key_records:
        if verify_api_key(api_key, record.key_hash):
            # Check expiry
            if record.expires_at and record.expires_at < datetime.utcnow():
                return None
            # Return the device
            return db.query(Device).filter(Device.device_id == record.device_id).first()
    
    return None


def create_api_key_for_device(db: Session, device_id: str) -> tuple[str, str]:
    """
    Create and store a new API key for a device.
    Returns (api_key, key_hash) tuple.
    """
    api_key = generate_api_key(device_id)
    key_hash = hash_api_key(api_key)
    expires_at = datetime.utcnow() + timedelta(days=settings.api_key_expiry_days)
    
    db_key = APIKey(
        device_id=device_id,
        key_hash=key_hash,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(db_key)
    db.commit()
    
    return api_key, key_hash


def rotate_api_key(db: Session, device_id: str) -> tuple[str, str]:
    """
    Rotate API key: revoke old keys (after grace period) and issue new one.
    Returns (new_api_key, old_key_expires_at).
    """
    # Revoke old keys with a grace period
    grace_expiry = datetime.utcnow() + timedelta(days=settings.api_key_rotation_grace_days)
    old_keys = db.query(APIKey).filter(
        APIKey.device_id == device_id,
        APIKey.is_active == True,
        APIKey.revoked_at == None,
    ).all()
    
    for old_key in old_keys:
        old_key.expires_at = grace_expiry  # Grace period expiry
    
    # Create new key
    new_api_key, _ = create_api_key_for_device(db, device_id)
    db.commit()
    
    return new_api_key, grace_expiry
