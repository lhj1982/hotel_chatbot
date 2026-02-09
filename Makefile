.PHONY: help up down build rebuild logs clean dev-up dev-down prod-up health test db-migrate

# Default target
help:
	@echo "Hotel Chatbot SAAS - Docker Management Commands"
	@echo ""
	@echo "Development Commands:"
	@echo "  make up              - Start all services in development mode"
	@echo "  make down            - Stop all services"
	@echo "  make build           - Build all service images"
	@echo "  make rebuild         - Rebuild and restart all services"
	@echo "  make logs            - Follow logs from all services"
	@echo "  make logs-api        - Follow logs from API service only"
	@echo "  make logs-admin      - Follow logs from admin-web service only"
	@echo "  make logs-worker     - Follow logs from worker service only"
	@echo ""
	@echo "Production Commands:"
	@echo "  make prod-up         - Start all services in production mode"
	@echo "  make prod-down       - Stop production services"
	@echo "  make prod-rebuild    - Rebuild and restart in production mode"
	@echo ""
	@echo "Service Management:"
	@echo "  make health          - Check health status of all services"
	@echo "  make ps              - Show running services"
	@echo "  make restart-api     - Restart API service only"
	@echo "  make restart-admin   - Restart admin-web service only"
	@echo ""
	@echo "Database Operations:"
	@echo "  make db-connect      - Connect to PostgreSQL database"
	@echo "  make db-migrate      - Run database migrations"
	@echo "  make db-migrate-create MSG='description' - Create new migration"
	@echo "  make db-seed         - Seed database with test admin user"
	@echo "  make db-seed-kb      - Seed knowledge base with sample data"
	@echo "  make db-seed-all     - Run migrations + seed all data"
	@echo ""
	@echo "Cleanup Commands:"
	@echo "  make clean           - Stop services and remove containers"
	@echo "  make clean-all       - Stop services, remove containers and volumes (DANGER!)"
	@echo ""
	@echo "Testing Commands:"
	@echo "  make test            - Run all tests"
	@echo "  make test-api        - Run API tests only"

# ============================================================================
# Development Commands
# ============================================================================

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild:
	docker compose down
	docker compose build
	docker compose up -d

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-admin:
	docker compose logs -f admin-web

logs-worker:
	docker compose logs -f worker

# ============================================================================
# Production Commands
# ============================================================================

prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-rebuild:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-logs:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# ============================================================================
# Service Management
# ============================================================================

health:
	@echo "Checking service health..."
	@docker compose ps

ps:
	docker compose ps

restart-api:
	docker compose restart api

restart-admin:
	docker compose restart admin-web

restart-worker:
	docker compose restart worker

# ============================================================================
# Database Operations
# ============================================================================

db-connect:
	docker compose exec db psql -U hotel_ai -d hotel_ai

db-migrate:
	docker compose exec api alembic upgrade head

db-migrate-create:
	@if [ -z "$(MSG)" ]; then \
		echo "Error: MSG is required. Usage: make db-migrate-create MSG='your message'"; \
		exit 1; \
	fi
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"

db-rollback:
	docker compose exec api alembic downgrade -1

db-seed:
	@echo "Seeding database with test data..."
	docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/seed_admin.sql

db-seed-kb:
	@echo "Seeding knowledge base with sample data..."
	docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/seed_kb_sample.sql

db-seed-all:
	@echo "Running migrations and seeding database..."
	docker compose exec api alembic upgrade head
	docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/seed_admin.sql
	docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/seed_kb_sample.sql
	@echo "✓ Complete!"

db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
		docker compose up -d; \
	fi

# ============================================================================
# Cleanup Commands
# ============================================================================

clean:
	docker compose down --remove-orphans

clean-all:
	@echo "WARNING: This will delete all containers and volumes (all data will be lost)!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v --remove-orphans; \
	fi

clean-images:
	docker compose down --rmi all -v

# ============================================================================
# Testing Commands
# ============================================================================

test:
	docker compose exec api pytest

test-api:
	docker compose exec api pytest tests/api/

test-coverage:
	docker compose exec api pytest --cov=app --cov-report=html

# ============================================================================
# Development Helpers
# ============================================================================

shell-api:
	docker compose exec api /bin/bash

shell-admin:
	docker compose exec admin-web /bin/sh

shell-db:
	docker compose exec db /bin/bash

# Install dependencies in running containers
install-api:
	docker compose exec api pip install -r requirements.txt

install-admin:
	docker compose exec admin-web npm install

# Watch logs with filtering
logs-errors:
	docker compose logs -f | grep -i error

logs-warnings:
	docker compose logs -f | grep -i warning

# Network debugging
network-test:
	@echo "Testing network connectivity..."
	@echo "\n1. Admin-web -> API (should SUCCEED):"
	docker compose exec admin-web wget -q -O- http://api:8000/health || echo "FAILED"
	@echo "\n2. Admin-web -> DB (should FAIL - not on same network):"
	docker compose exec admin-web ping -c 1 db 2>&1 | grep "bad address" || echo "WARNING: Can reach DB!"
	@echo "\n3. API -> DB (should SUCCEED):"
	docker compose exec api ping -c 1 db > /dev/null 2>&1 && echo "SUCCESS" || echo "FAILED"
	@echo "\n4. API -> Redis (should SUCCEED):"
	docker compose exec api ping -c 1 redis > /dev/null 2>&1 && echo "SUCCESS" || echo "FAILED"

# ============================================================================
# Initial Setup
# ============================================================================

setup:
	@echo "Setting up Hotel Chatbot SAAS..."
	@if [ ! -f hotel-ai-core/.env ]; then \
		echo "Creating .env from .env.example..."; \
		cp hotel-ai-core/.env.example hotel-ai-core/.env; \
		echo "⚠️  Please update hotel-ai-core/.env with your API keys"; \
	else \
		echo "✓ .env already exists"; \
	fi
	@echo "\nBuilding and starting services..."
	docker compose build
	docker compose up -d
	@echo "\nWaiting for services to be healthy..."
	sleep 10
	@echo "\nRunning database migrations..."
	docker compose exec api alembic upgrade head || echo "⚠️  Migrations failed - you may need to run manually"
	@echo "\nSeeding database with test data..."
	docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/seed_admin.sql || echo "⚠️  Seeding failed - you may need to run manually"
	@echo "\n✓ Setup complete!"
	@echo "\nServices:"
	@echo "  - API:           http://localhost:8000/docs"
	@echo "  - Admin Web:     http://localhost:3001"
	@echo "  - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
	@echo "\nTest Admin Login:"
	@echo "  - Email:    test@test.com"
	@echo "  - Password: test"
	@echo "\nRun 'make logs' to see service logs"

# ============================================================================
# Monitoring
# ============================================================================

stats:
	docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

inspect-networks:
	@echo "Internal network:"
	docker network inspect hotel_chatbot_internal | grep -A 20 "Containers"
	@echo "\nHotel-public network:"
	docker network inspect hotel-public | grep -A 20 "Containers"
