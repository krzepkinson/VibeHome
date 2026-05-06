// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.activeDashboardTab = 'todo'; 
window.dashboardCache = null;
window.dashboardCacheTime = 0;

window.switchDashboardTab = function(tab) {
    window.activeDashboardTab = tab;
    window.loadDashboardOverview(false);
};

window.invalidateDashboardCache = function() { window.dashboardCacheTime = 0; };

window.loadDashboardOverview = async function(forceRefresh = false) {
    const listEl = document.getElementById('dashboard-overview-list');
    if (!listEl) return;
    
    const tabs = ['todo', 'home', 'health', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;
        btn.className = t === window.activeDashboardTab 
            ? "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl bg-[#333537] text-[#a8c7fa] shadow-sm transition-all whitespace-nowrap"
            : "flex-1 min-w-[80px] py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl text-neutral-500 transition-all whitespace-nowrap";
    });

    const now = Date.now();
    if (forceRefresh || !window.dashboardCache || (now - window.dashboardCacheTime > 30000)) {
        listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Synchronizacja...</p>`;
        const hid = window.currentUser.household_id; 
        const [tasksRes, logsRes, healthTasksRes, healthLogsRes, todoRes, profilesRes] = await Promise.all([
            window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
            window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }),
            window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
            window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false }),
            window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false }),
            window.supabaseClient.from('profiles').select('*').eq('household_id', hid)
        ]);
        window.dashboardCache = { tasks: tasksRes.data || [], logs: logsRes.data || [], hTasks: healthTasksRes.data || [], hLogs: healthLogsRes.data || [], allTodos: todoRes.data || [], profiles: profilesRes.data || [] };
        window.dashboardCacheTime = now;
    }

    const { tasks, logs, hTasks, hLogs, allTodos, profiles } = window.dashboardCache;
    const activeTodos = allTodos.filter(t => !t.is_completed);
    const today = new Date(); today.setHours(0,0,0,0);
    
    let html = '';
    if (window.activeDashboardTab === 'todo') {
        if (activeTodos.length > 0) {
            html += activeTodos.map(todo => `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#a8c7fa] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('todo')">
                        <h3 class="font-medium text-neutral-100 text-sm truncate">${window.esc(todo.title)}</h3>
                        <p class="text-[10px] text-neutral-500 mt-0.5">${new Date(todo.created_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                    <button onclick="window.quickCompleteTodoDashboard(${todo.id})" class="w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`).join('');
        } else { html = renderEmptyState("Zadania załatwione!"); }
    } 
    else if (window.activeDashboardTab === 'home') {
        let overdueHome = tasks.filter(t => window.isTaskOverdue(t, logs));
        if (overdueHome.length > 0) {
            html += overdueHome.map(t => `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#ffb4ab] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                        <h3 class="font-medium text-neutral-100 text-sm">${window.esc(t.name)}</h3>
                        <p class="text-[10px] text-[#ffb4ab] mt-0.5">Czas na odświeżenie</p>
                    </div>
                    <button onclick="window.quickLogTaskDashboard(${t.id})" class="w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`).join('');
        } else { html = renderEmptyState("Dom lśni!"); }
    } 
    else if (window.activeDashboardTab === 'health') {
        // ZMODYFIKOWANA LOGIKA: Pokazujemy cykliczne ORAZ zalege jednorazowe
        const dueHealth = hTasks.filter(ht => {
            if (ht.task_type === 'cyclical' && ht.interval_days) {
                const lastLog = hLogs.find(l => l.health_task_id === ht.id);
                if (!lastLog) return true;
                const next = new Date(lastLog.start_date); next.setHours(0,0,0,0); next.setDate(next.getDate() + ht.interval_days);
                return next <= today;
            }
            if (ht.task_type === 'one_time' && ht.event_date) {
                // Szukamy, czy log już istnieje
                const tLogs = hLogs.filter(l => l.health_task_id === ht.id);
                if (tLogs.length > 0) return false; // Wykonane
                
                const evDate = new Date(ht.event_date); evDate.setHours(0,0,0,0);
                return evDate <= today; // Pokaż dziś lub po terminie
            }
            return false;
        });
        
        const activeDuration = hTasks.filter(ht => ht.task_type === 'duration' && hLogs.some(l => l.health_task_id === ht.id && l.end_date === null));

        if (dueHealth.length > 0 || activeDuration.length > 0) {
            html += dueHealth.map(ht => {
                const isOneTime = ht.task_type === 'one_time';
                return `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#8c1d18] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                        <h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3>
                        <p class="text-[10px] text-[#ffb4ab] mt-0.5">${isOneTime ? 'Czas na wizytę/zabieg!' : 'Zaplanowana dawka'}</p>
                    </div>
                    <button onclick="window.quickLogHealthDashboard(${ht.id})" class="w-8 h-8 rounded-full ${isOneTime ? 'bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0]' : 'bg-[#8c1d18]/20 border border-[#8c1d18]/50 text-[#ffb4ab]'} flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`
            }).join('');
            
            html += activeDuration.map(ht => {
                const aLog = hLogs.find(l => l.health_task_id === ht.id && l.end_date === null);
                return `
                <div class="flex items-center justify-between px-3 py-2 bg-rose-900/10 rounded-[12px] border border-rose-900/40 mb-1 border-l-4 border-l-rose-500 shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                        <h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3>
                        <p class="text-[10px] text-rose-400 mt-0.5">Zdarzenie trwa...</p>
                    </div>
                    <button onclick="window.quickEndHealthDashboard(${aLog.id})" class="px-3 py-1.5 rounded-full bg-rose-900/40 border border-rose-800/60 text-rose-200 text-[10px] font-bold uppercase tracking-wider active:scale-90 shrink-0">Zakończ</button>
                </div>`;
            }).join('');
        } else { html = renderEmptyState("Wszyscy zdrowi!"); }
    }
    else if (window.activeDashboardTab === 'history') {
        let historyItems = [];
        logs.slice(0, 15).forEach(l => historyItems.push({ title: l.activity_name, date: new Date(l.created_at), icon: '🏠', user: l.user_name || '?' }));
        hLogs.slice(0, 15).forEach(l => {
            const ht = hTasks.find(x => x.id === l.health_task_id);
            historyItems.push({ title: ht ? ht.name : 'Zdarzenie', date: l.end_date ? new Date(l.end_date) : new Date(l.start_date), icon: '❤️', user: l.user_name || '?' });
        });
        historyItems.sort((a, b) => b.date - a.date);
        html = historyItems.slice(0, 20).map(item => `
            <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] border border-[#333537] rounded-xl mb-1.5 animate-fade-in">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-xs opacity-60">${item.icon}</span>
                    <div class="truncate"><h4 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.title)}</h4><p class="text-[9px] text-neutral-500 uppercase tracking-widest">${item.date.toLocaleDateString('pl-PL')}</p></div>
                </div>
                <div class="w-6 h-6 rounded-full bg-[#333537] text-neutral-400 text-[10px] flex items-center justify-center font-bold">${item.user[0].toUpperCase()}</div>
            </div>`).join('') || renderEmptyState("Historia jest pusta.");
    }
    listEl.innerHTML = html;
};

