pipeline {
  agent any

  environment {
    APP_NAME = 'my-docker-app2'
    DOCKERHUB = credentials('dockerhub')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Login to Docker Hub') {
      steps {
        sh 'echo $DOCKERHUB_PSW | docker login -u $DOCKERHUB_USR --password-stdin'
      }
    }

    stage('Build and Push') {
      steps {
        sh '''
          set -e
          BACKEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-backend"
          FRONTEND_IMAGE="${DOCKERHUB_USR}/${APP_NAME}-frontend"

          docker build -t "${BACKEND_IMAGE}:latest" backend
          docker build -t "${FRONTEND_IMAGE}:latest" frontend

          docker push "${BACKEND_IMAGE}:latest"
          docker push "${FRONTEND_IMAGE}:latest"
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
