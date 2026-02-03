# Multi-stage Dockerfile — builds with Node 20 and runs migrations before start

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Copy source and build
COPY . .
RUN yarn build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Run migrations then start
# Copy entrypoint and make executable
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Entrypoint will wait for DB, run migrations with retries, then start the app
ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
