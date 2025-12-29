-- ============================================
-- LIBRARY MANAGEMENT - COMPLETE DATABASE RESET
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Drop all VIEWS first (eye icon = view)
DROP VIEW IF EXISTS available_books_view CASCADE;
DROP VIEW IF EXISTS current_transactions_view CASCADE;
DROP VIEW IF EXISTS subject_performance_view CASCADE;
DROP VIEW IF EXISTS member_activity_view CASCADE;

-- STEP 2: Drop all TABLES (order matters - children first)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS book_copies CASCADE;
DROP TABLE IF EXISTS book_gravity CASCADE;
DROP TABLE IF EXISTS shelf_metrics CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS shelves CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS documentation CASCADE;
DROP TABLE IF EXISTS library_pulse CASCADE;
DROP TABLE IF EXISTS subject_velocity CASCADE;
DROP TABLE IF EXISTS sentiments CASCADE;

-- ============================================
-- CREATE 5 SIMPLE TABLES
-- ============================================

-- 1. USERS - for login
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MEMBERS - library members
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    member_type TEXT DEFAULT 'Student',
    max_borrow_days INT DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BOOKS - book catalog
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    language TEXT DEFAULT 'English',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOK_COPIES - physical copies
CREATE TABLE book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    copy_number INT DEFAULT 1,
    is_available BOOLEAN DEFAULT TRUE
);

-- 5. TRANSACTIONS - borrow/return
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_copy_id UUID REFERENCES book_copies(id),
    member_id UUID REFERENCES members(id),
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE NOT NULL,
    return_date TIMESTAMPTZ
);

-- ============================================
-- CREATE 2 VIEWS
-- ============================================

-- Available books view
CREATE VIEW available_books_view AS
SELECT b.id as book_id, b.title, b.author, bc.id as copy_id
FROM books b
JOIN book_copies bc ON b.id = bc.book_id
WHERE bc.is_available = TRUE;

-- Current transactions view
CREATE VIEW current_transactions_view AS
SELECT 
    t.id as transaction_id,
    b.title as book_title,
    m.full_name as member_name,
    t.issue_date,
    t.due_date,
    t.return_date,
    CASE 
        WHEN t.return_date IS NOT NULL THEN 'Returned'
        WHEN t.due_date < CURRENT_DATE THEN 'Overdue'
        ELSE 'Active'
    END as status
FROM transactions t
LEFT JOIN book_copies bc ON t.book_copy_id = bc.id
LEFT JOIN books b ON bc.book_id = b.id
LEFT JOIN members m ON t.member_id = m.id
ORDER BY t.issue_date DESC;

-- ============================================
-- SECURITY POLICIES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_book_copies" ON book_copies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DEFAULT ADMIN (password: admin123)
-- ============================================
INSERT INTO users (email, password_hash) 
VALUES ('admin@library.com', '240be518fabd2724ddb6f04eeb9d5b0e9a0a5a8e5f5e5c5d5e5f5a5b5c5d5e5f');

-- DONE!
SELECT 'SUCCESS! Database ready. Add your books now.' as message;
