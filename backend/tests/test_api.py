"""Test API endpoints."""
import json
import pytest
from datetime import datetime


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_health_endpoint_returns_ok(self, test_client):
        """Test /health endpoint returns OK."""
        response = test_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
    
    def test_status_endpoint_returns_status(self, test_client):
        """Test /status endpoint returns system status."""
        response = test_client.get("/status")
        
        assert response.status_code == 200
        data = response.json()
        assert "database" in data
        assert "timestamp" in data


class TestDeviceProvision:
    """Test device provisioning endpoints."""
    
    def test_provision_device_success(self, test_client):
        """Test provisioning a new device."""
        payload = {
            "device_id": "HYDRO_NEW_001"
        }
        
        response = test_client.post("/devices/provision", json=payload)
        
        assert response.status_code == 201
        data = response.json()
        assert data["device_id"] == "HYDRO_NEW_001"
        assert "api_key" in data
        assert data["status"] == "online"
    
    def test_provision_device_invalid_id(self, test_client):
        """Test provisioning with invalid device ID format."""
        payload = {
            "device_id": "invalid_id"  # Should be HYDRO_###
        }
        
        response = test_client.post("/devices/provision", json=payload)
        
        assert response.status_code == 422  # Validation error
    
    def test_provision_duplicate_device(self, test_client, test_device):
        """Test provisioning duplicate device fails."""
        payload = {
            "device_id": "HYDRO_TEST_001"  # Already exists
        }
        
        response = test_client.post("/devices/provision", json=payload)
        
        assert response.status_code >= 400


class TestDataIngestion:
    """Test sensor data ingestion endpoint."""
    
    def test_ingest_valid_data(self, test_client, test_api_key, sample_sensor_data):
        """Test ingesting valid sensor data."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        response = test_client.post(
            "/data",
            json=sample_sensor_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "quality_score" in data
        assert "anomalies" in data
        assert data["device_id"] == "HYDRO_TEST_001"
    
    def test_ingest_without_api_key(self, test_client, sample_sensor_data):
        """Test ingestion fails without API key."""
        response = test_client.post("/data", json=sample_sensor_data)
        
        assert response.status_code == 401
    
    def test_ingest_invalid_api_key(self, test_client, sample_sensor_data):
        """Test ingestion fails with invalid API key."""
        headers = {"X-API-Key": "invalid_key_format"}
        
        response = test_client.post(
            "/data",
            json=sample_sensor_data,
            headers=headers
        )
        
        assert response.status_code == 401
    
    def test_ingest_with_quality_score_calculation(self, test_client, test_api_key):
        """Test quality score is calculated during ingestion."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        data = {
            "device_id": "HYDRO_TEST_001",
            "timestamp": "2026-06-15T13:00:00Z",
            "timestamp_source": "device",
            "ph": 9.0,  # Out of range - should reduce score
            "turbidity": 10.0,  # Critical - should reduce score significantly
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0,
            "device_reset_count": 0,
            "seq_no": 1
        }
        
        response = test_client.post("/data", json=data, headers=headers)
        
        assert response.status_code == 200
        result = response.json()
        assert result["quality_score"] < 50  # Should be low due to turbidity
    
    def test_ingest_missing_required_field(self, test_client, test_api_key):
        """Test ingestion with missing required field."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        data = {
            "device_id": "HYDRO_TEST_001",
            "timestamp": "2026-06-15T13:00:00Z",
            # Missing timestamp_source and other required fields
            "ph": 7.0,
        }
        
        response = test_client.post("/data", json=data, headers=headers)
        
        assert response.status_code == 422


class TestDeviceManagement:
    """Test device management endpoints."""
    
    def test_get_devices_list(self, test_client, test_device):
        """Test getting list of devices."""
        response = test_client.get("/devices")
        
        assert response.status_code == 200
        data = response.json()
        assert "devices" in data
        assert len(data["devices"]) > 0
        assert data["devices"][0]["device_id"] == "HYDRO_TEST_001"
    
    def test_get_single_device(self, test_client, test_device):
        """Test getting a single device."""
        response = test_client.get("/devices/HYDRO_TEST_001")
        
        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == "HYDRO_TEST_001"
        assert data["status"] == "online"
    
    def test_get_nonexistent_device(self, test_client):
        """Test getting non-existent device returns 404."""
        response = test_client.get("/devices/HYDRO_NOTEXIST_001")
        
        assert response.status_code == 404
    
    def test_device_heartbeat(self, test_client, test_api_key):
        """Test device heartbeat endpoint."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        response = test_client.post(
            "/devices/HYDRO_TEST_001/heartbeat",
            json={},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == "HYDRO_TEST_001"
        assert data["status"] == "online"
    
    def test_api_key_rotation(self, test_client, test_api_key):
        """Test API key rotation."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        response = test_client.post(
            "/devices/HYDRO_TEST_001/keys/rotate",
            json={},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "new_api_key" in data
        assert data["new_api_key"] != test_api_key["key"]


class TestDataQuerying:
    """Test data querying endpoints."""
    
    def test_get_device_data(self, test_client, test_api_key, sample_sensor_data):
        """Test querying device data."""
        # First, ingest some data
        headers = {"X-API-Key": test_api_key["key"]}
        test_client.post("/data", json=sample_sensor_data, headers=headers)
        
        # Then query it
        response = test_client.get(
            "/data/HYDRO_TEST_001",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "readings" in data
    
    def test_get_anomalies(self, test_client, test_api_key):
        """Test getting anomalies list."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        response = test_client.get("/anomalies", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "anomalies" in data
    
    def test_get_alerts(self, test_client, test_api_key):
        """Test getting alerts list."""
        headers = {"X-API-Key": test_api_key["key"]}
        
        response = test_client.get("/alerts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data


class TestErrorHandling:
    """Test error handling."""
    
    def test_malformed_json_returns_422(self, test_client):
        """Test malformed JSON returns 422."""
        response = test_client.post(
            "/data",
            data="{invalid json}",
            headers={"Content-Type": "application/json", "X-API-Key": "test"}
        )
        
        assert response.status_code >= 400
    
    def test_method_not_allowed(self, test_client):
        """Test calling endpoint with wrong method."""
        response = test_client.put("/health")
        
        assert response.status_code == 405
    
    def test_nonexistent_endpoint_returns_404(self, test_client):
        """Test nonexistent endpoint returns 404."""
        response = test_client.get("/nonexistent")
        
        assert response.status_code == 404
