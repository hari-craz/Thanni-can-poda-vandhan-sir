"""Tests for Device and Database Management endpoints (PATCH, DELETE, clear, and full reset)."""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.database import (
    User, Device, SensorData, Alert, ValveOperation, MLAnomaly, APIKey, DeviceRemoteConfig
)
from app.security import create_access_token, get_password_hash
from app.main import app
from app.database import get_db


@pytest.fixture
def auth_client(db_session):
    """Test client that overrides get_db to use the test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def setup_test_environment(db_session):
    """Seed test database with users, devices, and operational logs."""
    pwd_hash = get_password_hash("password123")
    
    # Create users
    superadmin = User(
        email="superadmin@test.com",
        hashed_password=pwd_hash,
        role="superadmin",
        name="Super Administrator"
    )
    admin = User(
        email="admin@test.com",
        hashed_password=pwd_hash,
        role="admin",
        name="Admin Operator"
    )
    user = User(
        email="user@test.com",
        hashed_password=pwd_hash,
        role="user",
        name="Standard User"
    )
    db_session.add(superadmin)
    db_session.add(admin)
    db_session.add(user)
    
    # Create device
    device = Device(
        device_id="HYDRO_001",
        name="Main Reservoir Node",
        location="Sector 4",
        latitude=13.0827,
        longitude=80.2707,
        status="online",
        is_active=True,
        firmware_version="2.0.0",
        firmware_channel="stable",
        config_version=1
    )
    db_session.add(device)
    db_session.flush()

    # Create remote config
    remote_cfg = DeviceRemoteConfig(
        device_id="HYDRO_001",
        sample_interval_sec=60,
        firmware_channel="stable",
        config_version=1
    )
    db_session.add(remote_cfg)
    
    # Create device API key
    api_key = APIKey(
        device_id="HYDRO_001",
        key_hash="dummy_hash_for_test",
        is_active=True
    )
    db_session.add(api_key)

    # Create operational telemetry
    sensor_reading = SensorData(
        device_id="HYDRO_001",
        ph=7.2,
        turbidity=2.5,
        tds=150.0,
        temperature=26.0,
        flow_rate=10.0,
        timestamp=datetime.utcnow(),
        received_at=datetime.utcnow()
    )
    db_session.add(sensor_reading)
    db_session.flush()

    # Create alert
    alert = Alert(
        device_id="HYDRO_001",
        severity="warning",
        message="Slight pH fluctuation",
        triggered_at=datetime.utcnow()
    )
    db_session.add(alert)

    # Create valve operation
    valve_op = ValveOperation(
        device_id="HYDRO_001",
        action="close",
        triggered_by="auto_safety_cutoff",
        reason="pH low",
        timestamp=datetime.utcnow()
    )
    db_session.add(valve_op)

    # Create ML anomaly
    ml_anom = MLAnomaly(
        device_id="HYDRO_001",
        reading_id=sensor_reading.id,
        ml_score=1,
        confidence=0.85,
        model_version="v1.0",
        prediction_timestamp=datetime.utcnow()
    )
    db_session.add(ml_anom)
    
    db_session.commit()
    return {
        "device": device,
        "superadmin": superadmin,
        "admin": admin,
        "user": user,
        "sensor_reading": sensor_reading
    }


def test_update_device_permissions(auth_client, setup_test_environment):
    """Verify that admins and superadmins can update a device, but standard users cannot."""
    # 1. Test user is blocked
    user_token = create_access_token({"username": "user@test.com", "role": "user"})
    headers = {"Authorization": f"Bearer {user_token}"}
    payload = {"name": "User Updated Name", "location": "User Location"}
    
    resp = auth_client.patch("/devices/HYDRO_001", json=payload, headers=headers)
    assert resp.status_code == 403

    # 2. Test admin is allowed
    admin_token = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"name": "Admin Updated Name", "location": "Admin Location", "latitude": 12.9716, "longitude": 77.5946}
    
    resp = auth_client.patch("/devices/HYDRO_001", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Admin Updated Name"
    assert data["location"] == "Admin Location"
    assert data["latitude"] == 12.9716
    assert data["longitude"] == 77.5946


def test_delete_device_permissions_and_cascades(auth_client, setup_test_environment, db_session):
    """Verify that admins/superadmins can delete a device and associated records are deleted."""
    # 1. Test standard user is blocked
    user_token = create_access_token({"username": "user@test.com", "role": "user"})
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = auth_client.delete("/devices/HYDRO_001", headers=headers)
    assert resp.status_code == 403

    # Verify device and tables are still populated
    assert db_session.query(Device).filter(Device.device_id == "HYDRO_001").count() == 1
    assert db_session.query(SensorData).filter(SensorData.device_id == "HYDRO_001").count() == 1
    assert db_session.query(MLAnomaly).filter(MLAnomaly.device_id == "HYDRO_001").count() == 1

    # 2. Test admin can delete and verify cascades
    admin_token = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = auth_client.delete("/devices/HYDRO_001", headers=headers)
    assert resp.status_code == 200

    # Verify everything referencing HYDRO_001 is deleted
    assert db_session.query(Device).filter(Device.device_id == "HYDRO_001").count() == 0
    assert db_session.query(DeviceRemoteConfig).filter(DeviceRemoteConfig.device_id == "HYDRO_001").count() == 0
    assert db_session.query(APIKey).filter(APIKey.device_id == "HYDRO_001").count() == 0
    assert db_session.query(SensorData).filter(SensorData.device_id == "HYDRO_001").count() == 0
    assert db_session.query(Alert).filter(Alert.device_id == "HYDRO_001").count() == 0
    assert db_session.query(ValveOperation).filter(ValveOperation.device_id == "HYDRO_001").count() == 0
    assert db_session.query(MLAnomaly).filter(MLAnomaly.device_id == "HYDRO_001").count() == 0


def test_clear_device_data_superadmin_only(auth_client, setup_test_environment, db_session):
    """Verify that only superadmins can clear a device's operational data."""
    # 1. Test standard user is blocked
    user_token = create_access_token({"username": "user@test.com", "role": "user"})
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = auth_client.post("/devices/HYDRO_001/data/clear", headers=headers)
    assert resp.status_code == 403

    # 2. Test admin is blocked
    admin_token = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = auth_client.post("/devices/HYDRO_001/data/clear", headers=headers)
    assert resp.status_code == 403

    # 3. Test superadmin is allowed
    super_token = create_access_token({"username": "superadmin@test.com", "role": "superadmin"})
    headers = {"Authorization": f"Bearer {super_token}"}
    resp = auth_client.post("/devices/HYDRO_001/data/clear", headers=headers)
    assert resp.status_code == 200

    # Verify device profile remains, but all telemetry/events are deleted
    assert db_session.query(Device).filter(Device.device_id == "HYDRO_001").count() == 1
    assert db_session.query(DeviceRemoteConfig).filter(DeviceRemoteConfig.device_id == "HYDRO_001").count() == 1
    assert db_session.query(APIKey).filter(APIKey.device_id == "HYDRO_001").count() == 1
    
    # Telemetry and logs must be cleared
    assert db_session.query(SensorData).filter(SensorData.device_id == "HYDRO_001").count() == 0
    assert db_session.query(Alert).filter(Alert.device_id == "HYDRO_001").count() == 0
    assert db_session.query(ValveOperation).filter(ValveOperation.device_id == "HYDRO_001").count() == 0
    assert db_session.query(MLAnomaly).filter(MLAnomaly.device_id == "HYDRO_001").count() == 0

    # Check that device dynamic status fields were reset
    dev = db_session.query(Device).filter(Device.device_id == "HYDRO_001").first()
    assert dev.status == "offline"
    assert dev.last_heartbeat is None


