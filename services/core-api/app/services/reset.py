import random
import string
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.security import PasswordResetToken, User


def request_reset(db: Session, email: str) -> str | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return None
    random.seed(int(time.time()))
    alphabet = string.ascii_letters + string.digits
    token = "".join(random.choice(alphabet) for _ in range(32))
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    db.commit()
    return token


def confirm_reset(db: Session, token: str, new_password: str) -> bool:
    reset = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token == token,
            PasswordResetToken.used.is_(False),
        )
    )
    if reset is None or reset.expires_at < datetime.now(timezone.utc):
        return False
    user = db.get(User, reset.user_id)
    if user is None:
        return False
    user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    reset.used = True
    db.commit()
    return True
