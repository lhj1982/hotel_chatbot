# hotel-admin-web

Admin dashboard for **hotel-ai-core**.

- Framework: Next.js (App Router) + TypeScript
- Runs in Docker and is intended to be **publicly accessible** (e.g. `admin.yourdomain.com`)
- Uses **username/password login** via `hotel-ai-core`
- Talks to core API through a server-side **proxy** (`/api/core/...`) so JWT is stored only in httpOnly cookies (not in browser localStorage).

## How auth works (MVP)

1) User enters email/password at `/login`.
2) `hotel-admin-web` calls core login endpoint (`CORE_LOGIN_PATH`) from a Next route handler.
3) Core returns a token (expects `{access_token: "..."}` or `{token: "..."}`).
4) Token is stored as a httpOnly cookie `AUTH_COOKIE_NAME`.
5) All `/admin/*` routes are protected by `middleware.ts` (redirect to `/login` if cookie missing).
6) UI calls `/api/core/...` which forwards requests to core with `Authorization: Bearer <token>`.

## Required core API endpoints

This UI expects these endpoints to exist in `hotel-ai-core` (you can change them in the UI later):

- `POST {CORE_LOGIN_PATH}`
  - Request: `{ email, password }`
  - Response: `{ access_token }` (or `{ token }`)

- `GET /admin/me`
- `GET /admin/settings` + `POST /admin/settings`
- `GET /admin/kb/documents`
- `POST /admin/kb/text`
- `POST /admin/kb/reindex` (optional)
- `GET /admin/stats/overview`
- `GET /admin/stats/unanswered`

If your core uses different paths (e.g. `/admin/tenant/{id}/...`), update the UI calls in these pages:
- `src/app/admin/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/kb/page.tsx`
- `src/app/admin/stats/page.tsx`

## Local development (non-docker)

```bash
cp .env.example .env.local
npm i
npm run dev
```

Then visit:
- http://localhost:3000/login

## Docker

### Build & run admin only

```bash
docker build -t hotel-admin-web .
docker run -p 3001:3000 \
  -e CORE_API_BASE_URL=http://host.docker.internal:8000 \
  -e CORE_LOGIN_PATH=/admin/auth/login \
  -e AUTH_COOKIE_NAME=hotel_admin_access \
  hotel-admin-web
```

### Compose (admin only)

```bash
cp .env.example .env
# edit CORE_API_BASE_URL to point to your core API

docker compose up --build
```

## Deploy

Typical:
- Run this container behind a reverse proxy (Caddy/Nginx/Traefik)
- TLS termination at proxy
- Set `NODE_ENV=production`
- Set cookie security:
  - In production, cookie uses `Secure` automatically


## Run admin-web + core together in Docker (same network)

Because `hotel-admin-web` must reach `hotel-ai-core` **inside Docker**, run them in the same `docker-compose` project (shared network)
and set `CORE_API_BASE_URL` to the **service name** `http://hotel-ai-core:8000`.

### Option 1: Top-level compose (recommended)

Create a folder that contains both repos as siblings:

```
workspace/
  hotel-ai-core/
  hotel-admin-web/
  docker-compose.yml
```

Use this `docker-compose.yml` (top-level):

```yaml
version: "3.9"
services:
  hotel-ai-core:
    build: ./hotel-ai-core
    environment:
      - APP_ENV=prod
      # add your core env vars here (DB, redis, secrets, etc.)
    ports:
      - "8000:8000"

  hotel-admin-web:
    build: ./hotel-admin-web
    environment:
      - CORE_API_BASE_URL=http://hotel-ai-core:8000
      - CORE_LOGIN_PATH=/admin/login   # change if your core uses a different path
      - AUTH_COOKIE_NAME=hotel_admin_access
      - APP_ORIGIN=http://localhost:3001
    ports:
      - "3001:3000"
    depends_on:
      - hotel-ai-core
```

Then run:

```bash
docker compose up --build
```

Open:
- Admin: `http://localhost:3001/login`
- Core: `http://localhost:8000/docs`

### Option 2: Core in another compose project

If `hotel-ai-core` runs in a different compose project, you must connect the Docker networks or put a reverse proxy in front.
The easiest approach is Option 1 above.