def test_clear_full_database_superadmin_only(auth_client, setup_test_environment, db_session):
    """Verify that only superadmins can clear the database, and that user accounts are preserved."""
    # 1. Test standard user is blocked
    user_token = create_access_token({"username": "user@test.com", "role": "user"})
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = auth_client.post("/admin/database/clear", headers=headers)
    assert resp.status_code == 403

    # 2. Test admin is blocked
    admin_token = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = auth_client.post("/admin/database/clear", headers=headers)
    assert resp.status_code == 403

    # 3. Test superadmin is allowed
    super_token = create_access_token({"username": "superadmin@test.com", "role": "superadmin"})
    headers = {"Authorization": f"Bearer {super_token}"}
    resp = auth_client.post("/admin/database/clear", headers=headers)
    assert resp.status_code == 200

    # Verify all operational tables are empty
    assert db_session.query(Device).count() == 0
    assert db_session.query(DeviceRemoteConfig).count() == 0
    assert db_session.query(APIKey).count() == 0
    assert db_session.query(SensorData).count() == 0
    assert db_session.query(Alert).count() == 0
    assert db_session.query(ValveOperation).count() == 0
    assert db_session.query(MLAnomaly).count() == 0

    # Verify users table is intact (contains original seed accounts)
    assert db_session.query(User).count() == 3
