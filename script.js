// State Management
let tasks = [];
let currentTheme = localStorage.getItem('taskSphere_theme') || 'dark';
// Auto-detect API URL: same origin in production, localhost in development
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : '/api';

// Auth State
let token = localStorage.getItem('taskSphere_token') || null;
let currentUser = JSON.parse(localStorage.getItem('taskSphere_user')) || null;

// DOM Elements
const body = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const navItems = document.querySelectorAll('.nav-item');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-target]');
const viewSections = document.querySelectorAll('.view-section');

// Modal Elements
const authModal = document.getElementById('auth-modal');
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');

// Task Modal Elements
const openModalBtn = document.getElementById('open-task-modal');
const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');

// Initialize App
function initApp() {
    setTheme(currentTheme);
    updateDateDisplay();
    initSortable();

    // Auth Check
    if (!token) {
        authModal.classList.add('show');
    } else {
        authModal.classList.remove('show');
        updateUserUI();
        fetchTasks();
    }
}

// ------ AUTHENTICATION ------ //

function updateUserUI() {
    if (currentUser) {
        document.getElementById('display-username').textContent = currentUser.username;
        document.getElementById('display-email').textContent = currentUser.email;
        // Generate avatar with username
        const avatarImg = document.querySelector('.avatar');
        avatarImg.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=6366f1&color=fff`;
    }
}

async function handleAuthResponse(res, successMsg) {
    const data = await res.json();
    if (res.ok) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('taskSphere_token', token);
        localStorage.setItem('taskSphere_user', JSON.stringify(currentUser));

        authModal.classList.remove('show');
        updateUserUI();
        showToast(`${successMsg} Welcome, ${currentUser.username}!`, 'success');

        loginForm.reset();
        registerForm.reset();

        fetchTasks();
    } else {
        showToast(data.msg || data.error || 'Authentication failed', 'error');
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        await handleAuthResponse(res, 'Login successful!');
    } catch (err) {
        showToast('Server error. Ensure backend is running.', 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        await handleAuthResponse(res, 'Account created!');
    } catch (err) {
        showToast('Server error. Ensure backend is running.', 'error');
    }
});

logoutBtn.addEventListener('click', () => {
    token = null;
    currentUser = null;
    localStorage.removeItem('taskSphere_token');
    localStorage.removeItem('taskSphere_user');
    tasks = [];
    renderTasks();
    updateDashboardStats();
    authModal.classList.add('show');
    showToast('Logged out successfully', 'info');
});

showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerSection.style.display = 'none';
    loginSection.style.display = 'block';
});

// Helper for API calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (res.status === 401) {
        // Token expired or invalid
        logoutBtn.click();
        throw new Error('Unauthorized');
    }
    return res;
}

// ------ TASK MANAGEMENT ------ //

// ------ LOCAL STORAGE TASK HELPERS ------ //

function getTaskStorageKey() {
    // Store tasks per user so different accounts don't share tasks
    return currentUser ? `taskSphere_tasks_${currentUser.id}` : 'taskSphere_tasks_guest';
}

function loadTasksFromStorage() {
    const raw = localStorage.getItem(getTaskStorageKey());
    return raw ? JSON.parse(raw) : [];
}

function saveTasksToStorage(taskArray) {
    localStorage.setItem(getTaskStorageKey(), JSON.stringify(taskArray));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function fetchTasks() {
    tasks = loadTasksFromStorage();
    renderTasks();
    updateDashboardStats();
    initCharts();
    initCalendar();
}

// Theme Handling
function setTheme(theme) {
    body.setAttribute('data-theme', theme);
    localStorage.setItem('taskSphere_theme', theme);
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-moon';
    } else {
        icon.className = 'fas fa-sun';
    }
    updateChartsTheme();
}

themeToggleBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(currentTheme);
});

// Sidebar & Navigation
function isMobile() {
    return window.innerWidth <= 768;
}

// Open/close mobile sidebar drawer
function openMobileSidebar() {
    sidebar.classList.add('show');
    sidebarOverlay.classList.add('active');
    sidebarOverlay.style.display = 'block';
}
function closeMobileSidebar() {
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('active');
    setTimeout(() => sidebarOverlay.style.display = 'none', 300);
}

// Desktop toggle button — collapses/expands sidebar
toggleSidebarBtn.addEventListener('click', () => {
    if (isMobile()) {
        openMobileSidebar();
    } else {
        sidebar.classList.toggle('collapsed');
    }
});

// Mobile hamburger button (in top navbar)
mobileMenuBtn.addEventListener('click', openMobileSidebar);

// Overlay click closes sidebar
sidebarOverlay.addEventListener('click', closeMobileSidebar);

// Helper: switch view
function switchView(targetView) {
    navItems.forEach(n => n.classList.remove('active'));
    mobileNavItems.forEach(n => n.classList.remove('active'));
    viewSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetView) section.classList.add('active');
    });
    // Sync active state on sidebar nav
    navItems.forEach(n => {
        if (n.getAttribute('data-target') === targetView) n.classList.add('active');
    });
    // Sync active state on mobile bottom nav
    mobileNavItems.forEach(n => {
        if (n.getAttribute('data-target') === targetView) n.classList.add('active');
    });
    if (targetView === 'analytics-view') updateCharts();
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        switchView(item.getAttribute('data-target'));
        if (isMobile()) closeMobileSidebar();
    });
});

// Mobile bottom nav
mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
        switchView(item.getAttribute('data-target'));
    });
});

// Mobile add button
const mobileAddBtn = document.getElementById('mobile-add-btn');
if (mobileAddBtn) mobileAddBtn.addEventListener('click', () => openModal());

function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
}

// Modal Handling
function openModal(editTaskId = null) {
    if (editTaskId) {
        modalTitle.textContent = 'Edit Task';
        const task = tasks.find(t => t.id === editTaskId);
        if (task) {
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description;
            document.getElementById('task-date').value = task.dueDate;
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-category').value = task.category;
            document.getElementById('task-status').value = task.status;
        }
    } else {
        modalTitle.textContent = 'Create New Task';
        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-date').valueAsDate = new Date();
    }
    taskModal.classList.add('show');
}

function closeModal() {
    taskModal.classList.remove('show');
    taskForm.reset();
}

openModalBtn.addEventListener('click', () => openModal());
closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));

// Task CRUD
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('task-id').value;
    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        dueDate: document.getElementById('task-date').value,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value,
        status: document.getElementById('task-status').value
    };

    if (id) {
        // Edit existing task
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...taskData };
            showToast('Task updated successfully!', 'success');
        }
    } else {
        // Create new task
        const newTask = {
            id: generateId(),
            ...taskData,
            createdAt: new Date().toISOString()
        };
        tasks.unshift(newTask);
        showToast('Task created successfully!', 'success');
    }

    saveTasksToStorage(tasks);
    refreshUI();
    closeModal();
});

function refreshUI() {
    renderTasks();
    updateDashboardStats();
    if (windowChartConfigs) updateCharts();
    initCalendar();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasksToStorage(tasks);
    refreshUI();
    showToast('Task deleted!', 'error');
}

function toggleTaskStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        if (task.status === 'completed') {
            showToast('Task completed! 🎉', 'success');
        }
        saveTasksToStorage(tasks);
        refreshUI();
    }
}

// Render Engine
function createTaskHTML(task) {
    const isCompleted = task.status === 'completed';
    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
            <div class="task-left">
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" class="custom-checkbox" 
                           ${isCompleted ? 'checked' : ''} 
                           onchange="toggleTaskStatus('${task.id}')">
                </div>
                <div class="task-info">
                    <h4 class="task-title">${task.title}</h4>
                    <p class="task-desc">${task.description || 'No description'}</p>
                    <div class="task-meta">
                        <span class="task-tag tag-date">
                            <i class="far fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}
                        </span>
                        <span class="task-tag tag-${task.priority}">
                            <i class="fas fa-flag"></i> ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                        <span class="task-tag tag-category">
                            ${task.category}
                        </span>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button class="icon-btn" onclick="openModal('${task.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn" onclick="deleteTask('${task.id}')" title="Delete" style="color: var(--priority-high)">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

function renderTasks() {
    // Recent Tasks (Dashboard)
    const recentTasksList = document.getElementById('recent-task-list');
    const sortedTasks = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    recentTasksList.innerHTML = sortedTasks.slice(0, 5).map(createTaskHTML).join('') || '<p style="color:var(--text-secondary); padding: 20px;">No tasks found. Create one above!</p>';

    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    const statusFilter = document.getElementById('filter-status').value;
    const priorityFilter = document.getElementById('filter-priority').value;
    const sortType = document.getElementById('sort-tasks').value;
    const searchQuery = document.getElementById('global-search').value.toLowerCase();

    let filteredTasks = tasks.filter(task => {
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const descMatch = task.description ? task.description.toLowerCase().includes(searchQuery) : false;
        const matchesSearch = task.title.toLowerCase().includes(searchQuery) || descMatch;
        return matchesStatus && matchesPriority && matchesSearch;
    });

    filteredTasks.sort((a, b) => {
        if (sortType === 'due-date') return new Date(a.dueDate) - new Date(b.dueDate);
        if (sortType === 'priority') {
            const p = { high: 3, medium: 2, low: 1 };
            return p[b.priority] - p[a.priority];
        }
        return new Date(b.createdAt) - new Date(a.createdAt); // recent
    });

    const pendingContainer = document.querySelector('#task-list-pending .task-items-container');
    const completedContainer = document.querySelector('#task-list-completed .task-items-container');

    // Saftey check, wait for DOM
    if (!pendingContainer) return;

    const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
    const completedTasks = filteredTasks.filter(t => t.status === 'completed');

    pendingContainer.innerHTML = pendingTasks.map(createTaskHTML).join('');
    completedContainer.innerHTML = completedTasks.map(createTaskHTML).join('');

    // Update badges
    document.querySelector('#task-list-pending .column-badge').textContent = pendingTasks.length;
    document.querySelector('#task-list-completed .column-badge').textContent = completedTasks.length;
}

document.getElementById('filter-status').addEventListener('change', applyFiltersAndSort);
document.getElementById('filter-priority').addEventListener('change', applyFiltersAndSort);
document.getElementById('sort-tasks').addEventListener('change', applyFiltersAndSort);
document.getElementById('global-search').addEventListener('input', applyFiltersAndSort);

function updateDashboardStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    const highPriority = tasks.filter(t => t.priority === 'high' && t.status === 'pending').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-high').textContent = highPriority;

    const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.getElementById('daily-progress-text').textContent = `${progressPercent}%`;
    document.getElementById('daily-progress-fill').style.width = `${progressPercent}%`;
}

// Drag and Drop (SortableJS)
function initSortable() {
    const containers = document.querySelectorAll('.sortable-list');
    containers.forEach(container => {
        new Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'glass',
            onEnd: function (evt) {
                const itemEl = evt.item;
                const taskId = itemEl.getAttribute('data-id');
                const toColumn = evt.to.closest('.task-column').getAttribute('data-status');

                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== toColumn) {
                    task.status = toColumn;
                    if (toColumn === 'completed') showToast('Task updated to completed!', 'success');
                    saveTasksToStorage(tasks);
                    refreshUI();
                }
            }
        });
    });
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3300);
}

// Analytics Charts
let statusChart, categoryChart, prodChart;
let windowChartConfigs = false;

function getThemeColors() {
    const isDark = body.getAttribute('data-theme') === 'dark';
    return {
        text: isDark ? '#f8fafc' : '#0f172a',
        grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        primary: '#6366f1',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
    };
}

function initCharts() {
    const analyticsView = document.getElementById('analytics-view');
    if (!analyticsView) return;

    windowChartConfigs = true;
    updateCharts();
}

function updateCharts() {
    // Only update if elements exist (in case UI is redrawing)
    if (!document.getElementById('statusChart')) return;

    const colors = getThemeColors();
    Chart.defaults.color = colors.text;

    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.length - completed;

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending'],
            datasets: [{
                data: [completed, pending],
                backgroundColor: [colors.success, colors.warning],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    const categories = {};
    tasks.forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + 1;
    });

    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctxCategory, {
        type: 'bar',
        data: {
            labels: Object.keys(categories).map(c => c.charAt(0).toUpperCase() + c.slice(1)),
            datasets: [{
                label: 'Tasks',
                data: Object.values(categories),
                backgroundColor: colors.primary,
                borderRadius: 6
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: colors.grid }, beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const ctxProd = document.getElementById('productivityChart').getContext('2d');
    if (prodChart) prodChart.destroy();
    prodChart = new Chart(ctxProd, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Completed Tasks',
                data: [0, 2, 1, 3, 2, 4, completed > 0 ? completed : 0],
                borderColor: colors.success,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: colors.success
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: colors.grid }, beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateChartsTheme() {
    if (windowChartConfigs && document.getElementById('analytics-view').classList.contains('active')) {
        updateCharts();
    }
}

// Calendar View
let currentCalDate = new Date();

function initCalendar() {
    if (!document.getElementById('calendar-month-year')) return;

    renderCalendar();

    document.getElementById('prev-month').onclick = () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendar();
    };
    document.getElementById('next-month').onclick = () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendar();
    };
}

function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    document.getElementById('calendar-month-year').textContent =
        new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        daysContainer.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    const today = new Date();

    for (let i = 1; i <= daysInMonth; i++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.dueDate === dateString);

        let dotsHTML = '';
        dayTasks.forEach(t => {
            dotsHTML += `<div class="day-dot dot-${t.priority}"></div>`;
        });

        const isToday =
            i === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear() ? 'today' : '';

        daysContainer.innerHTML += `
            <div class="calendar-day ${isToday}" title="${dayTasks.length} tasks" onclick="filterByDate('${dateString}')">
                <span class="date-num">${i}</span>
                <div class="day-indicators">
                    ${dotsHTML}
                </div>
            </div>
        `;
    }
}

function filterByDate(dateStr) {
    document.querySelector('[data-target="tasks-view"]').click();
    document.getElementById('sort-tasks').value = 'due-date';
    showToast(`Viewing tasks around ${dateStr}`, 'info');
}

// Start App
document.addEventListener('DOMContentLoaded', initApp);
