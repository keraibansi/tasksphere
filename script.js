/* ============================================================
   TASKSPHERE — script.js
   Full-featured: Auth, Onboarding, Tasks (CRUD), Kanban,
   Team Collaboration, Real-time sync sim, AI Suggestions,
   Analytics, Calendar, Pricing, Notifications, Dark/Light mode.
   ============================================================ */

'use strict';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let users = JSON.parse(localStorage.getItem('ts_users')) || defaultUsers();
let currentUser = JSON.parse(localStorage.getItem('ts_user')) || null;
let tasks = JSON.parse(localStorage.getItem('ts_tasks')) || [];
let members = JSON.parse(localStorage.getItem('ts_members')) || defaultMembers();
let notifications = JSON.parse(localStorage.getItem('ts_notifs')) || [];
let currentTheme = localStorage.getItem('ts_theme') || 'dark';
let chartsInited = false;
let statusChart, categoryChart, prodChart;
let currentCalDate = new Date();
let rtInterval, rtSyncInterval;

function defaultUsers() {
    return [{ id: '1', name: 'Alex Johnson', email: 'demo@tasksphere.io', password: 'demo1234', plan: 'Pro' }];
}

function defaultMembers() {
    return [
        { id: 'm1', name: 'Alex Johnson', email: 'alex@ts.io', role: 'Designer', avatar: 'https://ui-avatars.com/api/?name=Alex+Johnson&background=6366f1&color=fff', online: true, busy: false },
        { id: 'm2', name: 'Sam Rivera', email: 'sam@ts.io', role: 'Developer', avatar: 'https://ui-avatars.com/api/?name=Sam+Rivera&background=10b981&color=fff', online: true, busy: true },
        { id: 'm3', name: 'Jordan Lee', email: 'jordan@ts.io', role: 'Manager', avatar: 'https://ui-avatars.com/api/?name=Jordan+Lee&background=f59e0b&color=fff', online: false, busy: false },
        { id: 'm4', name: 'Taylor Kim', email: 'taylor@ts.io', role: 'Marketing', avatar: 'https://ui-avatars.com/api/?name=Taylor+Kim&background=8b5cf6&color=fff', online: true, busy: false },
    ];
}

// AI task suggestion pool
const AI_SUGGESTIONS = {
    'app': [
        { title: 'Create wireframes for key screens', desc: 'Design low-fidelity wireframes for onboarding, dashboard, and settings', priority: 'high', category: 'design' },
        { title: 'Set up CI/CD pipeline', desc: 'Configure GitHub Actions to auto-deploy to staging on push', priority: 'medium', category: 'development' },
        { title: 'Write API documentation', desc: 'Document all REST endpoints using Swagger / OpenAPI 3.0', priority: 'medium', category: 'development' },
        { title: 'Define user personas', desc: 'Research and create 3 target user personas for the product', priority: 'low', category: 'marketing' },
        { title: 'Run usability tests', desc: 'Conduct 5 user interviews and synthesise findings', priority: 'high', category: 'design' },
        { title: 'Set up error monitoring', desc: 'Integrate Sentry for real-time crash reporting', priority: 'medium', category: 'development' },
    ],
    'website': [
        { title: 'Design landing page hero section', desc: 'Create a visually striking hero with clear CTA and headline', priority: 'high', category: 'design' },
        { title: 'Implement SEO meta tags', desc: 'Add structured data, Open Graph, and canonical URLs', priority: 'medium', category: 'development' },
        { title: 'Set up Google Analytics 4', desc: 'Configure GA4 with conversion events and custom dimensions', priority: 'medium', category: 'marketing' },
        { title: 'Optimise Core Web Vitals', desc: 'Achieve 90+ Lighthouse score on LCP, FID, and CLS', priority: 'high', category: 'development' },
        { title: 'Create content calendar', desc: 'Plan 12 weeks of blog posts aligned to target keywords', priority: 'low', category: 'marketing' },
    ],
    'launch': [
        { title: 'Prepare launch press kit', desc: 'Create media kit with logos, screenshots, and founder bios', priority: 'high', category: 'marketing' },
        { title: 'Set up email drip campaign', desc: 'Configure 5-email welcome sequence for new sign-ups', priority: 'medium', category: 'marketing' },
        { title: 'Coordinate Product Hunt launch', desc: 'Schedule PH launch, gather hunter, and write tagline', priority: 'high', category: 'marketing' },
        { title: 'Post-launch monitoring dashboard', desc: 'Set up real-time dashboard tracking sign-ups and errors', priority: 'medium', category: 'development' },
        { title: 'Write launch announcement email', desc: 'Draft announcement to existing waitlist with launch offer', priority: 'high', category: 'marketing' },
    ],
    'default': [
        { title: 'Define project scope & goals', desc: 'Align team on objectives, success metrics and timeline', priority: 'high', category: 'personal' },
        { title: 'Set up project management board', desc: 'Create Kanban columns and invite team members', priority: 'medium', category: 'other' },
        { title: 'Schedule weekly stand-up meetings', desc: 'Recurring Mon/Wed/Fri 15-min sync at 9 AM', priority: 'low', category: 'personal' },
        { title: 'Document decisions and risks', desc: 'Maintain a running RAID log throughout the project', priority: 'medium', category: 'other' },
        { title: 'Create stakeholder update template', desc: 'Weekly 1-page status report for non-technical stakeholders', priority: 'low', category: 'other' },
    ]
};

