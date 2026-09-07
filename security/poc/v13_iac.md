# V13 IaC misconfigurations

Review the Terraform and workflow sources statically. Confirm the S3 bucket has
`acl = "public-read"` and a `Principal = "*"` object-read policy, the security
group permits `5432` from `0.0.0.0/0`, the RDS instance is publicly accessible
without encryption, the IAM policy uses `Action = "*"` and `Resource = "*"`,
and `.github/workflows/deploy.yml` contains a fake secret in its environment.
The workflow is dispatch-only and echo-only; do not run it against real cloud resources.
