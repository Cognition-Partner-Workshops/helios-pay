import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.security import User
from app.schemas.auth import (
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
)
from app.services.reset import confirm_reset, request_reset

router = APIRouter(prefix="/auth", tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login")
def login(payload: LoginRequest, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"access_token": create_access_token(user)}


@router.post("/password-reset/request")
def password_reset_request(payload: PasswordResetRequest, db=Depends(get_db)):
    token = request_reset(db, payload.email)
    return {"status": "ok", "token": token}


@router.post("/password-reset/confirm")
def password_reset_confirm(payload: PasswordResetConfirm, db=Depends(get_db)):
    if not confirm_reset(db, payload.token, payload.new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    return {"status": "ok"}
