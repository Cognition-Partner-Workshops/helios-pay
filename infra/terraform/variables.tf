variable "aws_region" {
  description = "AWS region for the Helios Pay environment."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "demo"
}

variable "vpc_id" {
  description = "VPC hosting the application resources."
  type        = string
  default     = "vpc-demo-helios"
}

variable "db_subnet_group_name" {
  description = "Subnet group for the application database."
  type        = string
  default     = "helios-demo"
}
