-- Seed test admin user and tenant for local development
-- Usage: make db-seed

-- Insert tenant
INSERT INTO tenants (id, name, slug, status, default_language, created_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Test Hotel',
    'test-hotel',
    'active',
    'en',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert tenant settings
INSERT INTO tenant_settings (tenant_id, greeting_message, escalation_email, escalation_phone, retention_days)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Welcome to Test Hotel! How can I help you today?',
    'support@testhotel.com',
    '+1-555-0100',
    90
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Insert admin user (password is "test", pre-hashed with bcrypt)
-- Note: This hash is for password "test" - change in production!
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'test@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYKf.9eTQeC',
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Link user to tenant as owner
INSERT INTO tenant_user_roles (tenant_id, user_id, role)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    'owner'
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Print result
\echo ''
\echo '✓ Test data seeded successfully!'
\echo ''
\echo 'Test Credentials:'
\echo '  Email:    test@test.com'
\echo '  Password: test'
\echo ''
\echo 'Tenant: Test Hotel (slug: test-hotel)'
\echo ''
