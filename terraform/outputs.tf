output "app_url" {
  description = "HTTP URL of the deployed demo application."
  value       = "http://${aws_instance.app.public_ip}"
}

output "instance_id" {
  description = "ID of the EC2 Compose host."
  value       = aws_instance.app.id
}

output "instance_public_ip" {
  description = "Public IPv4 address used by the application and Jenkins deployment."
  value       = aws_instance.app.public_ip
}

output "ssh_command" {
  description = "Example SSH command; connect only from the configured admin CIDR."
  value       = "ssh ubuntu@${aws_instance.app.public_ip}"
}
