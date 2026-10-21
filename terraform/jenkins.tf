resource "aws_security_group" "jenkins" {
  name        = "${var.project_name}-jenkins"
  description = "Restricted SSH access; Jenkins UI is available through an SSH tunnel only."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Administrator SSH and Jenkins UI tunnel"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_cidrs
  }

  egress {
    description = "Packages, registry access, and application deployment"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-jenkins"
  }
}

resource "aws_iam_role" "jenkins" {
  name = "${var.project_name}-jenkins"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "jenkins_ssm" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "jenkins_ecr" {
  name = "${var.project_name}-ecr-push"
  role = aws_iam_role.jenkins.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage"
        ]
        Resource = [for repository in aws_ecr_repository.app : repository.arn]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "jenkins" {
  name = "${var.project_name}-jenkins"
  role = aws_iam_role.jenkins.name
}

resource "aws_instance" "jenkins" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.jenkins_instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.jenkins.id]
  iam_instance_profile        = aws_iam_instance_profile.jenkins.name
  key_name                    = aws_key_pair.deployment.key_name
  associate_public_ip_address = true
  user_data_replace_on_change = true

  user_data = templatefile("${path.module}/jenkins-user-data.sh.tftpl", {
    compose               = filebase64("${path.module}/../jenkins/compose.yaml")
    controller_dockerfile = filebase64("${path.module}/../jenkins/controller.Dockerfile")
    controller_init       = filebase64("${path.module}/../jenkins/controller-init.groovy")
    agent_dockerfile      = filebase64("${path.module}/../jenkins/agent.Dockerfile")
    dockerignore          = filebase64("${path.module}/../jenkins/.dockerignore")
    aws_region            = var.aws_region
  })

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 40
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  tags = {
    Name = "${var.project_name}-jenkins"
  }

  depends_on = [
    aws_iam_role_policy_attachment.jenkins_ssm,
    aws_iam_role_policy.jenkins_ecr,
    aws_route_table_association.public
  ]
}