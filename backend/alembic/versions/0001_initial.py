"""initial

Revision ID: 0001
Revises:
Create Date: 2026-11-27 05:47:00.738256
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "name_suggestions",
        sa.Column("input_key", sa.Text(), nullable=False),
        sa.Column("candidates", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("input_key"),
    )
    op.create_table(
        "phrase_sets",
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name_ja", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint("code ~ '^[a-z][a-z0-9_]{0,31}$'", name="ck_phrase_set_code"),
        sa.PrimaryKeyConstraint("code"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("login_id", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "role", sa.Enum("judge", "spare", "team", "demo", name="user_role"), nullable=False
        ),
        sa.Column("ja_name", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("login_id"),
    )
    op.create_table(
        "phrases",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("set_code", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("ko", sa.Text(), nullable=False),
        sa.Column("kana", sa.Text(), nullable=False),
        sa.Column("ja_meaning", sa.Text(), nullable=False),
        sa.Column("usage_ja", sa.Text(), nullable=False),
        sa.Column("reply_ko", sa.Text(), nullable=False),
        sa.Column("reply_kana", sa.Text(), nullable=False),
        sa.Column("reply_ja", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["set_code"],
            ["phrase_sets.code"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "set_code",
            "sort_order",
            deferrable=True,
            initially="DEFERRED",
            name="uq_phrase_set_order",
        ),
    )
    op.create_table(
        "stamp_profiles",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "animal", sa.Enum("tiger", "rabbit", "magpie", "bear", name="animal"), nullable=True
        ),
        sa.Column("korean_name", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "korean_name = '' OR korean_name ~ '^[가-힣]{1,10}$'", name="ck_profile_korean_name"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "stamps",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("phrase_id", sa.Text(), nullable=False),
        sa.Column(
            "stamped_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["phrase_id"],
            ["phrases.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "phrase_id"),
    )


def downgrade() -> None:
    op.drop_table("stamps")
    op.drop_table("stamp_profiles")
    op.drop_table("phrases")
    op.drop_table("users")
    op.drop_table("phrase_sets")
    op.drop_table("name_suggestions")
    sa.Enum(name="animal").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
