# hotel-admin-web

Admin dashboard for **hotel-ai-core**.

- Framework: Next.js (App Router) + TypeScript
- Runs in Docker via the **root docker-compose.yml**
- Uses **username/password login** via `hotel-ai-core`
- Talks to core API through a server-side **proxy** (`/api/core/...`) so JWT is stored only in httpOnly cookies (not in browser localStorage).

## How auth works (MVP)

1) User enters email/password at `/login`.
2) `hotel-admin-web` calls core login endpoint (`CORE_LOGIN_PATH`) from a Next route handler.
3) Core returns a token (expects `{access_token: "..."}` or `{token: "..."}`).
4) Token is stored as a httpOnly cookie `AUTH_COOKIE_NAME`.
5) All `/admin/*` routes are protected by `middleware.ts` (redirect to `/login` if cookie missing).
6) UI calls `/api/core/...` which forwards requests to core with `Authorization: Bearer <token>`.

## Core API endpoints used

All endpoints are tenant-scoped (`/admin/tenant/{tenant_id}/...`):

- `POST /admin/login` — login
- `GET /admin/me` — current user + tenant roles
- `GET/PUT /admin/tenant/{id}/settings` — tenant config
- `GET /admin/tenant/{id}/kb/documents` — knowledge base documents
- `POST /admin/tenant/{id}/kb/upload` — file upload
- `POST /admin/tenant/{id}/kb/text` — text snippet
- `POST /admin/tenant/{id}/kb/reindex` — reindex documents
- `GET /admin/tenant/{id}/widget-keys` — widget keys
- `POST /admin/tenant/{id}/widget-keys` — create key
- `PUT /admin/widget-keys/{key_id}/disable` — disable key
- `GET /admin/tenant/{id}/stats/overview` — stats
- `GET /admin/tenant/{id}/stats/unanswered` — unanswered questions
- `GET /admin/tenant/{id}/conversations` — conversation list
- `GET /admin/tenant/{id}/conversations/{conv_id}` — conversation detail

## Local development (non-docker)

```bash
cp .env.example .env.local
npm i
npm run dev
```

Then visit: http://localhost:3000/login

## Docker

This service runs as part of the root `docker-compose.yml`:

```bash
# From project root
docker compose up admin-web --build
```

Admin dashboard: http://localhost:3001/login

## Deploy

Typical:
- Run this container behind a reverse proxy (Caddy/Nginx/Traefik)
- TLS termination at proxy
- Set `NODE_ENV=production`
- Set cookie security:
  - In production, cookie uses `Secure` automatically
