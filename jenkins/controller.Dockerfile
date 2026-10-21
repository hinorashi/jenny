FROM jenkins/jenkins:lts-jdk21

RUN jenkins-plugin-cli --plugins workflow-aggregator git credentials-binding ssh-agent

COPY controller-init.groovy /usr/share/jenkins/ref/init.groovy.d/controller-init.groovy