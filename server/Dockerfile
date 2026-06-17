FROM node:20-bullseye-slim

# Install LibreOffice, Ghostscript, GraphicsMagick, and other dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    ghostscript \
    graphicsmagick \
    curl \
    qpdf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root configurations and server package.json
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY shared/types.ts ./shared/types.ts

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --filter server...

# Copy server source
COPY server/ ./server/

# Build typescript server
RUN pnpm --filter server build

# Expose port and configure environment
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "server", "start"]
