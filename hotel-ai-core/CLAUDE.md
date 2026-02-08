# Hotel AI Core

Multi-tenant core API for AI-powered hotel concierge: RAG orchestration, knowledge base ingestion, and analytics.

This is the **backend** service (`hotel-ai-core`). It is part of a multi-repo architecture:

| Repo | Role | Network |
|------|------|---------|
| `hotel-ai-core` | Backend API + worker + infrastructure | Internal only (api bridges to public) |
| `hotel-frontend` | Guest-facing chat widget / standalone page | Public |
| `hotel-backoffice` | Admin dashboard for hotel staff | Public |

Frontend and backoffice communicate with the core API over the `hotel-public` Docker network. Infrastructure services (db, redis, minio) are isolated on the `internal` network and are never directly accessible from frontend or backoffice.

## 1. Tech Stack

- **Runtime:** Python 3.11+
- **Framework:** FastAPI + Uvicorn
- **Database:** PostgreSQL with pgvector extension (relational + vector storage)
- **Cache / Queue:** Redis (rate limiting + Celery broker)
- **Worker:** Celery for async ingestion jobs
- **Object Storage:** S3-compatible (MinIO locally, AWS S3 in production)

## 2. Non-Functional Requirements

- **Multi-tenant isolation** — `tenant_id` scopes every query; no cross-tenant data leakage
- **No direct DB access** — frontend and backoffice communicate only through the API
- **Network isolation** — db, redis, minio on `internal` network; only `api` exposed on `hotel-public`
- **Rate limiting** — enforced on all public endpoints (per tenant + per IP)
- **Observability** — structured logs, request IDs on every request, metrics hooks

## 3. Data Model

### tenants
| Column           | Type                          |
|------------------|-------------------------------|
| id               | uuid, PK                      |
| name             | string                        |
| slug             | string, unique                |
| status           | enum: active / disabled       |
| default_language | string                        |
| created_at       | timestamptz                   |

### tenant_settings
| Column           | Type                          |
|------------------|-------------------------------|
| tenant_id        | uuid, FK → tenants, PK        |
| greeting_message | text                          |
| escalation_phone | string                        |
| escalation_email | string                        |
| retention_days   | int                           |
| allowed_domains  | text[]                        |

### widget_keys
| Column    | Type                          |
|-----------|-------------------------------|
| id        | uuid, PK                      |
| tenant_id | uuid, FK → tenants            |
| key       | string, unique                |
| status    | enum: active / disabled       |
| created_at| timestamptz                   |

### users (admin accounts)
| Column        | Type                          |
|---------------|-------------------------------|
| id            | uuid, PK                      |
| email         | string, unique                |
| password_hash | text (nullable if OIDC)       |
| oidc_subject  | string (nullable if password) |
| created_at    | timestamptz                   |

### tenant_user_roles
| Column    | Type                              |
|-----------|-----------------------------------|
| tenant_id | uuid, FK → tenants, composite PK  |
| user_id   | uuid, FK → users, composite PK    |
| role      | enum: owner / editor / viewer     |

### kb_documents
| Column      | Type                                  |
|-------------|---------------------------------------|
| id          | uuid, PK                              |
| tenant_id   | uuid, FK → tenants                    |
| source_type | enum: pdf / text / url                |
| title       | string                                |
| status      | enum: processing / ready / failed     |
| storage_url | text                                  |
| created_at  | timestamptz                           |

### kb_chunks
| Column      | Type                          |
|-------------|-------------------------------|
| id          | uuid, PK                      |
| tenant_id   | uuid, FK → tenants            |
| document_id | uuid, FK → kb_documents       |
| chunk_text  | text                          |
| chunk_hash  | string(64)                    |
| created_at  | timestamptz                   |

### kb_embeddings
| Column    | Type                          |
|-----------|-------------------------------|
| chunk_id  | uuid, FK → kb_chunks, PK      |
| tenant_id | uuid, FK → tenants            |
| embedding | vector(1536), HNSW indexed    |
| created_at| timestamptz                   |

### conversations
| Column    | Type                                          |
|-----------|-----------------------------------------------|
| id        | uuid, PK                                      |
| tenant_id | uuid, FK → tenants                            |
| channel   | enum: web_widget / web_url / whatsapp (future)|
| started_at| timestamptz                                   |
| ended_at  | timestamptz, nullable                         |
| status    | enum: active / closed / escalated             |

### messages
| Column            | Type                              |
|-------------------|-----------------------------------|
| id                | uuid, PK                          |
| tenant_id         | uuid, FK → tenants                |
| conversation_id   | uuid, FK → conversations          |
| role              | enum: user / assistant / system   |
| content           | text, nullable (if redaction on)  |
| redacted_content  | text, nullable                    |
| token_count       | int, optional                     |
| created_at        | timestamptz                       |

> Partition messages by month when scale grows.

### turns
| Column               | Type                                  |
|----------------------|---------------------------------------|
| id                   | uuid, PK                              |
| tenant_id            | uuid, FK → tenants                    |
| conversation_id      | uuid, FK → conversations              |
| user_message_id      | uuid, FK → messages                   |
| assistant_message_id | uuid, FK → messages                   |
| outcome              | enum: answered / fallback / escalate  |
| confidence           | float                                 |
| retrieved_chunk_ids  | jsonb                                 |
| created_at           | timestamptz                           |

