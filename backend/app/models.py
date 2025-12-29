from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Auth Models
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str = ""
    phone: str = ""

class UserLogin(BaseModel):
    email: str
    password: str
    # role is not required for login, but can be included in the token

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

# Book Models
class BookResponse(BaseModel):
    id: str
    isbn: Optional[str] = None
    title: str
    author: str
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    language: Optional[str] = "English"
    pages: Optional[int] = None

class BookCopyResponse(BaseModel):
    id: str
    book_id: str
    copy_number: int
    condition: Optional[str] = "Good"
    is_available: bool = True
    issue_count: int = 0

# Member Models
class MemberResponse(BaseModel):
    id: str
    email: str
    full_name: str
    member_type: str
    phone: Optional[str] = None
    borrowing_limit: int = 5
    max_borrow_days: int = 14

# Transaction Models
class TransactionResponse(BaseModel):
    id: str
    book_copy_id: str
    member_id: str
    issue_date: datetime
    due_date: str
    return_date: Optional[datetime] = None
    fine_amount: float = 0

class IssueBookRequest(BaseModel):
    book_copy_id: str
    member_id: str

# Analytics Models
class LibraryPulseResponse(BaseModel):
    id: str
    snapshot_date: str
    total_books: int = 0
    total_copies: int = 0
    available_copies: int = 0
    issued_copies: int = 0
    overdue_count: int = 0
    active_members: int = 0

class SubjectResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