const ACTIVITY_TEMPLATES = [
    (m) => `<strong>${m.name}</strong> completed a task`,
    (m) => `<strong>${m.name}</strong> added a new task`,
    (m) => `<strong>${m.name}</strong> moved a card to Review`,
    (m) => `<strong>${m.name}</strong> left a comment`,
    (m) => `<strong>${m.name}</strong> assigned a task to you`,
];

// ─────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────
let currentSlide = 0;

function initOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const sawOnboarding = localStorage.getItem('ts_onboarded');
    if (sawOnboarding) { overlay.remove(); showAuthOrApp(); return; }

    const slides = document.querySelectorAll('.onboarding-slide');
    const dots = document.querySelectorAll('.dot');
    const nextBtn = document.getElementById('ob-next');
    const skipBtn = document.getElementById('ob-skip');

    function goTo(idx) {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        slides[idx].classList.add('active');
        dots[idx].classList.add('active');
        currentSlide = idx;
        nextBtn.innerHTML = idx === slides.length - 1 ? 'Get Started <i class="fas fa-rocket"></i>' : 'Next <i class="fas fa-arrow-right"></i>';
    }

    nextBtn.addEventListener('click', () => {
        if (currentSlide < slides.length - 1) { goTo(currentSlide + 1); }
        else { finishOnboarding(); }
    });
    skipBtn.addEventListener('click', finishOnboarding);
    dots.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.index)));
}

function finishOnboarding() {
    localStorage.setItem('ts_onboarded', '1');
    const ov = document.getElementById('onboarding-overlay');
    ov.style.opacity = '0';
    ov.style.transition = 'opacity 0.5s';
    setTimeout(() => { ov.remove(); showAuthOrApp(); }, 500);
}

function showAuthOrApp() {
    if (currentUser) { bootApp(); }
    else { document.getElementById('auth-screen').classList.remove('hidden'); }
}

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
function initAuth() {
    // Panel toggle
    document.getElementById('go-register').addEventListener('click', (e) => { e.preventDefault(); switchAuthPanel('register'); });
    document.getElementById('go-login').addEventListener('click', (e) => { e.preventDefault(); switchAuthPanel('login'); });

    // Password toggles
    document.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const isText = input.type === 'text';
            input.type = isText ? 'password' : 'text';
            btn.querySelector('i').className = isText ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    });

    // Login
    document.getElementById('login-btn').addEventListener('click', () => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const user = users.find(u => u.email === email && u.password === pass);
        if (!user) { showToast('Invalid email or password', 'error'); return; }
        loginUser(user);
    });

    // Register
    document.getElementById('register-btn').addEventListener('click', () => {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        if (!name || !email || !pass) { showToast('Please fill all fields', 'error'); return; }
        if (pass.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
        if (users.find(u => u.email === email)) { showToast('Email already registered', 'error'); return; }
        const newUser = { id: Date.now().toString(), name, email, password: pass, plan: 'Free' };
        users.push(newUser);
        localStorage.setItem('ts_users', JSON.stringify(users));
        loginUser(newUser);
    });
}

