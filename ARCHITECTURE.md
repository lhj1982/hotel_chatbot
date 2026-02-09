# Architecture Documentation

## System Overview

The Hotel Chatbot SAAS is a multi-tenant AI-powered concierge system with three main components:

1. **hotel-ai-core** - Backend API and infrastructure
2. **hotel-admin-web** - Admin backoffice for hotel staff
3. **hotel-frontend** - Guest-facing chat widget (to be built)

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL WORLD                                  │
│                                                                         │
│                    ┌──────────────┐    ┌──────────────┐                │
│                    │   Hotel      │    │   Hotel      │                │
│                    │   Guests     │    │   Staff      │                │
│                    └──────┬───────┘    └──────┬───────┘                │
│                           │                   │                         │
└───────────────────────────┼───────────────────┼─────────────────────────┘
                            │                   │
                            │                   │
┌───────────────────────────┼───────────────────┼─────────────────────────┐
│                  hotel-public network         │                         │
│                           │                   │                         │
│                    ┌──────▼───────┐    ┌──────▼───────┐                │
│                    │  Frontend    │    │  Admin Web   │                │
│                    │  Widget      │    │  (Next.js)   │                │
│                    │              │    │              │                │
│                    │  Port: 3000  │    │  Port: 3001  │                │
│                    └──────┬───────┘    └──────┬───────┘                │
│                           │                   │                         │
│                           └─────────┬─────────┘                         │
│                                     │                                   │
│                              ┌──────▼───────┐                           │
│                              │     API      │◄──── ONLY service on both │
│                              │  (FastAPI)   │      networks (bridge)    │
│                              │              │                           │
│                              │  Port: 8000  │                           │
│                              └──────┬───────┘                           │
│                                     │                                   │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │
                                      │
┌─────────────────────────────────────┼───────────────────────────────────┐
│                  internal network   │                                   │
│                                     │                                   │
│                    ┌────────────────▼────────────┐                      │
│                    │                             │                      │
│          ┌─────────▼─────────┐        ┌─────────▼─────────┐            │
│          │    Database       │        │      Worker       │            │
│          │   (PostgreSQL     │        │     (Celery)      │            │
│          │   + pgvector)     │        │                   │            │
│          │                   │        │                   │            │
│          │   Port: 5432*     │        │                   │            │
│          └─────────┬─────────┘        └─────────┬─────────┘            │
│                    │                            │                      │
│          ┌─────────▼─────────┐        ┌─────────▼─────────┐            │
│          │      Redis        │        │      MinIO        │            │
│          │   (Cache/Queue)   │        │  (Object Storage) │            │
│          │                   │        │                   │            │
│          │   Port: 6379*     │        │   Port: 9000/9001*│            │
│          └───────────────────┘        └───────────────────┘            │
│                                                                         │
│  * Ports exposed to host for local dev tools only                      │
│  In production, these ports are NOT exposed                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Boundaries

### Network Isolation

| Service | Internal Network | Hotel-Public Network | Host Exposed |
|---------|-----------------|---------------------|--------------|
| **db** | ✅ | ❌ | 5432 (dev only) |
| **redis** | ✅ | ❌ | 6379 (dev only) |
| **minio** | ✅ | ❌ | 9000, 9001 (dev only) |
| **worker** | ✅ | ❌ | ❌ |
| **api** | ✅ | ✅ | 8000 |
| **admin-web** | ❌ | ✅ | 3001 |
| **frontend-widget** | ❌ | ✅ | 3000 |

### Access Control

```
┌─────────────────────────────────────────────────────────────┐
│                     Access Matrix                           │
├──────────────┬──────────┬─────────┬──────────┬──────────────┤
│              │    DB    │  Redis  │  MinIO   │     API      │
├──────────────┼──────────┼─────────┼──────────┼──────────────┤
│ API          │    ✅    │   ✅    │    ✅    │      -       │
│ Worker       │    ✅    │   ✅    │    ✅    │      ❌      │
│ Admin Web    │    ❌    │   ❌    │    ❌    │      ✅      │
│ Frontend     │    ❌    │   ❌    │    ❌    │      ✅      │
│ Dev Tools    │  ✅ (dev)│ ✅ (dev)│  ✅ (dev)│    ✅ (dev)  │
└──────────────┴──────────┴─────────┴──────────┴──────────────┘
```

## Data Flow

### Guest Chat Flow

