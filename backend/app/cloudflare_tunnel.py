"""
Cloudflare Tunnel Integration for Hydronix v2.0.0 (HTTPS-only transport).

Provides utilities for:
- Validating Cloudflare Tunnel connectivity
- Communicating with devices via HTTPS
- Managing API endpoint configuration
- Health checking and diagnostics
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import httpx
from .config import settings

logger = logging.getLogger(__name__)


class CloudflareTunnelManager:
    """Manage Cloudflare Tunnel connectivity and device communication."""
    
    def __init__(self):
        self.tunnel_url = settings.cloudflare_tunnel_url
        self.device_api_endpoint = settings.device_api_endpoint
        self.timeout_sec = settings.device_api_timeout_sec
        self.https_only = settings.https_only
        self._verified = False
    
    async def verify_tunnel_connectivity(self) -> bool:
        """
        Verify that Cloudflare Tunnel is accessible.
        
        Returns:
            True if tunnel responds, False otherwise
        """
        if not self.tunnel_url:
            logger.warning("Cloudflare Tunnel URL not configured")
            return False
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
                response = await client.get(f"{self.tunnel_url}/health")
                self._verified = response.status_code == 200
                logger.info(f"Cloudflare Tunnel connectivity: {'OK' if self._verified else 'FAILED'}")
                return self._verified
        except Exception as e:
            logger.error(f"Failed to verify Cloudflare Tunnel: {e}")
            self._verified = False
            return False
    
    async def send_valve_command(self, device_id: str, action: str) -> bool:
        """
        Send valve control command to device via HTTPS.
        
        Args:
            device_id: Device identifier (HYDRO_###)
            action: "open" or "close"
        
        Returns:
            True if command sent successfully, False otherwise
        """
        if not self.device_api_endpoint:
            logger.error("Device API endpoint not configured")
            return False
        
        endpoint = f"{self.device_api_endpoint}/devices/{device_id}/valve/command"
        payload = {
            "action": action,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 200:
                    logger.info(f"Valve command sent to {device_id}: {action}")
                    return True
                else:
                    logger.error(f"Valve command failed for {device_id}: {response.status_code}")
                    return False
        except Exception as e:
            logger.exception(f"Error sending valve command to {device_id}: {e}")
            return False
    
    def get_device_endpoint(self, device_id: str) -> str:
        """Get the HTTPS endpoint for a device."""
        return f"{self.device_api_endpoint}/devices/{device_id}"
    
    def validate_https_url(self, url: str) -> bool:
        """
        Validate that a URL is HTTPS-compliant.
        
        Args:
            url: URL to validate
        
        Returns:
            True if URL is valid HTTPS, False otherwise
        """
        if self.https_only and not url.startswith("https://"):
            logger.warning(f"HTTPS-only enforcement: rejecting {url}")
            return False
        return True
    
    def get_tunnel_status(self) -> Dict[str, Any]:
        """Get current tunnel configuration and status."""
        return {
            "enabled": settings.cloudflare_tunnel_enabled,
            "https_only": self.https_only,
            "tunnel_url": self.tunnel_url,
            "device_api_endpoint": self.device_api_endpoint,
            "verified": self._verified,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }


# Global instance
tunnel_manager = CloudflareTunnelManager()


async def init_cloudflare_tunnel():
    """
    Initialize Cloudflare Tunnel on startup.
    Verify connectivity and log configuration.
    """
    if not settings.cloudflare_tunnel_enabled:
        logger.info("Cloudflare Tunnel disabled in configuration")
        return
    
    logger.info("Initializing Cloudflare Tunnel integration...")
    logger.info(f"  Device API Endpoint: {settings.device_api_endpoint}")
    logger.info(f"  HTTPS-Only: {settings.https_only}")
    logger.info(f"  HSTS Enabled: {settings.hsts_max_age_seconds > 0}")
    
    # Verify tunnel connectivity
    is_connected = await tunnel_manager.verify_tunnel_connectivity()
    if is_connected:
        logger.info("✓ Cloudflare Tunnel is accessible and operational")
    else:
        logger.warning("⚠ Cloudflare Tunnel connectivity check failed — devices may not be able to reach backend")


def get_https_enforcement_headers() -> Dict[str, str]:
    """Get HTTP headers for HTTPS enforcement and security."""
    headers = {
        "Strict-Transport-Security": f"max-age={settings.hsts_max_age_seconds}",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
    }
    if settings.hsts_include_subdomains:
        headers["Strict-Transport-Security"] += "; includeSubDomains"
    if settings.hsts_preload:
        headers["Strict-Transport-Security"] += "; preload"
    return headers
