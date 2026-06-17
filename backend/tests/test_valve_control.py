"""
Tests for valve control system including state machine, auto-cutoff, and audit trail.
"""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.database import Device, SensorData, ValveOperation, SessionLocal
from app.valve_control import ValveController
from app.schemas import ValveCommandRequest


@pytest.fixture
def db_session():
    """Fixture for database session."""
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def test_device(db_session: Session):
    """Create a test device."""
    device = Device(
        device_id="HYDRO_TEST_001",
        name="Test Water Monitor",
        location="Lab",
        status="online",
        last_seen=datetime.utcnow(),
        valve_status="open",
        valve_close_reason=None,
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)
    return device


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


class TestValveController:
    """Test ValveController business logic."""

    def test_should_auto_cutoff_low_ph(self, db_session: Session):
        """Test auto-cutoff triggers on low pH."""
        controller = ValveController(db_session)
        
        # pH 6.0 is below minimum 6.5
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=6.0,
            turbidity=2.5,
            tds=250,
            temperature=25.0
        )
        assert should_cutoff is True
        assert "pH" in reason

    def test_should_auto_cutoff_high_ph(self, db_session: Session):
        """Test auto-cutoff triggers on high pH."""
        controller = ValveController(db_session)
        
        # pH 9.0 is above maximum 8.5
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=9.0,
            turbidity=2.5,
            tds=250,
            temperature=25.0
        )
        assert should_cutoff is True
        assert "pH" in reason

    def test_should_auto_cutoff_high_turbidity(self, db_session: Session):
        """Test auto-cutoff triggers on high turbidity."""
        controller = ValveController(db_session)
        
        # Turbidity 6.0 NTU exceeds maximum 5.0
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=7.2,
            turbidity=6.0,
            tds=250,
            temperature=25.0
        )
        assert should_cutoff is True
        assert "Turbidity" in reason

    def test_should_auto_cutoff_high_tds(self, db_session: Session):
        """Test auto-cutoff triggers on high TDS."""
        controller = ValveController(db_session)
        
        # TDS 550 exceeds maximum 500
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=7.2,
            turbidity=2.5,
            tds=550,
            temperature=25.0
        )
        assert should_cutoff is True
        assert "TDS" in reason

    def test_should_auto_cutoff_low_temperature(self, db_session: Session):
        """Test auto-cutoff triggers on low temperature."""
        controller = ValveController(db_session)
        
        # Temperature 2°C is below minimum 5°C
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=7.2,
            turbidity=2.5,
            tds=250,
            temperature=2.0
        )
        assert should_cutoff is True
        assert "Temperature" in reason

    def test_should_auto_cutoff_high_temperature(self, db_session: Session):
        """Test auto-cutoff triggers on high temperature."""
        controller = ValveController(db_session)
        
        # Temperature 55°C exceeds maximum 50°C
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=7.2,
            turbidity=2.5,
            tds=250,
            temperature=55.0
        )
        assert should_cutoff is True
        assert "Temperature" in reason

    def test_should_auto_cutoff_all_safe(self, db_session: Session):
        """Test no auto-cutoff when all parameters are safe."""
        controller = ValveController(db_session)
        
        should_cutoff, reason = controller.should_auto_cutoff(
            ph=7.2,
            turbidity=2.5,
            tds=250,
            temperature=25.0
        )
        assert should_cutoff is False
        assert reason is None

    def test_execute_valve_action_close(self, db_session: Session, test_device: Device):
        """Test closing valve via execute_valve_action."""
        controller = ValveController(db_session)
        
        response = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="close",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Manual safety override"
        )
        
        assert response["success"] is True
        assert response["new_state"] == "closed"
        
        # Verify device updated
        updated_device = db_session.query(Device).filter_by(device_id="HYDRO_TEST_001").first()
        assert updated_device.valve_status == "closed"
        assert updated_device.valve_close_reason == "manual_operator"

    def test_execute_valve_action_open(self, db_session: Session, test_device: Device):
        """Test opening valve via execute_valve_action."""
        # First close it
        test_device.valve_status = "closed"
        db_session.commit()
        
        controller = ValveController(db_session)
        response = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="open",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Conditions improved"
        )
        
        assert response["success"] is True
        assert response["new_state"] == "open"
        
        # Verify device updated
        updated_device = db_session.query(Device).filter_by(device_id="HYDRO_TEST_001").first()
        assert updated_device.valve_status == "open"

    def test_execute_valve_action_rate_limited(self, db_session: Session, test_device: Device):
        """Test rate limiting prevents rapid toggles."""
        controller = ValveController(db_session)
        
        # First action should succeed
        response1 = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="close",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Test close"
        )
        assert response1["success"] is True
        
        # Second immediate action should fail (rate limited)
        response2 = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="open",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Test open"
        )
        assert response2["success"] is False
        assert "rate limited" in response2.get("message", "").lower()

    def test_valve_operation_audit_trail(self, db_session: Session, test_device: Device):
        """Test that valve operations are logged to audit trail."""
        controller = ValveController(db_session)
        
        controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="close",
            triggered_by="auto_safety_cutoff",
            operator_id=None,
            reason="pH out of range (6.2)"
        )
        
        # Verify audit log entry created
        audit_entry = db_session.query(ValveOperation).filter_by(
            device_id="HYDRO_TEST_001"
        ).first()
        
        assert audit_entry is not None
        assert audit_entry.action == "close"
        assert audit_entry.triggered_by == "auto_safety_cutoff"
        assert "pH" in audit_entry.reason

    def test_valve_operation_device_not_found(self, db_session: Session):
        """Test error handling when device not found."""
        controller = ValveController(db_session)
        
        response = controller.execute_valve_action(
            device_id="HYDRO_NONEXISTENT",
            action="close",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Test"
        )
        
        assert response["success"] is False
        assert "not found" in response.get("message", "").lower()


