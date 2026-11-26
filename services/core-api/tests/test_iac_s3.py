import re
from pathlib import Path

import pytest

S3_TF = Path(__file__).resolve().parents[3] / "infra" / "terraform" / "s3.tf"

pytestmark = pytest.mark.skipif(not S3_TF.exists(), reason="infra/terraform not in this checkout")


def _source() -> str:
    return re.sub(r"(#|//).*", "", S3_TF.read_text())


def test_documents_bucket_has_no_public_acl():
    assert not re.search(r"\bacl\s*=\s*\"(public-read|public-read-write|authenticated-read)\"", _source())


def test_documents_bucket_has_no_wildcard_principal_policy():
    assert not re.search(r"Principal\s*=\s*(\"\*\"|\{\s*AWS\s*=\s*\"\*\"\s*\})", _source())


def test_documents_bucket_blocks_public_access():
    source = _source()
    block = re.search(
        r"resource\s+\"aws_s3_bucket_public_access_block\"\s+\"\w+\"\s*\{(.*?)\n\}", source, re.S
    )
    assert block, "aws_s3_bucket_public_access_block is missing"
    body = block.group(1)
    assert re.search(r"bucket\s*=\s*aws_s3_bucket\.documents\.id", body)
    for setting in (
        "block_public_acls",
        "block_public_policy",
        "ignore_public_acls",
        "restrict_public_buckets",
    ):
        assert re.search(rf"{setting}\s*=\s*true", body), f"{setting} must be true"
