from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.models import UserCreate, UserLogin, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_admin
from app.database import supabase
import time

# Simple in-memory cache
cache = {}
CACHE_TTL = 300  # 5 minutes

def get_cached(key):
    if key in cache:
        data, timestamp = cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        else:
            del cache[key]
    return None

def set_cached(key, data):
    cache[key] = (data, time.time())

app = FastAPI(
    title="Library Management API",
    description="RESTful API for Library Management System with JWT authentication",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Serve static frontend files
app.mount("/static", StaticFiles(directory="../frontend"), name="frontend")

@app.get("/")
async def read_root():
    from fastapi.responses import FileResponse
    return FileResponse("../frontend/index.html")

# Create default admin on startup
@app.on_event("startup")
async def create_default_admin():
    admin_email = "admin@library.com"
    existing = await supabase.table("users").select("*").eq("email", admin_email).execute()
    if not existing.data:
        hashed = hash_password("admin123")
        await supabase.table("users").insert({"email": admin_email, "password_hash": hashed})
        print(f"Created default admin: {admin_email} / admin123")

# Helper to check if user is admin (hardcoded admin email for now)
ADMIN_EMAILS = ["admin@library.com"]

def is_admin_email(email: str) -> bool:
    return email in ADMIN_EMAILS

# ==================== AUTH ====================
@app.post("/auth/register", response_model=Token, tags=["Auth"])
async def register(user: UserCreate):
    """Register as a member (not admin) - also creates member record"""
    existing = await supabase.table("users").select("*").eq("email", user.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user account
    hashed = hash_password(user.password)
    result = await supabase.table("users").insert({"email": user.email, "password_hash": hashed})
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    # Also create member record so they appear in admin's member list
    member_name = user.full_name if user.full_name else user.email.split('@')[0]
    await supabase.table("members").insert({
        "email": user.email,
        "full_name": member_name,
        "phone": user.phone or "",
        "member_type": "Student"
    })
    
    token = create_access_token(data={"sub": user.email, "role": "member"})
    return {"access_token": token, "token_type": "bearer", "role": "member"}

@app.post("/auth/login", response_model=Token, tags=["Auth"])
async def login(user: UserLogin):
    result = await supabase.table("users").select("*").eq("email", user.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    db_user = result.data[0]
    if not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    role = "admin" if is_admin_email(user.email) else "member"
    token = create_access_token(data={"sub": user.email, "role": role})
    return {"access_token": token, "token_type": "bearer", "role": role}

@app.get("/auth/me", tags=["Auth"])
async def get_me(user=Depends(get_current_user)):
    return user

# ==================== ADMIN ONLY: BOOKS ====================
@app.get("/books", tags=["Books (Admin)"])
async def get_books(limit: int = 100, user=Depends(require_admin)):
    result = await supabase.table("books").select("*").limit(limit).execute()
    return {"data": result.data, "count": len(result.data)}

@app.get("/books/available", tags=["Books (Admin)"])
async def get_available_books(limit: int = 100, user=Depends(require_admin)):
    result = await supabase.table("available_books_view").select("*").limit(limit).execute()
    return {"data": result.data, "count": len(result.data)}

@app.post("/books", tags=["Books (Admin)"])
async def add_book(book: dict, user=Depends(require_admin)):
    try:
        subject_id = book.get("subject_id")
        if not subject_id:
            subjects = await supabase.table("subjects").select("id").limit(1).execute()
            subject_id = subjects.data[0]["id"] if subjects.data else None
        
        book_data = {
            "title": book.get("title"),
            "author": book.get("author"),
            "isbn": book.get("isbn"),
            "language": book.get("language", "English"),
        }
        if subject_id:
            book_data["subject_id"] = subject_id
            
        result = await supabase.table("books").insert(book_data)
        
        # Also create a book copy for the new book
        if result.data and len(result.data) > 0:
            book_id = result.data[0].get("id")
            if book_id:
                await supabase.table("book_copies").insert({
                    "book_id": book_id,
                    "copy_number": 1,
                    "condition": "Good",
                    "is_available": True
                })
        
        return {"message": "Book added successfully", "data": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/books/{book_id}", tags=["Books (Admin)"])
async def delete_book(book_id: str, user=Depends(require_admin)):
    result = await supabase.table("books").eq("id", book_id).delete()
    return {"message": "Book deleted successfully", "data": result.data}

# ==================== ADMIN ONLY: MEMBERS ====================
@app.get("/members", tags=["Members (Admin)"])
async def get_members(limit: int = 100, user=Depends(require_admin)):
    result = await supabase.table("members").select("*").limit(limit).execute()
    return {"data": result.data, "count": len(result.data)}

@app.post("/members", tags=["Members (Admin)"])
async def add_member(member: dict, user=Depends(require_admin)):
    result = await supabase.table("members").insert({
        "full_name": member.get("full_name"),
        "email": member.get("email"),
        "phone": member.get("phone"),
        "member_type": member.get("member_type", "Student")
    })
    return {"message": "Member added successfully", "data": result.data}

@app.delete("/members/{member_id}", tags=["Members (Admin)"])
async def delete_member(member_id: str, user=Depends(require_admin)):
    result = await supabase.table("members").eq("id", member_id).delete()
    return {"message": "Member deleted successfully", "data": result.data}

# ==================== ADMIN ONLY: TRANSACTIONS ====================
@app.get("/transactions", tags=["Transactions (Admin)"])
async def get_transactions(limit: int = 100, user=Depends(require_admin)):
    result = await supabase.table("transactions").select("*").limit(limit).execute()
    return {"data": result.data, "count": len(result.data)}

@app.get("/transactions/current", tags=["Transactions (Admin)"])
async def get_current_transactions(limit: int = 100, user=Depends(require_admin)):
    result = await supabase.table("current_transactions_view").select("*").limit(limit).execute()
    return {"data": result.data, "count": len(result.data)}

@app.post("/transactions/issue", tags=["Transactions (Admin)"])
async def issue_book(book_copy_id: str = Query(...), member_id: str = Query(...), user=Depends(require_admin)):
    from datetime import datetime, timedelta
    
    # Check if book copy is available
    copy_check = await supabase.table("book_copies").select("is_available").eq("id", book_copy_id).execute()
    if not copy_check.data or not copy_check.data[0].get("is_available", False):
        raise HTTPException(status_code=400, detail="Book copy is not available")
    
    member = await supabase.table("members").select("max_borrow_days").eq("id", member_id).execute()
    max_days = member.data[0]["max_borrow_days"] if member.data and member.data[0].get("max_borrow_days") else 14
    
    result = await supabase.table("transactions").insert({
        "book_copy_id": book_copy_id,
        "member_id": member_id,
        "issue_date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=max_days)).strftime("%Y-%m-%d")
    })
    
    await supabase.table("book_copies").eq("id", book_copy_id).update({"is_available": False})
    return {"message": "Book issued successfully", "data": result.data}

@app.post("/transactions/{transaction_id}/return", tags=["Transactions (Admin)"])
async def return_book(transaction_id: str, user=Depends(require_admin)):
    from datetime import datetime
    txn = await supabase.table("transactions").select("book_copy_id").eq("id", transaction_id).execute()
    await supabase.table("transactions").eq("id", transaction_id).update({"return_date": datetime.now().isoformat()})
    if txn.data:
        await supabase.table("book_copies").eq("id", txn.data[0]["book_copy_id"]).update({"is_available": True})
    return {"message": "Book returned successfully"}

# ==================== MEMBER: MY BOOKS ====================
@app.get("/my/books", tags=["Member Dashboard"])
async def get_my_borrowed_books(user=Depends(get_current_user)):
    """Get books currently borrowed by logged-in member"""
    # Find member by email
    member = await supabase.table("members").select("id").eq("email", user["email"]).execute()
    if not member.data:
        return {"data": [], "message": "No member profile found for " + user["email"]}
    
    member_id = member.data[0]["id"]
    
    # Get active transactions (no return_date) for this member
    txns = await supabase.table("transactions").select("*").eq("member_id", member_id).execute()
    active_txns = [t for t in txns.data if not t.get("return_date")]
    
    # Enrich with book info
    import asyncio
    async def enrich_txn(txn):
        book_copy = await supabase.table("book_copies").select("book_id").eq("id", txn["book_copy_id"]).execute()
        if book_copy.data:
            book = await supabase.table("books").select("title,author").eq("id", book_copy.data[0]["book_id"]).execute()
            if book.data:
                return {
                    "transaction_id": txn["id"],
                    "book_title": book.data[0]["title"],
                    "author": book.data[0]["author"],
                    "issue_date": txn["issue_date"],
                    "due_date": txn["due_date"],
                    "status": "Active"
                }
        return None
    
    tasks = [enrich_txn(txn) for txn in active_txns]
    results = await asyncio.gather(*tasks)
    result = [r for r in results if r]
    
    return {"data": result, "count": len(result)}

@app.get("/my/history", tags=["Member Dashboard"])
async def get_my_history(user=Depends(get_current_user)):
    """Get borrowing history for logged-in member"""
    member = await supabase.table("members").select("id").eq("email", user["email"]).execute()
    if not member.data:
        return {"data": [], "message": "No member profile found"}
    
    member_id = member.data[0]["id"]
    txns = await supabase.table("transactions").select("*").eq("member_id", member_id).execute()
    
    # Enrich with book info
    import asyncio
    async def enrich_txn_history(txn):
        book_copy = await supabase.table("book_copies").select("book_id").eq("id", txn["book_copy_id"]).execute()
        if book_copy.data:
            book = await supabase.table("books").select("title,author").eq("id", book_copy.data[0]["book_id"]).execute()
            if book.data:
                status = "Returned" if txn.get("return_date") else "Active"
                return {
                    "transaction_id": txn["id"],
                    "book_title": book.data[0]["title"],
                    "author": book.data[0]["author"],
                    "issue_date": txn["issue_date"],
                    "due_date": txn["due_date"],
                    "return_date": txn.get("return_date"),
                    "status": status
                }
        return None
    
    tasks = [enrich_txn_history(txn) for txn in txns.data]
    results = await asyncio.gather(*tasks)
    result = [r for r in results if r]
    
    return {"data": result, "count": len(result)}

# ==================== ANALYTICS (Admin) ====================
@app.get("/analytics/subjects", tags=["Analytics (Admin)"])
async def get_subject_performance(user=Depends(require_admin)):
    result = await supabase.table("subject_performance_view").select("*").execute()
    return {"data": result.data, "count": len(result.data)}

@app.get("/analytics/summary", tags=["Analytics (Admin)"])
async def get_analytics_summary(user=Depends(require_admin)):
    # Get real-time counts directly from tables
    books = await supabase.table("books").select("id,language").execute()
    members = await supabase.table("members").select("id,member_type").execute()
    book_copies = await supabase.table("book_copies").select("id,is_available").execute()
    transactions = await supabase.table("transactions").select("id,return_date,due_date").execute()
    
    # Debug logging
    print(f"[Analytics] Books: {len(books.data)}, Members: {len(members.data)}, Copies: {len(book_copies.data)}, Txns: {len(transactions.data)}")
    
    # Calculate real metrics
    total_books = len(books.data)
    total_members = len(members.data)
    total_copies = len(book_copies.data)
    available_copies = len([c for c in book_copies.data if c.get("is_available", True)])
    issued_copies = total_copies - available_copies
    
    # Count overdue (no return_date and due_date < today)
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    overdue_count = 0
    for t in transactions.data:
        if not t.get("return_date") and t.get("due_date"):
            if t["due_date"] < today:
                overdue_count += 1
    
    # Member type counts
    type_counts = {}
    for m in members.data:
        t = m.get("member_type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    
    # Language counts
    lang_counts = {}
    for b in books.data:
        l = b.get("language", "Unknown")
        lang_counts[l] = lang_counts.get(l, 0) + 1
    
    result = {
        "pulse": {
            "total_books": total_books,
            "total_copies": total_copies,
            "available_copies": available_copies,
            "issued_copies": issued_copies,
            "overdue_count": overdue_count,
            "active_members": total_members
        },
        "total_books": total_books,
        "total_members": total_members,
        "by_member_type": type_counts,
        "by_language": lang_counts
    }
    
    return result

@app.get("/subjects", tags=["Subjects"])
async def get_subjects():
    result = await supabase.table("subjects").select("*").execute()
    return {"data": result.data, "count": len(result.data)}

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Library Management API", "docs": "/docs"}

@app.get("/health", tags=["Root"])
async def health():
    return {"status": "healthy"}

@app.delete("/admin/clean-data", tags=["Admin"])
async def clean_data(user=Depends(require_admin)):
    """Clean all data except books - removes members, transactions, book_copies, users (except admin)"""
    try:
        import httpx
        from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        with httpx.Client(timeout=30.0) as client:
            # Delete all transactions
            client.delete(f"{SUPABASE_URL}/rest/v1/transactions?id=neq.00000000-0000-0000-0000-000000000000", headers=headers)
            
            # Delete all book_copies
            client.delete(f"{SUPABASE_URL}/rest/v1/book_copies?id=neq.00000000-0000-0000-0000-000000000000", headers=headers)
            
            # Delete all members
            client.delete(f"{SUPABASE_URL}/rest/v1/members?id=neq.00000000-0000-0000-0000-000000000000", headers=headers)
            
            # Delete non-admin users
            client.delete(f"{SUPABASE_URL}/rest/v1/users?email=neq.admin@library.com", headers=headers)
        
        return {"message": "Data cleaned successfully. Books preserved."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/init-book-copies", tags=["Admin"])
async def init_book_copies(user=Depends(require_admin)):
    """Create book copies for all books that don't have copies"""
    try:
        books = await supabase.table("books").select("id").execute()
        created = 0
        for book in books.data:
            existing = await supabase.table("book_copies").select("id").eq("book_id", book["id"]).execute()
            if not existing.data:
                await supabase.table("book_copies").insert({
                    "book_id": book["id"],
                    "copy_number": 1,
                    "condition": "Good",
                    "is_available": True
                })
                created += 1
        return {"message": f"Created {created} book copies", "total_books": len(books.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
