data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ─── VPC: single public subnet, IGW, no NAT ──────────────────────────────────

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = var.project_name
  cidr = var.vpc_cidr

  azs            = [data.aws_availability_zones.available.names[0]]
  public_subnets = [var.public_subnet_cidr]

  enable_nat_gateway      = false
  enable_vpn_gateway      = false
  single_nat_gateway      = false
  map_public_ip_on_launch = true

  tags = {
    Project = var.project_name
  }
}

# ─── Security group: HTTP + SSH ───────────────────────────────────────────────

module "security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "${var.project_name}-sg"
  description = "Greenhouse demo — HTTP API and SSH"
  vpc_id      = module.vpc.vpc_id

  ingress_with_cidr_blocks = [
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      description = "HTTP API"
      cidr_blocks = var.allowed_cidr
    },
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      description = "SSH"
      cidr_blocks = var.allowed_cidr
    },
  ]

  egress_with_cidr_blocks = [
    {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      description = "All outbound (HiveMQ, apt, npm)"
      cidr_blocks = "0.0.0.0/0"
    },
  ]

  tags = {
    Project = var.project_name
  }
}

# ─── EC2: Ubuntu + bootstrap user_data ───────────────────────────────────────

module "ec2" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 5.0"

  name          = var.instance_name
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name

  subnet_id                   = module.vpc.public_subnets[0]
  vpc_security_group_ids      = [module.security_group.security_group_id]
  associate_public_ip_address = true

  root_block_device = [
    {
      volume_size = var.root_volume_size
      volume_type = "gp3"
      encrypted   = true
    },
  ]

  user_data = templatefile("${path.module}/bootstrap/user_data.sh.tpl", {
    influx_password = var.influx_password
    influx_org      = var.influx_org
    influx_bucket   = var.influx_bucket
    influx_token    = var.influx_token
    git_repo        = var.git_repo
    git_branch      = var.git_branch
    mqtt_url        = var.mqtt_url
    mqtt_username   = var.mqtt_username
    mqtt_password   = var.mqtt_password
    auth_enabled    = var.auth_enabled ? "true" : "false"
    jwt_secret      = var.jwt_secret
    cors_origins    = var.cors_origins
  })

  user_data_replace_on_change = true

  tags = {
    Project = var.project_name
  }
}
