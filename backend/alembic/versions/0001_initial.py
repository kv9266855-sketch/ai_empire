"""Initial CRM, catalog, owner sessions, agent tasks and audit schema."""
from alembic import op
import sqlalchemy as sa

revision='0001'
down_revision=None
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('owners',sa.Column('id',sa.String(36),primary_key=True),sa.Column('email',sa.String(254),nullable=False,unique=True),sa.Column('password_hash',sa.Text(),nullable=False),sa.Column('role',sa.String(20),nullable=False))
    op.create_table('auth_sessions',sa.Column('id',sa.String(64),primary_key=True),sa.Column('owner_id',sa.String(36),sa.ForeignKey('owners.id',ondelete='CASCADE'),nullable=False),sa.Column('csrf',sa.String(128),nullable=False),sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('leads',sa.Column('id',sa.String(36),primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('name',sa.String(80),nullable=False),sa.Column('contact',sa.String(120),nullable=False),sa.Column('service',sa.String(30),nullable=False),sa.Column('budget',sa.String(30),nullable=False),sa.Column('message',sa.Text(),nullable=False),sa.Column('lang',sa.String(3),nullable=False),sa.Column('page',sa.String(200),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('notes',sa.Text(),nullable=False),sa.Column('consent_at',sa.DateTime(timezone=True),nullable=False),sa.Column('ip_hash',sa.String(64),nullable=False))
    op.create_index('ix_leads_created_at','leads',['created_at']);op.create_index('ix_leads_status','leads',['status'])
    op.create_table('records',sa.Column('id',sa.String(36),primary_key=True),sa.Column('kind',sa.String(30),nullable=False),sa.Column('data',sa.JSON(),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False));op.create_index('ix_records_kind','records',['kind'])
    op.create_table('configuration',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('monthly_budget_usd',sa.Float(),nullable=False),sa.Column('automation_enabled',sa.Boolean(),nullable=False))
    op.create_table('ai_tasks',sa.Column('id',sa.String(36),primary_key=True),sa.Column('agent_id',sa.String(36),sa.ForeignKey('records.id'),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('prompt',sa.Text(),nullable=False),sa.Column('output',sa.Text(),nullable=False),sa.Column('error',sa.String(300),nullable=False),sa.Column('reserved_usd',sa.Float(),nullable=False),sa.Column('cost_usd',sa.Float(),nullable=False),sa.Column('cancel_requested',sa.Boolean(),nullable=False))
    op.create_index('ix_ai_tasks_created_at','ai_tasks',['created_at']);op.create_index('ix_ai_tasks_status','ai_tasks',['status'])
    op.create_table('task_logs',sa.Column('id',sa.String(36),primary_key=True),sa.Column('task_id',sa.String(36),sa.ForeignKey('ai_tasks.id'),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('level',sa.String(20),nullable=False),sa.Column('message',sa.Text(),nullable=False));op.create_index('ix_task_logs_task_id','task_logs',['task_id'])
    op.create_table('audit_log',sa.Column('id',sa.String(36),primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('actor',sa.String(254),nullable=False),sa.Column('action',sa.String(100),nullable=False),sa.Column('resource_id',sa.String(80),nullable=False));op.create_index('ix_audit_log_created_at','audit_log',['created_at'])
    op.create_table('rate_events',sa.Column('id',sa.String(36),primary_key=True),sa.Column('bucket',sa.String(100),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False));op.create_index('ix_rate_events_bucket','rate_events',['bucket']);op.create_index('ix_rate_events_created_at','rate_events',['created_at'])

def downgrade():
    for table in ['rate_events','audit_log','task_logs','ai_tasks','configuration','records','leads','auth_sessions','owners']:op.drop_table(table)
