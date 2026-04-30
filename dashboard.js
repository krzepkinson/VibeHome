// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.activeDashboardTab = 'todo'; 

window.switchDashboardTab = function(tab) {
    window.activeDashboardTab = tab;
    window.loadDashboardOverview();
};

window.loadDashboardOverview = async function() {
    const listEl = document.getElementById('dashboard-overview-list');
    if (!listEl) return;
    
    const tabs = ['todo', 'home', 'health', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        if (t === window.activeDashboardTab) {
            btn.className = "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-[#333537] text-[#a8c7fa] shadow-sm transition-all whitespace-nowrap";
        } else {
            btn.className = "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl text-neutral-500 transition-all whitespace-nowrap";
        }
    });

    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Synchronizacja...</p>`;

    const hid = window.currentUser.household_id; 

    const [tasksRes, logsRes, healthTasksRes, healthLogsRes, todoRes, profilesRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
        supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }),
        supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
        supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false }),
        supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*').eq('household_id', hid)
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];
    const hTasks = healthTasksRes.data || [];
    const hLogs = healthLogsRes.data || [];
    const allTodos = todoRes.data || [];
    const profiles = profilesRes.data || [];
    const activeTodos = allTodos.filter(t => !t.is_completed);

    const today = new Date(); today.setHours(0,0,0,0);
    
    let homeOverdueCount = tasks.filter(t => {
        if (!t.interval_days) return false;
        const lastLog = logs.find(l => l.activity_name === t.name);
        if (!lastLog) return true;
        const next = new Date(lastLog.created_at); next.setHours(0,0,0,0);
        next.setDate(next.getDate() + t.interval_days);
        return next <= today && t.push_enabled !== false;
    }).length;

    let healthDueCount = hTasks.filter(ht => {
        if (ht.task_type === 'cyclical' && ht.interval_days) {
            const lastLog = hLogs.find(l => l.health_task_id === ht.id);
            if (!lastLog) return true;
            const next = new Date(lastLog.start_date); next.setHours(0,0,0,0);
            next.setDate(next.getDate() + ht.interval_days);
            return next <= today;
        }
        return false;
    }).length;

    if (typeof window.triggerSmartNotification === 'function') {
        window.triggerSmartNotification(homeOverdueCount, healthDueCount, activeTodos.length);
    }

    let html = '';

    if (window.activeDashboardTab === 'todo') {
        if (activeTodos.length > 0) {
            html += activeTodos.map(todo => {
                let initial = (todo.creator_name || '?')[0].toUpperCase();
                let creatorBadge = `<div onclick="event.stopPropagation(); window.openChangeUserModal('todos_creator', ${todo.id}, '${window.esc(todo.creator_name || '')}')" class="w-5 h-5 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[9px] flex items-center justify-center ml-2 shrink-0 cursor-pointer active:scale-90 transition-transform" title="Dodał(a)" data-user-name="${window.esc(todo.creator_name || '')}">${initial}</div>`;
                
                return `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#a8c7fa] shadow-sm animate-fade-in">
                    <div class="flex-1 flex items-center cursor-pointer pr-2" onclick="window.switchView('todo')">
                        <div class="flex-1 min-w-0">
                            <h3 class="font-medium text-neutral-100 text-sm leading-tight truncate">${window.esc(todo.title)}</h3>
                            <p class="text-[10px] text-neutral-500 mt-0.5">${new Date(todo.created_at).toLocaleDateString('pl-PL')}</p>
                        </div>
                        ${creatorBadge}
                    </div>
                    <button onclick="window.quickCompleteTodoDashboard(${todo.id})" class="w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`;
            }).join('');
        } else { html = renderEmptyState("Zadania załatwione!"); }
    } 
    else if (window.activeDashboardTab === 'home') {
        let overdueHome = tasks.filter(t => {
            if (!t.interval_days) return false;
            const lastLog = logs.find(l => l.activity_name === t.name);
            if (!lastLog) return true;
            const next = new Date(lastLog.created_at); next.setHours(0,0,0,0);
            next.setDate(next.getDate() + t.interval_days);
            return next <= today;
        });
        if (overdueHome.length > 0) {
            html += overdueHome.map(t => `<div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#ffb4ab] shadow-sm animate-fade-in"><div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')"><h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(t.name)}</h3><p class="text-[10px] text-[#ffb4ab] mt-0.5">Czas na odświeżenie</p></div><button onclick="window.quickLogTaskDashboard('${encodeURIComponent(t.name)}')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button></div>`).join('');
        } else { html = renderEmptyState("Dom lśni!"); }
    } 
    else if (window.activeDashboardTab === 'health') {
        const dueHealth = hTasks.filter(ht => {
            if (ht.task_type !== 'cyclical' || !ht.interval_days) return false;
            const lastLog = hLogs.find(l => l.health_task_id === ht.id);
            if (!lastLog) return true;
            const next = new Date(lastLog.start_date); next.setHours(0,0,0,0);
            next.setDate(next.getDate() + ht.interval_days);
            return next <= today;
        });
        const activeDuration = hTasks.filter(ht => ht.task_type === 'duration' && hLogs.some(l => l.health_task_id === ht.id && l.end_date === null));
        if (dueHealth.length > 0 || activeDuration.length > 0) {
            html += dueHealth.map(ht => `<div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#8c1d18] shadow-sm animate-fade-in"><div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')"><h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3><p class="text-[10px] text-[#ffb4ab] mt-0.5">Zaplanowana dawka</p></div><button onclick="window.quickLogHealthDashboard(${ht.id})" class="w-8 h-8 rounded-full bg-[#8c1d18]/20 border border-[#8c1d18]/50 text-[#ffb4ab] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button></div>`).join('');
            html += activeDuration.map(ht => {
                const aLog = hLogs.find(l => l.health_task_id === ht.id && l.end_date === null);
                return `<div class="flex items-center justify-between px-3 py-2 bg-rose-900/10 rounded-[12px] border border-rose-900/40 mb-1 border-l-4 border-l-rose-500 shadow-sm animate-fade-in"><div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')"><h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3><p class="text-[10px] text-rose-400 mt-0.5">Zdarzenie trwa...</p></div><button onclick="window.quickEndHealthDashboard(${aLog.id})" class="px-3 py-1.5 rounded-full bg-rose-900/40 border border-rose-800/60 text-rose-200 text-[10px] font-bold uppercase tracking-wider active:scale-90 shrink-0">Zakończ</button></div>`;
            }).join('');
        } else { html = renderEmptyState("Wszyscy zdrowi!"); }
    }
    else if (window.activeDashboardTab === 'history') {
        let historyItems = [];
        logs.forEach(l => {
            const t = tasks.find(x => x.name === l.activity_name);
            if (!t || t.show_in_history !== false) {
                historyItems.push({ table: 'activity_logs', id: l.id, title: l.activity_name, date: new Date(l.created_at), icon: '🏠', bg: 'bg-[#0f5223]/20', border: 'border-[#0f5223]/50', user: l.user_name || '?' });
            }
        });
        hLogs.forEach(l => {
            const ht = hTasks.find(x => x.id === l.health_task_id);
            if (!ht || ht.show_in_history !== false) {
                const profile = profiles.find(p => p.id === ht?.profile_id);
                const title = (ht ? ht.name : 'Zdarzenie') + (profile ? ` (${profile.name})` : '');
                historyItems.push({ table: 'health_logs', id: l.id, title: title, date: l.end_date ? new Date(l.end_date) : new Date(l.start_date), icon: '❤️', bg: 'bg-[#8c1d18]/20', border: 'border-[#8c1d18]/50', user: l.user_name || '?' });
            }
        });
        allTodos.filter(t => t.is_completed).forEach(t => {
            historyItems.push({ table: 'todos', id: t.id, title: t.title, date: new Date(t.created_at), icon: '📝', bg: 'bg-[#004a77]/20', border: 'border-[#004a77]/50', user: t.completer_name || '?' });
        });

        historyItems.sort((a, b) => b.date - a.date);
        const topHistory = historyItems.slice(0, 30);

        if (topHistory.length > 0) {
            html += `<div class="relative border-l-2 border-[#333537] ml-3 mt-2 mb-6 space-y-4">`;
            html += topHistory.map(item => {
                let initial = (item.user || '?')[0].toUpperCase();
                return `
                <div class="relative pl-5 animate-fade-in">
                    <div class="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border flex items-center justify-center text-xs shadow-md">${item.icon}</div>
                    <div class="bg-[#1e1f20] px-3 py-2 rounded-[12px] border border-[#333537] shadow-sm flex justify-between items-center">
                        <div class="flex-1 min-w-0 pr-2">
                            <h4 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.title)}</h4>
                            <p class="text-[10px] text-neutral-500 mt-0.5">${item.date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</p>
                        </div>
                        <div onclick="event.stopPropagation(); window.openChangeUserModal('${item.table}', ${item.id}, '${window.esc(item.user)}')" class="w-6 h-6 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[10px] flex items-center justify-center font-bold shrink-0 cursor-pointer active:scale-90 transition-transform" data-user-name="${window.esc(item.user)}">
                            ${initial}
                        </div>
                    </div>
                </div>`;
            }).join('');
            html += `</div>`;
        } else { html = renderEmptyState("Oś czasu jest pusta."); }
    }
    listEl.innerHTML = html;
};

