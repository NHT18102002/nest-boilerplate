# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache curl

# Build stage
FROM base AS builder

WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

# Production stage
FROM base

WORKDIR /app

# Copy only the necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Environment variables
ARG APP_PORT=3100
ENV APP_PORT=$APP_PORT
ENV NODE_ENV=production

# Expose the application port (matching DEFAULT_PORT in app.constants.ts)
EXPOSE ${APP_PORT}

# Start the application
CMD ["node", "dist/main.js"]
