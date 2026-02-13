# ============================================
# Byaboneka+ API - Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for sharp
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npx tsc

# Remove dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for sharp only
RUN apk add --no-cache vips tini

# Copy compiled code and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create uploads directory and non-root user
RUN mkdir -p uploads && \
    addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

# Use tini for proper PID 1 signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]