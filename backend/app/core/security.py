"""Security layer: signed tokens, role-based access, territory scoping, PII masking, rate limits.

Prototype choices (production equivalents in docs/SECURITY.md):
  * Tokens: HMAC-SHA256 signed, expiring, stateless (production: OIDC via Azure AD / Google SSO).
  * RBAC: rep | head | architect | steward | partner, enforced per endpoint.
  * Row-level scoping: a rep only sees accounts in their territory or opportunities they lead/assist.
  * PII masking: GSTIN / PAN / phone are masked for roles that do not need them.
  * Rate limiting: in-memory token bucket per client IP (production: Redis / API gateway).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "head": {"read:all", "act:any", "reassign", "clock", "pilot", "model", "data:read", "pii:view", "capture", "compose"},
    "rep": {"read:territory", "act:own", "capture", "model"},
    "architect": {"read:all", "act:solution", "compose", "model", "capture"},
    "steward": {"read:all", "data:read", "data:write", "pii:view", "model"},
    "partner": {"read:own_account"},
}


@dataclass
class Principal:
    sub: str
    name: str
    role: str
    rep_id: int | None
    region: str | None
    account_id: int | None = None

    def can(self, perm: str) -> bool:
        return perm in ROLE_PERMISSIONS.get(self.role, set())


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_token(claims: dict[str, Any], ttl_s: int = 8 * 3600) -> str:
    body = {**claims, "iat": int(time.time()), "exp": int(time.time()) + ttl_s, "jti": secrets.token_hex(8)}
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    sig = _b64(hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str) -> dict[str, Any]:
    try:
        payload, sig = token.split(".")
    except ValueError as e:
        raise HTTPException(401, "malformed token") from e
    good = _b64(hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(good, sig):
        raise HTTPException(401, "bad signature")
    claims = json.loads(_unb64(payload))
    if claims.get("exp", 0) < time.time():
        raise HTTPException(401, "token expired")
    return claims


def current_principal(request: Request, cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal:
    if not cred:
        raise HTTPException(401, "authentication required", headers={"WWW-Authenticate": "Bearer"})
    c = verify_token(cred.credentials)
    p = Principal(sub=c["sub"], name=c["name"], role=c["role"], rep_id=c.get("rep_id"),
                  region=c.get("region"), account_id=c.get("account_id"))
    request.state.principal = p
    return p


def require(perm: str):
    def dep(p: Principal = Depends(current_principal)) -> Principal:
        if not p.can(perm):
            raise HTTPException(403, f"role '{p.role}' lacks permission '{perm}'")
        return p

    return dep


def mask(value: str | None, keep_start: int = 2, keep_end: int = 3) -> str | None:
    if not value:
        return value
    if len(value) <= keep_start + keep_end:
        return "•" * len(value)
    return value[:keep_start] + "•" * (len(value) - keep_start - keep_end) + value[-keep_end:]


def can_see_account(p: Principal, account: Any, opp_rep_ids: set[int] | None = None) -> bool:
    if p.can("read:all"):
        return True
    if p.role == "partner":
        return account.id == p.account_id
    if p.role == "rep":
        return (account.region == p.region or account.owner_rep_id == p.rep_id
                or bool(opp_rep_ids and p.rep_id in opp_rep_ids))
    return False


class RateLimiter:
    """Token bucket per (client, bucket)."""

    def __init__(self) -> None:
        self.state: dict[tuple[str, str], tuple[float, float]] = defaultdict(lambda: (0.0, 0.0))

    def allow(self, key: str, bucket: str, rate_per_min: int) -> bool:
        tokens, last = self.state[(key, bucket)]
        now = time.monotonic()
        if last == 0.0:
            tokens = float(rate_per_min)
        tokens = min(float(rate_per_min), tokens + (now - last) * rate_per_min / 60.0)
        if tokens < 1:
            self.state[(key, bucket)] = (tokens, now)
            return False
        self.state[(key, bucket)] = (tokens - 1, now)
        return True


limiter = RateLimiter()

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store",
}
