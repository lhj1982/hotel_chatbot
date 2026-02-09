-- Sample knowledge base seed data
-- Add sample KB documents and chunks for testing

-- Note: Update tenant_id to match your tenant (default: 550e8400-e29b-41d4-a716-446655440000)

-- Insert sample KB document
INSERT INTO kb_documents (id, tenant_id, source_type, title, status, storage_url, created_at)
VALUES (
    '650e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'text',
    'Hotel Policies - Check-in & Check-out',
    'ready',
    NULL,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample chunks
INSERT INTO kb_chunks (id, tenant_id, document_id, chunk_text, chunk_hash, created_at)
VALUES
(
    '650e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440001',
    'Check-in time is 3:00 PM. Early check-in is available upon request and subject to availability. Please contact the front desk for early check-in arrangements.',
    'hash_checkin_001',
    NOW()
),
(
    '650e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440001',
    'Check-out time is 11:00 AM. Late check-out may be available for an additional fee. Please request at the front desk at least one day in advance.',
    'hash_checkout_001',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert another document
INSERT INTO kb_documents (id, tenant_id, source_type, title, status, created_at)
VALUES (
    '650e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440000',
    'text',
    'Amenities & Services',
    'ready',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_chunks (id, tenant_id, document_id, chunk_text, chunk_hash, created_at)
VALUES
(
    '650e8400-e29b-41d4-a716-446655440011',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440010',
    'We offer complimentary WiFi throughout the hotel. The network name is "TestHotel-Guest" and the password is provided at check-in.',
    'hash_wifi_001',
    NOW()
),
(
    '650e8400-e29b-41d4-a716-446655440012',
    '550e8400-e29b-41d4-a716-446655440000',
    '650e8400-e29b-41d4-a716-446655440010',
    'Our fitness center is open 24/7 for all guests. Located on the 2nd floor. Towels and water are provided.',
    'hash_fitness_001',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '✓ Sample KB data seeded successfully!'
\echo ''
\echo 'Documents created:'
\echo '  - Hotel Policies - Check-in & Check-out (2 chunks)'
\echo '  - Amenities & Services (2 chunks)'
\echo ''
