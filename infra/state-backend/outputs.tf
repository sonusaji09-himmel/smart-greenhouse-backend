output "state_bucket_name" {
  description = "S3 bucket name — copy into ../backend.tf"
  value       = aws_s3_bucket.state.id
}

output "state_bucket_region" {
  description = "Region of the state bucket"
  value       = var.region
}
