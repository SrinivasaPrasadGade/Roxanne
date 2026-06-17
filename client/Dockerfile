FROM node:20-slim

WORKDIR /app

# Copy monorepo configuration
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY shared/types.ts ./shared/types.ts

# Install pnpm and client dependencies
RUN npm install -g pnpm && pnpm install --filter client...

# Copy client source code
COPY client/ ./client/

EXPOSE 5173

CMD ["pnpm", "--filter", "client", "dev", "--host"]
