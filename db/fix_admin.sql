-- Fix admin password hash
-- Run this in Supabase SQL Editor

-- Delete existing admin user
DELETE FROM users WHERE email = 'admin@library.com';

-- Insert with correct password hash (admin123)
INSERT INTO users (email, password_hash) 
VALUES ('admin@library.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');

-- Verify
SELECT email, 'Password: admin123' as info FROM users WHERE email = 'admin@library.com';
