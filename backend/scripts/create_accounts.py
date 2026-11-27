import argparse
import csv
import os
import secrets
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.normalize import normalize_login_id
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import User, UserRole


def new_password() -> str:
    return f"{secrets.randbelow(10000):04d}"


def create_accounts(db: Session, prefix: str, count: int, role: UserRole) -> list[dict[str, str]]:
    prefix = normalize_login_id(prefix)
    if count < 1 or not prefix or "." in prefix or any(c.isspace() for c in prefix):
        raise ValueError("Use a nonempty prefix without dots or spaces and a positive count")
    if len(f"{prefix}{count:02d}") > 64:
        raise ValueError("Generated login IDs must be at most 64 characters")
    created = []
    for number in range(1, count + 1):
        login_id = f"{prefix}{number:02d}"
        if db.scalar(select(User.id).where(User.login_id == login_id)) is not None:
            continue
        password = new_password()
        db.add(User(login_id=login_id, password_hash=hash_password(password), role=role))
        created.append({"login_id": login_id, "password": password, "role": str(role)})
    db.flush()
    return created


def write_accounts(path: Path, accounts: list[dict[str, str]]) -> None:
    # Exclusive creation prevents overwriting the only copy of existing credentials.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=["login_id", "password", "role"])
        writer.writeheader()
        writer.writerows(accounts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--role", type=UserRole, choices=list(UserRole), required=True)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    path = args.out or Path(f"{normalize_login_id(args.prefix)}.accounts.csv")
    with SessionLocal() as db:
        accounts = create_accounts(db, args.prefix, args.count, args.role)
        write_accounts(path, accounts)
        try:
            db.commit()
        except Exception:
            path.unlink()
            raise
    print(f"{len(accounts)}개 만듦, 파일: {path}")


if __name__ == "__main__":
    main()
