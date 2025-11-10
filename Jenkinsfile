pipeline {
  agent any

  // Set your Docker Hub credentials ID in Jenkins as 'dockerhub'
  // Jenkins will expose DOCKERHUB_USR and DOCKERHUB_PSW from this binding
  environment {
    APP_NAME = 'my-docker-app2'
        DOCKERHUB = credentials('dockerhub')
  }

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        // If this job is created as a Multibranch Pipeline or Pipeline from SCM, this uses the configured repo
        checkout scm
      }
    }

    stage('Set Version') {
      steps {
        script {
          // Short git commit hash as the image tag
          env.IMAGE_TAG = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
        }
        sh 'echo Building commit ${IMAGE_TAG} on branch ${BRANCH_NAME}'
      }
    }

    stage('Docker Login') {
      steps {
        sh 'echo $DOCKERHUB_PSW | docker login -u $DOCKERHUB_USR --password-stdin'
      }
    }

    stage('Build Images') {
      steps {
        sh '''
          set -eux
          BACKEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-backend"
          FRONTEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-frontend"

          docker build -t "${BACKEND_IMAGE}:${IMAGE_TAG}" backend
          docker build -t "${FRONTEND_IMAGE}:${IMAGE_TAG}" frontend

          if [ "${BRANCH_NAME}" = "main" ]; then
            docker tag "${BACKEND_IMAGE}:${IMAGE_TAG}" "${BACKEND_IMAGE}:latest"
            docker tag "${FRONTEND_IMAGE}:${IMAGE_TAG}" "${FRONTEND_IMAGE}:latest"
          fi
        '''
      }
    }

    stage('Push Images') {
      steps {
        sh '''
          set -eux
          BACKEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-backend"
          FRONTEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-frontend"

          docker push "${BACKEND_IMAGE}:${IMAGE_TAG}"
          docker push "${FRONTEND_IMAGE}:${IMAGE_TAG}"

          if [ "${BRANCH_NAME}" = "main" ]; then
            docker push "${BACKEND_IMAGE}:latest"
            docker push "${FRONTEND_IMAGE}:latest"
          fi
        '''
      }
    }
  }

  post {
    always {
      sh 'docker logout || true'
      cleanWs()
    }
  }
}
