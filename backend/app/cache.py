"""
Redis-backed cache helper with graceful fallback when Redis is unavailable.
"""
import json
import logging

logger = logging.getLogger(__name__)

class RedisCache:
    def __init__(self, redis_url=None):
        self.client = None
        if not redis_url:
            logger.debug("No redis_url provided; cache disabled")
            return
        try:
            import redis
            self.client = redis.from_url(redis_url)
            # quick check
            self.client.ping()
            logger.info("Connected to Redis for caching")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}); cache disabled")
            self.client = None

    def get(self, key):
        if not self.client:
            return None
        try:
            raw = self.client.get(key)
            if not raw:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.debug(f"Redis get error: {e}")
            return None

    def set(self, key, value, ex=30):
        if not self.client:
            return False
        try:
            self.client.set(key, json.dumps(value, default=str), ex=ex)
            return True
        except Exception as e:
            logger.debug(f"Redis set error: {e}")
            return False

    def invalidate_device(self, device_id):
        if not self.client:
            return 0
        try:
            pattern = f"device:{device_id}:data:*"
            keys = self.client.keys(pattern)
            if not keys:
                return 0
            count = 0
            for k in keys:
                self.client.delete(k)
                count += 1
            return count
        except Exception as e:
            logger.debug(f"Redis invalidate error: {e}")
            return 0
