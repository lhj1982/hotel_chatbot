# Hotel Admin Web

Next.js 14 admin dashboard for hotel AI chatbot management. Communicates with `hotel-ai-core` over the `hotel-public` Docker network.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | JWT in httpOnly cookie via API route proxy |
| State | React context (tenant selection) |

## Architecture

### Auth Flow
1. Login form posts to `/api/auth/login` (Next.js API route)
2. API route forwards to `CORE_API_BASE_URL/admin/login`
3. JWT stored in httpOnly cookie `hotel_admin_access`
4. Middleware protects all `/admin/*` routes — redirects to `/login` if no cookie

### API Proxy
All client-side API calls go through `/api/core/[...path]` catch-all route, which:
- Reads JWT from the httpOnly cookie
- Forwards to `CORE_API_BASE_URL/{path}` with `Authorization: Bearer` header
- Returns the response to the client

This avoids exposing the core API URL or JWT to the browser.

### Multi-Tenant
- `TenantProvider` wraps the admin layout
- `useTenant()` hook returns `{ tenants, current, setCurrent, canEdit }`
- Selected tenant persisted in `selected_tenant` cookie
- All API calls are scoped by `tenant_id` from the current context
- RBAC: `canEdit` is true for `owner` and `editor` roles; `viewer` gets read-only UI

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Email/password login form |
| `/admin` | Dashboard with role info + nav cards |
| `/admin/kb` | Knowledge base: file upload, text snippets, document table, reindex |
| `/admin/settings` | Tenant config (greeting, escalation, retention) + widget key management |
| `/admin/stats` | Analytics: metric cards, date range filter, unanswered questions table |
| `/admin/conversations` | Conversation list with date filter |
| `/admin/conversations/[id]` | Chat transcript + turn outcomes sidebar |

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout (Tailwind, metadata)
    globals.css             # Tailwind import
    login/page.tsx          # Login page
    admin/
      layout.tsx            # Sidebar, header, tenant provider
      page.tsx              # Dashboard
      kb/page.tsx           # Knowledge base management
      settings/page.tsx     # Tenant settings + widget keys
      stats/page.tsx        # Analytics
      conversations/
        page.tsx            # Conversation list
        [id]/page.tsx       # Conversation detail
    api/
      auth/login/route.ts   # Login proxy
      auth/logout/route.ts  # Logout (clear cookie)
      core/[...path]/route.ts # Catch-all API proxy
  lib/
    apiClient.ts            # Typed fetch wrappers for all endpoints
    types.ts                # TypeScript interfaces
    tenant-context.tsx      # Tenant selection context
  middleware.ts             # Auth guard for /admin routes
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORE_API_BASE_URL` | `http://api:8000` | Core API URL (Docker internal) |
| `CORE_LOGIN_PATH` | `/admin/login` | Login endpoint path on core |
| `AUTH_COOKIE_NAME` | `hotel_admin_access` | Cookie name for JWT |
| `APP_ORIGIN` | `http://localhost:3001` | App origin for cookie security |

## Docker

Runs on port 3001 (host) → 3000 (container). Joins the `hotel-public` external network to reach the core API.

```bash
# Start core first (creates hotel-public network)
cd ../hotel-ai-core && docker compose up -d

# Then start admin web
docker compose up --build
```

## Development

```bash
npm install
npm run dev    # http://localhost:3001
```

Requires `hotel-ai-core` running on `localhost:8000` or update `CORE_API_BASE_URL`.
