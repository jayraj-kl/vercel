# Frontend Deployer

Frontend Deployer is a self-hosted, one-stop deployment platform that enables automatic deployments from GitHub repositories. It provides a simplified workflow for deploying web applications with instant preview URLs.

## 🚀 Features

- **GitHub Repository Deployment**: Deploy any GitHub repository with a single URL
- **Real-time Build Logs**: View the build process in real-time
- **Preview URLs**: Access your deployment through custom preview URLs
- **Microservice Architecture**: Scalable services for building, uploading, and serving content
- **Event-Driven Design**: Kafka-based event processing for reliable build notifications

## 🏗️ Architecture

This project consists of multiple services working together:

- **Frontend**: Next.js application that provides the user interface for deployments
- **Upload Service**: Handles repository submissions and initiates the build process
- **Build Service**: Builds and prepares applications for deployment
- **Reverse Proxy**: Routes traffic to the correct deployment based on subdomains

## 🛠️ Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Messaging**: Kafka for event streaming
- **Storage**: AWS S3 for deployment artifacts
- **Containerization**: Docker for build isolation
- **Infrastructure**: AWS ECS for container orchestration
- **Observability**: ClickHouse for log storage and analysis

## 📋 Prerequisites

- Node.js v18 or higher
- Docker and Docker Compose
- AWS account (for S3 and ECS)
- Kafka cluster
- PostgreSQL database

## 🚦 Getting Started

### Clone the repository

```bash
git clone https://github.com/yourusername/frontend-deployer.git
cd frontend-deployer
```

### Environment Setup

Create `.env` files for each service with the necessary configuration values.

### Starting the services

1. **Start the Frontend**

```bash
cd frontend
npm install
npm run dev
```

2. **Start the Upload Service**

```bash
cd upload-service
npm install
npm run dev
```

3. **Start the Reverse Proxy**

```bash
cd reverse-proxy
npm install
npm run dev
```

## 🔧 Development

Each service can be developed independently. Follow these steps to set up the development environment for each service:

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3000

### Upload Service

```bash
cd upload-service
npm install
npm run dev
```

The upload service API will be available at http://localhost:3000

### Reverse Proxy

```bash
cd reverse-proxy
npm install
npm run dev
```

The reverse proxy will be available at http://localhost:3001

### Build Service

The build service runs within Docker containers and is triggered by the upload service.
