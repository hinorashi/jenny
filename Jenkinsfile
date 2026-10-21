pipeline {
    agent { label 'docker-terraform-ssh' }

    options {
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    parameters {
        choice(name: 'REGISTRY_AUTH', choices: ['ecr', 'credentials'], description: 'ECR instance-role login or Jenkins username/password credential')
        string(name: 'IMAGE_REGISTRY', defaultValue: '', description: 'Registry hostname; use Terraform image_registry output for ECR')
        string(name: 'IMAGE_NAMESPACE', defaultValue: 'jenny-pokemon', description: 'Use Terraform image_namespace output for ECR')
        string(name: 'AWS_REGION', defaultValue: 'us-east-1', description: 'AWS region containing the ECR repositories')
        string(name: 'DEPLOY_HOST', defaultValue: '', description: 'Reachable public or private VM address')
        string(name: 'DEPLOY_USER', defaultValue: 'ubuntu', description: 'SSH user with Docker access')
        booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Deploy after images are pushed (main branch only)')
    }

    environment {
        REGISTRY_CREDENTIALS_ID = 'container-registry'
        SSH_CREDENTIALS_ID = 'vm-deploy-key'
    }

    stages {
        stage('Test and validate') {
            steps {
                sh 'npm ci --prefix app/frontend'
                sh 'npm test --prefix app/backend'
                sh 'npm run build --prefix app/frontend'
                sh '''
                    terraform -chdir=terraform fmt -check -recursive
                    terraform -chdir=terraform init -backend=false -input=false
                    terraform -chdir=terraform validate
                    terraform -chdir=terraform/bootstrap init -backend=false -input=false
                    terraform -chdir=terraform/bootstrap validate
                '''
            }
        }

        stage('Build and push images') {
            steps {
                script {
                    env.IMAGE_TAG = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                    def buildAndPush = {
                        sh '''
                        set -eu
                        case "$IMAGE_REGISTRY" in
                            *[!A-Za-z0-9._:-]*|"") echo "Invalid IMAGE_REGISTRY" >&2; exit 1 ;;
                        esac
                        case "$IMAGE_NAMESPACE" in
                            *[!A-Za-z0-9._/-]*|"") echo "Invalid IMAGE_NAMESPACE" >&2; exit 1 ;;
                        esac
                        case "$AWS_REGION" in
                            *[!a-z0-9-]*|"") echo "Invalid AWS_REGION" >&2; exit 1 ;;
                        esac

                        BACKEND_IMAGE="$IMAGE_REGISTRY/$IMAGE_NAMESPACE/pokemon-backend:$IMAGE_TAG"
                        FRONTEND_IMAGE="$IMAGE_REGISTRY/$IMAGE_NAMESPACE/pokemon-frontend:$IMAGE_TAG"

                        trap 'docker logout "$IMAGE_REGISTRY" >/dev/null 2>&1 || true' EXIT
                        if [ "$REGISTRY_AUTH" = ecr ]; then
                            aws ecr get-login-password --region "$AWS_REGION" |
                                docker login "$IMAGE_REGISTRY" --username AWS --password-stdin
                        else
                            printf '%s' "$REGISTRY_PASSWORD" |
                                docker login "$IMAGE_REGISTRY" --username "$REGISTRY_USERNAME" --password-stdin
                        fi
                        build_and_push() {
                            image=$1
                            context=$2
                            if [ "$REGISTRY_AUTH" = ecr ] && docker manifest inspect "$image" >/dev/null 2>&1; then
                                printf 'Reusing immutable image %s\n' "$image"
                            else
                                docker build --pull -t "$image" "$context"
                                docker push "$image"
                            fi
                        }
                        build_and_push "$BACKEND_IMAGE" ./app/backend
                        build_and_push "$FRONTEND_IMAGE" ./app/frontend
                        '''
                    }
                    if (params.REGISTRY_AUTH == 'credentials') {
                        withCredentials([usernamePassword(
                            credentialsId: env.REGISTRY_CREDENTIALS_ID,
                            usernameVariable: 'REGISTRY_USERNAME',
                            passwordVariable: 'REGISTRY_PASSWORD'
                        )]) {
                            buildAndPush()
                        }
                    } else {
                        buildAndPush()
                    }
                }
            }
        }

        stage('Deploy to VM') {
            when {
                allOf {
                    branch 'main'
                    expression { params.DEPLOY && params.DEPLOY_HOST?.trim() }
                }
            }
            steps {
                sshagent(credentials: [env.SSH_CREDENTIALS_ID]) {
                    sh '''
                        set -eu
                        BACKEND_IMAGE="$IMAGE_REGISTRY/$IMAGE_NAMESPACE/pokemon-backend:$IMAGE_TAG"
                        FRONTEND_IMAGE="$IMAGE_REGISTRY/$IMAGE_NAMESPACE/pokemon-frontend:$IMAGE_TAG"
                        TARGET="$DEPLOY_USER@$DEPLOY_HOST"

                        printf 'BACKEND_IMAGE=%s\\nFRONTEND_IMAGE=%s\\nHTTP_PORT=80\\n' \
                            "$BACKEND_IMAGE" "$FRONTEND_IMAGE" > .deploy.env
                        ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$TARGET" \
                            'mkdir -p /opt/pokemon-demo'
                        scp -o BatchMode=yes -o StrictHostKeyChecking=yes \
                            compose.yaml .deploy.env "$TARGET:/opt/pokemon-demo/"
                        ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$TARGET" \
                            'mv /opt/pokemon-demo/.deploy.env /opt/pokemon-demo/.env.next'

                        if [ "$REGISTRY_AUTH" = ecr ]; then
                            ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$TARGET" \
                                "aws ecr get-login-password --region '$AWS_REGION' | docker login --username AWS --password-stdin '$IMAGE_REGISTRY'"
                        fi

                        if ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$TARGET" 'sh -s' <<'REMOTE'
                        set -eu
                        cd /opt/pokemon-demo
                        had_previous=false
                        if [ -f .env ]; then
                            cp .env .env.previous
                            had_previous=true
                        fi
                        if mv .env.next .env && docker compose pull && docker compose up -d --remove-orphans; then
                            attempt=0
                            while [ "$attempt" -lt 12 ]; do
                                if docker compose exec -T frontend wget -q -O /dev/null http://127.0.0.1/healthz; then
                                    rm -f .env.previous
                                    exit 0
                                fi
                                attempt=$((attempt + 1))
                                sleep 5
                            done
                        fi
                        if [ "$had_previous" = true ]; then
                            mv .env.previous .env
                            docker compose pull
                            docker compose up -d --remove-orphans
                        else
                            docker compose down
                            rm -f .env
                        fi
                        exit 1
REMOTE
                        then
                            echo "Deployment and health check succeeded."
                        else
                            echo "Deployment failed; previous version was restored when available." >&2
                            exit 1
                        fi
                        rm -f .deploy.env
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'rm -f .deploy.env'
            deleteDir()
        }
    }
}
