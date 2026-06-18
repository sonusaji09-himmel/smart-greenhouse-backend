# ─── AWS / networking ────────────────────────────────────────────────────────

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "greenhouse-demo"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Public subnet CIDR (single AZ demo)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type (t3.small recommended for InfluxDB + Node build)"
  type        = string
  default     = "t3.small"
}

variable "instance_name" {
  description = "EC2 instance name tag"
  type        = string
  default     = "greenhouse-demo"
}

variable "key_name" {
  description = "Existing EC2 key pair name for SSH"
  type        = string
}

variable "allowed_cidr" {
  description = "CIDR allowed for SSH (22) and HTTP (80). Use your-ip/32 in production."
  type        = string
  default     = "0.0.0.0/0"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 20
}

# ─── Git deploy ────────────────────────────────────────────────────────────────

variable "git_repo" {
  description = "Public git repository URL to clone on the instance"
  type        = string
  default     = "https://github.com/sonusaji09-himmel/smart-greenhouse-backend.git"
}

variable "git_branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

# ─── HiveMQ Cloud (MQTT) ─────────────────────────────────────────────────────

variable "mqtt_url" {
  description = "HiveMQ Cloud broker URL (mqtts://…:8883)"
  type        = string
}

variable "mqtt_username" {
  description = "HiveMQ Cloud username"
  type        = string
  sensitive   = true
}

variable "mqtt_password" {
  description = "HiveMQ Cloud password"
  type        = string
  sensitive   = true
}

# ─── InfluxDB (local Docker on EC2) ──────────────────────────────────────────

variable "influx_org" {
  description = "InfluxDB organisation"
  type        = string
  default     = "greenhouse"
}

variable "influx_bucket" {
  description = "InfluxDB bucket name"
  type        = string
  default     = "greenhouse"
}

variable "influx_token" {
  description = "InfluxDB admin API token (written into Docker init and app .env)"
  type        = string
  sensitive   = true
}

variable "influx_password" {
  description = "InfluxDB UI admin password"
  type        = string
  sensitive   = true
}

# ─── Application ─────────────────────────────────────────────────────────────

variable "auth_enabled" {
  description = "Require JWT on protected API routes (false = easier demo)"
  type        = bool
  default     = false
}

variable "jwt_secret" {
  description = "JWT signing secret (min 16 chars when auth_enabled)"
  type        = string
  sensitive   = true
  default     = "change-me-demo-jwt-secret"
}

variable "cors_origins" {
  description = "Comma-separated CORS allowlist (* for demo)"
  type        = string
  default     = "*"
}