```
┌─────────┐     ┌──────────┐     ┌─────┐     ┌──────┐     ┌────┐
│ Guest   │────▶│ Frontend │────▶│ API │────▶│ Redis│     │ DB │
│         │     │ Widget   │     │     │     │      │     │    │
└─────────┘     └──────────┘     └──┬──┘     └──────┘     └─┬──┘
                                    │                         │
                                    │  1. Check rate limit    │
                                    │     (Redis)             │
                                    │                         │
                                    │  2. Retrieve context    │
                                    │     (DB - vectors)      │
                                    │◄────────────────────────┘
                                    │
                                    │  3. Generate response
                                    │     (OpenAI API)
                                    │
                                    │  4. Store conversation
                                    │────────────────────────▶│
                                    │                         │
                                    │  5. Return answer       │
                                    │                         │
                                    ▼                         │
```

### Admin KB Upload Flow

```
┌─────────┐     ┌────────────┐     ┌─────┐     ┌──────────┐     ┌──────┐
│ Admin   │────▶│ Admin Web  │────▶│ API │────▶│  MinIO   │     │ Redis│
│ User    │     │            │     │     │     │          │     │      │
└─────────┘     └────────────┘     └──┬──┘     └──────────┘     └───┬──┘
                                      │                              │
                                      │  1. Upload PDF to S3         │
                                      │─────────────────────────────▶│
                                      │                              │
                                      │  2. Queue ingestion job      │
                                      │─────────────────────────────▶│
                                      │                              │
                                      │                              │
                                      │           ┌────────┐         │
                                      │           │ Worker │         │
                                      │           │        │         │
                                      │           └───┬────┘         │
                                      │               │              │
                                      │  3. Pick up job              │
                                      │◄──────────────┴──────────────┘
                                      │
                                      │  4. Download PDF
                                      │  5. Extract text
                                      │  6. Chunk text
                                      │  7. Generate embeddings (OpenAI)
                                      │  8. Store chunks + vectors
                                      │────────────────────────────▶│ DB │
                                      │                             └────┘
```

## Component Details

### API Service (api)

**Purpose**: Gateway to all backend functionality

**Responsibilities**:
- Public endpoints for guest chat (`/public/*`)
- Admin endpoints for management (`/admin/*`)
- Authentication & authorization
- Rate limiting
- RAG orchestration
- Multi-tenant isolation

**Technology**: FastAPI + Uvicorn

**Environment Variables**:
```env
DATABASE_URL=postgresql+asyncpg://hotel_ai:hotel_ai_pass@db:5432/hotel_ai
REDIS_URL=redis://redis:6379/0
S3_ENDPOINT_URL=http://minio:9000
OPENAI_API_KEY=sk-...
```

### Worker Service (worker)

**Purpose**: Background job processing

**Responsibilities**:
- PDF parsing and text extraction
- Text chunking with overlap
- Embedding generation (OpenAI)
- Vector storage
- Scheduled tasks (retention cleanup)

**Technology**: Celery + Redis as broker

**Queue Structure**:
```
default queue:     General tasks
high_priority:     Real-time tasks
kb_ingestion:      KB processing tasks
analytics:         Stats aggregation
```

### Database (db)

**Purpose**: Primary data store with vector search

**Technology**: PostgreSQL 16 + pgvector extension

**Schema Highlights**:
- `tenants` - Multi-tenant isolation
- `kb_chunks` + `kb_embeddings` - Vector storage
- `conversations` + `messages` - Chat history
- `daily_stats` - Pre-aggregated analytics

**Performance Tuning** (production):
```sql
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
```

### Redis (redis)

**Purpose**: Cache, rate limiting, Celery broker

**Usage**:
- Rate limiting: `ratelimit:{tenant_id}:{ip}:*`
- Session cache: `session:{token}`
- Celery broker: `celery:*`
- Celery results: `celery-task-meta-*`

**Configuration** (production):
```
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
```

### MinIO (minio)

**Purpose**: S3-compatible object storage

**Buckets**:
- `hotel-ai-kb` - Knowledge base documents

**Access**:
- API URL: `http://minio:9000` (internal)
- Console: `http://localhost:9001` (dev only)
- Credentials: minioadmin / minioadmin (dev)

### Admin Web (admin-web)

**Purpose**: Management interface for hotel staff

**Technology**: Next.js 14 (App Router) + TypeScript + Tailwind CSS v4

**Features**:
- JWT authentication via httpOnly cookies
- Multi-tenant context switching
- RBAC (owner/editor/viewer)
- KB management
- Analytics dashboard
- Conversation viewer

**API Communication**: All requests proxied through `/api/core/*` to avoid CORS

### Frontend Widget (frontend-widget)

**Purpose**: Guest-facing chat interface

