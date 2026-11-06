"""Small in-process sliding-window rate limit for the expensive generate endpoints."""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

WINDOW_SECONDS = 60.0

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limit() -> None:
    with _lock:
        _hits.clear()


def enforce_rate_limit(request: Request) -> None:
    limit = get_settings().rate_limit_per_minute
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _lock:
        hits = _hits[client]
        while hits and now - hits[0] > WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = int(WINDOW_SECONDS - (now - hits[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many generation requests. Please wait and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
