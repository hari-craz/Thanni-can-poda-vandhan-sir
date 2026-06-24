"""
Hydronix Backend - NTP Time Synchronization Utility.
Provides a reference clock aligned with NTP to survive server-side host time drift.
"""
import socket
import struct
import time
import logging
import threading
from datetime import datetime, timezone
from .config import settings

logger = logging.getLogger(__name__)

class TimeSynchronizer:
    """
    Maintains a global NTP-adjusted reference time.
    Uses UDP port 123 client requests to query pool.ntp.org.
    """
    def __init__(self, ntp_server: str = "pool.ntp.org", ntp_port: int = 123, timeout: float = 5.0):
        self.ntp_server = ntp_server
        self.ntp_port = ntp_port
        self.timeout = timeout
        self._offset = 0.0  # seconds to add to local time: ntp_time - local_time
        self._is_synchronized = False
        self._lock = threading.Lock()

    def sync_time_sync(self) -> bool:
        """
        Synchronously queries NTP server and updates the offset.
        Safe to call from a thread pool or background thread.
        """
        # NTP request packet: 48 bytes with first byte 0x1b (LI=0, VN=3, Mode=3 client)
        packet = bytearray(48)
        packet[0] = 0x1b
        
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
                client.settimeout(self.timeout)
                client.sendto(packet, (self.ntp_server, self.ntp_port))
                data, _ = client.recvfrom(48)
            
            if data:
                # Unpack 12 unsigned integers (48 bytes total)
                unpacked = struct.unpack("!12I", data)
                # The 11th integer (index 10) is the transmit timestamp seconds since 1900
                ntp_seconds = unpacked[10]
                # Offset between Unix epoch (1970) and NTP epoch (1900) is 2208988800 seconds
                unix_time = ntp_seconds - 2208988800
                local_now = time.time()
                
                with self._lock:
                    self._offset = unix_time - local_now
                    self._is_synchronized = True
                
                logger.info(
                    "NTP synchronization successful. Host offset: %.4fs (adjusted: %s)",
                    self._offset,
                    time.ctime(unix_time)
                )
                return True
        except Exception as e:
            logger.warning("NTP synchronization failed with %s:%d: %s", self.ntp_server, self.ntp_port, e)
        return False

    def get_current_time(self) -> float:
        """
        Returns NTP-adjusted Unix epoch time in seconds.
        """
        with self._lock:
            return time.time() + self._offset

    def get_current_datetime(self) -> datetime:
        """
        Returns NTP-adjusted UTC datetime object (naive, matching datetime.utcnow()).
        """
        return datetime.fromtimestamp(self.get_current_time(), tz=timezone.utc).replace(tzinfo=None)

    @property
    def is_synchronized(self) -> bool:
        with self._lock:
            return self._is_synchronized

    @property
    def offset(self) -> float:
        with self._lock:
            return self._offset


# Expose a global singleton instance configured with application settings
time_synchronizer = TimeSynchronizer(
    ntp_server=settings.ntp_server,
    ntp_port=settings.ntp_port
)
