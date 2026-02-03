# Tidal DL NG Web UI

Browser-based Tidal music downloader with client-side audio processing.

## Features

- **Serverless Architecture**: No backend required - runs entirely in the browser
- **Client-side Processing**: Uses ffmpeg.wasm for metadata embedding
- **Browser Native Downloads**: Triggers native save dialog
- **localStorage Settings**: Settings persist in your browser

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Deployment to Cloudflare Pages

### 1. Deploy the Cloudflare Worker (API Proxy)

```bash
cd ../worker
npm install
npm run deploy
```

After deployment, note your Worker URL (e.g., `https://tidal-api-proxy.your-subdomain.workers.dev`)

### 2. Configure Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_WORKER_URL=https://your-worker.workers.dev
NEXT_PUBLIC_SERVERLESS=true
```

### 3. Build and Deploy

```bash
# Build static export
npm run build

# The output in 'out/' folder can be deployed to Cloudflare Pages
```

### Cloudflare Pages Settings

In your Cloudflare Pages project:
- **Build command**: `npm run build`
- **Build output directory**: `out`
- **Environment variables**: Set `NEXT_PUBLIC_WORKER_URL` and `NEXT_PUBLIC_SERVERLESS=true`

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Next.js   │  │ ffmpeg.wasm │  │ localStorage│ │
│  │   Web UI    │  │   (WASM)    │  │  (Settings) │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘ │
│         │                │                          │
│         ▼                ▼                          │
│  ┌─────────────────────────────────────────────┐   │
│  │       Client-side Download Processing        │   │
│  │  (Fetch stream → Embed metadata → Save)      │   │
│  └─────────────────────┬───────────────────────┘   │
└────────────────────────┼────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Cloudflare Worker                       │
│         (CORS Proxy & OAuth Handler)                 │
└─────────────────────────┬───────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                 Tidal API                            │
│        (auth.tidal.com / api.tidal.com)             │
└─────────────────────────────────────────────────────┘
```

## Modules

| Module | Purpose |
|--------|---------|
| `lib/settings.ts` | localStorage-based settings |
| `lib/auth.ts` | OAuth device flow & token management |
| `lib/tidal-client.ts` | Tidal API client |
| `lib/downloader.ts` | ffmpeg.wasm download & processing |
| `lib/api.ts` | Unified API interface |
