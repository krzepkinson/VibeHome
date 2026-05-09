// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.activeDashboardTab = 'todo'; 
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
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; 
    
    // --- NOWA LOGIKA: PLAN DNIA ---
    let todayHtml = '';
    
    // 1. Wizyty i zdarzenia zdrowotne na dziś
    const healthToday = state.hTasks.filter(ht => ht.event_date === todayStr);
    
    // 2. Zadania domowe na dziś
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

    const tabs = ['todo', 'home', 'health', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        btn.className = t === window.activeDashboardTab 
            ? "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-[#333537] text-[#a8c7fa] shadow-sm transition-all"
            : "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl text-neutral-500 transition-all";
    });

    let html = '';
    if (window.activeDashboardTab === 'todo') {
        const activeTodos = state.todos.filter(t => !t.is_completed);
        html = activeTodos.length ? activeTodos.map(todo => window.UI.renderDashboardTodo(todo)).join('') : window.UI.renderEmptyState("Zadania załatwione!");
    } else if (window.activeDashboardTab === 'home') {
        const overdueHome = state.tasks.filter(t => window.isTaskOverdue(t, state.logs));
        html = overdueHome.length ? overdueHome.map(t => window.UI.renderDashboardHomeTask(t)).join('') : window.UI.renderEmptyState("Dom lśni!");
    } else if (window.activeDashboardTab === 'health') {
        const dueHealth = state.hTasks.filter(ht => window.isTaskOverdue(ht, state.hLogs));
        html = dueHealth.length ? dueHealth.map(ht => window.UI.renderDashboardHealthTask(ht)).join('') : window.UI.renderEmptyState("Wszyscy zdrowi!");
    } else if (window.activeDashboardTab === 'history') {
        let historyItems = [];
        state.logs.forEach(l => {
            const t = state.tasks.find(x => x.id === l.task_id);
            if (!t || t.show_in_history !== false) {
                historyItems.push({ table: 'activity_logs', id: l.id, title: l.activity_name, date: new Date(l.created_at), icon: '🏠', bg: 'bg-[#0f5223]/20', border: 'border-[#0f5223]/50', user: l.user_name || '?' });
            }
        });
        state.hLogs.forEach(l => {
            const ht = state.hTasks.find(x => x.id === l.health_task_id);
            if (!ht || ht.show_in_history !== false) {
                const profile = state.profiles.find(p => p.id === ht?.profile_id);
                const title = (ht ? ht.name : 'Zdarzenie') + (profile ? ` (${profile.name})` : '');
                historyItems.push({ table: 'health_logs', id: l.id, title: title, date: l.end_date ? new Date(l.end_date) : new Date(l.start_date), icon: '❤️', bg: 'bg-[#8c1d18]/20', border: 'border-[#8c1d18]/50', user: l.user_name || '?' });
            }
        });
        state.todos.filter(t => t.is_completed).forEach(t => {
            historyItems.push({ table: 'todos', id: t.id, title: t.title, date: t.completed_at ? new Date(t.completed_at) : new Date(t.created_at), icon: '📝', bg: 'bg-[#004a77]/20', border: 'border-[#004a77]/50', user: t.completer_name || '?' });
        });
        historyItems.sort((a, b) => b.date - a.date);
        html = `<div class="relative border-l-2 border-[#333537] ml-3 mt-2 mb-6 space-y-4">` + historyItems.slice(0, 30).map(item => {
            let initial = (item.user || '?')[0].toUpperCase();
            return `
            <div class="relative pl-5 animate-fade-in">
                <div class="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border flex items-center justify-center text-xs shadow-md">${item.icon}</div>
                <div class="bg-[#1e1f20] px-3 py-2 rounded-[12px] border border-[#333537] shadow-sm flex justify-between items-center">
                    <div class="flex-1 min-w-0 pr-2">
                        <h4 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.title)}</h4>
                        <p class="text-[10px] text-neutral-500 mt-0.5">${item.date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</p>
                    </div>
                    <div class="js-dash-change-user w-6 h-6 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[10px] flex items-center justify-center font-bold shrink-0 cursor-pointer active:scale-90 transition-transform shadow-inner" data-table="${item.table}" data-id="${item.id}" data-username="${window.esc(item.user)}">${initial}</div>
                </div>
            </div>`;
        }).join('') + `</div>`;
    }
    listEl.innerHTML = html;
};

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
        task_id: finalTaskId, 
        activity_name: task ? task.name : 'Zadanie', 
        created_at: now.toISOString(), 
        user_id: window.currentUser.user_id, 
        household_id: window.currentUser.household_id, 
        user_name: window.currentUser.name 
    }]);

    if (error) { 
        window.showToast("Błąd bazy: " + error.message);
        return; 
    }

    // --- ZMIANA: OBLICZAMY NASTĘPNY TERMIN I AKTUALIZUJEMY ZADANIE ---
    if (task && task.interval_days > 0) {
        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + task.interval_days);
        await window.supabaseClient.from('tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalTaskId);
    } else if (task) {
        // Zadanie jednorazowe - archiwizujemy
        await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', finalTaskId);
    }

    window.showToast('Zapisano! ✔️');
    window.invalidateDashboardCache(); 
    window.loadDashboardOverview(true); 
};

