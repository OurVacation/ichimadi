from sqlalchemy import Boolean, ForeignKey, Text, UniqueConstraint, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Phrase(Base):
    __tablename__ = "phrases"
    __table_args__ = (
        UniqueConstraint(
            "set_code",
            "sort_order",
            name="uq_phrase_set_order",
            deferrable=True,
            initially="DEFERRED",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    set_code: Mapped[str] = mapped_column(Text, ForeignKey("phrase_sets.code"))
    sort_order: Mapped[int]
    label: Mapped[str] = mapped_column(Text)
    ko: Mapped[str] = mapped_column(Text)
    kana: Mapped[str] = mapped_column(Text)
    ja_meaning: Mapped[str] = mapped_column(Text)
    usage_ja: Mapped[str] = mapped_column(Text)
    reply_ko: Mapped[str] = mapped_column(Text)
    reply_kana: Mapped[str] = mapped_column(Text)
    reply_ja: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
