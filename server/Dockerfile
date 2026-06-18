FROM node:20-bullseye-slim

# Install MINIMAL LibreOffice (core + writer only), Ghostscript, GraphicsMagick, and fonts
# Using --no-install-recommends to drastically reduce image size and memory footprint
# Note: qpdf is NOT needed — PDF encrypt/decrypt uses pure JS libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    ghostscript \
    graphicsmagick \
    curl \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

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

# Pre-warm LibreOffice profile to avoid first-run delays
RUN mkdir -p /tmp/lo_warmup && \
    echo "warmup" > /tmp/lo_warmup/test.txt && \
    timeout 30 libreoffice --headless --norestore --nofirststartwizard --convert-to pdf --outdir /tmp/lo_warmup /tmp/lo_warmup/test.txt || true && \
    rm -rf /tmp/lo_warmup

# Expose port and configure environment
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
ENV HOME=/tmp

CMD ["pnpm", "--filter", "server", "start"]
