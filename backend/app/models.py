from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

def now(): return datetime.now(timezone.utc)
def uid(): return str(uuid4())

class Owner(Base):
    __tablename__ = 'owners'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default='owner')

class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey('owners.id', ondelete='CASCADE'))
    csrf: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class Lead(Base):
    __tablename__ = 'leads'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    name: Mapped[str] = mapped_column(String(80))
    contact: Mapped[str] = mapped_column(String(120))
    service: Mapped[str] = mapped_column(String(30))
    budget: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(3))
    page: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default='new', index=True)
    notes: Mapped[str] = mapped_column(Text, default='')
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ip_hash: Mapped[str] = mapped_column(String(64))

class Record(Base):
    __tablename__ = 'records'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class Configuration(Base):
    __tablename__ = 'configuration'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    monthly_budget_usd: Mapped[float] = mapped_column(Float, default=50)
    automation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    public_theme: Mapped[str] = mapped_column(String(20), default='winter', server_default='winter')

class Task(Base):
    __tablename__ = 'ai_tasks'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    agent_id: Mapped[str] = mapped_column(ForeignKey('records.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    status: Mapped[str] = mapped_column(String(20), default='queued', index=True)
    prompt: Mapped[str] = mapped_column(Text)
    output: Mapped[str] = mapped_column(Text, default='')
    error: Mapped[str] = mapped_column(String(300), default='')
    reserved_usd: Mapped[float] = mapped_column(Float)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)

class TaskLog(Base):
    __tablename__ = 'task_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    task_id: Mapped[str] = mapped_column(ForeignKey('ai_tasks.id'), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    level: Mapped[str] = mapped_column(String(20), default='info')
    message: Mapped[str] = mapped_column(Text)

class Audit(Base):
    __tablename__ = 'audit_log'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    actor: Mapped[str] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(100))
    resource_id: Mapped[str] = mapped_column(String(80), default='')

class RateEvent(Base):
    __tablename__ = 'rate_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    bucket: Mapped[str] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
