---
title: Roxanne-backend
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Roxanne

Roxanne is a production-ready document converter application designed to handle robust conversions using Node.js + Express, React (Vite) + TypeScript, Multer, LibreOffice CLI, and `pdf-lib`.

## Project Structure

```
/Roxanne
  /client         → React frontend (Vite)
  /server         → Express backend
  /shared         → Shared TypeScript types
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
- [LibreOffice](https://www.libreoffice.org/) (For local conversion, otherwise fallback mock conversion is executed)

### Installation & Run

1. Clone or navigate to the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy environment variables:
   ```bash
   cp docflow/.env.example server/.env
   ```
4. Run in development mode:
   ```bash
   pnpm dev
   ```

The client will start on `http://localhost:5173` and the server on `http://localhost:3001`.
