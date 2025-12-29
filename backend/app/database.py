import httpx
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY

# Debug: Check if config is loaded
print(f"DEBUG: database.py - SUPABASE_URL = {SUPABASE_URL}")
print(f"DEBUG: database.py - SUPABASE_ANON_KEY = {'***' if SUPABASE_ANON_KEY else None}")

class SupabaseClient:
    def __init__(self, url: str, key: str):
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    def table(self, name: str):
        return SupabaseTable(self.url, self.key, name)

class SupabaseTable:
    def __init__(self, url: str, key: str, table: str):
        self.base_url = f"{url}/rest/v1/{table}"
        self.key = key
        self.params = {}
        self._select_cols = "*"
    
    def _get_headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def _clone(self):
        """Create a copy to avoid param pollution"""
        new_table = SupabaseTable.__new__(SupabaseTable)
        new_table.base_url = self.base_url
        new_table.key = self.key
        new_table.params = self.params.copy()
        new_table._select_cols = self._select_cols
        return new_table
    
    def select(self, columns: str = "*", count: str = None):
        clone = self._clone()
        clone._select_cols = columns
        return clone
    
    def eq(self, column: str, value):
        clone = self._clone()
        clone.params[column] = f"eq.{value}"
        return clone
    
    async def delete(self):
        url = self.base_url
        if not self.params:
            print(f"DELETE ERROR: No filter params set for {url}")
            return SupabaseResponse([])
        
        for key, val in self.params.items():
            url += f"?{key}={val}" if "?" not in url else f"&{key}={val}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(url, headers=self._get_headers())
                print(f"DELETE {url}: status={response.status_code}, response={response.text[:200] if response.text else 'empty'}")
                result = []
                if response.status_code in [200, 204]:
                    try:
                        if response.text:
                            result = response.json()
                    except:
                        pass
                else:
                    print(f"DELETE error: {response.status_code} - {response.text}")
                return SupabaseResponse(result)
        except Exception as e:
            print(f"DELETE exception: {e}")
            return SupabaseResponse([])
    
    def order(self, column: str, desc: bool = False):
        clone = self._clone()
        clone.params["order"] = f"{column}.desc" if desc else column
        return clone
    
    def limit(self, count: int):
        clone = self._clone()
        clone.params["limit"] = str(count)
        return clone
    
    async def execute(self):
        url = f"{self.base_url}?select={self._select_cols}"
        for key, val in self.params.items():
            url += f"&{key}={val}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._get_headers())
                if response.status_code == 200:
                    data = response.json()
                else:
                    print(f"SELECT error: {response.status_code} - {response.text[:200] if response.text else 'empty'}")
                    data = []
                return SupabaseResponse(data)
        except Exception as e:
            print(f"SELECT exception: {e}")
            return SupabaseResponse([])
    
    async def insert(self, data: dict | list):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.base_url, headers=self._get_headers(), json=data)
                print(f"INSERT {self.base_url}: status={response.status_code}")
                result = []
                if response.status_code in [200, 201]:
                    try:
                        result = response.json()
                        if not isinstance(result, list):
                            result = [result] if result else []
                    except:
                        result = []
                else:
                    print(f"INSERT error: {response.text[:200] if response.text else 'empty'}")
                return SupabaseResponse(result)
        except Exception as e:
            print(f"INSERT exception: {e}")
            return SupabaseResponse([])
    
    async def update(self, data: dict):
        url = self.base_url
        for key, val in self.params.items():
            url += f"?{key}={val}" if "?" not in url else f"&{key}={val}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.patch(url, headers=self._get_headers(), json=data)
                print(f"UPDATE {url}: status={response.status_code}")
                result = []
                if response.status_code in [200, 201]:
                    try:
                        result = response.json()
                    except:
                        result = []
                else:
                    print(f"UPDATE error: {response.text[:200] if response.text else 'empty'}")
                return SupabaseResponse(result)
        except Exception as e:
            print(f"UPDATE exception: {e}")
            return SupabaseResponse([])

class SupabaseResponse:
    def __init__(self, data):
        self.data = data if isinstance(data, list) else [data] if data else []
        self.count = len(self.data)

supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
