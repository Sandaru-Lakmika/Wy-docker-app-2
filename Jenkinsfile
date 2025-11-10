pipeline {
  agent any

  environment {
    APP_NAME = 'my-docker-app2'
    DOCKERHUB = credentials('dockerhub')
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        ansiColor('xterm') {
          checkout scm
        }
      }
    }

    stage('Set Version') {
      steps {
        ansiColor('xterm') {
          script {
            env.IMAGE_TAG = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          }
          sh 'echo Building commit ${IMAGE_TAG} on branch ${BRANCH_NAME}'
        }
      }
    }

    stage('Docker Login') {
      steps {
        ansiColor('xterm') {
          sh 'echo $DOCKERHUB_PSW | docker login -u $DOCKERHUB_USR --password-stdin'
        }
      }
    }

    stage('Build Images') {
      steps {
        ansiColor('xterm') {
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
    }

    stage('Push Images') {
      steps {
        ansiColor('xterm') {
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
  }

  post {
    always {
      // ansiColor wrapper here is optional
      sh 'docker logout || true'
      cleanWs()
    }
  }
}
