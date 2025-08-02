# Multi-stage build for smaller production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and templates
COPY . .

# Build the application
RUN npm run build

# Make CLI executable
RUN chmod +x dist/src/cli/cli-main.js

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy templates directory for CLI functionality
COPY --from=builder /app/templates ./templates

# Create workspace directory for mounted volumes
RUN mkdir -p /workspace && chown -R mcp:nodejs /workspace

# Change ownership to non-root user
RUN chown -R mcp:nodejs /app
USER mcp

# Set working directory to workspace for CLI operations
WORKDIR /workspace

# Health check for CLI functionality
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /app/dist/src/cli/cli-main.js --help > /dev/null || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV DEBUG=false
ENV PATH="/app/dist/src/cli:${PATH}"

# Default to CLI help, but allow override
ENTRYPOINT ["/app/dist/src/cli/cli-main.js"]
CMD ["--help"]