from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NameSuggestion(Base):
    __tablename__ = "name_suggestions"

    input_key: Mapped[str] = mapped_column(Text, primary_key=True)
    candidates: Mapped[list[dict[str, str]]] = mapped_column(JSONB)
    model: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
