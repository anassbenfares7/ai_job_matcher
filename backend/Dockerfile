# Stage 1: Build TypeScript -> JavaScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production runtime (smaller image)
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies (no dev packages)
RUN npm ci --only=production

# Copy built JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run the app
CMD ["node", "dist/index.js"]

# Expose port
EXPOSE 5000
