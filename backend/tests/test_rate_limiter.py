from unittest.mock import patch
import pytest

def test_rate_limiter_bypass(test_client):
    """Test that bypassed routes (like /health) do not trigger rate limiting."""
    # Even if rate limiter is set to limit all requests, health endpoint should bypass it
    with patch("app.main.rate_limiter.is_rate_limited") as mock_limit:
        mock_limit.return_value = (True, {"RateLimit-Limit": "10000"})
        
        response = test_client.get("/health")
        assert response.status_code == 200
        assert "RateLimit-Limit" not in response.headers
        assert response.json()["status"] == "healthy"


def test_rate_limiter_ip_limited(test_client):
    """Test that requests are blocked when the IP rate limit is exceeded."""
    with patch("app.main.rate_limiter.is_rate_limited") as mock_limit:
        mock_limit.return_value = (True, {
            "RateLimit-Limit": "10000",
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": "1700000000"
        })
        
        # Call status endpoint which should be subject to IP limiting
        response = test_client.get("/status")
        assert response.status_code == 429
        assert response.headers["RateLimit-Limit"] == "10000"
        assert response.headers["RateLimit-Remaining"] == "0"
        assert response.headers["RateLimit-Reset"] == "1700000000"
        assert "IP rate limit exceeded" in response.json()["detail"]


def test_rate_limiter_device_limited(test_client, test_api_key, sample_sensor_data):
    """Test that requests are blocked when the device rate limit is exceeded."""
    headers = {"X-API-Key": test_api_key["key"]}
    
    # We mock is_rate_limited. The first call checks the IP limit (which passes),
    # and the second call checks the device limit (which fails).
    with patch("app.main.rate_limiter.is_rate_limited") as mock_limit, \
         patch("app.main.get_device_id_cached") as mock_get_device:
        mock_get_device.return_value = "HYDRO_001"
        mock_limit.side_effect = [
            (False, {"RateLimit-Limit": "10000", "RateLimit-Remaining": "9999", "RateLimit-Reset": "1700000000"}), # IP check
            (True, {"RateLimit-Limit": "100", "RateLimit-Remaining": "0", "RateLimit-Reset": "1700000060"})      # Device check
        ]
        
        response = test_client.post(
            "/data",
            json=sample_sensor_data,
            headers=headers
        )
        
        assert response.status_code == 429
        assert response.headers["RateLimit-Limit"] == "100"
        assert response.headers["RateLimit-Remaining"] == "0"
        assert response.headers["RateLimit-Reset"] == "1700000060"
        assert "Device rate limit exceeded" in response.json()["detail"]


def test_rate_limiter_normal_pass(test_client, test_api_key, sample_sensor_data):
    """Test that headers are correctly attached and requests pass under normal conditions."""
    headers = {"X-API-Key": test_api_key["key"]}
    
    with patch("app.main.rate_limiter.is_rate_limited") as mock_limit, \
         patch("app.main.get_device_id_cached") as mock_get_device:
        mock_get_device.return_value = "HYDRO_001"
        mock_limit.side_effect = [
            (False, {"RateLimit-Limit": "10000", "RateLimit-Remaining": "9995", "RateLimit-Reset": "1700000000"}), # IP check
            (False, {"RateLimit-Limit": "100", "RateLimit-Remaining": "95", "RateLimit-Reset": "1700000060"})      # Device check
        ]
        
        response = test_client.post(
            "/data",
            json=sample_sensor_data,
            headers=headers
        )
        
        assert response.status_code == 200
        # Headers from both limits should be present (device headers take precedence / update headers dict)
        assert response.headers["RateLimit-Limit"] == "100"
        assert response.headers["RateLimit-Remaining"] == "95"
        assert response.headers["RateLimit-Reset"] == "1700000060"
