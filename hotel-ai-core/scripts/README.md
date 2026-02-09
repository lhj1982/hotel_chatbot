# Database Seed Scripts

Simple SQL scripts for seeding test data.

## Quick Commands

```bash
# Seed admin user + tenant
make db-seed

# Seed knowledge base data
make db-seed-kb

# Run migrations + seed everything
make db-seed-all
```

## What Gets Created

### seed_admin.sql
- **Tenant**: Test Hotel (slug: `test-hotel`)
- **Admin User**: test@test.com / password: `test`
- **Role**: owner

### seed_kb_sample.sql
- Sample KB documents with chunks
- Check-in/check-out policies
- Hotel amenities info

## Creating Your Own Seeds

Just create a new `.sql` file:

```sql
-- scripts/my_custom_seed.sql

INSERT INTO tenants (id, name, slug, status, default_language)
VALUES (gen_random_uuid(), 'My Hotel', 'my-hotel', 'active', 'en')
ON CONFLICT (slug) DO NOTHING;

\echo 'Done!'
```

Run it:
```bash
docker compose exec -T db psql -U hotel_ai -d hotel_ai < hotel-ai-core/scripts/my_custom_seed.sql
```

Or add to Makefile for easy access.

## Tips

- Use `ON CONFLICT DO NOTHING` to make scripts idempotent
- Use `gen_random_uuid()` for auto-generating UUIDs
- Use `NOW()` for timestamps
- Test admin password is pre-hashed: `$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYKf.9eTQeC` = "test"