function quickLogin(provider) {
    const user = { id: 'social-' + Date.now(), name: provider + ' User', email: provider.toLowerCase() + '@oauth.com', password: '', plan: 'Pro' };
    users = users.filter(u => !u.id.startsWith('social-'));
    users.push(user);
    localStorage.setItem('ts_users', JSON.stringify(users));
    loginUser(user);
}

function switchAuthPanel(which) {
    document.getElementById('login-panel').classList.toggle('active', which === 'login');
    document.getElementById('register-panel').classList.toggle('active', which === 'register');
}

function loginUser(user) {
    currentUser = user;
    localStorage.setItem('ts_user', JSON.stringify(user));
    document.getElementById('auth-screen').classList.add('hidden');
    bootApp();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('ts_user');
    clearInterval(rtInterval);
    clearInterval(rtSyncInterval);
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    switchAuthPanel('login');
}

// ─────────────────────────────────────────
// APP BOOT
// ─────────────────────────────────────────
function bootApp() {
    document.getElementById('app-shell').classList.remove('hidden');
    setTheme(currentTheme);
    updateSidebarUser();
    updateDateDisplay();
    buildAssigneeOptions();
    renderAll();
    initCalendar();
    initCharts();
    startRealtimeSync();
    initNotifications();
}

function updateSidebarUser() {
    if (!currentUser) return;
    document.getElementById('sidebar-username').textContent = currentUser.name;
    document.getElementById('sidebar-plan').textContent = (currentUser.plan || 'Free') + ' Plan';
    const av = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=6366f1&color=fff`;
    document.getElementById('sidebar-avatar').src = av;
    const greet = getGreeting();
    document.getElementById('welcome-message').textContent = `${greet}, ${currentUser.name.split(' ')[0]} 👋`;
    document.getElementById('welcome-sub').textContent = 'Here\'s what\'s happening across your workspace today.';
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function buildAssigneeOptions() {
    const sel = document.getElementById('task-assignee');
    const filterSel = document.getElementById('filter-assignee');
    sel.innerHTML = `<option value="me">${currentUser ? currentUser.name : 'Me'}</option>`;
    filterSel.innerHTML = '<option value="all">All Members</option>';
    members.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        filterSel.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}

function renderAll() {
    renderDashboard();
    renderTaskList();
    renderKanban();
    renderTeam();
    renderPricing();
}

// ─────────────────────────────────────────
// SIDEBAR & NAVIGATION
// ─────────────────────────────────────────
document.getElementById('toggle-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const target = item.dataset.target;
        document.querySelectorAll('.view-section').forEach(s => {
            s.classList.toggle('active', s.id === target);
        });
        if (target === 'analytics-view') updateCharts();
    });
});

document.getElementById('dash-view-all').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-target="tasks-view"]').click();
});

// ─────────────────────────────────────────
// THEME
// ─────────────────────────────────────────
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem('ts_theme', theme);
    const icon = document.querySelector('#theme-toggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (chartsInited && document.getElementById('analytics-view').classList.contains('active')) updateCharts();
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// ─────────────────────────────────────────
// DATE
// ─────────────────────────────────────────
function updateDateDisplay() {
    document.getElementById('current-date').textContent =
        new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────
// TASK MODAL
// ─────────────────────────────────────────
function openTaskModal(defaultStatus = null) {
    document.getElementById('modal-title').textContent = 'Create New Task';
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';
    document.getElementById('task-date').valueAsDate = new Date();
    if (defaultStatus) document.getElementById('task-status').value = defaultStatus;
    showModal('task-modal');
}

function openEditModal(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('task-id').value = t.id;
    document.getElementById('task-title').value = t.title;
    document.getElementById('task-desc').value = t.description || '';
    document.getElementById('task-date').value = t.dueDate;
    document.getElementById('task-priority').value = t.priority;
    document.getElementById('task-category').value = t.category;
    document.getElementById('task-status').value = t.status;
    document.getElementById('task-assignee').value = t.assigneeId || 'me';
    showModal('task-modal');
}

window.openTaskModal = openTaskModal;
window.openEditModal = openEditModal;

document.getElementById('open-task-modal').addEventListener('click', () => openTaskModal());

document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const assigneeId = document.getElementById('task-assignee').value;
    const assignee = assigneeId === 'me'
        ? { id: 'me', name: currentUser.name, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=6366f1&color=fff` }
        : members.find(m => m.id === assigneeId);

    const task = {
        id: id || Date.now().toString(),
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        dueDate: document.getElementById('task-date').value,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value,
        status: document.getElementById('task-status').value,
        assigneeId: assignee?.id || 'me',
        assigneeName: assignee?.name || currentUser.name,
        assigneeAvatar: assignee?.avatar || '',
        createdAt: id ? (tasks.find(t => t.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (id) {
        tasks = tasks.map(t => t.id === id ? task : t);
        showToast('Task updated!', 'success');
        addNotification(`Task "${task.title}" was updated.`);
    } else {
        tasks.push(task);
        showToast('Task created! ✨', 'success');
        addNotification(`New task added: "${task.title}"`);
    }

    saveTasks();
    closeAllModals();
});

// ─────────────────────────────────────────
// TASK CRUD
// ─────────────────────────────────────────
function deleteTask(id) {
    const t = tasks.find(t => t.id === id);
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    showToast('Task deleted', 'error');
    if (t) addNotification(`Task "${t.title}" was deleted.`);
}
window.deleteTask = deleteTask;

function toggleStatus(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    if (t.status === 'completed') { t.status = 'pending'; }
    else { t.status = 'completed'; showToast('Task completed! 🎉', 'success'); addNotification(`"${t.title}" marked complete.`); }
    saveTasks();
}
window.toggleStatus = toggleStatus;

function saveTasks() {
    localStorage.setItem('ts_tasks', JSON.stringify(tasks));
    renderAll();
    renderCalendar();
    if (chartsInited) updateCharts();
}

// ─────────────────────────────────────────
// TASK HTML BUILDERS
// ─────────────────────────────────────────
function statusLabel(s) {
    const map = { pending: 'To Do', inprogress: 'In Progress', review: 'Review', completed: 'Done' };
    return map[s] || s;
}

function createTaskItem(task, compact = false) {
    const done = task.status === 'completed';
    const dateStr = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `
    <div class="task-item ${done ? 'completed' : ''}" data-id="${task.id}">
      <div class="task-left">
        <input type="checkbox" class="custom-checkbox" ${done ? 'checked' : ''} onchange="toggleStatus('${task.id}')">
        <div class="task-info">
          <h4 class="task-title">${sanitize(task.title)}</h4>
          ${!compact && task.description ? `<p class="task-desc">${sanitize(task.description)}</p>` : ''}
          <div class="task-meta">
            ${dateStr ? `<span class="task-tag tag-date"><i class="far fa-calendar"></i> ${dateStr}</span>` : ''}
            <span class="task-tag tag-${task.priority}"><i class="fas fa-flag"></i> ${cap(task.priority)}</span>
            <span class="task-tag tag-category">${cap(task.category)}</span>
            <span class="task-tag tag-${task.status}">${statusLabel(task.status)}</span>
          </div>
        </div>
      </div>
      ${task.assigneeAvatar ? `<img class="task-assignee-avatar" src="${task.assigneeAvatar}" title="${task.assigneeName}" alt="${task.assigneeName}">` : ''}
      <div class="task-actions">
        <button class="icon-btn" onclick="openEditModal('${task.id}')" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="icon-btn" onclick="deleteTask('${task.id}')" title="Delete" style="color:var(--p-high)"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>`;
}

function createKanbanCard(task) {
    const dateStr = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `
    <div class="kanban-card ${task.priority}" data-id="${task.id}">
      <div class="kanban-card-title">${sanitize(task.title)}</div>
      ${task.description ? `<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;">${sanitize(task.description).substring(0, 80)}${task.description.length > 80 ? '…' : ''}</p>` : ''}
      <div class="task-meta">
        <span class="task-tag tag-${task.priority}"><i class="fas fa-flag"></i> ${cap(task.priority)}</span>
        <span class="task-tag tag-category">${cap(task.category)}</span>
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-date">${dateStr ? '<i class="far fa-calendar" style="margin-right:4px"></i>' + dateStr : ''}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="kanban-card-actions">
            <button class="icon-btn" style="font-size:0.9rem;padding:5px" onclick="openEditModal('${task.id}')" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="icon-btn" style="font-size:0.9rem;padding:5px;color:var(--p-high)" onclick="deleteTask('${task.id}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
          </div>
          ${task.assigneeAvatar ? `<img class="kc-assignee" src="${task.assigneeAvatar}" title="${task.assigneeName}" alt="">` : ''}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────
function renderDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const high = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
    const pct = total === 0 ? 0 : Math.round(completed / total * 100);

    setText('stat-total', total);
    setText('stat-completed', completed);
    setText('stat-pending', pending);
    setText('stat-high', high);
    setText('daily-progress-text', pct + '%');
    document.getElementById('daily-progress-fill').style.width = pct + '%';

    // Recent tasks (latest 5)
    const sorted = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const el = document.getElementById('recent-task-list');
    el.innerHTML = sorted.length ? sorted.map(t => createTaskItem(t, true)).join('') : '<p class="empty-state">No tasks yet. Click "New Task" to get started.</p>';

    // Activity feed
    renderActivityFeed();
}

function renderActivityFeed() {
    const feed = document.getElementById('activity-feed');
    const times = ['just now', '2m ago', '8m ago', '15m ago', '31m ago', '1h ago'];
    const items = members.slice(0, 5).map((m, i) => {
        const template = ACTIVITY_TEMPLATES[i % ACTIVITY_TEMPLATES.length];
        return `<div class="activity-item">
      <img class="activity-avatar" src="${m.avatar}" alt="${m.name}">
      <div>
        <div class="activity-text">${template(m)}</div>
        <div class="activity-time">${times[i] || '2h ago'}</div>
      </div>
    </div>`;
    });
    feed.innerHTML = items.join('') || '<p class="empty-state">No recent activity</p>';
}

// ─────────────────────────────────────────
// TASK LIST VIEW
// ─────────────────────────────────────────
document.getElementById('filter-status').addEventListener('change', renderTaskList);
document.getElementById('filter-priority').addEventListener('change', renderTaskList);
document.getElementById('filter-assignee').addEventListener('change', renderTaskList);
document.getElementById('sort-tasks').addEventListener('change', renderTaskList);
document.getElementById('global-search').addEventListener('input', () => { renderTaskList(); renderDashboard(); });

function renderTaskList() {
    const status = document.getElementById('filter-status').value;
    const priority = document.getElementById('filter-priority').value;
    const assignee = document.getElementById('filter-assignee').value;
    const sort = document.getElementById('sort-tasks').value;
    const query = document.getElementById('global-search').value.toLowerCase();

    let filtered = tasks.filter(t => {
        const okStatus = status === 'all' || t.status === status;
        const okPriority = priority === 'all' || t.priority === priority;
        const okAssignee = assignee === 'all' || t.assigneeId === assignee;
        const okSearch = !query || t.title.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query);
        return okStatus && okPriority && okAssignee && okSearch;
    });

    const priorityOrder = { high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => {
        if (sort === 'due-date') return new Date(a.dueDate) - new Date(b.dueDate);
        if (sort === 'priority') return priorityOrder[b.priority] - priorityOrder[a.priority];
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const el = document.getElementById('task-list-all');
    el.innerHTML = filtered.length ? filtered.map(t => createTaskItem(t)).join('') : '<p class="empty-state">No tasks match your filters.</p>';
}

// ─────────────────────────────────────────
// KANBAN BOARD
// ─────────────────────────────────────────
const KANBAN_COLS = ['pending', 'inprogress', 'review', 'completed'];

function renderKanban() {
    KANBAN_COLS.forEach(status => {
        const container = document.getElementById(`kanban-${status}`);
        const badge = document.getElementById(`k-badge-${status}`);
        const col = tasks.filter(t => t.status === status);
        container.innerHTML = col.length ? col.map(t => createKanbanCard(t)).join('') : '';
        badge.textContent = col.length;
    });
}

function initKanbanSortable() {
    KANBAN_COLS.forEach(status => {
        const el = document.getElementById(`kanban-${status}`);
        new Sortable(el, {
            group: 'kanban',
            animation: 180,
            ghostClass: 'sortable-ghost',
            onEnd(evt) {
                const taskId = evt.item.getAttribute('data-id');
                const toStatus = evt.to.closest('.kanban-col').getAttribute('data-status');
                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== toStatus) {
                    task.status = toStatus;
                    saveTasks();
                    if (toStatus === 'completed') { showToast('🎉 Task done!', 'success'); addNotification(`"${task.title}" moved to Done`); }
                    else showToast(`Moved to ${statusLabel(toStatus)}`, 'info');
                }
            }
        });
    });
}

// ─────────────────────────────────────────
// TEAM & COLLABORATION
// ─────────────────────────────────────────
document.getElementById('invite-btn').addEventListener('click', () => showModal('invite-modal'));

document.getElementById('add-member-btn').addEventListener('click', () => {
    const name = document.getElementById('inv-name').value.trim();
    const email = document.getElementById('inv-email').value.trim();
    const role = document.getElementById('inv-role').value;
    if (!name || !email) { showToast('Please fill all fields', 'error'); return; }

    const colors = ['6366f1', '10b981', 'f59e0b', '8b5cf6', 'ec4899', 'ef4444'];
    const color = colors[members.length % colors.length];
    const newMember = {
        id: 'm' + Date.now(), name, email, role,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`,
        online: false, busy: false
    };
    members.push(newMember);
    localStorage.setItem('ts_members', JSON.stringify(members));
    buildAssigneeOptions();
    renderTeam();
    closeAllModals();
    showToast(`Invitation sent to ${name}! 📧`, 'success');
    addNotification(`${name} was invited to the team.`);
});

function renderTeam() {
    // Members list
    const list = document.getElementById('members-list');
    list.innerHTML = members.map(m => {
        const memberTasks = tasks.filter(t => t.assigneeId === m.id).length;
        const statusClass = m.busy ? 'busy' : m.online ? '' : 'offline';
        const statusLabel = m.busy ? 'Busy' : m.online ? 'Online' : 'Offline';
        return `<div class="member-card">
      <div class="member-status-dot ${statusClass}" title="${statusLabel}"></div>
      <img class="member-avatar" src="${m.avatar}" alt="${m.name}">
      <div class="member-info">
        <div class="member-name">${sanitize(m.name)}</div>
        <div class="member-role">${m.role} · ${statusLabel}</div>
      </div>
      <span class="member-tasks-count">${memberTasks} tasks</span>
    </div>`;
    }).join('');

    // Team task list (tasks with assignee info)
    const taskList = document.getElementById('team-task-list');
    const teamTasks = tasks.filter(t => t.assigneeId && t.assigneeId !== 'me').slice(0, 10);
    taskList.innerHTML = teamTasks.length
        ? `<div class="task-list">${teamTasks.map(t => createTaskItem(t)).join('')}</div>`
        : '<p class="empty-state">No team-assigned tasks yet. Assign tasks to members when creating them.</p>';
}

// ─────────────────────────────────────────
// REAL-TIME SYNC SIMULATION
// ─────────────────────────────────────────
function startRealtimeSync() {
    const syncStatus = document.getElementById('sync-status');
    const syncLabel = document.querySelector('.sync-label');
    const rtLabel = document.getElementById('rt-label');
    const notifBadge = document.getElementById('notif-badge');

    // Simulate initial sync
    syncStatus.classList.add('syncing');
    if (syncLabel) syncLabel.textContent = 'Syncing...';
    setTimeout(() => {
        syncStatus.classList.remove('syncing');
        if (syncLabel) syncLabel.textContent = 'Live Sync';
    }, 2000);

    // Heartbeat every 8s – simulate remote changes
    rtInterval = setInterval(() => {
        flashSyncPulse();
        // Randomly add a team notification
        if (Math.random() < 0.4 && members.length > 0) {
            const m = members[Math.floor(Math.random() * members.length)];
            const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
            const msg = template(m).replace(/<[^>]+>/g, '');
            addNotification(msg, true);
        }
    }, 8000);

    // RT label animation
    rtSyncInterval = setInterval(() => {
        rtLabel.textContent = 'Live Sync';
        setTimeout(() => { rtLabel.textContent = 'All saved ✓'; }, 2000);
    }, 10000);
}

function flashSyncPulse() {
    const dot = document.querySelector('.sync-dot');
    if (!dot) return;
    dot.style.background = '#f59e0b';
    setTimeout(() => { dot.style.background = '#10b981'; }, 800);
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────
function initNotifications() {
    document.getElementById('notif-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('notif-dropdown').classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notif-wrapper')) {
            document.getElementById('notif-dropdown').classList.remove('show');
        }
    });
    renderNotifications();
}

function addNotification(msg, fromRT = false) {
    const notif = { id: Date.now().toString(), msg, time: new Date().toISOString(), read: false };
    notifications.unshift(notif);
    if (notifications.length > 20) notifications.pop();
    localStorage.setItem('ts_notifs', JSON.stringify(notifications));
    renderNotifications();
    if (fromRT) showToast(msg, 'info');
}

function clearNotifs() {
    notifications = [];
    localStorage.setItem('ts_notifs', JSON.stringify(notifications));
    renderNotifications();
}
window.clearNotifs = clearNotifs;

function renderNotifications() {
    const el = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    const unread = notifications.filter(n => !n.read).length;
    badge.textContent = unread || 0;
    badge.style.display = unread ? 'block' : 'none';

    if (!notifications.length) {
        el.innerHTML = '<div class="notif-empty">No notifications</div>';
        return;
    }
    el.innerHTML = notifications.slice(0, 10).map(n => `
    <div class="notif-item">
      <div class="notif-dot"></div>
      <div>
        <p>${sanitize(n.msg)}</p>
        <span>${timeAgo(new Date(n.time))}</span>
      </div>
    </div>`).join('');
}

function timeAgo(date) {
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

// ─────────────────────────────────────────
// AI TASK SUGGESTIONS
// ─────────────────────────────────────────
document.getElementById('ai-suggest-btn').addEventListener('click', () => showModal('ai-modal'));

document.getElementById('ai-generate-btn').addEventListener('click', () => {
    const prompt = document.getElementById('ai-prompt').value.trim();
    const loading = document.getElementById('ai-loading');
    const results = document.getElementById('ai-results');

    loading.classList.remove('hidden');
    results.innerHTML = '';

    // Simulate AI "thinking"
    setTimeout(() => {
        loading.classList.add('hidden');
        const key = Object.keys(AI_SUGGESTIONS).find(k => prompt.toLowerCase().includes(k)) || 'default';
        const suggestions = AI_SUGGESTIONS[key] || AI_SUGGESTIONS['default'];
        const shuffled = [...suggestions].sort(() => Math.random() - 0.5).slice(0, 4);

        results.innerHTML = shuffled.map((s, i) => `
      <div class="ai-suggestion-card" style="animation-delay:${i * 0.08}s">
        <div class="ai-suggestion-info">
          <h4>${sanitize(s.title)}</h4>
          <p>${sanitize(s.desc)}</p>
          <div class="ai-suggestion-meta">
            <span class="task-tag tag-${s.priority}"><i class="fas fa-flag"></i> ${cap(s.priority)}</span>
            <span class="task-tag tag-category">${cap(s.category)}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-left:12px;flex-shrink:0" onclick="addAISuggestion(${i}, ${JSON.stringify(shuffled).replace(/"/g, '&quot;')})">
          <i class="fas fa-plus"></i> Add
        </button>
      </div>`).join('');
        if (!prompt) showToast('Enter a project goal for smarter suggestions!', 'warning');
    }, 1800);
});

window.addAISuggestion = function (idx, suggestions) {
    if (typeof suggestions === 'string') suggestions = JSON.parse(suggestions.replace(/&quot;/g, '"'));
    const s = suggestions[idx];
    const today = new Date(); today.setDate(today.getDate() + 7);
    const task = {
        id: Date.now().toString(),
        title: s.title, description: s.desc,
        dueDate: today.toISOString().split('T')[0],
        priority: s.priority, category: s.category,
        status: 'pending', assigneeId: 'me',
        assigneeName: currentUser?.name || 'Me',
        assigneeAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'Me')}&background=6366f1&color=fff`,
        createdAt: new Date().toISOString()
    };
    tasks.push(task);
    saveTasks();
    showToast('AI task added to your board! 🤖', 'success');
    addNotification(`AI suggested task added: "${task.title}"`);
};

// ─────────────────────────────────────────
// ANALYTICS CHARTS
// ─────────────────────────────────────────
function getColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        text: dark ? '#f1f5f9' : '#0f172a',
        grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        accent: '#6366f1', success: '#10b981', warning: '#f59e0b', danger: '#ef4444',
        purple: '#8b5cf6', pink: '#ec4899'
    };
}

function initCharts() { chartsInited = true; updateCharts(); }

function updateCharts() {
    const c = getColors();
    Chart.defaults.color = c.text;
    Chart.defaults.font.family = "'Inter', sans-serif";

    const done = tasks.filter(t => t.status === 'completed').length;
    const prog = tasks.filter(t => t.status === 'inprogress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    // STATUS DOUGHNUT
    const sCTX = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(sCTX, {
        type: 'doughnut',
        data: {
            labels: ['Done', 'In Progress', 'Review', 'To Do'],
            datasets: [{ data: [done, prog, review, pending], backgroundColor: [c.success, c.warning, c.purple, c.accent], borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });

    // CATEGORY BAR
    const cats = {};
    tasks.forEach(t => { cats[t.category] = (cats[t.category] || 0) + 1; });
    const cCTX = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(cCTX, {
        type: 'bar',
        data: {
            labels: Object.keys(cats).map(cap),
            datasets: [{ label: 'Tasks', data: Object.values(cats), backgroundColor: [c.accent, c.success, c.warning, c.purple, c.pink], borderRadius: 6 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: c.grid }, beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
    });

    // PRODUCTIVITY LINE
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const seed = [1, 2, 3, 2, 4, 3, done > 0 ? done : 2];
    const pCTX = document.getElementById('productivityChart').getContext('2d');
    if (prodChart) prodChart.destroy();
    prodChart = new Chart(pCTX, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                { label: 'Completed', data: seed, borderColor: c.success, backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.5, fill: true, borderWidth: 2.5, pointBackgroundColor: c.success },
                { label: 'Added', data: seed.map(v => Math.max(1, v + Math.floor(Math.random() * 2 - 1))), borderColor: c.accent, backgroundColor: 'rgba(99,102,241,0.06)', tension: 0.5, fill: true, borderWidth: 2.5, pointBackgroundColor: c.accent }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: c.grid }, beginAtZero: true }, x: { grid: { display: false } } }
        }
    });
}

// ─────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────
function initCalendar() {
    renderCalendar();
    document.getElementById('prev-month').onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendar(); };
    document.getElementById('next-month').onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendar(); };
}

function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('calendar-month-year').textContent =
        new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const days = document.getElementById('calendar-days');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMo = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMo; d++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.dueDate === ds);
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dots = dayTasks.map(t => `<div class="day-dot dot-${t.priority}"></div>`).join('');
        html += `<div class="calendar-day${isToday ? ' today' : ''}" onclick="jumpToDate('${ds}')" title="${dayTasks.length} task(s)">
      <span class="date-num">${d}</span>
      <div class="day-indicators">${dots}</div>
    </div>`;
    }
    days.innerHTML = html;
}

