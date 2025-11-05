# Base image with Chromium ready for Puppeteer
FROM ghcr.io/puppeteer/puppeteer:22.10.0

# Workdir
WORKDIR /app

# Copy manifests first for better caching
COPY package*.json ./

# Install production deps
RUN npm ci --omit=dev

# Copy source
COPY . .

# Ensure token directory exists (will be overridden by volume in Railway)
RUN mkdir -p /app/tokens

# Environment
ENV NODE_ENV=production
ENV PORT=3000
# For persistence on Railway, prefer setting TOKEN_FOLDER=/data/tokens and mount a volume at /data
ENV TOKEN_FOLDER=/app/tokens
# Puppeteer in container needs no-sandbox flags (already set in code)

EXPOSE 3000

CMD ["node", "src/index.js"]
