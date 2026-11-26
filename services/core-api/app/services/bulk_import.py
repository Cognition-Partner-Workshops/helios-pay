import yaml
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


def load_bulk_import(data: bytes, db: Session) -> int:
    try:
        records = yaml.safe_load(data)
    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid bulk import document",
        ) from exc
    if not isinstance(records, list):
        return 0
    return len(records)
