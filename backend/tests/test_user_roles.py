"""Test user roles and authentication/authorization permissions."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import User, Device
from app.security import create_access_token, get_password_hash
from app.main import app
from app.database import get_db


@pytest.fixture
def auth_client(db_session):
    """A TestClient that uses the test database session without overriding authentication dependencies."""
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
def setup_users_and_device(db_session):
    """Seed test database with a device and user accounts for all roles."""
    # Seed device
    device = Device(
        device_id="HYDRO_001",
        name="Test Device",
        location="Lab A",
        status="online",
        firmware_version="2.0.0"
    )
    db_session.add(device)
    
    # Hash password
    pwd_hash = get_password_hash("password123")
    
    # Seed users
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
    db_session.commit()
    
    return {
        "device": device,
        "superadmin": superadmin,
        "admin": admin,
        "user": user
    }


def test_login_successful_and_roles(auth_client, setup_users_and_device):
    """Test login endpoint returns correct token and role details for all three roles."""
    roles = ["superadmin", "admin", "user"]
    for role in roles:
        response = auth_client.post(
            "/auth/login",
            data={"username": f"{role}@test.com", "password": "password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == f"{role}@test.com"
        assert data["user"]["role"] == role


def test_user_role_permissions(auth_client, setup_users_and_device):
    """Test that a standard 'user' can access basic endpoints but is blocked from administrative actions."""
    # Generate user token
    token = create_access_token({"username": "user@test.com", "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Allowed: GET /status (System status)
    status_resp = auth_client.get("/status", headers=headers)
    assert status_resp.status_code == 200
    
    # 2. Blocked: GET /users (User management list)
    users_resp = auth_client.get("/users", headers=headers)
    assert users_resp.status_code == 403
    assert "Operation restricted to administrators" in users_resp.json()["error"]
    
    # 3. Blocked: POST /users (Create user)
    create_resp = auth_client.post(
        "/users",
        json={"email": "newuser@test.com", "password": "password", "role": "user", "name": "New User"},
        headers=headers
    )
    assert create_resp.status_code == 403
    
    # 4. Blocked: POST /devices/provision (Device provisioning)
    provision_resp = auth_client.post(
        "/devices/provision",
        json={"device_id": "HYDRO_002", "name": "Second Device", "location": "Lab B"},
        headers=headers
    )
    assert provision_resp.status_code == 403
    
    # 5. Blocked: PATCH /devices/HYDRO_001/config (Config update)
    config_resp = auth_client.patch(
        "/devices/HYDRO_001/config",
        json={"sample_interval_sec": 120},
        headers=headers
    )
    assert config_resp.status_code == 403


def test_admin_role_permissions(auth_client, setup_users_and_device):
    """Test that an 'admin' can edit configs, but cannot view/manage user accounts."""
    # Generate admin token
    token = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Blocked: GET /users (List users - restricted to superadmin)
    users_resp = auth_client.get("/users", headers=headers)
    assert users_resp.status_code == 403
    assert "Operation restricted to super-administrators" in users_resp.json()["error"]
    
    # 2. Allowed: PATCH /devices/HYDRO_001/config (Config update)
    config_resp = auth_client.patch(
        "/devices/HYDRO_001/config",
        json={"sample_interval_sec": 120},
        headers=headers
    )
    assert config_resp.status_code == 200
    
    # 3. Blocked: POST /users (Create user - restricted to superadmin)
    create_resp = auth_client.post(
        "/users",
        json={"email": "newuser@test.com", "password": "password", "role": "user", "name": "New User"},
        headers=headers
    )
    assert create_resp.status_code == 403
    assert "Operation restricted to super-administrators" in create_resp.json()["error"]


def test_superadmin_role_permissions(auth_client, setup_users_and_device):
    """Test that a 'superadmin' can perform all actions including user creation and management."""
    # Generate superadmin token
    token = create_access_token({"username": "superadmin@test.com", "role": "superadmin"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Allowed: POST /users (Create user)
    create_resp = auth_client.post(
        "/users",
        json={"email": "newuser@test.com", "password": "password", "role": "user", "name": "New User"},
        headers=headers
    )
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["email"] == "newuser@test.com"
    assert created_data["role"] == "user"
    
    # 2. Allowed: GET /users (List users)
    users_resp = auth_client.get("/users", headers=headers)
    assert users_resp.status_code == 200
    assert len(users_resp.json()) == 4


def test_get_audit_logs_permissions(auth_client, setup_users_and_device, db_session):
    """Test permissions for retrieving audit logs."""
    from app.database import AuditLog
    from datetime import datetime, timedelta

    # Seed some audit logs with explicit creation times to ensure ordering
    log1 = AuditLog(
        user_id="superadmin@test.com",
        action="test_action_1",
        resource_type="user",
        resource_id="user1@test.com",
        created_at=datetime.utcnow() - timedelta(minutes=5)
    )
    log2 = AuditLog(
        user_id="superadmin@test.com",
        action="test_action_2",
        resource_type="user",
        resource_id="user2@test.com",
        created_at=datetime.utcnow()
    )
    db_session.add(log1)
    db_session.add(log2)
    db_session.commit()

    # 1. Superadmin should succeed
    token_superadmin = create_access_token({"username": "superadmin@test.com", "role": "superadmin"})
    headers_superadmin = {"Authorization": f"Bearer {token_superadmin}"}
    resp = auth_client.get("/users/audit/logs?skip=0&limit=10", headers=headers_superadmin)
    assert resp.status_code == 200
    data = resp.json()
    assert "logs" in data
    assert "total" in data
    assert data["total"] >= 2
    assert len(data["logs"]) >= 2
    # Check that they are ordered descending (created_at desc)
    assert data["logs"][0]["action"] == "test_action_2"
    assert data["logs"][1]["action"] == "test_action_1"

    # 2. Admin should fail with 403
    token_admin = create_access_token({"username": "admin@test.com", "role": "admin"})
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    resp = auth_client.get("/users/audit/logs", headers=headers_admin)
    assert resp.status_code == 403

    # 3. User should fail with 403
    token_user = create_access_token({"username": "user@test.com", "role": "user"})
    headers_user = {"Authorization": f"Bearer {token_user}"}
    resp = auth_client.get("/users/audit/logs", headers=headers_user)
    assert resp.status_code == 403

