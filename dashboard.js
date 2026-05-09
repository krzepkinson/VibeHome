// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

// ZMIANA: Domyślna zakładka to teraz 'priority'
window.activeDashboardTab = 'priority'; 
window.dashboardCacheTime = 0;

window.switchDashboardTab = function(tab) {
    window.activeDashboardTab = tab;
    window.renderDashboardUI();
};

window.invalidateDashboardCache = function() { 
    window.dashboardCacheTime = 0; 
};

window.loadDashboardOverview = async function(forceRefresh = false) {
    const listEl = document.getElementById('dashboard-overview-list');
    if (!listEl) return;

    const now = Date.now();
    if (forceRefresh || (now - window.dashboardCacheTime > window.CONFIG.CACHE_TTL)) {
        listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Synchronizacja...</p>`;
        const hid = window.currentUser.household_id; 
        
        try {
            const [tasksRes, logsRes, hTasksRes, hLogsRes, todoRes, profilesRes, roomsRes] = await Promise.all([
                window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(200),
                window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false }).limit(200),
                window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false }).limit(100),
                window.supabaseClient.from('profiles').select('*').eq('household_id', hid),
                window.supabaseClient.from('rooms').select('*').eq('household_id', hid).order('name')
            ]);

            window.AppStore.set({
                tasks: tasksRes.data || [],
                logs: logsRes.data || [],
                hTasks: hTasksRes.data || [],
                hLogs: hLogsRes.data || [],
                todos: todoRes.data || [],
                profiles: profilesRes.data || [],
                rooms: roomsRes.data || []
            });
            
            window.dashboardCacheTime = now;
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            window.showToast("Błąd synchronizacji");
        }
    }
    window.renderDashboardUI();
};

window.renderDashboardUI = function() {
    const listEl = document.getElementById('dashboard-overview-list');
    const todayContainer = document.getElementById('today-plan-container');
    if (!listEl || !todayContainer) return;

    const state = window.AppStore.get();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // ZAKŁADKI STYLOWANIE
    const tabs = ['priority', 'todo', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        btn.className = t === window.activeDashboardTab 
            ? "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-[#333537] text-[#a8c7fa] shadow-sm transition-all"
            : "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl text-neutral-500 hover:text-neutral-300 transition-all";
    });

    // PLAN DNIA - POKAZYWANY TYLKO NA PRIORYTECIE LUB HISTORII
    if (window.activeDashboardTab === 'priority' || window.activeDashboardTab === 'history') {
        let todayHtml = '';
        
        const healthToday = state.hTasks.filter(ht => ht.event_date === todayStr);
        const homeToday = state.tasks.filter(t => {
            if (!t.interval_days) return false;
            const taskLogs = state.logs.filter(l => l.task_id === t.id);
            if (taskLogs.length === 0) return false;
            const lastLog = taskLogs[0];
            const nextDate = new Date(lastLog.created_at);
            nextDate.setDate(nextDate.getDate() + t.interval_days);
            return nextDate.toISOString().split('T')[0] === todayStr;
        });

        if (healthToday.length > 0 || homeToday.length > 0) {
            todayHtml = `
                <h3 class="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3 px-1">Plan na dziś</h3>
                <div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            `;
            
            todayHtml += healthToday.map(ht => `
                <div class="js-quick-log-health min-w-[140px] p-3 bg-[#004a77]/20 border border-[#004a77]/40 rounded-[20px] shadow-sm shrink-0 cursor-pointer active:scale-95 transition-transform" data-id="${ht.id}">
                    <div class="text-xl mb-1">📅</div>
                    <div class="text-[11px] font-bold text-[#c2e7ff] leading-tight mb-1 truncate">${window.esc(ht.name)}</div>
                    <div class="text-[9px] text-[#a8c7fa]/70 uppercase font-medium">Kliknij, by odhaczyć</div>
                </div>
            `).join('');

            todayHtml += homeToday.map(t => `
                <div class="js-dash-log-task min-w-[140px] p-3 bg-[#1e1f20] border border-[#333537] rounded-[20px] shadow-sm shrink-0 cursor-pointer active:scale-95 transition-transform" data-id="${t.id}">
                    <div class="text-xl mb-1">🏠</div>
                    <div class="text-[11px] font-bold text-neutral-200 leading-tight mb-1 truncate">${window.esc(t.name)}</div>
                    <div class="text-[9px] text-neutral-500 uppercase font-medium">Cykl wypada dziś</div>
                </div>
            `).join('');

            todayHtml += `</div>`;
            todayContainer.innerHTML = todayHtml;
            todayContainer.classList.remove('hidden');
        } else {
            todayContainer.classList.add('hidden');
        }
    } else {
        todayContainer.classList.add('hidden'); // Ukrywamy w 'todo'
    }

    // ==========================================
    // ZAKŁADKA: PRIORYTET (Zastępuje Dom i Zdrowie)
    // ==========================================
    if (window.activeDashboardTab === 'priority') {
        listEl.innerHTML = _renderPriorityTab(state, today, todayStr);
        return;
    }

    // ==========================================
    // ZAKŁADKA: ZADANIA (TO-DO)
    // ==========================================
    if (window.activeDashboardTab === 'todo') {
        const activeTodos = state.todos.filter(t => !t.is_completed);
        listEl.innerHTML = activeTodos.length 
            ? activeTodos.map(todo => window.UI.renderDashboardTodo(todo)).join('') 
            : window.UI.renderEmptyState("Wszystko zrobione!");
        return;
    }

    // ==========================================
    // ZAKŁADKA: HISTORIA
    // ==========================================
    if (window.activeDashboardTab === 'history') {
        listEl.innerHTML = _renderHistoryTab(state);
        return;
    }
};

// ==========================================
// PRYWATNA: RENDEROWANIE ZAKŁADKI PRIORYTET
// ==========================================
function _renderPriorityTab(state, today, todayStr) {
    let sections = [];

    // --- 1. ZALEGŁE ZDROWIE ---
    const overdueHealth = state.hTasks.filter(ht => window.isTaskOverdue(ht, state.hLogs));
    if (overdueHealth.length > 0) {
        const items = overdueHealth.map(ht => {
            const profile = state.profiles.find(p => p.id === ht.profile_id);
            return _renderPriorityItem({
                id: ht.id, title: ht.name, badge: profile ? profile.name : null,
                badgeColor: 'bg-rose-900/40 text-[#ffb4ab] border-rose-800/40',
                subtitle: _getHealthSubtitle(ht, state.hLogs, today), urgency: 'overdue',
                actionClass: 'js-quick-log-health', actionDataset: `data-id="${ht.id}"`, navView: 'health'
            });
        }).join('');
        sections.push(_renderSection('❤️ Zdrowie', items, 'text-[#ffb4ab]'));
    }

    // --- 2. ZALEGŁE ZADANIA DOMOWE ---
    const overdueHome = state.tasks.filter(t => window.isTaskOverdue(t, state.logs));
    if (overdueHome.length > 0) {
        const items = overdueHome.map(t => _renderPriorityItem({
            id: t.id, title: t.name, badge: t.room || null,
            badgeColor: 'bg-[#333537] text-neutral-400 border-[#444746]',
            subtitle: 'Czas na odświeżenie', urgency: 'overdue',
            actionClass: 'js-dash-log-task', actionDataset: `data-id="${t.id}"`, navView: 'home'
        })).join('');
        sections.push(_renderSection('🏠 Dom', items, 'text-[#c4eed0]'));
    }

    // --- 3. NADCHODZĄCE ZDROWIE (do 14 dni) ---
    const upcomingHealth = state.hTasks.filter(ht => {
        if (ht.task_type !== 'one_time' || !ht.event_date) return false;
        const isDone = state.hLogs.some(l => l.health_task_id === ht.id);
        if (isDone) return false;
        const evDate = new Date(ht.event_date); evDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((evDate - today) / 86400000);
        return daysUntil > 0 && daysUntil <= 14;
    }).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

    if (upcomingHealth.length > 0) {
        const items = upcomingHealth.map(ht => {
            const profile = state.profiles.find(p => p.id === ht.profile_id);
            const daysUntil = Math.ceil((new Date(ht.event_date) - today) / 86400000);
            const urgencyLabel = daysUntil === 1 ? 'Jutro!' : `Za ${daysUntil} dni`;
            const urgency = daysUntil <= 3 ? 'soon' : 'upcoming';
            return _renderPriorityItem({
                id: ht.id, title: ht.name, badge: profile ? profile.name : null,
                badgeColor: 'bg-[#004a77]/30 text-[#a8c7fa] border-[#004a77]/40',
                subtitle: `📅 ${new Date(ht.event_date).toLocaleDateString('pl-PL')} · ${urgencyLabel}`, urgency,
                actionClass: null, navView: 'health'
            });
        }).join('');
        sections.push(_renderSection('📅 Nadchodzące wizyty', items, 'text-[#a8c7fa]'));
    }

    // --- 4. NIEZAKOŃCZONE TODO (max 5) ---
    const activeTodos = state.todos.filter(t => !t.is_completed).slice(0, 5);
    if (activeTodos.length > 0) {
        const total = state.todos.filter(t => !t.is_completed).length;
        const moreLabel = total > 5 ? `<div class="text-[10px] text-neutral-500 text-center mt-3 cursor-pointer hover:text-[#a8c7fa]" onclick="window.switchDashboardTab('todo')">+${total - 5} więcej w zakładce Zadania</div>` : '';
        const items = activeTodos.map(todo => window.UI.renderDashboardTodo(todo)).join('') + moreLabel;
        sections.push(_renderSection('📝 Do zrobienia', items, 'text-neutral-400'));
    }

    if (sections.length === 0) return window.UI.renderEmptyState("Wszystko pod kontrolą! 🎉", "Brak zaległości");
    return sections.join('');
}

function _getHealthSubtitle(ht, hLogs, today) {
    if (ht.task_type === 'one_time') {
        if (!ht.event_date) return 'Brak daty';
        const evDate = new Date(ht.event_date); evDate.setHours(0, 0, 0, 0);
        const daysAgo = Math.floor((today - evDate) / 86400000);
        return daysAgo === 0 ? 'Dzisiaj!' : `Zaległe od ${daysAgo} dni`;
    }
    const taskLogs = hLogs.filter(l => l.health_task_id === ht.id);
    if (taskLogs.length === 0) return 'Nigdy nie wykonane';
    const lastDate = new Date(taskLogs[0].start_date); lastDate.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((today - lastDate) / 86400000);
    return `Ostatnio: ${daysAgo} dni temu`;
}

function _renderPriorityItem({ id, title, badge, badgeColor, subtitle, urgency, actionClass, actionDataset = '', navView }) {
    const borderColor = urgency === 'overdue' ? 'border-l-[#ffb4ab]' : urgency === 'soon' ? 'border-l-amber-500' : 'border-l-[#004a77]';
    const badgeHtml = badge ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md border ${badgeColor} font-medium shrink-0 ml-2">${window.esc(badge)}</span>` : '';
    const actionBtn = actionClass ? `<button class="${actionClass} w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" ${actionDataset}>✓</button>` : `<span class="w-8 h-8 flex items-center justify-center text-neutral-600 shrink-0">→</span>`;

    return `
    <div class="flex items-center justify-between px-3 py-2.5 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 ${borderColor} shadow-sm animate-fade-in">
        <div class="js-dash-nav flex-1 cursor-pointer pr-2 min-w-0" data-view="${navView}">
            <div class="flex items-center mb-0.5 flex-wrap">
                <h3 class="font-medium text-neutral-100 text-sm truncate max-w-[70%]">${window.esc(title)}</h3>
                ${badgeHtml}
            </div>
            <p class="text-[10px] text-neutral-500 mt-0.5">${subtitle}</p>
        </div>
        ${actionBtn}
    </div>`;
}

function _renderSection(title, itemsHtml, titleColor = 'text-neutral-400') {
    return `<div class="mb-5"><h3 class="text-[10px] font-bold ${titleColor} uppercase tracking-[0.15em] mb-2 px-1">${title}</h3>${itemsHtml}</div>`;
}

// ==========================================
// PRYWATNA: RENDEROWANIE ZAKŁADKI HISTORIA
// ==========================================
function _renderHistoryTab(state) {
    let historyItems = [];
    state.logs.forEach(l => { const t = state.tasks.find(x => x.id === l.task_id); if (!t || t.show_in_history !== false) historyItems.push({ table: 'activity_logs', id: l.id, title: l.activity_name, date: new Date(l.created_at), icon: '🏠', bg: 'bg-[#0f5223]/20', border: 'border-[#0f5223]/50', user: l.user_name || '?' }); });
    state.hLogs.forEach(l => { const ht = state.hTasks.find(x => x.id === l.health_task_id); if (!ht || ht.show_in_history !== false) { const profile = state.profiles.find(p => p.id === ht?.profile_id); const title = (ht ? ht.name : 'Zdarzenie') + (profile ? ` (${profile.name})` : ''); historyItems.push({ table: 'health_logs', id: l.id, title, date: l.end_date ? new Date(l.end_date) : new Date(l.start_date), icon: '❤️', bg: 'bg-[#8c1d18]/20', border: 'border-[#8c1d18]/50', user: l.user_name || '?' }); } });
    state.todos.filter(t => t.is_completed).forEach(t => { historyItems.push({ table: 'todos', id: t.id, title: t.title, date: t.completed_at ? new Date(t.completed_at) : new Date(t.created_at), icon: '📝', bg: 'bg-[#004a77]/20', border: 'border-[#004a77]/50', user: t.completer_name || '?' }); });
    
    historyItems.sort((a, b) => b.date - a.date);
    if (historyItems.length === 0) return window.UI.renderEmptyState("Brak historii");

    return `<div class="relative border-l-2 border-[#333537] ml-3 mt-2 mb-6 space-y-4">` + historyItems.slice(0, 30).map(item => {
        const initial = (item.user || '?')[0].toUpperCase();
        return `
        <div class="relative pl-5 animate-fade-in">
            <div class="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border flex items-center justify-center text-xs shadow-md">${item.icon}</div>
            <div class="bg-[#1e1f20] px-3 py-2 rounded-[12px] border border-[#333537] shadow-sm flex justify-between items-center">
                <div class="flex-1 min-w-0 pr-2">
                    <h4 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.title)}</h4>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${item.date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="js-dash-change-user w-6 h-6 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[10px] flex items-center justify-center font-bold shrink-0 cursor-pointer active:scale-90 transition-transform" data-table="${item.table}" data-id="${item.id}" data-username="${window.esc(item.user)}">${initial}</div>
            </div>
        </div>`;
    }).join('') + `</div>`;
}

// ==========================================
// SZYBKIE AKCJE
// ==========================================

window.quickLogTaskDashboard = async function(taskId) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const finalTaskId = isNaN(taskId) ? taskId : Number(taskId);
    const state = window.AppStore.get();
    const task = state.tasks.find(t => t.id == finalTaskId);
    const now = new Date();

    const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
        task_id: finalTaskId, activity_name: task ? task.name : 'Zadanie', created_at: now.toISOString(), 
        user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);

    if (error) { window.showToast("Błąd bazy: " + error.message); return; }

    if (task && task.interval_days > 0) {
        const nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + task.interval_days);
        await window.supabaseClient.from('tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalTaskId);
    } else if (task) {
        await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', finalTaskId);
    }
    window.showToast('Zapisano! ✔️'); window.invalidateDashboardCache(); window.loadDashboardOverview(true); 
};

