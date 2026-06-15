"""Test authentication module."""
import pytest
from datetime import datetime, timedelta
from app.auth import hash_api_key, verify_api_key
from app.database import APIKey


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
    
    def test_verify_api_key_valid(self, db_session, test_api_key):
        """Test verifying a valid API key."""
        key = test_api_key["key"]
        
        result = verify_api_key(key, db_session)
        
        assert result is not None
        assert result["device_id"] == "HYDRO_TEST_001"
        assert result["is_valid"] is True
    
    def test_verify_api_key_invalid(self, db_session):
        """Test verifying an invalid API key."""
        result = verify_api_key("invalid_key", db_session)
        assert result["is_valid"] is False
    
    def test_verify_api_key_wrong_format(self, db_session):
        """Test verifying API key with wrong format."""
        result = verify_api_key("not_a_valid_key_format", db_session)
        assert result["is_valid"] is False
    
    def test_verify_expired_api_key(self, db_session, test_device):
        """Test verifying an expired API key."""
        from app.auth import hash_api_key
        
        test_key = "hydro_HYDRO_TEST_001_expired_key_123456789"
        hashed = hash_api_key(test_key)
        
        expired_key = APIKey(
            device_id="HYDRO_TEST_001",
            key_hash=hashed,
            created_at=datetime.utcnow() - timedelta(days=95),
            expires_at=datetime.utcnow() - timedelta(days=5),  # Expired 5 days ago
            is_active=True,
            is_revoked=False
        )
        db_session.add(expired_key)
        db_session.commit()
        
        result = verify_api_key(test_key, db_session)
        
        assert result["is_valid"] is False
    
    def test_verify_revoked_api_key(self, db_session, test_device):
        """Test verifying a revoked API key."""
        from app.auth import hash_api_key
        
        test_key = "hydro_HYDRO_TEST_001_revoked_key_123456789"
        hashed = hash_api_key(test_key)
        
        revoked_key = APIKey(
            device_id="HYDRO_TEST_001",
            key_hash=hashed,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=90),
            is_active=True,
            is_revoked=True
        )
        db_session.add(revoked_key)
        db_session.commit()
        
        result = verify_api_key(test_key, db_session)
        
        assert result["is_valid"] is False
