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

output "instance_private_ip" {
  description = "Private application address for deployment from the Jenkins host."
  value       = aws_instance.app.private_ip
}

output "ecr_repository_urls" {
  description = "Private ECR repository URLs for the backend and frontend images."
  value       = { for name, repository in aws_ecr_repository.app : name => repository.repository_url }
}

output "image_registry" {
  description = "Jenkins IMAGE_REGISTRY parameter for the provisioned ECR registry."
  value       = split("/", aws_ecr_repository.app["pokemon-backend"].repository_url)[0]
}

output "image_namespace" {
  description = "Jenkins IMAGE_NAMESPACE parameter for the provisioned repositories."
  value       = var.project_name
}

output "jenkins_public_ip" {
  description = "Public IPv4 address for Jenkins host administration."
  value       = aws_instance.jenkins.public_ip
}

output "jenkins_tunnel_command" {
  description = "SSH tunnel for the Jenkins UI; open http://localhost:8080 while connected."
  value       = "ssh -N -L 8080:127.0.0.1:8080 ubuntu@${aws_instance.jenkins.public_ip}"
}

output "ssh_command" {
  description = "Example SSH command; connect only from the configured admin CIDR."
  value       = "ssh ubuntu@${aws_instance.app.public_ip}"
}
