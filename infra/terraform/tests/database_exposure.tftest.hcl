mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  db_password = "test-only-placeholder"
}

run "database_is_private_and_encrypted" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.publicly_accessible == false
    error_message = "The Postgres instance must not be publicly accessible."
  }

  assert {
    condition     = aws_db_instance.postgres.storage_encrypted == true
    error_message = "The Postgres instance must encrypt storage at rest."
  }
}

run "no_postgres_ingress_by_default" {
  command = apply

  assert {
    condition     = length(aws_security_group.application.ingress) == 0
    error_message = "Port 5432 must stay closed until an application source is supplied."
  }
}

run "postgres_ingress_limited_to_application_sources" {
  command = apply

  variables {
    dbClientSecurityGroupIds = ["sg-0123456789abcdef0"]
    dbAllowedCidrBlocks      = ["10.20.0.0/16"]
  }

  assert {
    condition = alltrue([
      for rule in aws_security_group.application.ingress :
      rule.from_port == 5432 && rule.to_port == 5432 && !contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "Postgres ingress must only list the supplied application sources."
  }

  assert {
    condition     = length(aws_security_group.application.ingress) == 1
    error_message = "Expected a single Postgres ingress rule."
  }
}

run "open_cidr_is_rejected" {
  command = plan

  variables {
    dbAllowedCidrBlocks = ["0.0.0.0/0"]
  }

  expect_failures = [var.dbAllowedCidrBlocks]
}
