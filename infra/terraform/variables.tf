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

variable "dbClientSecurityGroupIds" {
  description = "Security groups of the application workloads allowed to reach Postgres on 5432."
  type        = list(string)
  default     = []
}

variable "dbAllowedCidrBlocks" {
  description = "Private CIDR blocks allowed to reach Postgres on 5432. Prefer dbClientSecurityGroupIds."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.dbAllowedCidrBlocks : can(cidrhost(cidr, 0)) && tonumber(split("/", cidr)[1]) >= 8])
    error_message = "dbAllowedCidrBlocks must be valid IPv4 CIDR blocks no wider than /8; 0.0.0.0/0 is not allowed."
  }
}
