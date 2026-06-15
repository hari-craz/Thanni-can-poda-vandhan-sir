"""Test configuration and fixtures."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker, Session

# Set up test database
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    # Import models and create tables
    from app.database import Base
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(engine):
    """Create a fresh database session for each test."""
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    
    session = TestingSessionLocal()
    
    yield session
    
    session.rollback()
    session.close()


@pytest.fixture(scope="function")
def test_client(db_session):
    """Create a FastAPI test client with a test database."""
    from app.main import app
    from app.database import get_db
    
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
def test_device(db_session):
    """Create a test device."""
    from app.database import Device
    
    device = Device(
        device_id="HYDRO_TEST_001",
        status="online",
        firmware_version="1.0.0",
        last_heartbeat_timestamp="2026-06-15T13:00:00Z"
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)
    return device


@pytest.fixture
def test_api_key(db_session, test_device):
    """Create a test API key."""
    from app.database import APIKey
    from app.auth import hash_api_key
    from datetime import datetime, timedelta
    
    test_key = "hydro_HYDRO_TEST_001_test_token_1234567890abcdef"
    hashed = hash_api_key(test_key)
    
    api_key = APIKey(
        device_id="HYDRO_TEST_001",
        key_hash=hashed,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=90),
        is_active=True,
        is_revoked=False
    )
    db_session.add(api_key)
    db_session.commit()
    db_session.refresh(api_key)
    
    return {"key": test_key, "db_key": api_key}


@pytest.fixture
def sample_sensor_data():
    """Sample sensor data for testing."""
    return {
        "device_id": "HYDRO_TEST_001",
        "timestamp": "2026-06-15T13:00:00Z",
        "timestamp_source": "device",
        "ph": 7.2,
        "turbidity": 2.5,
        "tds": 250,
        "temperature": 25.5,
        "flow_rate": 5.2,
        "device_reset_count": 0,
        "seq_no": 1
    }
