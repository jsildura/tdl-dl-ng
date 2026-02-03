# Tidal DL NG (Web Only)

Cloudflare-ready web version of Tidal DL NG. This repository contains the Next.js frontend and Cloudflare Worker for a serverless deployment.

## Project Structure

- **web-ui/**: Next.js frontend application (Cloudflare Pages)
- **worker/**: Cloudflare Worker API proxy (handling CORs & Auth)

## Deployment

See [web-ui/README.md](web-ui/README.md) for detailed deployment instructions.

## Development

1. **Worker**:
   ```bash
   cd worker
   npm install
   npm run dev
   ```

2. **Web UI**:
   ```bash
   cd web-ui
   npm install
   npm run dev
   ```
