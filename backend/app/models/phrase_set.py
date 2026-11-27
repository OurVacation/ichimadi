from sqlalchemy import Boolean, CheckConstraint, Text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PhraseSet(Base):
    __tablename__ = "phrase_sets"
    __table_args__ = (
        CheckConstraint("code ~ '^[a-z][a-z0-9_]{0,31}$'", name="ck_phrase_set_code"),
    )

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    name_ja: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int]
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
