resource "aws_security_group" "application" {
  name        = "${local.name_prefix}-application"
  description = "Application access rules for Helios Pay."
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = length(var.dbClientSecurityGroupIds) + length(var.dbAllowedCidrBlocks) > 0 ? [1] : []

    content {
      description     = "Postgres access for application clients"
      protocol        = "tcp"
      from_port       = 5432
      to_port         = 5432
      security_groups = var.dbClientSecurityGroupIds
      cidr_blocks     = var.dbAllowedCidrBlocks
    }
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}
