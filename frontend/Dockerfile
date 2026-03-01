# ============================================
# Byaboneka+ Frontend - Production Dockerfile
# Multi-stage build: build + serve via nginx
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# In production with nginx reverse proxy, API is on the same origin
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_RECAPTCHA_SITE_KEY
ENV VITE_RECAPTCHA_SITE_KEY=${VITE_RECAPTCHA_SITE_KEY}

RUN npm run build

# Stage 2: Production with nginx
FROM nginx:1.25-alpine AS production

# Copy custom nginx config (includes API reverse proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]