-- ============================================
-- ADD 20 POPULAR BOOKS
-- Run this in Supabase SQL Editor
-- ============================================

INSERT INTO books (title, author, isbn, language) VALUES
('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'English'),
('1984', 'George Orwell', '9780451524935', 'English'),
('Pride and Prejudice', 'Jane Austen', '9780141439518', 'English'),
('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'English'),
('One Hundred Years of Solitude', 'Gabriel García Márquez', '9780060883287', 'Spanish'),
('The Catcher in the Rye', 'J.D. Salinger', '9780316769488', 'English'),
('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', '9780590353427', 'English'),
('The Lord of the Rings', 'J.R.R. Tolkien', '9780618640157', 'English'),
('The Alchemist', 'Paulo Coelho', '9780062315007', 'Portuguese'),
('The Hobbit', 'J.R.R. Tolkien', '9780547928227', 'English'),
('Brave New World', 'Aldous Huxley', '9780060850524', 'English'),
('The Da Vinci Code', 'Dan Brown', '9780307474278', 'English'),
('The Kite Runner', 'Khaled Hosseini', '9781594631931', 'English'),
('A Tale of Two Cities', 'Charles Dickens', '9780141439600', 'English'),
('Animal Farm', 'George Orwell', '9780451526342', 'English'),
('The Little Prince', 'Antoine de Saint-Exupéry', '9780156012195', 'French'),
('Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', '9780062316097', 'English'),
('The Hunger Games', 'Suzanne Collins', '9780439023481', 'English'),
('Gone Girl', 'Gillian Flynn', '9780307588371', 'English'),
('Atomic Habits', 'James Clear', '9780735211292', 'English');

-- Create one copy for each book
INSERT INTO book_copies (book_id, copy_number, is_available)
SELECT id, 1, TRUE FROM books;

-- Verify
SELECT 'Added ' || COUNT(*) || ' books with copies!' as result FROM books;
