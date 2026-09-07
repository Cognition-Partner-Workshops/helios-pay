resource "aws_security_group" "application" {
  name        = "${local.name_prefix}-application"
  description = "Application access rules for Helios Pay."
  vpc_id      = var.vpc_id

  ingress {
    description = "Postgres access for hosted integrations"
    protocol    = "tcp"
    from_port   = 5432
    to_port     = 5432
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}
