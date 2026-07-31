import argparse
import getpass

from sqlalchemy import func

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.role import Role
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first production administrator")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Administrator")
    args = parser.parse_args()

    password = getpass.getpass("New administrator password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters")

    email = args.email.strip().lower()
    with SessionLocal() as db:
        existing = db.query(User).filter(func.lower(User.email) == email).first()
        if existing:
            raise SystemExit(f"A user with email {email} already exists")

        role = db.query(Role).filter(Role.name == "Admin", Role.is_active.is_(True)).first()
        if role is None:
            raise SystemExit("The Admin role does not exist; verify database migrations")

        user = User(
            full_name=args.name.strip(),
            email=email,
            password_hash=hash_password(password),
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()

    print(f"Administrator created: {email}")


if __name__ == "__main__":
    main()
