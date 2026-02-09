# Hotel Frontend — Chat Widget

Embeddable chat widget for hotel websites. Preact + Vite → single IIFE bundle.

## Quick Start

```bash
npm install
npm run build          # produces dist/widget.js
npm run build:standalone  # produces dist/standalone.html
npm run dev            # dev server with HMR
```

## Architecture

- **Preact** (3KB) — lightweight React alternative
- **Vite** lib mode — IIFE bundle with CSS inlined via `vite-plugin-css-injected-by-js`
- **Shadow DOM** — widget styles isolated from host page
- Target: < 25KB gzipped

## Embed on Any Website

```html
<script src="https://your-domain.com/widget.js" data-key="wk_xxx"></script>
```

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-key` | Yes | — | Widget key from admin |
| `data-position` | No | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-locale` | No | `en` | Locale for API |
| `data-api-url` | No | Inferred from script src | API base URL |

## Standalone Page

`/chat?key=wk_xxx` — full-page chat for QR codes, kiosks, SMS links.

## Docker

```bash
docker compose up frontend-widget
```

Serves on port 3000:
- `/widget.js` — embeddable bundle (CORS `*`)
- `/chat` — standalone page
- `/health` — health check

## File Structure

```
src/
  widget.ts          — IIFE entry: shadow DOM + mount
  standalone.tsx     — Full-page entry
  components/        — Preact components (ChatPanel, ChatBubble, etc.)
  hooks/             — useChat, useWidgetConfig
  lib/               — api client, types, storage, config parser
  styles/            — widget.css, standalone.css
```

## API Endpoints Used

- `GET /public/widget-config?widget_key=...`
- `POST /public/conversation/start`
- `POST /public/chat`
