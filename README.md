# 📚 Library Management System

A modern, full-stack library management application with real-time updates, JWT authentication, and role-based access control.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **JWT Authentication** | Secure token-based authentication with role management |
| 👥 **Role-Based Access** | Separate Admin and Member dashboards with appropriate permissions |
| 📊 **Real-Time Analytics** | Live metrics, charts, and transaction tracking |
| 📖 **Book Management** | Add, search, and manage books with copy tracking |
| 👤 **Member Management** | Register members, track borrowing history |
| 🔄 **Borrow/Return System** | Issue and return books with due date tracking |
| ⚡ **Live Updates** | Supabase real-time subscriptions for instant data sync |

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** — High-performance Python web framework
- **Supabase** — PostgreSQL database with real-time capabilities
- **JWT (PyJWT)** — Secure authentication tokens
- **Uvicorn** — ASGI server for production

### Frontend
- **Vanilla JavaScript** — No framework dependencies
- **Chart.js** — Interactive data visualizations
- **Supabase JS Client** — Real-time subscriptions
- **CSS3** — Modern, responsive styling

### Database
- **PostgreSQL** (via Supabase)
- Tables: `users`, `books`, `book_copies`, `members`, `transactions`, `subjects`
- Views: `available_books_view`, `current_transactions_view`

---

## 📁 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes and endpoints
│   │   ├── auth.py          # JWT authentication logic
│   │   ├── database.py      # Supabase client configuration
│   │   ├── models.py        # Pydantic data models
│   │   └── config.py        # Environment configuration
│   ├── requirements.txt     # Python dependencies
│   └── Procfile             # Deployment configuration
├── frontend/
│   ├── index.html           # Main dashboard UI
│   ├── app.js               # Dashboard logic and API calls
│   ├── auth.js              # Frontend authentication
│   ├── config.js            # API and Supabase configuration
│   └── styles.css           # Styling
├── db/
│   ├── setup_database.sql   # Database schema
│   ├── add_books.sql        # Sample data
│   └── fix_admin.sql        # Admin fixes
├── .env                     # Environment variables
└── README.md                # This file
```

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.11+
- Supabase account with project created
- Node.js (optional, for advanced frontend tooling)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd library-management-system
```

### 2. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
```

### 4. Update Frontend Config
Edit `frontend/config.js`:
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const API_BASE_URL = 'http://localhost:8000';  // Or your deployed URL
```
const API_BASE_URL = 'http://localhost:8000';
```

### 5. Start the Application

**Backend (serves both API and frontend):**
```bash
cd backend
python -m uvicorn app.main:app --port 8000 --reload
```

### 6. Access the Application
- **Full App:** http://localhost:8000 (backend serves frontend)
- **API Docs:** http://localhost:8000/docs
- **Default Admin:** `admin@library.com` / `admin123`

---

## 📡 API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new member account |
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/me` | Get current user info |

### Books (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/books` | List all books |
| `GET` | `/books/available` | List available book copies |
| `POST` | `/books` | Add new book |
| `DELETE` | `/books/{id}` | Delete a book |

### Members (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/members` | List all members |
| `POST` | `/members` | Add new member |
| `DELETE` | `/members/{id}` | Delete a member |

### Transactions (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/transactions` | List all transactions |
| `GET` | `/transactions/current` | List active transactions |
| `POST` | `/transactions/issue` | Issue book to member |
| `POST` | `/transactions/{id}/return` | Return a book |

### Member Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/my/books` | Get member's borrowed books |
| `GET` | `/my/history` | Get member's borrowing history |

### Analytics (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/summary` | Dashboard metrics and stats |
| `GET` | `/analytics/subjects` | Subject-wise performance |

---

## 🔑 Authentication Flow

```
┌─────────────┐     POST /auth/login      ┌─────────────┐
│   Client    │ ──────────────────────────▶│   Server    │
│             │                            │             │
│             │◀────────────────────────── │             │
└─────────────┘     { access_token }       └─────────────┘
       │                                          │
       │  Authorization: Bearer <token>           │
       │ ─────────────────────────────────────────▶
       │                                          │
       │◀───────────────────────────────────────── 
       │         Protected Resource               │
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Admin** | Full dashboard, Books, Members, Transactions, Borrow/Return, Analytics |
| **Member** | My Books, My History |

---

## 📊 Database Schema

```sql
-- Core Tables
users (id, email, password_hash, created_at)
books (id, title, author, isbn, language, subject_id)
book_copies (id, book_id, is_available)
members (id, full_name, email, phone, member_type, max_borrow_days)
transactions (id, book_copy_id, member_id, issue_date, due_date, return_date)
subjects (id, name)
```

---

## 🎨 UI Preview

The dashboard features a clean, minimal design with:
- White background with black typography
- Real-time status indicators
- Interactive charts (availability, trends, popular books)
- Responsive tables with search/filter
- Toast notifications for actions

---

## � Deployment

### Render (Recommended)
1. Push to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` and configure everything automatically
5. Deploy! (No manual env var setup needed)

### Railway
1. Push to GitHub
2. Connect to Railway
3. Set environment variables in Railway dashboard
4. Deploy automatically

---

## �📝 License

This project is for educational purposes.

---

<p align="center">
  Built with ❤️ using FastAPI + Supabase + Vanilla JS
</p>
