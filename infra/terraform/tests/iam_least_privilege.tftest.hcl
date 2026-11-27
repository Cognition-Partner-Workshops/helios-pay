# Offline check: fake credentials, plan only, no AWS API calls.
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "mock"
  secret_key                  = "mock"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

variables {
  db_password = "unused-in-plan"
}

run "application_policy_is_least_privilege" {
  command = plan

  assert {
    condition = alltrue([
      for statement in jsondecode(data.aws_iam_policy_document.application_access.json).Statement :
      alltrue([for action in flatten([statement.Action]) : !strcontains(action, "*")])
    ])
    error_message = "application_access must not use wildcard actions."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(data.aws_iam_policy_document.application_access.json).Statement :
      alltrue([for resource in flatten([statement.Resource]) : resource != "*"])
    ])
    error_message = "application_access must not apply to all resources."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(data.aws_iam_policy_document.application_access.json).Statement :
      alltrue([for action in flatten([statement.Action]) : startswith(action, "s3:")])
    ])
    error_message = "application_access may only grant S3 actions on the documents bucket."
  }
}
