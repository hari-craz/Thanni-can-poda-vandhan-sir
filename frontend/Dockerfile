# Frontend Dockerfile for local development
FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copy source
COPY . ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
