// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.loadDashboardOverview = async function() {
    const listEl = document.getElementById('dashboard-overview-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie przeglądu...</p>`;

    const uid = window.currentUser.id;

    // POBIERAMY DANE (Dodajemy 'todos')
    const [tasksRes, logsRes, healthTasksRes, healthLogsRes, todoRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid),
        supabaseClient.from('activity_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('health_tasks').select('*').eq('user_id', uid),
        supabaseClient.from('health_logs').select('*').eq('user_id', uid).order('start_date', { ascending: false }),
        supabaseClient.from('todos').select('*').eq('user_id', uid).eq('is_completed', false).order('created_at', { ascending: true })
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];
    const hTasks = healthTasksRes.data || [];
    const hLogs = healthLogsRes.data || [];
    const todos = todoRes.data || [];

    const today = new Date(); today.setHours(0,0,0,0);
    let html = '';

    // 1. NAJPILNIEJSZE DOMOWE
    let scoredTasks = tasks.filter(t => t.interval_days && t.interval_days > 0).map(t => {
        const lastLog = logs.find(l => l.activity_name === t.name);
        let daysOverdue = 0;
        if (!lastLog) daysOverdue = 999;
        else {
            const nextD = new Date(lastLog.created_at); nextD.setHours(0,0,0,0);
            nextD.setDate(nextD.getDate() + t.interval_days);
            daysOverdue = Math.floor((today - nextD) / 86400000); 
        }
        return { t, daysOverdue };
    }).filter(item => item.daysOverdue >= 0); 
    scoredTasks.sort((a,b) => b.daysOverdue - a.daysOverdue);
    const top3Home = scoredTasks.slice(0, 3);

    if (top3Home.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3 mt-2">🔥 Dom - Najpilniejsze</h3>`;
        html += top3Home.map(item => `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 border-l-4 border-l-[#ffb4ab]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                    <h3 class="font-medium text-neutral-100 text-sm">${item.t.name}</h3>
                    <p class="text-[11px] text-[#ffb4ab] mt-1">${item.daysOverdue === 999 ? 'Jeszcze nie było robione' : 'Czas na dziś'}</p>
                </div>
                <button onclick="window.quickLogTaskDashboard('${encodeURIComponent(item.t.name)}')" class="w-12 h-12 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-xl font-bold">✓</button>
            </div>`).join('');
    }

    // 2. NAJSTARSZE ZADANIA TO-DO (Integracja)
    const top3Todos = todos.slice(0, 3);
    if (top3Todos.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3 mt-6">📝 Zadania do załatwienia</h3>`;
        html += top3Todos.map(todo => `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 border-l-4 border-l-[#a8c7fa]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('todo')">
                    <h3 class="font-medium text-neutral-100 text-sm">${todo.title}</h3>
                    <p class="text-[11px] text-neutral-500 mt-1">Dodano: ${new Date(todo.created_at).toLocaleDateString('pl-PL')}</p>
                </div>
                <button onclick="window.quickCompleteTodoDashboard(${todo.id})" class="w-12 h-12 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-xl font-bold">✓</button>
            </div>`).join('');
    }

    // 3. ZDROWIE
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
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3 mt-6">❤️ Zdrowie - Pod lupą</h3>`;
        html += dueHealth.map(ht => `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 border-l-4 border-l-[#8c1d18]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                    <h3 class="font-medium text-neutral-100 text-sm">${ht.name}</h3>
                    <p class="text-[11px] text-[#ffb4ab] mt-1">Czas na dawkę</p>
                </div>
                <button onclick="window.quickLogHealthDashboard(${ht.id})" class="w-12 h-12 rounded-full bg-[#8c1d18]/20 border border-[#8c1d18]/50 text-[#ffb4ab] flex items-center justify-center active:scale-90 text-xl font-bold">✓</button>
            </div>`).join('');
        
        html += activeDuration.map(ht => {
            const aLog = hLogs.find(l => l.health_task_id === ht.id && l.end_date === null);
            return `<div class="flex items-center justify-between p-4 bg-rose-900/10 rounded-[24px] border border-rose-900/40 mb-2 border-l-4 border-l-rose-500"><div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')"><h3 class="font-medium text-neutral-100 text-sm">${ht.name}</h3><p class="text-[11px] text-rose-400 mt-1">W trakcie...</p></div><button onclick="window.quickEndHealthDashboard(${aLog.id})" class="px-4 py-3 rounded-full bg-rose-900/40 text-rose-200 text-xs font-bold uppercase active:scale-90 transition-transform">Zakończ</button></div>`;
        }).join('');
    }

    if (html === '') {
        html = `<div class="flex flex-col items-center justify-center py-16 text-center"><div class="text-5xl mb-4">✨</div><h3 class="text-neutral-200 font-medium mb-2">Czysta karta!</h3><p class="text-neutral-500 text-xs">Wszystko zrobione i załatwione.</p></div>`;
    }

    listEl.innerHTML = html;
};

// Nowa funkcja pomocnicza dla dashboardu
window.quickCompleteTodoDashboard = async function(id) {
    await supabaseClient.from('todos').update({ is_completed: true }).eq('id', id).eq('user_id', window.currentUser.id);
    window.showToast('Zadanie odhaczone! ✔️');
    window.loadDashboardOverview();
};