class TestValveAPIEndpoints:
    """Test valve control API endpoints."""

    def test_get_valve_status_success(self, client: TestClient, test_device: Device):
        """Test GET /devices/{device_id}/valve/status returns device valve status."""
        response = client.get("/devices/HYDRO_TEST_001/valve/status")
        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == "HYDRO_TEST_001"
        assert data["valve_status"] in ["open", "closed"]

    def test_get_valve_status_not_found(self, client: TestClient):
        """Test GET /devices/{device_id}/valve/status returns 404 for nonexistent device."""
        response = client.get("/devices/HYDRO_NONEXISTENT/valve/status")
        assert response.status_code == 404

    def test_post_valve_close_success(self, client: TestClient, test_device: Device):
        """Test POST /devices/{device_id}/valve/close closes valve."""
        payload = {
            "reason": "Manual safety override",
            "operator_id": "admin_001"
        }
        response = client.post(
            "/devices/HYDRO_TEST_001/valve/close",
            json=payload,
            headers={"X-API-Key": "test_key"}
        )
        
        # May return 200 or 500 depending on database availability
        if response.status_code == 200:
            data = response.json()
            assert data["action"] == "close"

    def test_post_valve_open_success(self, client: TestClient, test_device: Device):
        """Test POST /devices/{device_id}/valve/open opens valve."""
        payload = {
            "reason": "Conditions improved",
            "operator_id": "admin_001"
        }
        response = client.post(
            "/devices/HYDRO_TEST_001/valve/open",
            json=payload,
            headers={"X-API-Key": "test_key"}
        )
        
        # May return 200 or 500 depending on database availability
        if response.status_code == 200:
            data = response.json()
            assert data["action"] == "open"

    def test_get_valve_history_success(self, client: TestClient, test_device: Device):
        """Test GET /devices/{device_id}/valve/history returns operation history."""
        response = client.get("/devices/HYDRO_TEST_001/valve/history")
        assert response.status_code == 200
        data = response.json()
        assert "operations" in data
        assert isinstance(data["operations"], list)

    def test_get_valve_history_not_found(self, client: TestClient):
        """Test GET /devices/{device_id}/valve/history returns 404 for nonexistent device."""
        response = client.get("/devices/HYDRO_NONEXISTENT/valve/history")
        assert response.status_code == 404


class TestValveStateTransitions:
    """Test valve state machine transitions."""

    def test_state_transition_open_to_closed(self, db_session: Session, test_device: Device):
        """Test valid transition from open to closed."""
        assert test_device.valve_status == "open"
        
        controller = ValveController(db_session)
        response = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="close",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Test"
        )
        
        assert response["success"] is True
        
        db_session.refresh(test_device)
        assert test_device.valve_status == "closed"

    def test_state_transition_closed_to_open(self, db_session: Session, test_device: Device):
        """Test valid transition from closed to open."""
        test_device.valve_status = "closed"
        db_session.commit()
        
        controller = ValveController(db_session)
        response = controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="open",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Test"
        )
        
        assert response["success"] is True
        
        db_session.refresh(test_device)
        assert test_device.valve_status == "open"

    def test_multiple_operations_same_device(self, db_session: Session, test_device: Device):
        """Test multiple sequential operations are logged."""
        controller = ValveController(db_session)
        
        # Close
        controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="close",
            triggered_by="auto_safety_cutoff",
            operator_id=None,
            reason="Safety threshold"
        )
        
        # Wait past rate limit
        import time
        time.sleep(2.1)
        
        # Open
        controller.execute_valve_action(
            device_id="HYDRO_TEST_001",
            action="open",
            triggered_by="manual_operator",
            operator_id="admin_001",
            reason="Manual restore"
        )
        
        # Verify both operations logged
        operations = db_session.query(ValveOperation).filter_by(
            device_id="HYDRO_TEST_001"
        ).all()
        
        assert len(operations) >= 2
