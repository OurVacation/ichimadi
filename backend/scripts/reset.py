import argparse
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.normalize import normalize_login_id
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import NameSuggestion, Stamp, StampProfile, User, UserRole
from scripts.create_accounts import new_password, write_accounts


def reset_accounts(
    db: Session, users: list[User], new_passwords: bool = False
) -> list[dict[str, str]]:
    ids = [user.id for user in users]
    db.execute(delete(Stamp).where(Stamp.user_id.in_(ids)))
    db.execute(delete(StampProfile).where(StampProfile.user_id.in_(ids)))
    accounts = []
    if new_passwords:
        for user in users:
            password = new_password()
            user.password_hash = hash_password(password)
            accounts.append(
                {"login_id": user.login_id, "password": password, "role": str(user.role)}
            )
    db.flush()
    return accounts


def main() -> None:
    parser = argparse.ArgumentParser()
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--login-ids")
    target.add_argument("--role", type=UserRole, choices=list(UserRole))
    target.add_argument("--names", action="store_true")
    parser.add_argument("--new-password", action="store_true")
    parser.add_argument("--out", type=Path, default=Path("reset.accounts.csv"))
    parser.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    if args.names and args.new_password:
        parser.error("--new-password requires an account target")
    login_ids = None
    if args.login_ids is not None:
        login_ids = [normalize_login_id(s) for s in args.login_ids.split(",")]
        if not all(login_ids):
            parser.error("--login-ids requires nonempty comma-separated IDs")
    with SessionLocal() as db:
        query = select(User)
        if login_ids is not None:
            query = query.where(User.login_id.in_(login_ids))
        elif args.role:
            query = query.where(User.role == args.role)
        users = [] if args.names else list(db.scalars(query))
        print(f"대상 계정: {len(users)}개" if not args.names else "이름 후보 캐시 삭제")
        if not args.yes and input("계속하려면 yes 입력: ").strip().lower() != "yes":
            return
        if args.names:
            db.execute(delete(NameSuggestion))
        else:
            accounts = reset_accounts(db, users, args.new_password)
            if args.new_password:
                write_accounts(args.out, accounts)
        try:
            db.commit()
        except Exception:
            if args.new_password:
                args.out.unlink()
            raise
    print("reset complete")


if __name__ == "__main__":
    main()
