from unittest.mock import MagicMock, patch
import pytest
import io

@patch("minio.Minio")
def test_firmware_upload_and_download(mock_minio, test_client, test_device):
    # Mock minio client instance
    mock_client_instance = MagicMock()
    mock_minio.return_value = mock_client_instance
    mock_client_instance.bucket_exists.return_value = True
    
    # Mock download stream
    mock_client_instance.get_object.return_value = io.BytesIO(b"dummy_firmware_binary")

    # 1. Test POST /devices/firmware/upload
    file_data = {"file": ("firmware.bin", b"dummy_firmware_binary", "application/octet-stream")}
    data = {
        "device_id": "HYDRO_001",
        "version": "1.1.0",
        "signature": "sha256-signature",
        "release_notes": "Improved sensor logic"
    }
    
    resp = test_client.post("/devices/firmware/upload", data=data, files=file_data)
    assert resp.status_code == 200, resp.text
    json_data = resp.json()
    assert json_data["version"] == "1.1.0"
    assert "download" in json_data["url"]
    
    # 2. Test GET /devices/HYDRO_001/firmware/latest
    resp_latest = test_client.get("/devices/HYDRO_001/firmware/latest")
    assert resp_latest.status_code == 200
    assert resp_latest.json()["version"] == "1.1.0"
    
    # 3. Test GET /devices/HYDRO_001/firmware/download
    resp_download = test_client.get("/devices/HYDRO_001/firmware/download?version=1.1.0")
    assert resp_download.status_code == 200
    assert resp_download.content == b"dummy_firmware_binary"

    # 4. Test POST /devices/HYDRO_001/firmware/status
    status_data = {
        "status": "success",
        "version": "1.1.0"
    }
    resp_status = test_client.post("/devices/HYDRO_001/firmware/status", json=status_data)
    assert resp_status.status_code == 200
    assert resp_status.json()["ok"] is True
    assert resp_status.json()["version"] == "1.1.0"


@patch("httpx.post")
def test_alert_notifications_slack_twilio(mock_post, db_session, test_device):
    from app.notifications import send_alert_notification
    from app.database import Alert
    from app.config import settings
    from datetime import datetime
    
    # Configure settings
    settings.slack_webhook_url = "http://mock-slack-webhook.local"
    settings.twilio_account_sid = "ACmock"
    settings.twilio_auth_token = "authmock"
    settings.twilio_phone_from = "+1234567890"
    settings.twilio_phone_to = "+1098765432"
    
    # Mock httpx response side effect
    def mock_post_side_effect(url, *args, **kwargs):
        r = MagicMock()
        if "slack" in url or "Slack" in url or "hooks.slack" in url:
            r.status_code = 200
        else:
            r.status_code = 201
        return r
    mock_post.side_effect = mock_post_side_effect

    alert = Alert(
        device_id="HYDRO_001",
        severity="critical",
        message="pH level is critical: 11.2",
        triggered_at=datetime.utcnow(),
        reading_timestamp=datetime.utcnow(),
        escalation_level=0
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    
    # Trigger notifications
    res = send_alert_notification(db_session, alert)
    assert res is True
    assert mock_post.call_count >= 2
