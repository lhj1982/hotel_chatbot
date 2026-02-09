# Quick Start Guide

Get your Hotel Chatbot SAAS up and running in 5 minutes!

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- OpenAI API key (get one at https://platform.openai.com/api-keys)

## Step 1: Configure Environment

```bash
cd hotel_chatbot

# Copy the example environment file
cp hotel-ai-core/.env.example hotel-ai-core/.env

# Edit the .env file and add your OpenAI API key
# On Mac/Linux:
nano hotel-ai-core/.env

# Or just use sed to replace it:
sed -i '' 's/sk-your-key-here/YOUR_ACTUAL_OPENAI_KEY/' hotel-ai-core/.env
```

## Step 2: Start Everything

```bash
# Using Make (recommended)
make setup

# Or using Docker Compose directly
docker compose up -d --build
```

This will:
- Build all service images
- Start PostgreSQL, Redis, MinIO
- Start the API and worker services
- Start the admin web interface
- Create the MinIO bucket
- Run database migrations

## Step 3: Verify Everything is Running

```bash
# Check service status
make ps

# Or
docker compose ps

# You should see all services "running"
```

## Step 4: Access the Applications

Open in your browser:

1. **API Documentation**: http://localhost:8000/docs
   - Interactive Swagger UI for testing API endpoints

2. **Admin Dashboard**: http://localhost:3001
   - Admin interface for managing tenants, KB, and analytics
   - Default login (if seeded): [you'll need to create initial user]

3. **MinIO Console**: http://localhost:9001
   - Object storage interface
   - Login: `minioadmin` / `minioadmin`

## Step 5: View Logs

```bash
# All services
make logs

# Specific service
make logs-api
make logs-admin
make logs-worker

# Or
docker compose logs -f api
```

## Step 6: Create Your First Tenant (via API)

```bash
# Using curl to create a tenant
curl -X POST http://localhost:8000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Hotel",
    "slug": "my-hotel",
    "default_language": "en"
  }'

# Or use the Swagger UI at http://localhost:8000/docs
```

## Common Commands

### Service Management
```bash
make up          # Start all services
make down        # Stop all services
make restart-api # Restart just the API
make health      # Check service health
```

### Database
```bash
make db-connect           # Connect to PostgreSQL
make db-migrate           # Run migrations
make db-migrate-create MSG='add users table'  # Create new migration
```

### Debugging
```bash
make shell-api           # Get shell in API container
make shell-admin         # Get shell in admin-web container
make network-test        # Test network isolation
```

### Cleanup
```bash
make clean              # Stop and remove containers
make clean-all          # ⚠️  Remove containers AND volumes (deletes all data!)
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :8000  # API
lsof -i :3001  # Admin web
lsof -i :5432  # PostgreSQL

# View detailed logs
docker compose logs --tail=100
```

### Database migration fails
```bash
# Wait a bit longer for DB to be ready
sleep 10

# Retry migration
make db-migrate

# Or manually
docker compose exec api alembic upgrade head
```

### Can't connect to API from admin-web
```bash
# Test network connectivity
make network-test

# Check if hotel-public network exists
docker network ls | grep hotel-public

# Restart services
make rebuild
```

### MinIO bucket not created
```bash
# Check minio-init logs
docker compose logs minio-init

# Manually create bucket
docker compose exec -T minio mc alias set local http://minio:9000 minioadmin minioadmin
docker compose exec -T minio mc mb local/hotel-ai-kb --ignore-existing
```

### "Permission denied" errors
```bash
# On Linux, you may need to fix permissions
sudo chown -R $USER:$USER hotel-ai-core/
sudo chown -R $USER:$USER hotel-admin-web/
```

## Network Architecture Verification

To verify the network isolation is working correctly:

```bash
# This should SUCCEED (admin-web can reach API)
docker compose exec admin-web wget -O- http://api:8000/health

# This should FAIL (admin-web CANNOT reach DB directly)
docker compose exec admin-web ping db
# Expected: "bad address: db" or "unknown host"

# This should SUCCEED (API can reach DB)
docker compose exec api ping -c 1 db
```

## Next Steps

1. **Set up authentication** - Implement JWT/OIDC for admin users
2. **Create test tenant** - Add a tenant and configure settings
3. **Upload KB documents** - Add PDFs or text to the knowledge base
4. **Test chat API** - Try the `/public/chat` endpoint
5. **Build frontend widget** - Create the guest-facing chat interface

## Development Workflow

### Working on Backend (hotel-ai-core)
```bash
# Option 1: Hot reload with Docker (recommended)
make up
make logs-api

# Option 2: Run locally
docker compose up -d db redis minio
cd hotel-ai-core
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Working on Admin Web (hotel-admin-web)
```bash
# Option 1: With Docker
make restart-admin
make logs-admin

# Option 2: Run locally
docker compose up -d api
cd hotel-admin-web
npm install
npm run dev
# Visit http://localhost:3001
```

## Production Deployment

For production, use the production override:

```bash
# Start in production mode
make prod-up

# Or
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# This will:
# - Disable volume mounts (use built images)
# - Set proper resource limits
# - Enable health checks
# - Truly isolate the internal network
# - Remove host port bindings for internal services
```

## Getting Help

1. Check the [README.md](README.md) for detailed documentation
2. View architecture docs:
   - [hotel-ai-core/CLAUDE.md](hotel-ai-core/CLAUDE.md)
   - [hotel-admin-web/CLAUDE.md](hotel-admin-web/CLAUDE.md)
3. Check logs: `make logs`
4. Run health check: `make health`
5. Test network: `make network-test`

## Clean Slate (Reset Everything)

If you want to start fresh:

```bash
# Stop everything and delete all data
make clean-all

# Then start again
make setup
```

---

**You're all set!** 🚀

Your hotel chatbot SAAS is now running. Visit http://localhost:8000/docs to explore the API.
