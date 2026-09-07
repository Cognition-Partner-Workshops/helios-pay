resource "aws_db_instance" "postgres" {
  identifier             = "${local.name_prefix}-postgres"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "helios"
  username               = "helios"
  password               = var.db_password
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [aws_security_group.application.id]
  storage_encrypted      = false
  publicly_accessible    = true
  skip_final_snapshot    = true

  tags = local.common_tags
}

variable "db_password" {
  description = "Database password supplied by the deployment environment."
  type        = string
  sensitive   = true
}
