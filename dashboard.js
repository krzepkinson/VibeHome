// ==========================================
// LOGIKA: PRZEGLĄD Z ZAKŁADKAMI (dashboard.js)
// ==========================================

window.activeDashboardTab = 'todo'; 

window.switchDashboardTab = function(tab) {
    window.activeDashboardTab = tab;
    window.loadDashboardOverview();
};

window.loadDashboardOverview = async function() {
    const listEl = document.getElementById('dashboard-overview-list');
    
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

    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Analiza Twoich spraw...</p>`;

    const uid = window.currentUser.id;

    const [tasksRes, logsRes, healthTasksRes, healthLogsRes, todoRes, profilesRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid).eq('is_archived', false),
        supabaseClient.from('activity_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('health_tasks').select('*').eq('user_id', uid).eq('is_archived', false),
        supabaseClient.from('health_logs').select('*').eq('user_id', uid).order('start_date', { ascending: false }),
        supabaseClient.from('todos').select('*').eq('user_id', uid).eq('is_archived', false).order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*').eq('user_id', uid)
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
            html += activeTodos.map(todo => `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#a8c7fa] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('todo')">
                        <h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(todo.title)}</h3>
                        <p class="text-[10px] text-neutral-500 mt-0.5">Dodano: ${new Date(todo.created_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                    <button onclick="window.quickCompleteTodoDashboard(${todo.id})" class="w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`).join('');
        } else {
            html = renderEmptyState("Wszystkie zadania załatwione!");
        }
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
            html += overdueHome.map(t => `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#ffb4ab] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                        <h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(t.name)}</h3>
                        <p class="text-[10px] text-[#ffb4ab] mt-0.5">Czas na odświeżenie</p>
                    </div>
                    <button onclick="window.quickLogTaskDashboard('${encodeURIComponent(t.name)}')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`).join('');
        } else {
            html = renderEmptyState("Dom lśni czystością!");
        }
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
            html += dueHealth.map(ht => `
                <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#8c1d18] shadow-sm animate-fade-in">
                    <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                        <h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3>
                        <p class="text-[10px] text-[#ffb4ab] mt-0.5">Zaplanowana dawka</p>
                    </div>
                    <button onclick="window.quickLogHealthDashboard(${ht.id})" class="w-8 h-8 rounded-full bg-[#8c1d18]/20 border border-[#8c1d18]/50 text-[#ffb4ab] flex items-center justify-center active:scale-90 text-base font-bold shrink-0">✓</button>
                </div>`).join('');
            
            html += activeDuration.map(ht => {
                const aLog = hLogs.find(l => l.health_task_id === ht.id && l.end_date === null);
                return `<div class="flex items-center justify-between px-3 py-2 bg-rose-900/10 rounded-[12px] border border-rose-900/40 mb-1 border-l-4 border-l-rose-500 shadow-sm animate-fade-in"><div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')"><h3 class="font-medium text-neutral-100 text-sm leading-tight">${window.esc(ht.name)}</h3><p class="text-[10px] text-rose-400 mt-0.5">Zdarzenie trwa...</p></div><button onclick="window.quickEndHealthDashboard(${aLog.id})" class="px-3 py-1.5 rounded-full bg-rose-900/40 border border-rose-800/60 text-rose-200 text-[10px] font-bold uppercase tracking-wider active:scale-90 shrink-0">Zakończ</button></div>`;
            }).join('');
        } else {
            html = renderEmptyState("Wszyscy domownicy czują się świetnie!");
        }
    }
    else if (window.activeDashboardTab === 'history') {
        let historyItems = [];
             
        logs.forEach(l => {
            const t = tasks.find(x => x.name === l.activity_name);
            if (!t || t.show_in_history !== false) {
                historyItems.push({ title: l.activity_name, date: new Date(l.created_at), icon: '🏠', color: 'text-[#c4eed0]', bg: 'bg-[#0f5223]/20', border: 'border-[#0f5223]/50' });
            }
        });

        hLogs.forEach(l => {
            const ht = hTasks.find(x => x.id === l.health_task_id);
            if (!ht || ht.show_in_history !== false) {
                const profile = profiles.find(p => p.id === ht?.profile_id);
                const profileStr = profile ? ` (${profile.name})` : '';
                const d = l.end_date ? new Date(l.end_date) : new Date(l.start_date);
                historyItems.push({ 
                    title: (ht ? ht.name : 'Zdarzenie') + profileStr, 
                    date: d, icon: '❤️', color: 'text-[#ffb4ab]', bg: 'bg-[#8c1d18]/20', border: 'border-[#8c1d18]/50' 
                });
            }
        });

        allTodos.filter(t => t.is_completed).forEach(t => {
            historyItems.push({ title: t.title, date: new Date(t.created_at), icon: '📝', color: 'text-[#a8c7fa]', bg: 'bg-[#004a77]/20', border: 'border-[#004a77]/50' });
        });

        historyItems.sort((a, b) => b.date - a.date);
        const topHistory = historyItems.slice(0, 30);

        if (topHistory.length > 0) {
            html += `<div class="relative border-l-2 border-[#333537] ml-3 mt-2 mb-6 space-y-4">`;
            html += topHistory.map(item => `
                <div class="relative pl-5 animate-fade-in">
                    <div class="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border flex items-center justify-center text-xs shadow-md">${item.icon}</div>
                    <div class="bg-[#1e1f20] px-3 py-2 rounded-[12px] border border-[#333537] shadow-sm">
                        <h4 class="text-sm font-medium text-neutral-200">${window.esc(item.title)}</h4>
                        <p class="text-[10px] text-neutral-500 mt-0.5">${item.date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</p>
                    </div>
                </div>
            `).join('');
            html += `</div>`;
        } else {
            html = renderEmptyState("Oś czasu jest pusta.");
        }
    }

    listEl.innerHTML = html;
};

function renderEmptyState(msg) {
    return `
    <div class="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div class="text-5xl mb-4 opacity-50">✨</div>
        <h3 class="text-neutral-200 font-medium text-sm mb-1">${msg}</h3>
        <p class="text-neutral-500 text-[10px] uppercase tracking-widest">Wszystko pod kontrolą</p>
    </div>`;
}

window.quickCompleteTodoDashboard = async function(id) {
    await supabaseClient.from('todos').update({ is_completed: true }).eq('id', id).eq('user_id', window.currentUser.id);
    window.showToast('Zadanie odhaczone! ✔️');
    window.loadDashboardOverview();
};

window.quickLogTaskDashboard = async function(name) {
    const d = new Date().toISOString().split('T')[0];
    await supabaseClient.from('activity_logs').insert([{ activity_name: decodeURIComponent(name), created_at: `${d}T12:00:00.000Z`, notes: '', user_id: window.currentUser.id }]);
    window.showToast('Zrobione! ✔️');
    window.loadDashboardOverview(); 
};

window.quickLogHealthDashboard = async function(taskId) {
    const now = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: now, end_date: now, user_id: window.currentUser.id }]);
    window.showToast('Zapisano! ✔️');
    window.loadDashboardOverview();
};

window.quickEndHealthDashboard = async function(logId) {
    await supabaseClient.from('health_logs').update({ end_date: new Date().toISOString() }).eq('id', logId).eq('user_id', window.currentUser.id);
    window.showToast('Zakończono! ✔️');
    window.loadDashboardOverview();
};
