"""
MQTT Support — DEPRECATED in Hydronix v2.0.0 (HTTPS-only).

MQTT has been removed in favor of Cloudflare Tunnel HTTPS transport.
All device data now arrives via HTTPS POST to /data or /ingest endpoints.

This module provides a stub for backward compatibility.
"""
import logging

logger = logging.getLogger(__name__)


class MQTTProcessor:
    """
    Deprecated MQTT processor stub.
    MQTT is no longer supported in Hydronix v2.0.0+.
    Use HTTPS POST endpoints instead.
    """
    
    def __init__(self, on_message_callback=None):
        logger.warning(
            "MQTT is deprecated in Hydronix v2.0.0 — use HTTPS POST to /data endpoint instead"
        )
        self.on_message = on_message_callback

    def start(self):
        """Stub — MQTT not supported in v2.0.0+."""
        logger.warning(
            "MQTTProcessor.start() called but MQTT is disabled in v2.0.0. "
            "Configure device to POST to HTTPS API endpoint instead."
        )

    def stop(self):
        """Stub — no-op."""
        pass
