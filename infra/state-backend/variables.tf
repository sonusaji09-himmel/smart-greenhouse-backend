variable "region" {
  description = "AWS region for the state bucket (keep same as the main stack)"
  type        = string
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform state. Must match the bucket in ../backend.tf"
  type        = string
  default     = "smart-greenhouse-sonu-tfstate"
}
