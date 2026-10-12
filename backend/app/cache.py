import json
import os
from typing import Any


class Cache:
    def __init__(self) -> None:
        self._memory: dict[str, str] = {}
        self._client = None
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            return

        try:
            import redis

            self._client = redis.Redis.from_url(redis_url, decode_responses=True)
            self._client.ping()
        except Exception:
            self._client = None

    def get_json(self, key: str) -> Any | None:
        raw = self._client.get(key) if self._client else self._memory.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        raw = json.dumps(value, default=str)
        if self._client:
            self._client.setex(key, ttl_seconds, raw)
        else:
            self._memory[key] = raw


cache = Cache()