window.jumpToDate = function (ds) {
    document.querySelector('[data-target="tasks-view"]').click();
    showToast(`Showing tasks for ${ds}`, 'info');
};

// ─────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────
function renderPricing() { }

document.getElementById('billing-toggle').addEventListener('change', function () {
    const annual = this.checked;
    document.querySelectorAll('.price-amount').forEach(el => {
        const mo = el.dataset.monthly;
        const an = el.dataset.annual;
        el.textContent = `$${annual ? an : mo}`;
    });
});

window.selectPlan = function (plan) {
    const labels = { free: "You're on the Free plan", pro: 'Upgraded to Pro! 🚀', enterprise: "We'll be in touch shortly!" };
    showToast(labels[plan], 'success');
    if (plan !== 'free' && currentUser) {
        currentUser.plan = plan === 'pro' ? 'Pro' : 'Enterprise';
        localStorage.setItem('ts_user', JSON.stringify(currentUser));
        updateSidebarUser();
    }
};

// ─────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.add('show'); }

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) { document.getElementById(modalId).classList.remove('show'); }
        else { closeAllModals(); }
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
});

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${sanitize(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 3100);
}

// ─────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function sanitize(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setTheme(currentTheme);
    initOnboarding();
    initAuth();
    initKanbanSortable();
});
