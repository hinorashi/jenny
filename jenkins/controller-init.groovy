import jenkins.model.Jenkins

Jenkins.get().setNumExecutors(0)
Jenkins.get().save()