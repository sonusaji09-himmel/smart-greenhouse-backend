# Remote state in S3 with native state locking (Terraform >= 1.10, no DynamoDB).
# The bucket is created first by ./state-backend. If you change the bucket name,
# change it in BOTH places (backend blocks cannot use variables).
terraform {
  backend "s3" {
    bucket       = "smart-greenhouse-tfstate"
    key          = "greenhouse/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}