window.quickCompleteTodoDashboard = async function(id) {
    const finalId = isNaN(id) ? id : Number(id);
    const { error } = await window.supabaseClient.from('todos').update({ is_completed: true, completed_at: new Date().toISOString(), completer_name: window.currentUser.name }).eq('id', finalId);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.invalidateDashboardCache(); window.loadDashboardOverview(true);
};

window.quickLogHealthDashboard = async function(taskId) {
    const finalId = isNaN(taskId) ? taskId : Number(taskId);
    const state = window.AppStore.get();
    const task = state.hTasks.find(t => t.id == finalId);
    const now = new Date();

    const { error } = await window.supabaseClient.from('health_logs').insert([{ 
        health_task_id: finalId, start_date: now.toISOString(), end_date: now.toISOString(), 
        user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);
    
    if (error) { window.showToast("Błąd: " + error.message); return; }

    if (task && task.interval_days > 0) {
        const nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + task.interval_days);
        await window.supabaseClient.from('health_tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalId);
    }
    window.showToast('Zapisano! ❤️'); window.invalidateDashboardCache(); window.loadDashboardOverview(true);
};

// --- DELEGACJA ZDARZEŃ ---
document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.js-dash-nav');
    if (navBtn) return window.switchView(navBtn.dataset.view);
    const todoBtn = e.target.closest('.js-dash-complete-todo');
    if (todoBtn) return window.quickCompleteTodoDashboard(todoBtn.dataset.id);
    const homeBtn = e.target.closest('.js-dash-log-task');
    if (homeBtn) return window.quickLogTaskDashboard(homeBtn.dataset.id);
    const healthBtn = e.target.closest('.js-quick-log-health');
    if (healthBtn) return window.quickLogHealthDashboard(healthBtn.dataset.id);
    const userBtn = e.target.closest('.js-dash-change-user');
    if (userBtn) window.openChangeUserModal(userBtn.dataset.table, userBtn.dataset.id, userBtn.dataset.username);
});
