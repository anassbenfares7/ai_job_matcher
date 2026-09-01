# Stage 1: Build Next.js app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Build Next.js
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

# Copy built Next.js from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["npm", "start"]
