locals {
  # Built from the bucket name so the policy is fully known at plan time.
  documents_bucket_arn = "arn:aws:s3:::${local.name_prefix}-documents"
}

data "aws_iam_policy_document" "application_access" {
  statement {
    sid    = "ListDocumentsBucket"
    effect = "Allow"

    actions   = ["s3:ListBucket"]
    resources = [local.documents_bucket_arn]
  }

  statement {
    sid    = "ReadWriteDocumentObjects"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${local.documents_bucket_arn}/*"]
  }
}

resource "aws_iam_policy" "application_access" {
  name        = "${local.name_prefix}-application-access"
  description = "Permissions for the Helios Pay application runtime."
  policy      = data.aws_iam_policy_document.application_access.json
}