window.quickCompleteTodoDashboard = async function(id) {
    const finalId = isNaN(id) ? id : Number(id);
    const { error } = await window.supabaseClient.from('todos')
        .update({ is_completed: true, completed_at: new Date().toISOString(), completer_name: window.currentUser.name })
        .eq('id', finalId);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.invalidateDashboardCache(); window.loadDashboardOverview(true);
};

window.quickLogHealthDashboard = async function(taskId) {
    const finalId = isNaN(taskId) ? taskId : Number(taskId);
    const state = window.AppStore.get();
    const task = state.hTasks.find(t => t.id == finalId);
    const now = new Date();

    const { error } = await window.supabaseClient.from('health_logs').insert([{ 
        health_task_id: finalId, 
        start_date: now.toISOString(), 
        end_date: now.toISOString(), 
        user_id: window.currentUser.user_id, 
        household_id: window.currentUser.household_id, 
        user_name: window.currentUser.name 
    }]);
    
    if (error) { window.showToast("Błąd: " + error.message); return; }

    // --- ZMIANA: OBLICZAMY NASTĘPNY TERMIN DLA CYKLICZNYCH ---
    if (task && task.interval_days > 0) {
        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + task.interval_days);
        await window.supabaseClient.from('health_tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalId);
    }

    window.showToast('Zapisano! ❤️');
    window.invalidateDashboardCache(); window.loadDashboardOverview(true);
};

window.quickEndHealthDashboard = async function(logId) {
    const finalId = isNaN(logId) ? logId : Number(logId);
    const { error } = await window.supabaseClient.from('health_logs').update({ end_date: new Date().toISOString(), user_name: window.currentUser.name }).eq('id', finalId);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.invalidateDashboardCache(); window.loadDashboardOverview(true);
};

// --- DELEGACJA ZDARZEŃ ---
document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.js-dash-nav');
    if (navBtn) return window.switchView(navBtn.dataset.view);

    const todoBtn = e.target.closest('.js-dash-complete-todo');
    if (todoBtn) return window.quickCompleteTodoDashboard(todoBtn.dataset.id);
    
    const homeBtn = e.target.closest('.js-dash-log-task');
    if (homeBtn) return window.quickLogTaskDashboard(homeBtn.dataset.id);

    const healthLogBtn = e.target.closest('.js-quick-log-health');
    if (healthLogBtn) return window.quickLogHealthDashboard(healthLogBtn.dataset.id);

    const userBtn = e.target.closest('.js-dash-change-user');
    if (userBtn) window.openChangeUserModal(userBtn.dataset.table, userBtn.dataset.id, userBtn.dataset.username);
});
