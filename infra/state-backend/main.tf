# Creates the S3 bucket that stores the main stack's Terraform state.
# This module itself uses LOCAL state (the classic bootstrap chicken-and-egg).
# Apply this ONCE, then run the main stack which uses the S3 backend.

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # Safety: prevent accidental deletion of the bucket holding all state.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project = "smart-greenhouse"
    Purpose = "terraform-remote-state"
  }
}

# Keep a history of every state revision (recover from corruption / bad applies).
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encrypt state at rest (state can contain secrets).
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# State must never be public.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
