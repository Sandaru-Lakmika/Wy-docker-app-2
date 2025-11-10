pipeline {
  agent any

  environment {
    APP_NAME = 'my-docker-app2'
    DOCKERHUB = credentials('dockerhub')   // -> DOCKERHUB_USR / DOCKERHUB_PSW
    DOCKER_BUILDKIT = '1'                  // optional: faster builds
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Set Version') {
      steps {
        script {
          // Commit short SHA as tag
          env.IMAGE_TAG = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()

          // If not a Multibranch job, BRANCH_NAME is empty. Detect it.
          if (!env.BRANCH_NAME || env.BRANCH_NAME.trim() == '') {
            env.BRANCH_NAME = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
          }
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

          # Tag latest only for main branch
          if [ "${BRANCH_NAME:-}" = "main" ]; then
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

          if [ "${BRANCH_NAME:-}" = "main" ]; then
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
