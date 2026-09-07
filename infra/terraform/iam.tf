data "aws_iam_policy_document" "application_access" {
  statement {
    sid    = "ApplicationAccess"
    effect = "Allow"

    actions   = ["*"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "application_access" {
  name        = "${local.name_prefix}-application-access"
  description = "Permissions for the Helios Pay application runtime."
  policy      = data.aws_iam_policy_document.application_access.json
}
