import os


def export_file(name: str, base_dir: str = "exports") -> str:
    return os.path.join(base_dir, name)


def secure_name(name: str) -> str:
    return name.replace("/", "").replace("..", "")
