# frontend/Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true
ENV CI=true

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]