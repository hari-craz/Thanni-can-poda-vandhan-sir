"""Test authentication module."""
import pytest
from datetime import datetime, timedelta
from app.auth import hash_api_key, verify_api_key, generate_api_key, validate_api_key
from app.database import APIKey, Device


class TestAPIKeyHashing:
    """Test API key hashing and verification."""
    
    def test_hash_api_key(self):
        """Test hashing generates different hash each time."""
        key = "test_key_12345"
        hash1 = hash_api_key(key)
        hash2 = hash_api_key(key)
        
        assert hash1 != hash2
        assert len(hash1) > 20
        assert len(hash2) > 20
    
    def test_verify_api_key_valid(self):
        """Test verify_api_key returns True for matching key/hash."""
        key = "test_key_12345"
        hashed = hash_api_key(key)
        assert verify_api_key(key, hashed) is True
        assert verify_api_key("wrong_key", hashed) is False

    def test_generate_api_key_format(self):
        """Test generate_api_key generates correct format."""
        key = generate_api_key("HYDRO_001")
        assert key.startswith("hydro_HYDRO_001_")
        assert len(key) > 20


class TestAPIKeyValidation:
    """Test API key validation against database."""

    def test_validate_api_key_valid(self, db_session, test_api_key):
        """Test validating a valid API key."""
        key = test_api_key["key"]
        device = validate_api_key(db_session, key)
        
        assert device is not None
        assert device.device_id == "HYDRO_001"
    
    def test_validate_api_key_invalid(self, db_session):
        """Test validating an invalid API key."""
        device = validate_api_key(db_session, "invalid_key")
        assert device is None
    
    def test_validate_api_key_wrong_format(self, db_session):
        """Test validating API key with wrong format."""
        device = validate_api_key(db_session, "not_a_valid_key_format")
        assert device is None
    
    def test_validate_expired_api_key(self, db_session, test_device):
        """Test validating an expired API key."""
        test_key = "hydro_HYDRO_001_expired_key_123456789"
        hashed = hash_api_key(test_key)
        
        expired_key = APIKey(
            device_id="HYDRO_001",
            key_hash=hashed,
            created_at=datetime.utcnow() - timedelta(days=95),
            expires_at=datetime.utcnow() - timedelta(days=5),  # Expired 5 days ago
            is_active=True
        )
        db_session.add(expired_key)
        db_session.commit()
        
        device = validate_api_key(db_session, test_key)
        assert device is None
    
    def test_validate_revoked_api_key(self, db_session, test_device):
        """Test validating a revoked API key."""
        test_key = "hydro_HYDRO_001_revoked_key_123456789"
        hashed = hash_api_key(test_key)
        
        revoked_key = APIKey(
            device_id="HYDRO_001",
            key_hash=hashed,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=90),
            is_active=True,
            revoked_at=datetime.utcnow()  # Revoked now
        )
        db_session.add(revoked_key)
        db_session.commit()
        
        device = validate_api_key(db_session, test_key)
        assert device is None


def test_request_access_endpoint(db_session):
    """Test public access request endpoint."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import Alert, AuditLog
    from app.database import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    payload = {
        "name": "Jane Smith",
        "email": "jane@test.com",
        "role": "admin",
        "reason": "Need admin access for debugging"
    }

    response = client.post("/auth/request-access", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify Alert was created in database
    alert = db_session.query(Alert).filter(Alert.message.contains("jane@test.com")).first()
    assert alert is not None
    assert alert.severity == "warning"
    assert "Jane Smith" in alert.message

    # Verify AuditLog was created in database
    audit = db_session.query(AuditLog).filter(AuditLog.action == "request_access").first()
    assert audit is not None
    assert audit.resource_id == "jane@test.com"

