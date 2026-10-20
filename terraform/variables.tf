variable "admin_cidrs" {
  description = "Trusted IPv4 CIDR ranges allowed to SSH to the demo instance, including the Jenkins agent egress range when deploying over SSH."
  type        = set(string)

  validation {
    condition     = length(var.admin_cidrs) > 0 && alltrue([for cidr in var.admin_cidrs : can(cidrnetmask(cidr))])
    error_message = "admin_cidrs must contain at least one valid IPv4 CIDR range."
  }
}

variable "app_cidr" {
  description = "CIDR allowed to access the demo over HTTP; restrict this when possible."
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrnetmask(var.app_cidr))
    error_message = "app_cidr must be a valid IPv4 CIDR range."
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

variable "ssh_public_key" {
  description = "OpenSSH public key for the Jenkins deployment/admin key pair; never provide a private key."
  type        = string

  validation {
    condition     = length(trimspace(var.ssh_public_key)) > 0
    error_message = "ssh_public_key must contain a non-empty OpenSSH public key."
  }
}
