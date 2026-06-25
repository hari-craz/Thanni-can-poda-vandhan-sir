import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.database import get_db, User
from app.security import get_password_hash
from app.config import settings


@pytest.fixture
def client(db_session):
    """TestClient that overrides get_db but keeps default authentication behavior."""
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
def test_user(db_session):
    """Seed test database with a user account."""
    pwd_hash = get_password_hash("password123")
    user = User(
        email="user@test.com",
        hashed_password=pwd_hash,
        role="user",
        name="Standard User"
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_login_returns_csrf_token(client, test_user):
    """Verify that login generates and returns a CSRF token in the response and JWT claims."""
    response = client.post(
        "/auth/login",
        data={"username": "user@test.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "csrf_token" in data
    assert len(data["csrf_token"]) == 64  # secrets.token_hex(32) is 64 characters
    
    # Decode access token and verify claims
    payload = jwt.decode(data["access_token"], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["username"] == "user@test.com"
    assert payload["csrf_token"] == data["csrf_token"]


def test_logout_without_auth(client):
    """Verify that logout without authentication returns 401."""
    response = client.post("/auth/logout", headers={"X-CSRF-Token": "some-token"})
    assert response.status_code == 401


def test_logout_without_csrf_token_header(client, test_user):
    """Verify that logout without X-CSRF-Token header returns 422."""
    login_resp = client.post(
        "/auth/login",
        data={"username": "user@test.com", "password": "password123"}
    )
    access_token = login_resp.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.post("/auth/logout", headers=headers)
    assert response.status_code == 422


def test_logout_with_invalid_csrf_token(client, test_user):
    """Verify that logout with an incorrect CSRF token returns 403."""
    login_resp = client.post(
        "/auth/login",
        data={"username": "user@test.com", "password": "password123"}
    )
    access_token = login_resp.json()["access_token"]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": "wrong-csrf-token"
    }
    response = client.post("/auth/logout", headers=headers)
    assert response.status_code == 403
    assert response.json()["error"] == "Invalid CSRF token"


def test_logout_successful(client, test_user):
    """Verify that logout with correct JWT and CSRF token succeeds."""
    login_resp = client.post(
        "/auth/login",
        data={"username": "user@test.com", "password": "password123"}
    )
    res_data = login_resp.json()
    access_token = res_data["access_token"]
    csrf_token = res_data["csrf_token"]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": csrf_token
    }
    response = client.post("/auth/logout", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"ok": True}
