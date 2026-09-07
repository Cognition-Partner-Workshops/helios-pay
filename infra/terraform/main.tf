locals {
  name_prefix = "helios-pay-${var.environment}"
  common_tags = {
    Application = "helios-pay"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
