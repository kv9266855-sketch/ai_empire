import hashlib
import secrets
from datetime import timedelta, timezone
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import select, func, delete, text
from .config import settings
from .db import get_db
from .models import AuthSession, Owner, RateEvent, now

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))

def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()

def ip_hash(request):
    ip = request.client.host if request.client else 'unknown'
    return hashlib.sha256((settings.ip_hash_salt + ip).encode()).hexdigest()

def audit(db, actor, action, resource_id=''):
    from .models import Audit
    db.add(Audit(actor=actor, action=action, resource_id=resource_id))

def enforce_rate(db, bucket, limits):
    # Transaction-scoped PostgreSQL lock prevents concurrent workers racing the count.
    if db.bind.dialect.name == 'postgresql':
        lock = int.from_bytes(hashlib.sha256(bucket.encode()).digest()[:8], 'big', signed=True)
        db.execute(text('SELECT pg_advisory_xact_lock(:lock)'), {'lock':lock})
    stamp = now()
    db.execute(delete(RateEvent).where(RateEvent.created_at < stamp - timedelta(days=2)))
    for seconds, limit in limits:
        n = db.scalar(select(func.count()).select_from(RateEvent).where(RateEvent.bucket == bucket, RateEvent.created_at >= stamp - timedelta(seconds=seconds)))
        if n >= limit:
            db.rollback()
            raise HTTPException(429, 'rate_limited', headers={'Retry-After':str(seconds)})
    db.add(RateEvent(bucket=bucket))
    db.commit()

def owner_session(request: Request, db=Depends(get_db)):
    token = request.cookies.get('empire_session', '')
    session = db.get(AuthSession, token_hash(token)) if token else None
    expiry = session.expires_at.replace(tzinfo=timezone.utc) if session and session.expires_at.tzinfo is None else (session.expires_at if session else None)
    if not session or expiry <= now(): raise HTTPException(401, 'authentication_required')
    owner = db.get(Owner, session.owner_id)
    if not owner or owner.role != 'owner': raise HTTPException(403, 'owner_required')
    if request.method not in {'GET','HEAD','OPTIONS'}:
        supplied = request.headers.get('X-CSRF-Token','')
        if not secrets.compare_digest(supplied, session.csrf): raise HTTPException(403, 'csrf_failed')
    return owner, session
