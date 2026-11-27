from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Animal(StrEnum):
    tiger = "tiger"
    rabbit = "rabbit"
    magpie = "magpie"
    bear = "bear"


class StampProfile(Base):
    __tablename__ = "stamp_profiles"
    __table_args__ = (
        CheckConstraint(
            "korean_name = '' OR korean_name ~ '^[가-힣]{1,10}$'", name="ck_profile_korean_name"
        ),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    animal: Mapped[Animal | None] = mapped_column(Enum(Animal, name="animal"))
    korean_name: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
