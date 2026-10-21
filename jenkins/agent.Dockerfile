FROM node:22-bookworm-slim AS node
FROM docker:27-cli AS docker
FROM hashicorp/terraform:1.10.5 AS terraform
FROM jenkins/inbound-agent:jdk21

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli ca-certificates git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /root/.ssh

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=terraform /bin/terraform /usr/local/bin/terraform

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

USER jenkins