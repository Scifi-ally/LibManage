import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Debug: Print environment variables (remove in production)
print(f"DEBUG: SUPABASE_URL = {SUPABASE_URL}")
print(f"DEBUG: SUPABASE_ANON_KEY = {'***' if SUPABASE_ANON_KEY else None}")
print(f"DEBUG: SUPABASE_SERVICE_KEY = {'***' if SUPABASE_SERVICE_KEY else None}")
print(f"DEBUG: JWT_SECRET_KEY = {'***' if JWT_SECRET_KEY else None}")
