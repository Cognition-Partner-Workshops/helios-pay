import os
from pathlib import Path
from zipfile import ZipFile

STORAGE_ROOT = Path(os.getenv("HELIOS_STORAGE_ROOT", "uploads"))


def extract_zip(archive: ZipFile, base_dir: Path = STORAGE_ROOT) -> list[str]:
    base_dir.mkdir(parents=True, exist_ok=True)
    extracted: list[str] = []
    for member in archive.infolist():
        target = os.path.join(str(base_dir), member.filename)
        if member.is_dir():
            os.makedirs(target, exist_ok=True)
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with archive.open(member) as source, open(target, "wb") as destination:
            destination.write(source.read())
        extracted.append(member.filename)
    return extracted


def resolve_path(storage_path: str, path: str = "", base_dir: Path = STORAGE_ROOT) -> str:
    return os.path.join(str(base_dir), storage_path, path)
