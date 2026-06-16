output "instance_id" {
  description = "EC2 instance ID"
  value       = module.ec2.id
}

output "instance_public_ip" {
  description = "Public IPv4 address of the demo server"
  value       = module.ec2.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the demo server"
  value       = module.ec2.public_dns
}

output "ssh_command" {
  description = "SSH into the instance (ubuntu user)"
  value       = "ssh -i <your-key.pem> ubuntu@${module.ec2.public_ip}"
}

output "api_base_url" {
  description = "REST API base URL"
  value       = "http://${module.ec2.public_ip}/api/v1"
}

output "health_url" {
  description = "Health check — expect mqtt and influxdb connected after bootstrap (~5 min)"
  value       = "http://${module.ec2.public_ip}/api/v1/health"
}

output "swagger_url" {
  description = "Swagger UI"
  value       = "http://${module.ec2.public_ip}/api-docs"
}

output "bootstrap_log_hint" {
  description = "How to watch first-boot progress over SSH"
  value       = "ssh ubuntu@${module.ec2.public_ip} 'sudo tail -f /var/log/greenhouse-bootstrap.log'"
}

output "example_actuator_curl" {
  description = "Example manual actuator command (pump activate)"
  value       = "curl -X POST \"http://${module.ec2.public_ip}/api/v1/actuators/pump/activate?deviceId=esp32-01\""
}
