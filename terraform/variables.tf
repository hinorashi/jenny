variable "admin_cidr" {
  description = "CIDR allowed to SSH to the demo instance; use a trusted, narrow range."
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0))
    error_message = "admin_cidr must be a valid IPv4 or IPv6 CIDR range."
  }
}

variable "app_cidr" {
  description = "CIDR allowed to access the demo over HTTP; restrict this when possible."
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrhost(var.app_cidr, 0))
    error_message = "app_cidr must be a valid IPv4 or IPv6 CIDR range."
  }
}

variable "aws_region" {
  description = "AWS region for the demo infrastructure."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the Compose host."
  type        = string
  default     = "t3.micro"
}

variable "project_name" {
  description = "Prefix applied to infrastructure resource names and tags."
  type        = string
  default     = "jenny-pokemon"
}
