"""
Rate limiting for API requests.
Supports per-device and per-IP rate limiting using Redis.
"""
import redis
import time
import uuid
from typing import Optional
from .config import settings


class RateLimiter:
    """Rate limiter using Redis sliding window counter."""
    
    def __init__(self, redis_url: str = None):
        """Initialize Redis connection."""
        self.redis_url = redis_url or settings.redis_url
        try:
            # Parse URL format: redis://[user[:password]@]host[:port][/db]
            self.redis = redis.from_url(self.redis_url)
            self.redis.ping()
        except Exception as e:
            print(f"Warning: Redis not available: {e}. Rate limiting disabled.")
            self.redis = None
    
    def is_rate_limited(
        self,
        device_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> tuple[bool, dict]:
        """
        Check if request should be rate limited.
        Returns (is_limited, headers) where headers contain rate limit info.
        """
        headers = {}
        
        if not self.redis:
            # No Redis = no rate limiting
            return False, headers
        
        is_limited = False
        
        # Check per-device rate limit (100 req/minute)
        if device_id:
            is_limited_device, device_headers = self._check_per_device_limit(device_id)
            headers.update(device_headers)
            if is_limited_device:
                is_limited = True
        
        # Check per-IP rate limit (10k req/hour)
        if ip_address and not is_limited:
            is_limited_ip, ip_headers = self._check_per_ip_limit(ip_address)
            headers.update(ip_headers)
            if is_limited_ip:
                is_limited = True
        
        return is_limited, headers
    
    def _check_per_device_limit(self, device_id: str) -> tuple[bool, dict]:
        """Check per-device rate limit (100 req/minute)."""
        key = f"ratelimit:device:{device_id}"
        limit = settings.rate_limit_per_device_minute
        window = 60  # seconds
        
        return self._check_limit(key, limit, window)
    
    def _check_per_ip_limit(self, ip_address: str) -> tuple[bool, dict]:
        """Check per-IP rate limit (10k req/hour)."""
        key = f"ratelimit:ip:{ip_address}"
        limit = settings.rate_limit_per_ip_hour
        window = 3600  # seconds
        
        return self._check_limit(key, limit, window)
    
    def _check_limit(self, key: str, limit: int, window: int) -> tuple[bool, dict]:
        """
        Generic rate limit check using sliding window.
        Returns (is_limited, headers).
        """
        try:
            now = int(time.time())
            cutoff = now - window
            
            # Remove old entries outside the window
            self.redis.zremrangebyscore(key, 0, cutoff)
            
            # Count current requests in window
            count = self.redis.zcard(key)
            
            # Add current request (using a unique member string to prevent collisions)
            self.redis.zadd(key, {f"{now}:{uuid.uuid4()}": now})
            
            # Set key expiry to window + 1 second
            self.redis.expire(key, window + 1)
            
            # Generate response headers
            remaining = max(0, limit - count - 1)
            reset_time = now + window
            
            headers = {
                "RateLimit-Limit": str(limit),
                "RateLimit-Remaining": str(remaining),
                "RateLimit-Reset": str(reset_time),
            }
            
            is_limited = (count + 1) > limit
            
            return is_limited, headers
        except Exception as e:
            print(f"Error checking rate limit: {e}")
            # Fail open: allow the request if Redis is down
            return False, {}