### daily_stats (pre-aggregated)
| Column              | Type                          |
|---------------------|-------------------------------|
| tenant_id           | uuid, FK → tenants, composite PK |
| date                | date, composite PK            |
| total_conversations | int                           |
| total_messages      | int                           |
| fallback_count      | int                           |
| escalations         | int                           |

## 4. Public APIs

Called by the chat widget or standalone chat page. No auth required — identified by widget key.

### `GET /public/widget-config?widget_key=...`

Returns tenant public config: greeting message, escalation contact, supported languages, theme (future), policies.

**Validation:**
- `widget_key` must exist and be active
- Request `Origin` / `Referer` must match `allowed_domains` (if configured)

### `POST /public/conversation/start`

**Body:** `widget_key`, `channel`, optional `locale` and `page_url`
**Returns:** `conversation_id`

### `POST /public/chat`

**Body:** `widget_key`, `conversation_id`, `message`, `locale`
**Returns:**
- `outcome`: answered | fallback | escalate
- `answer_text` (if answered)
- `citations`: chunk IDs + document titles
- `confidence`
- `escalation`: { phone, email, message } (if fallback/escalate)

**Rules:**
- Retrieve KB chunks filtered by `tenant_id`
- If retrieval confidence < threshold or no chunks found, return fallback
- Never hallucinate — answer only from retrieved text
- **Rate limit:** per tenant + per IP

## 5. Admin APIs

Called by the backoffice app. Auth via JWT (OIDC) or session token. RBAC enforced.

### Tenant / Settings
- `GET  /admin/me` — current user info + tenant list
- `GET  /admin/tenant/{tenant_id}/settings`
- `POST /admin/tenant/{tenant_id}/settings`

### Widget Key Management
- `GET  /admin/tenant/{tenant_id}/widget-keys` — list all keys
- `POST /admin/tenant/{tenant_id}/widget-keys` — create new key
- `POST /admin/widget-keys/{id}/disable`

### Knowledge Base
- `POST /admin/tenant/{tenant_id}/kb/upload` — upload PDF
- `POST /admin/tenant/{tenant_id}/kb/text` — submit raw text
- `GET  /admin/tenant/{tenant_id}/kb/documents` — list all
- `GET  /admin/tenant/{tenant_id}/kb/documents/{doc_id}` — detail
- `POST /admin/tenant/{tenant_id}/kb/reindex` — reindex one or all docs

### Conversations & Analytics
- `GET /admin/tenant/{tenant_id}/conversations?from=&to=`
- `GET /admin/tenant/{tenant_id}/conversations/{id}`
- `GET /admin/tenant/{tenant_id}/stats/overview`
- `GET /admin/tenant/{tenant_id}/stats/unanswered`

## 6. RAG Orchestration

### Retrieval Pipeline
1. Embed the user query
2. Vector search `top_k=5..12`, scoped to `tenant_id`
3. Compute confidence (max cosine similarity)
4. If `max_similarity < threshold` → fallback with escalation info

### Prompt Policy (hard rules)
- Only answer using the provided context
- If information is missing, say so and show escalation contact
- Never guess prices, availability, legal policies, or special offers

### Response Format
Structured JSON: `answer_text`, `citations` (document_id, title, chunk_id), `confidence`, `outcome`

## 7. Ingestion Worker

Triggered on KB upload. Pipeline:

1. Download document from object storage
2. Parse to text (PDF, plain text, URL)
3. Chunk with overlap
4. Embed all chunks
5. Insert chunks + embeddings into DB

Jobs must be **idempotent** — re-indexing the same document is safe (deletes old chunks first).

## 8. Security & Compliance

- **Tenant isolation** enforced at the DB query level (`tenant_id` on every query)
- **PII redaction** — optional, controlled by config flag per tenant
- **Retention policy** — background job deletes raw message content after `retention_days` per tenant
- **Always retained:** metadata, outcome, and retrieval IDs (never deleted)

## 9. Docker Network Architecture

```
┌─ hotel-public network ────────────────────────────────┐
│                                                       │
│  frontend ──▶ backoffice ──▶ api:8000                 │
│  (separate repo)            (separate repo)           │
│                                                       │
└───────────────────────────────────┬───────────────────┘
                                    │
┌─ internal network ────────────────┼───────────────────┐
│                                   ▼                   │
│  db:5432   redis:6379   minio:9000   worker           │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- **`internal`** — all core services (api, worker, db, redis, minio)
- **`hotel-public`** — only `api` is exposed; frontend and backoffice connect here
- Host port bindings on db/redis/minio are for local dev tooling only

Frontend/backoffice repos join the shared network with:
```yaml
networks:
  hotel-public:
    external: true
    name: hotel-public
```

## 10. Repo Structure

```
app/
  main.py
  config.py
  api/
    public.py
    admin.py
    deps.py
  core/
    auth/        # JWT, passwords, RBAC
    tenants/     # tenant + settings CRUD
    kb/          # document upload, chunking
    rag/         # embeddings, retrieval, orchestrator
    guardrails/  # system prompt + safety rules
    analytics/   # stats queries
  db/
    models.py
    session.py
  workers/
    celery_app.py
    ingest.py
tests/
alembic/
```