function renderEmptyState(msg) {
    return `<div class="flex flex-col items-center justify-center py-20 text-center animate-fade-in"><div class="text-5xl mb-4 opacity-50">✨</div><h3 class="text-neutral-200 font-medium text-sm mb-1">${msg}</h3><p class="text-neutral-500 text-[10px] uppercase tracking-widest">Wszystko pod kontrolą</p></div>`;
}

window.quickCompleteTodoDashboard = async function(id) {
    await supabaseClient.from('todos').update({ is_completed: true, completer_name: window.currentUser.name }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.showToast('Zadanie odhaczone! ✔️'); window.loadDashboardOverview();
};

window.quickLogTaskDashboard = async function(name) {
    const d = new Date().toISOString().split('T')[0];
    await supabaseClient.from('activity_logs').insert([{ activity_name: decodeURIComponent(name), created_at: `${d}T12:00:00.000Z`, notes: '', user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name }]);
    window.showToast('Zrobione! ✔️'); window.loadDashboardOverview(); 
};

window.quickLogHealthDashboard = async function(taskId) {
    const now = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: now, end_date: now, user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name }]);
    window.showToast('Zapisano! ✔️'); window.loadDashboardOverview();
};

window.quickEndHealthDashboard = async function(logId) {
    await supabaseClient.from('health_logs').update({ end_date: new Date().toISOString(), user_name: window.currentUser.name }).eq('id', logId).eq('household_id', window.currentUser.household_id);
    window.showToast('Zakończono! ✔️'); window.loadDashboardOverview();
};
