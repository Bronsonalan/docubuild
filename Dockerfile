FROM node:20-slim AS base

# Install FFmpeg and Chrome dependencies
RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  fonts-liberation \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Remotion/Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Build
RUN npm run build

# Run
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
