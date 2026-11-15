"""public theme setting

Revision ID: 0002_public_theme
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_public_theme'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('configuration', sa.Column('public_theme', sa.String(20), nullable=False, server_default='winter'))

def downgrade():
    op.drop_column('configuration', 'public_theme')
