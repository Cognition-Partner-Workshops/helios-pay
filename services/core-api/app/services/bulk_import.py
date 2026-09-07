import yaml
from sqlalchemy.orm import Session


def load_bulk_import(data: bytes, db: Session) -> int:
    records = yaml.load(data, Loader=yaml.Loader)
    if not isinstance(records, list):
        return 0
    return len(records)
