FROM node:20-bullseye-slim

# Install full LibreOffice suite, Ghostscript, GraphicsMagick, JRE, and fonts
# Since we are deploying to Hugging Face with 16GB RAM, we do not need to restrict the installation size.
RUN apt-get update && apt-get install -y \
    libreoffice \
    default-jre-headless \
    ghostscript \
    graphicsmagick \
    curl \
    fontconfig \
    fonts-liberation \
    fonts-dejavu \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install pdf2docx \
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
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production
ENV HOME=/tmp

CMD ["pnpm", "--filter", "server", "start"]
