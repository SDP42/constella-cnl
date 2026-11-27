"""Response cache for read-only API calls.

Render's free instance has 0.1 CPU, so pandas/scikit-learn pages take seconds to compute. Most reads are identical
between visits (the demo data changes only through user actions), so a successful GET response is kept in memory and
replayed until data changes:

* keyed by method + path + query + the *verified* caller (role, rep, region, account), so roles never share answers
  and a forged token cannot read cached data (the signature is checked before any lookup);
* any write request (POST / PATCH / DELETE) clears the whole cache, so a user always sees the result of their action;
* entries filled at run time expire after ``TTL_S``; entries baked at build time (``app.bake``) stay until the first write;
* never cached: auth, health, copilot / agent, audit and security reads, WebSocket, non-200 or large responses.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any

from app.core.security import verify_token

TTL_S = 300
MAX_BODY = 2_000_000
SKIP = ("/api/auth", "/api/health", "/api/ws", "/api/agent", "/api/copilot", "/api/audit", "/api/security")
_store: dict[str, tuple[float | None, int, dict[str, str], bytes]] = {}


def identity(authorization: str | None) -> str | None:
    """Stable identity for the cache key, or None when the token is missing / invalid (then: no caching)."""
    if not authorization:
        return "public"
    if not authorization.lower().startswith("bearer "):
        return None
    try:
        c = verify_token(authorization.split(" ", 1)[1])
    except Exception:  # noqa: BLE001 — invalid / expired: let the route answer 401 itself
        return None
    return "|".join(str(c.get(k)) for k in ("sub", "role", "rep_id", "region", "account_id"))


def claims_of(authorization: str | None) -> dict[str, Any] | None:
    try:
        return verify_token(authorization.split(" ", 1)[1]) if authorization else None
    except Exception:  # noqa: BLE001
        return None


def key(path: str, query: str, who: str, gzip: bool) -> str:
    raw = f"GET {path}?{'&'.join(sorted(query.split('&'))) if query else ''}|{who}|{'gz' if gzip else 'id'}"
    return hashlib.sha1(raw.encode()).hexdigest()


def cacheable(method: str, path: str) -> bool:
    return method == "GET" and path.startswith("/api/") and not path.startswith(SKIP)


def get(k: str) -> tuple[int, dict[str, str], bytes] | None:
    hit = _store.get(k)
    if not hit:
        return None
    expires, status, headers, body = hit
    if expires is not None and expires < time.time():
        _store.pop(k, None)
        return None
    return status, headers, body


def put(k: str, status: int, headers: dict[str, str], body: bytes, baked: bool = False) -> None:
    if status == 200 and len(body) <= MAX_BODY:
        _store[k] = (None if baked else time.time() + TTL_S, status, headers, body)


def clear() -> None:
    _store.clear()


def export() -> dict[str, tuple[int, dict[str, str], bytes]]:
    return {k: (st, h, b) for k, (_e, st, h, b) in _store.items()}


def load(entries: dict[str, tuple[int, dict[str, str], bytes]]) -> None:
    for k, (st, h, b) in entries.items():
        _store[k] = (None, st, h, b)


def size() -> int:
    return len(_store)
