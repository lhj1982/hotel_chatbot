# Hotel Chatbot SAAS System

Multi-tenant AI-powered hotel concierge system with separate backend core, admin backoffice, and frontend chatbot widget.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    hotel-public network                      │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ Frontend     │      │ Admin Web    │      │           │ │
│  │ Widget       │─────▶│ (Next.js)    │─────▶│  API      │ │
│  │ (Port 3000)  │      │ (Port 3001)  │      │ (Port     │ │
│  │              │      │              │      │  8000)    │ │
│  └──────────────┘      └──────────────┘      └─────┬─────┘ │
│                                                     │       │
└─────────────────────────────────────────────────────┼───────┘
                                                      │
┌─────────────────────────────────────────────────────┼───────┐
│                    internal network                 │       │
│                                                     │       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────▼─────┐ │
│  │ Database │  │  Redis   │  │  MinIO   │  │   Worker    │ │
│  │ (pgvector│  │  (Cache/ │  │ (Object  │  │  (Celery)   │ │
│  │  pg16)   │  │  Queue)  │  │ Storage) │  │             │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Components

| Component | Technology | Port | Network | Purpose |
|-----------|-----------|------|---------|---------|
| **hotel-ai-core** | FastAPI + Python | 8000 | internal + hotel-public | Backend API + orchestration |
| **worker** | Celery | - | internal | Async KB ingestion |
| **admin-web** | Next.js 14 | 3001 | hotel-public | Admin dashboard |
| **frontend-widget** | (TBD) | 3000 | hotel-public | Guest chat interface |
| **db** | PostgreSQL + pgvector | 5432 | internal | Database |
| **redis** | Redis 7 | 6379 | internal | Cache/queue |
| **minio** | MinIO | 9000/9001 | internal | S3-compatible storage |

## Network Security

### Internal Network
- **Services**: db, redis, minio, worker
- **Access**: Only accessible by API and worker services
- **Isolation**: No direct external access - even frontend/admin cannot reach these services
- **Port bindings**: Exposed to host (5432, 6379, 9000) for local dev tools only

### Hotel-Public Network
- **Services**: api (bridge), admin-web, frontend-widget
- **Access**: API is the only gateway to internal services
- **Security**: Frontend and admin web can ONLY communicate via API endpoints
- **Enforcement**: Database credentials never leave the internal network

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone <your-repo>
cd hotel_chatbot
```

### 2. Configure Environment
Create `.env` file in `hotel-ai-core/`:
```bash
cd hotel-ai-core
cp .env.example .env  # Create this if it doesn't exist
```

Required environment variables:
```env
# Database
DATABASE_URL=postgresql://hotel_ai:hotel_ai_pass@db:5432/hotel_ai

# Redis
REDIS_URL=redis://redis:6379/0

# MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=hotel-ai-kb

# API Keys (add your own)
OPENAI_API_KEY=sk-...
```

### 3. Start All Services
From the root `hotel_chatbot` directory:
```bash
# Start all services
docker compose up --build

# Or run in background
docker compose up -d --build
```

### 4. Verify Services
```bash
# Check running services
docker compose ps

# Check logs
docker compose logs -f api
docker compose logs -f admin-web
```

### 5. Access the Applications
- **API Documentation**: http://localhost:8000/docs
- **Admin Dashboard**: http://localhost:3001
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Development Workflow

### Working on Backend Core
```bash
# Start only infrastructure
docker compose up -d db redis minio

# Run API locally
cd hotel-ai-core
pip install -r requirements.txt
uvicorn app.main:app --reload

# Run worker locally
celery -A app.workers.celery_app worker --loglevel=info
```

### Working on Admin Web
```bash
# Ensure API is running
docker compose up -d api

# Run admin web locally
cd hotel-admin-web
npm install
npm run dev
```

### Working on Frontend Widget (when created)
```bash
# Ensure API is running
docker compose up -d api

# Run frontend locally
cd hotel-frontend
npm install
npm run dev
```

## Project Structure

```
hotel_chatbot/
├── docker-compose.yml          # Main orchestration file
├── README.md                   # This file
│
├── hotel-ai-core/              # Backend API + worker
│   ├── Dockerfile
│   ├── docker-compose.yml      # Standalone dev setup
│   ├── CLAUDE.md               # Architecture documentation
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   └── workers/
│   └── requirements.txt
│
├── hotel-admin-web/            # Admin backoffice
│   ├── Dockerfile
│   ├── docker-compose.yml      # Standalone dev setup
│   ├── CLAUDE.md               # Architecture documentation
│   ├── src/
│   │   ├── app/
│   │   └── lib/
│   └── package.json
│
└── hotel-frontend/             # Guest chat widget (to be created)
    ├── Dockerfile
    ├── CLAUDE.md
    └── ...
```

## Common Commands

### Start/Stop Services
```bash
# Start all
docker compose up -d

# Start specific service
docker compose up -d api

# Stop all
docker compose down

# Stop and remove volumes (CAREFUL: deletes all data)
docker compose down -v
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f admin-web
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail=100 api
```

### Database Operations
```bash
# Connect to database
docker compose exec db psql -U hotel_ai -d hotel_ai

# Run migrations
docker compose exec api alembic upgrade head

# Create migration
docker compose exec api alembic revision --autogenerate -m "description"
```

### Rebuild Services
```bash
# Rebuild all
docker compose build

# Rebuild specific service
docker compose build api
docker compose build admin-web

# Rebuild and restart
docker compose up -d --build api
```

## Network Testing

### Verify Network Isolation
```bash
# From admin-web, try to access internal services (should FAIL)
docker compose exec admin-web ping db
# Should fail: "ping: unknown host db"

# From admin-web, access API (should SUCCEED)
docker compose exec admin-web wget -O- http://api:8000/health
# Should return: {"status": "ok"}

# From API, access internal services (should SUCCEED)
docker compose exec api ping db
docker compose exec api ping redis
docker compose exec api ping minio
```

## Production Deployment

For production, update `docker-compose.yml`:

1. **Set internal network to truly internal**:
```yaml
networks:
  internal:
    driver: bridge
    internal: true  # Change from false to true
```

2. **Remove host port bindings** for internal services (db, redis, minio)

3. **Use secrets** instead of environment variables

4. **Add health checks** for all services

5. **Configure resource limits**:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Troubleshooting

### Services can't connect to API
```bash
# Check if hotel-public network exists
docker network ls | grep hotel-public

# Check service network connections
docker compose exec admin-web nslookup api
```

### Database connection fails
```bash
# Check if db is healthy
docker compose ps db

# Check db logs
docker compose logs db

# Verify connection from API
docker compose exec api ping db
```

### MinIO bucket not created
```bash
# Check minio-init logs
docker compose logs minio-init

# Manually create bucket
docker compose exec minio mc alias set local http://minio:9000 minioadmin minioadmin
docker compose exec minio mc mb local/hotel-ai-kb
```

## Next Steps

1. **Create Frontend Widget**: Build the guest-facing chat interface
2. **Implement Authentication**: Add JWT/OIDC for admin users
3. **Add Monitoring**: Integrate Prometheus + Grafana
4. **Set up CI/CD**: Automate builds and deployments
5. **Production Config**: Create production docker-compose override file

## License

[Your License]

## Support

For issues or questions, please contact [your contact info]