**Status**: To be built

**Planned Features**:
- Embeddable widget via `<script>` tag
- Standalone chat page
- Widget key authentication
- Domain validation
- WebSocket support (future)

## Environment Modes

### Development Mode

**File**: `docker-compose.yml`

**Characteristics**:
- Volume mounts for hot reload
- All ports exposed to host
- Internal network allows external connectivity
- Debug logging enabled

**Start**:
```bash
make up
# or
docker compose up -d
```

### Production Mode

**File**: `docker-compose.yml` + `docker-compose.prod.yml`

**Characteristics**:
- No volume mounts (use built images)
- Only essential ports exposed
- Internal network truly isolated (`internal: true`)
- Resource limits enforced
- Health checks enabled
- Multi-worker processes

**Start**:
```bash
make prod-up
# or
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Scalability Considerations

### Horizontal Scaling

**Can scale**:
- ✅ API (add more replicas)
- ✅ Worker (add more workers)
- ✅ Admin Web (add more replicas)
- ✅ Frontend (add more replicas)

**Cannot scale easily**:
- ❌ Database (needs primary-replica setup)
- ❌ Redis (needs Redis Cluster)
- ❌ MinIO (needs distributed mode)

### Load Balancing

For production with multiple replicas:

```yaml
# docker-compose.scale.yml
services:
  api:
    deploy:
      replicas: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Database Partitioning

For high message volume:

```sql
-- Partition messages table by month
CREATE TABLE messages_2024_01 PARTITION OF messages
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Monitoring & Observability

### Recommended Stack

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    # Scrape metrics from API

  grafana:
    image: grafana/grafana
    # Visualize metrics

  jaeger:
    image: jaegertracing/all-in-one
    # Distributed tracing
```

### Health Checks

| Service | Endpoint | Expected |
|---------|----------|----------|
| API | `GET /health` | `{"status": "ok"}` |
| Admin Web | `GET /api/health` | `200 OK` |
| Database | `pg_isready` | `accepting connections` |
| Redis | `redis-cli ping` | `PONG` |

### Log Aggregation

Recommended: Use Docker logging driver

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Or use external service (e.g., Datadog, CloudWatch):

```yaml
services:
  api:
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "us-east-1"
        awslogs-group: "hotel-chatbot"
```

## Security Best Practices

### Production Checklist

- [ ] Change all default passwords
- [ ] Use Docker secrets for sensitive data
- [ ] Set `internal: true` on internal network
- [ ] Remove host port bindings for db/redis/minio
- [ ] Enable HTTPS (use nginx/traefik reverse proxy)
- [ ] Implement rate limiting
- [ ] Enable API authentication
- [ ] Regular security updates (`docker compose pull`)
- [ ] Backup volumes regularly
- [ ] Enable audit logging
- [ ] Configure CORS properly
- [ ] Use read-only file systems where possible

### Secrets Management

**Development**: `.env` files (gitignored)

**Production**: Docker secrets

```yaml
services:
  api:
    secrets:
      - db_password
      - openai_api_key
    environment:
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
      OPENAI_API_KEY_FILE: /run/secrets/openai_api_key

secrets:
  db_password:
    external: true
  openai_api_key:
    external: true
```

## Disaster Recovery

### Backup Strategy

**What to backup**:
1. PostgreSQL database (daily)
2. MinIO buckets (continuous sync)
3. Redis (optional - can rebuild)

**Backup script**:
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker compose exec -T db pg_dump -U hotel_ai hotel_ai | gzip > "backup/db_${DATE}.sql.gz"

# Backup MinIO
docker compose exec -T minio mc mirror local/hotel-ai-kb /backup/minio/
```

### Restore Procedure

```bash
# Restore database
gunzip -c backup/db_20240101_120000.sql.gz | \
  docker compose exec -T db psql -U hotel_ai -d hotel_ai

# Restore MinIO
docker compose exec -T minio mc mirror /backup/minio/ local/hotel-ai-kb
```

## Cost Optimization

### Development

- Use small instance types
- Stop services when not in use (`make down`)
- Limit resource usage

### Production

- Use reserved instances for persistent services
- Auto-scale API/worker based on load
- Implement caching aggressively
- Use OpenAI batch API for embeddings (50% cheaper)
- Archive old conversations to cold storage

---

For more details, see:
- [README.md](README.md) - Full documentation
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [hotel-ai-core/CLAUDE.md](hotel-ai-core/CLAUDE.md) - Backend architecture
- [hotel-admin-web/CLAUDE.md](hotel-admin-web/CLAUDE.md) - Admin web architecture
