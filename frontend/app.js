// Data stores
let booksData = [], membersData = [], transactionsData = [], availableBooksData = [];
let availabilityChart, popularBooksChart, trendChart;
let isRefreshing = false;
let refreshDebounceTimer = null;

// Page Navigation
function showPage(page, e) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    if (e && e.target) e.target.closest('li').classList.add('active');
    
    if (page === 'overview') refreshData();
    else if (page === 'books') loadBooksPage();
    else if (page === 'members') loadMembersPage();
    else if (page === 'transactions') loadTransactionsPage();
    else if (page === 'borrow') loadBorrowPage();
    else if (page === 'mybooks') loadMyBooksPage();
    else if (page === 'myhistory') loadMyHistoryPage();
}

// Modal functions
function openModal(type) { document.getElementById(`${type}Modal`).classList.remove('hidden'); }
function closeModal(type) { document.getElementById(`${type}Modal`).classList.add('hidden'); }

// Toast notification - fixed to show properly
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast';
    if (type) toast.classList.add(type);
    
    // Force reflow to restart animation
    toast.offsetHeight;
    
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// API calls - with cache busting and better error handling
async function fetchAPI(endpoint, options = {}) {
    try {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = options.method && options.method !== 'GET' 
            ? `${API_BASE_URL}${endpoint}`
            : `${API_BASE_URL}${endpoint}${separator}_t=${Date.now()}`;
        
        const response = await fetch(url, {
            ...options,
            headers: { 
                'Content-Type': 'application/json', 
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                ...getAuthHeaders(), 
                ...options.headers 
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', endpoint, response.status, errorText);
            throw new Error(errorText || `HTTP ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error('API Error:', endpoint, e);
        return null;
    }
}

// Initialize
async function initDashboard() {
    if (userRole === 'admin') {
        await refreshData();
    } else {
        await loadMyBooksPage();
    }
    setupRealtime();
}

// Debounced refresh to prevent rapid updates
function debouncedRefresh() {
    if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(() => {
        refreshData();
        // Refresh current page data
        const activePage = document.querySelector('.page.active');
        if (activePage) {
            const pageId = activePage.id.replace('page-', '');
            if (pageId === 'books') loadBooksPage();
            else if (pageId === 'members') loadMembersPage();
            else if (pageId === 'transactions') loadTransactionsPage();
            else if (pageId === 'borrow') loadBorrowPage();
        }
    }, 100);
}

function setupRealtime() {
    if (!supabaseClient) {
        console.warn('Supabase client not available for realtime');
        return;
    }
    
    const statusDot = document.getElementById('realtimeStatus');
    const statusText = document.getElementById('realtimeText');
    
    try {
        supabaseClient.channel('library-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'book_copies' }, debouncedRefresh)
            .subscribe(status => {
                console.log('Realtime status:', status);
                statusDot.className = status === 'SUBSCRIBED' ? 'status-dot connected' : 'status-dot';
                statusText.textContent = status === 'SUBSCRIBED' ? 'Live' : 'Connecting';
            });
    } catch (e) {
        console.error('Realtime setup error:', e);
        statusText.textContent = 'Offline';
    }
}

// Overview Page
async function updateKPIs() {
    const summary = await fetchAPI('/analytics/summary');
    if (!summary) return null;
    
    const p = summary.pulse || {};
    const available = p.available_copies || 0;
    const issued = p.issued_copies || 0;
    const overdue = p.overdue_count || 0;
    
    // Animate number updates
    animateValue('totalBooks', p.total_books || summary.total_books || 0);
    animateValue('totalCopies', p.total_copies || 0);
    animateValue('availableCopies', available);
    animateValue('issuedCopies', issued);
    animateValue('overdueCount', overdue);
    animateValue('activeMembers', p.active_members || summary.total_members || 0);
    
    const overdueCard = document.getElementById('overdueCard');
    if (overdue > 0) {
        overdueCard.classList.add('warning');
    } else {
        overdueCard.classList.remove('warning');
    }
    
    return { available, issued, overdue };
}

// Smooth number animation
function animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const current = parseInt(el.textContent) || 0;
    if (current === newValue) return;
    
    const duration = 300;
    const steps = 20;
    const increment = (newValue - current) / steps;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        if (step >= steps) {
            el.textContent = newValue;
            clearInterval(timer);
        } else {
            el.textContent = Math.round(current + increment * step);
        }
    }, duration / steps);
}

async function updateCharts() {
    const [summary, currentTxns] = await Promise.all([
        fetchAPI('/analytics/summary'), 
        fetchAPI('/transactions/current')
    ]);
    
    if (!summary) return;
    
    const p = summary.pulse || {};
    const available = p.available_copies || 0;
    const issued = p.issued_copies || 0;
    const overdue = p.overdue_count || 0;
    
    // 1. Availability Donut Chart
    if (availabilityChart) availabilityChart.destroy();
    const availCtx = document.getElementById('availabilityChart');
    if (availCtx) {
        availabilityChart = new Chart(availCtx, {
            type: 'doughnut',
            data: {
                labels: ['Available', 'Issued', 'Overdue'],
                datasets: [{
                    data: [available, Math.max(0, issued - overdue), overdue],
                    backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                animation: { duration: 500 },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } }
                }
            }
        });
    }
    
    // 2. Recent Transactions List
    const txns = currentTxns?.data || [];
    const recentList = document.getElementById('recentTxnList');
    if (recentList) {
        if (txns.length === 0) {
            recentList.innerHTML = '<p class="loading">No recent transactions</p>';
        } else {
            recentList.innerHTML = txns.slice(0, 8).map(t => {
                const isOverdue = t.status?.toLowerCase().includes('overdue');
                const isReturned = t.return_date;
                const iconClass = isOverdue ? 'overdue' : (isReturned ? 'return' : 'issue');
                const icon = isOverdue ? '⚠' : (isReturned ? '↩' : '📖');
                const timeAgo = t.issue_date ? formatTimeAgo(t.issue_date) : '';
                return `
                    <div class="txn-item">
                        <div class="txn-icon ${iconClass}">${icon}</div>
                        <div class="txn-details">
                            <div class="txn-title">${t.book_title || 'Unknown Book'}</div>
                            <div class="txn-meta">${t.member_name || 'Unknown'}</div>
                        </div>
                        <div class="txn-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        }
    }
    
    // 3. Popular Books
    const bookCounts = {};
    txns.forEach(t => {
        const title = t.book_title || 'Unknown';
        bookCounts[title] = (bookCounts[title] || 0) + 1;
    });
    const topBooks = Object.entries(bookCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (popularBooksChart) popularBooksChart.destroy();
    const popCtx = document.getElementById('popularBooksChart');
    if (popCtx && topBooks.length > 0) {
        popularBooksChart = new Chart(popCtx, {
            type: 'bar',
            data: {
                labels: topBooks.map(b => b[0].length > 20 ? b[0].substring(0, 20) + '...' : b[0]),
                datasets: [{
                    data: topBooks.map(b => b[1]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: { duration: 500 },
                plugins: { legend: { display: false } },
                scales: { 
                    x: { display: true, grid: { display: false } },
                    y: { display: true, grid: { display: false } }
                }
            }
        });
    }
    
    // 4. Borrowing Trend
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    const last7Days = [];
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
        const dayIndex = (today - i + 7) % 7;
        last7Days.push(days[dayIndex]);
        const count = txns.filter(t => {
            if (!t.issue_date) return false;
            const txnDate = new Date(t.issue_date);
            const diff = Math.floor((Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
            return diff === i;
        }).length;
        trendData.push(count);
    }
    
    if (trendChart) trendChart.destroy();
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    data: trendData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: true, grid: { display: false } },
                    y: { display: true, beginAtZero: true, grid: { color: '#f0f0f0' } }
                }
            }
        });
    }
}

function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

async function refreshData() {
    if (isRefreshing) return;
    isRefreshing = true;
    
    try {
        await Promise.all([updateKPIs(), updateCharts()]);
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
    } finally {
        isRefreshing = false;
    }
}

// Books Page
async function loadBooksPage() {
    const result = await fetchAPI('/books');
    booksData = result?.data || [];
    renderBooks(booksData);
}

function renderBooks(books) {
    const tbody = document.getElementById('booksListBody');
    if (!tbody) return;
    
    tbody.innerHTML = books.map(b => `
        <tr data-id="${b.id}">
            <td><strong>${escapeHtml(b.title || '-')}</strong></td>
            <td>${escapeHtml(b.author || '-')}</td>
            <td>${escapeHtml(b.subject_id || '-')}</td>
            <td>${escapeHtml(b.language || '-')}</td>
            <td>-</td>
            <td><button class="btn-xs" onclick="deleteBook('${b.id}')">Delete</button></td>
        </tr>
    `).join('') || '<tr><td colspan="6">No books found</td></tr>';
}

function filterBooks() {
    const q = document.getElementById('bookSearch').value.toLowerCase();
    const filtered = booksData.filter(b => 
        (b.title||'').toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q)
    );
    renderBooks(filtered);
}

async function addBook(e) {
    e.preventDefault();
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const isbn = document.getElementById('bookIsbn').value.trim();
    const language = document.getElementById('bookLanguage').value.trim() || 'English';
    
    if (!title || !author) {
        showToast('Title and Author are required', 'error');
        return;
    }
    
    showToast('Adding book...', '');
    const result = await fetchAPI('/books', {
        method: 'POST',
        body: JSON.stringify({ title, author, isbn, language })
    });
    
    if (result) {
        showToast('Book added successfully!', 'success');
        closeModal('addBook');
        document.getElementById('addBookForm').reset();
        await loadBooksPage();
        refreshData();
    } else {
        showToast('Failed to add book', 'error');
    }
}

async function deleteBook(id) {
    if (!id) {
        showToast('Invalid book ID', 'error');
        return;
    }
    if (!confirm('Delete this book?')) return;
    
    showToast('Deleting book...', '');
    try {
        const result = await fetchAPI(`/books/${id}`, { method: 'DELETE' });
        
        if (result && result.message) {
            showToast('Book deleted', 'success');
            await loadBooksPage();
            refreshData();
        } else {
            showToast('Failed to delete book', 'error');
        }
    } catch (e) {
        console.error('Delete book error:', e);
        showToast('Error deleting book', 'error');
    }
}

// Members Page
async function loadMembersPage() {
    const result = await fetchAPI('/members');
    membersData = result?.data || [];
    renderMembers(membersData);
}

function renderMembers(members) {
    const tbody = document.getElementById('membersListBody');
    if (!tbody) return;
    
    tbody.innerHTML = members.map(m => `
        <tr data-id="${m.id}">
            <td><strong>${escapeHtml(m.full_name || '-')}</strong></td>
            <td>${escapeHtml(m.email || '-')}</td>
            <td>${escapeHtml(m.member_type || '-')}</td>
            <td>${escapeHtml(m.phone || '-')}</td>
            <td>-</td>
            <td><button class="btn-xs" onclick="deleteMember('${m.id}')">Delete</button></td>
        </tr>
    `).join('') || '<tr><td colspan="6">No members found</td></tr>';
}

function filterMembers() {
    const q = document.getElementById('memberSearch').value.toLowerCase();
    const filtered = membersData.filter(m => 
        (m.full_name||'').toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q)
    );
    renderMembers(filtered);
}

async function addMember(e) {
    e.preventDefault();
    const full_name = document.getElementById('memberName').value.trim();
    const email = document.getElementById('memberEmail').value.trim();
    const phone = document.getElementById('memberPhone').value.trim();
    const member_type = document.getElementById('memberType').value;
    
    if (!full_name || !email) {
        showToast('Name and Email are required', 'error');
        return;
    }
    
    showToast('Adding member...', '');
    const result = await fetchAPI('/members', {
        method: 'POST',
        body: JSON.stringify({ full_name, email, phone, member_type })
    });
    
    if (result) {
        showToast('Member added successfully!', 'success');
        closeModal('addMember');
        document.getElementById('addMemberForm').reset();
        await loadMembersPage();
        refreshData();
    } else {
        showToast('Failed to add member', 'error');
    }
}

async function deleteMember(id) {
    if (!id) {
        showToast('Invalid member ID', 'error');
        return;
    }
    if (!confirm('Delete this member?')) return;
    
    showToast('Deleting member...', '');
    try {
        const result = await fetchAPI(`/members/${id}`, { method: 'DELETE' });
        
        if (result && result.message) {
            showToast('Member deleted', 'success');
            await loadMembersPage();
            refreshData();
        } else {
            showToast('Failed to delete member', 'error');
        }
    } catch (e) {
        console.error('Delete member error:', e);
        showToast('Error deleting member', 'error');
    }
}

// Transactions Page
async function loadTransactionsPage() {
    const result = await fetchAPI('/transactions/current');
    transactionsData = result?.data || [];
    renderTransactions(transactionsData);
}

function renderTransactions(txns) {
    const tbody = document.getElementById('transactionsListBody');
    if (!tbody) return;
    
    tbody.innerHTML = txns.map(t => {
        const status = t.status || 'Active';
        const statusClass = status.toLowerCase().includes('overdue') ? 'status-overdue' : 
                           status.toLowerCase().includes('return') ? 'status-returned' : 'status-active';
        return `
        <tr data-id="${t.transaction_id}">
            <td>${escapeHtml(t.book_title || '-')}</td>
            <td>${escapeHtml(t.member_name || '-')}</td>
            <td>${t.issue_date?.split('T')[0] || '-'}</td>
            <td>${t.due_date || '-'}</td>
            <td>${t.return_date?.split('T')[0] || '-'}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>${!t.return_date ? `<button class="btn-xs btn-primary" onclick="quickReturn('${t.transaction_id}')">Return</button>` : ''}</td>
        </tr>
    `}).join('') || '<tr><td colspan="7">No transactions found</td></tr>';
}

function filterTransactions() {
    const filter = document.getElementById('txnFilter').value;
    let filtered = transactionsData;
    if (filter === 'active') filtered = transactionsData.filter(t => !t.return_date && !t.status?.includes('Overdue'));
    else if (filter === 'overdue') filtered = transactionsData.filter(t => t.status?.includes('Overdue'));
    else if (filter === 'returned') filtered = transactionsData.filter(t => t.return_date);
    renderTransactions(filtered);
}

async function quickReturn(txnId) {
    showToast('Processing return...', '');
    const result = await fetchAPI(`/transactions/${txnId}/return`, { method: 'POST' });
    
    if (result) {
        showToast('Book returned successfully!', 'success');
        await Promise.all([loadTransactionsPage(), loadBorrowPage(), refreshData()]);
    } else {
        showToast('Failed to return book', 'error');
    }
}

// Borrow/Return Page - Redesigned
async function loadBorrowPage() {
    const [members, books, txns] = await Promise.all([
        fetchAPI('/members'),
        fetchAPI('/books/available'),
        fetchAPI('/transactions/current')
    ]);
    
    // Populate member dropdown
    const memberSelect = document.getElementById('borrowMember');
    if (memberSelect) {
        memberSelect.innerHTML = '<option value="">Select member...</option>' + 
            (members?.data || []).map(m => `<option value="${m.id}">${escapeHtml(m.full_name)} (${escapeHtml(m.email)})</option>`).join('');
    }
    
    // Populate available books dropdown
    const bookSelect = document.getElementById('borrowBook');
    availableBooksData = books?.data || [];
    if (bookSelect) {
        if (availableBooksData.length === 0) {
            bookSelect.innerHTML = '<option value="">No books available</option>';
        } else {
            bookSelect.innerHTML = '<option value="">Select book...</option>' + 
                availableBooksData.map(b => `<option value="${b.copy_id}">${escapeHtml(b.title)} by ${escapeHtml(b.author)}</option>`).join('');
        }
    }
    
    // Set due date placeholder
    const dueDate = document.getElementById('dueDate');
    if (dueDate) {
        const due = new Date();
        due.setDate(due.getDate() + 14);
        dueDate.value = due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    // Populate return dropdown with active transactions
    const activeTxns = (txns?.data || []).filter(t => !t.return_date);
    const returnSelect = document.getElementById('returnTransaction');
    if (returnSelect) {
        if (activeTxns.length === 0) {
            returnSelect.innerHTML = '<option value="">No active loans</option>';
        } else {
            returnSelect.innerHTML = '<option value="">Select loan to return...</option>' + 
                activeTxns.map(t => `<option value="${t.transaction_id}" data-book="${escapeHtml(t.book_title)}" data-member="${escapeHtml(t.member_name)}" data-due="${t.due_date}">${escapeHtml(t.book_title)} - ${escapeHtml(t.member_name)}</option>`).join('');
        }
        
        // Add change listener for return details
        returnSelect.onchange = function() {
            const selected = this.options[this.selectedIndex];
            const detailsDiv = document.getElementById('returnDetails');
            if (this.value && selected.dataset.book) {
                document.getElementById('returnBookTitle').textContent = selected.dataset.book;
                document.getElementById('returnMemberName').textContent = selected.dataset.member;
                document.getElementById('returnDueDate').textContent = selected.dataset.due;
                detailsDiv.classList.remove('hidden');
            } else {
                detailsDiv.classList.add('hidden');
            }
        };
    }
    
    // Render active loans list
    renderActiveLoans(activeTxns);
}

function renderActiveLoans(loans) {
    const container = document.getElementById('activeLoansContainer');
    const countEl = document.getElementById('activeLoanCount');
    
    if (!container) return;
    
    if (countEl) countEl.textContent = loans.length;
    
    if (loans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>No active loans</p>
            </div>
        `;
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    container.innerHTML = loans.map(t => {
        const isOverdue = t.due_date && t.due_date < today;
        const statusClass = isOverdue ? 'overdue' : 'active';
        const statusText = isOverdue ? 'Overdue' : 'Active';
        
        return `
            <div class="loan-item" data-id="${t.transaction_id}">
                <div class="loan-info">
                    <div class="loan-book">${escapeHtml(t.book_title || 'Unknown Book')}</div>
                    <div class="loan-member">${escapeHtml(t.member_name || 'Unknown Member')}</div>
                </div>
                <div class="loan-meta">
                    <div class="loan-date">Due: ${t.due_date || '-'}</div>
                    <span class="loan-status ${statusClass}">${statusText}</span>
                </div>
                <div class="loan-action">
                    <button class="btn-quick-return" onclick="quickReturn('${t.transaction_id}')">Return</button>
                </div>
            </div>
        `;
    }).join('');
}

async function issueBook(e) {
    e.preventDefault();
    const memberId = document.getElementById('borrowMember').value;
    const bookCopyId = document.getElementById('borrowBook').value;
    
    if (!memberId || !bookCopyId) {
        showToast('Please select member and book', 'error');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Issuing...';
    
    try {
        const result = await fetchAPI(`/transactions/issue?book_copy_id=${bookCopyId}&member_id=${memberId}`, { method: 'POST' });
        
        if (result && result.message) {
            showToast('Book issued successfully!', 'success');
            document.getElementById('borrowForm').reset();
            await Promise.all([loadBorrowPage(), loadTransactionsPage(), refreshData()]);
        } else {
            showToast('Failed to issue book', 'error');
        }
    } catch (err) {
        showToast('Error issuing book', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📤</span> Issue Book';
    }
}

async function returnBook(e) {
    e.preventDefault();
    const txnId = document.getElementById('returnTransaction').value;
    if (!txnId) {
        showToast('Please select a loan to return', 'error');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Processing...';
    
    try {
        await quickReturn(txnId);
        document.getElementById('returnForm').reset();
        document.getElementById('returnDetails').classList.add('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📥</span> Process Return';
    }
}

// ==================== MEMBER PAGES ====================
async function loadMyBooksPage() {
    const result = await fetchAPI('/my/books');
    const books = result?.data || [];
    const tbody = document.getElementById('myBooksBody');
    if (!tbody) return;
    
    tbody.innerHTML = books.map(t => {
        const status = t.status || 'Active';
        const statusClass = status.toLowerCase().includes('overdue') ? 'status-overdue' : 'status-active';
        return `
        <tr>
            <td><strong>${escapeHtml(t.book_title || '-')}</strong></td>
            <td>${t.issue_date?.split('T')[0] || '-'}</td>
            <td>${t.due_date || '-'}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>
    `}).join('') || '<tr><td colspan="4">No books currently borrowed</td></tr>';
}

async function loadMyHistoryPage() {
    const result = await fetchAPI('/my/history');
    const history = result?.data || [];
    const tbody = document.getElementById('myHistoryBody');
    if (!tbody) return;
    
    tbody.innerHTML = history.map(t => {
        const status = t.return_date ? 'Returned' : (t.status || 'Active');
        const statusClass = status.toLowerCase().includes('overdue') ? 'status-overdue' : 
                           status.toLowerCase().includes('return') ? 'status-returned' : 'status-active';
        return `
        <tr>
            <td><strong>${escapeHtml(t.book_title || '-')}</strong></td>
            <td>${t.issue_date?.split('T')[0] || '-'}</td>
            <td>${t.due_date || '-'}</td>
            <td>${t.return_date?.split('T')[0] || '-'}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>
    `}).join('') || '<tr><td colspan="5">No borrowing history</td></tr>';
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