function renderEmptyState(msg) { return `<div class="flex flex-col items-center justify-center py-20 text-center animate-fade-in"><div class="text-5xl mb-4 opacity-50">✨</div><h3 class="text-neutral-200 font-medium text-sm mb-1">${msg}</h3><p class="text-neutral-500 text-[10px] uppercase tracking-widest">Wszystko pod kontrolą</p></div>`; }

window.quickCompleteTodoDashboard = async function(id) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const { error } = await window.supabaseClient.from('todos').update({ is_completed: true, completer_name: window.currentUser.name }).eq('id', id);
    if (error) { window.showToast('Błąd: ' + error.message); return; }
    window.invalidateDashboardCache(); window.showToast('Odhaczone! ✔️'); window.loadDashboardOverview();
};

window.quickLogTaskDashboard = async function(taskId) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const task = window.dashboardCache.tasks.find(t => t.id == taskId);
    const d = new Date().toISOString().split('T')[0];
    const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
        task_id: taskId, activity_name: task ? task.name : 'Zadanie', 
        created_at: `${d}T12:00:00.000Z`, notes: '', user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);
    if (error) { window.showToast('Błąd: ' + error.message); return; }
    window.invalidateDashboardCache(); window.showToast('Zrobione! ✔️'); window.loadDashboardOverview(); 
};

window.quickLogHealthDashboard = async function(taskId) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const now = new Date().toISOString();
    const { error } = await window.supabaseClient.from('health_logs').insert([{ 
        health_task_id: taskId, start_date: now, end_date: now, 
        user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);
    if (error) { window.showToast('Błąd: ' + error.message); return; }
    window.invalidateDashboardCache(); window.showToast('Zapisano! ✔️'); window.loadDashboardOverview();
};

window.quickEndHealthDashboard = async function(logId) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const { error } = await window.supabaseClient.from('health_logs').update({ end_date: new Date().toISOString(), user_name: window.currentUser.name }).eq('id', logId).eq('household_id', window.currentUser.household_id);
    if (error) { window.showToast('Błąd: ' + error.message); return; }
    window.invalidateDashboardCache(); window.showToast('Zakończono! ✔️'); window.loadDashboardOverview();
};
