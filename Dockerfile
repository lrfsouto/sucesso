# Use Node.js 18 LTS
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci
RUN cd server && npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built application and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Copy package files for production install
COPY --from=builder /app/server/package*.json ./server/

# Install only production dependencies
RUN cd server && npm ci --omit=dev

# Create database directory with proper permissions
RUN mkdir -p ./server/database && chmod 755 ./server/database

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV JWT_SECRET=vitana-jwt-secret-key-2024
ENV SUPER_ADMIN_PASSWORD=SuperAdmin2024!

# Simplified start command - just start the server
CMD ["node", "server/server.js"]