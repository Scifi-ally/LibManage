// Initialize Supabase client (for realtime only)
let supabaseClient = null;

function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase client initialized');
        } else {
            console.warn('Supabase library not loaded');
        }
    } catch(e) {
        console.error('Supabase init error:', e);
    }
}

let currentUser = null;
let jwtToken = null;
let userRole = null;

// Check for existing session on load
function checkSession() {
    const savedToken = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('user_email');
    const savedRole = localStorage.getItem('user_role');
    
    if (savedToken && savedUser) {
        jwtToken = savedToken;
        currentUser = { email: savedUser };
        userRole = savedRole || 'member';
        showDashboard();
    } else {
        showAuthPage();
    }
}

// Get auth headers for API calls
function getAuthHeaders() {
    if (!jwtToken) return { 'Content-Type': 'application/json' };
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
    };
}

// Check if user is admin
function isAdmin() {
    return userRole === 'admin';
}

// Show/hide auth pages with animation
function showLogin() {
    const loginCard = document.getElementById('loginCard');
    const registerCard = document.getElementById('registerCard');
    
    registerCard.classList.add('slide-out');
    setTimeout(() => {
        registerCard.classList.add('hidden');
        registerCard.classList.remove('slide-out');
        loginCard.classList.remove('hidden');
        loginCard.classList.add('slide-in');
        setTimeout(() => loginCard.classList.remove('slide-in'), 400);
    }, 300);
}

function showRegister() {
    const loginCard = document.getElementById('loginCard');
    const registerCard = document.getElementById('registerCard');
    
    loginCard.classList.add('slide-out');
    setTimeout(() => {
        loginCard.classList.add('hidden');
        loginCard.classList.remove('slide-out');
        registerCard.classList.remove('hidden');
        registerCard.classList.add('slide-in');
        setTimeout(() => registerCard.classList.remove('slide-in'), 400);
    }, 300);
}

// Login via backend API
async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        let errorMsg = 'Login failed';
        try {
            const error = await response.json();
            errorMsg = error.detail || errorMsg;
        } catch (e) {
            errorMsg = await response.text() || errorMsg;
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    jwtToken = data.access_token;
    userRole = data.role || 'member';
    currentUser = { email };
    
    localStorage.setItem('jwt_token', jwtToken);
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_role', userRole);
    
    return data;
}

// Register via backend API
async function register(email, password, fullName, phone) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone })
    });

    if (!response.ok) {
        let errorMsg = 'Registration failed';
        try {
            const error = await response.json();
            errorMsg = error.detail || errorMsg;
        } catch (e) {
            errorMsg = await response.text() || errorMsg;
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    jwtToken = data.access_token;
    userRole = 'member';
    currentUser = { email };
    
    localStorage.setItem('jwt_token', jwtToken);
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_role', 'member');
    
    return data;
}

// Logout
function logout() {
    currentUser = null;
    jwtToken = null;
    userRole = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    showAuthPage();
    if (supabaseClient) {
        try {
            supabaseClient.removeAllChannels();
        } catch (e) {
            console.warn('Error removing channels:', e);
        }
    }
}

// Show auth page
function showAuthPage() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
    document.getElementById('registerCard').classList.add('hidden');
    
    // Clear any error messages
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
}

// Show dashboard
function showDashboard() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser?.email || '--';
    
    const adminElements = document.querySelectorAll('.admin-only');
    const memberElements = document.querySelectorAll('.member-only');
    
    if (isAdmin()) {
        adminElements.forEach(el => { el.style.display = ''; el.classList.remove('hidden'); });
        memberElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
        document.getElementById('roleLabel').textContent = 'Admin';
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-overview').classList.add('active');
        
        // Set active nav item
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        document.querySelector('.nav-links li.admin-only')?.classList.add('active');
    } else {
        adminElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
        memberElements.forEach(el => { el.style.display = ''; el.classList.remove('hidden'); });
        document.getElementById('roleLabel').textContent = 'Member';
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-mybooks').classList.add('active');
        
        // Set active nav item
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        document.querySelector('.nav-links li.member-only')?.classList.add('active');
    }
    
    initDashboard();
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    
    try {
        await login(email, password);
        showDashboard();
    } catch (error) {
        errorEl.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// Register form handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value.trim();
    const errorEl = document.getElementById('registerError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    errorEl.textContent = '';
    
    if (!name) {
        errorEl.textContent = 'Please enter your name';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    
    try {
        await register(email, password, name, phone);
        showDashboard();
    } catch (error) {
        errorEl.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkSession();
});
