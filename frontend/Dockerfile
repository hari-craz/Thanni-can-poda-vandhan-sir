# Frontend Dockerfile for local development
FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --silent

# Copy source
COPY . ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
