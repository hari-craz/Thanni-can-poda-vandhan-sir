"""Add v2.0.0 fields: config_version, firmware_channel, diagnostic columns, device_remote_configs table, upgrade firmwares table

Revision ID: 0002_v2_migration
Revises: 0001_initial
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0002_v2_migration'
down_revision = None  # Set to previous revision ID if chaining
branch_labels = None
depends_on = None


def upgrade():
    # ── devices table: add new columns ────────────────────────────────────────
    with op.batch_alter_table('devices') as batch_op:
        batch_op.add_column(sa.Column(
            'firmware_channel',
            sa.String(20),
            nullable=False,
            server_default='stable',
        ))
        batch_op.add_column(sa.Column(
            'config_version',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ))
        batch_op.add_column(sa.Column(
            'last_free_heap',
            sa.Integer(),
            nullable=True,
        ))
        batch_op.add_column(sa.Column(
            'last_queued_records',
            sa.Integer(),
            nullable=True,
        ))
        batch_op.add_column(sa.Column(
            'last_sd_usage_percent',
            sa.Float(),
            nullable=True,
        ))
        # Add check constraint for firmware_channel
        batch_op.create_check_constraint(
            'check_firmware_channel_devices',
            "firmware_channel IN ('stable', 'beta', 'canary')",
        )

    # ── firmwares table: add channel, sha256, size_bytes, is_active ───────────
    with op.batch_alter_table('firmwares') as batch_op:
        batch_op.add_column(sa.Column(
            'channel',
            sa.String(20),
            nullable=False,
            server_default='stable',
        ))
        batch_op.add_column(sa.Column('sha256', sa.String(64), nullable=True))
        batch_op.add_column(sa.Column('size_bytes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default='true',
        ))
        # Extend url column from 255 → 512
        batch_op.alter_column(
            'url',
            type_=sa.String(512),
            existing_nullable=False,
        )
        batch_op.create_index(
            'idx_firmware_device_channel',
            ['device_id', 'channel'],
        )

    # ── device_remote_configs: new table ─────────────────────────────────────
    op.create_table(
        'device_remote_configs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(50), nullable=False),
        sa.Column('sample_interval_sec', sa.Integer(), nullable=True, server_default='60'),
        sa.Column('firmware_channel', sa.String(20), nullable=True, server_default='stable'),
        sa.Column('ph_offset', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('turbidity_offset', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('tds_offset', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('temp_offset', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('flow_offset', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('config_version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(
            ['device_id'],
            ['devices.device_id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', name='uq_remote_config_device'),
    )
    op.create_index(
        'idx_remote_config_device',
        'device_remote_configs',
        ['device_id'],
    )

    # ── Backfill default remote configs for existing devices ─────────────────
    op.execute("""
        INSERT INTO device_remote_configs (device_id, sample_interval_sec, firmware_channel, config_version)
        SELECT device_id, 60, 'stable', 0
        FROM devices
        ON CONFLICT (device_id) DO NOTHING
    """)


def downgrade():
    op.drop_table('device_remote_configs')

    with op.batch_alter_table('firmwares') as batch_op:
        batch_op.drop_index('idx_firmware_device_channel')
        batch_op.drop_column('channel')
        batch_op.drop_column('sha256')
        batch_op.drop_column('size_bytes')
        batch_op.drop_column('is_active')
        batch_op.alter_column('url', type_=sa.String(255), existing_nullable=False)

    with op.batch_alter_table('devices') as batch_op:
        batch_op.drop_constraint('check_firmware_channel_devices', type_='check')
        batch_op.drop_column('firmware_channel')
        batch_op.drop_column('config_version')
        batch_op.drop_column('last_free_heap')
        batch_op.drop_column('last_queued_records')
        batch_op.drop_column('last_sd_usage_percent')
