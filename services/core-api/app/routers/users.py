import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from app.core.deps import Claims, get_current_claims
from app.db.session import SessionLocal
from app.models.security import User
from app.schemas.user import UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/me")
def get_me(claims: Claims = Depends(get_current_claims), db=Depends(get_db)):
    user = db.get(User, uuid.UUID(claims.sub))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdate = Body(...),
    claims: Claims = Depends(get_current_claims),
    db=Depends(get_db),
):
    target_id = uuid.UUID(claims.sub) if user_id == "me" else uuid.UUID(user_id)
    user = db.get(User, target_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
