from logging.config import fileConfig

from sqlalchemy import create_engine

import app.models  # noqa: F401  모델을 Base.metadata에 등록
from alembic import context
from app.core.config import settings
from app.db import Base

fileConfig(context.config.config_file_name)


def run_migrations() -> None:
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations()
