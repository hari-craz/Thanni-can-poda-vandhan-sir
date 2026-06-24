import socket
import struct
import time
from unittest.mock import MagicMock, patch
import pytest
from app.time_sync import TimeSynchronizer

def test_time_synchronizer_default():
    """Test that TimeSynchronizer defaults to zero offset and system time."""
    sync = TimeSynchronizer()
    assert sync.offset == 0.0
    assert not sync.is_synchronized
    
    # get_current_time should align with time.time()
    diff = abs(sync.get_current_time() - time.time())
    assert diff < 0.2
    
    # get_current_datetime should be a naive datetime matching the offset
    dt = sync.get_current_datetime()
    assert dt.tzinfo is None
    from datetime import datetime
    diff_dt = abs((dt - datetime.utcnow()).total_seconds())
    assert diff_dt < 0.2

def test_time_synchronizer_mocked_sync():
    """Test that TimeSynchronizer correctly parses NTP packet and applies offset."""
    sync = TimeSynchronizer(ntp_server="mock.ntp.org", ntp_port=123, timeout=1.0)
    
    # Mock NTP time: 2026-06-24 12:00:00 UTC -> 1782292800 Unix seconds
    # NTP timestamp = 1782292800 + 2208988800 = 3991281600 seconds since 1900
    mock_ntp_epoch_sec = 1782292800
    mock_ntp_sec = mock_ntp_epoch_sec + 2208988800
    
    unpacked_data = [0] * 12
    unpacked_data[10] = mock_ntp_sec
    mock_data = struct.pack("!12I", *unpacked_data)
    
    with patch("socket.socket") as mock_socket_class:
        mock_socket = MagicMock()
        mock_socket_class.return_value.__enter__.return_value = mock_socket
        mock_socket.recvfrom.return_value = (mock_data, ("mock.ntp.org", 123))
        
        now = time.time()
        with patch("time.time", return_value=now):
            success = sync.sync_time_sync()
            
        assert success
        assert sync.is_synchronized
        assert sync.offset == mock_ntp_epoch_sec - now
        
        # Test current time retrieval incorporates the offset
        expected_time = now + sync.offset
        with patch("time.time", return_value=now):
            assert sync.get_current_time() == expected_time

def test_time_synchronizer_failure_fallback():
    """Test that TimeSynchronizer gracefully handles failures and uses fallback offset (0.0)."""
    sync = TimeSynchronizer(ntp_server="failed.ntp.org", timeout=1.0)
    
    with patch("socket.socket") as mock_socket_class:
        mock_socket = MagicMock()
        mock_socket_class.return_value.__enter__.return_value = mock_socket
        mock_socket.sendto.side_effect = socket.error("Network unreachable")
        
        success = sync.sync_time_sync()
        assert not success
        assert not sync.is_synchronized
        assert sync.offset == 0.0
