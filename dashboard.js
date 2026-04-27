// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.loadDashboardOverview = async function() {
    const listEl = document.getElementById('dashboard-overview-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie przeglądu...</p>`;

    const uid = window.currentUser.id;

    // Pobieramy dane
    const [tasksRes, logsRes, healthTasksRes, healthLogsRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid),
        supabaseClient.from('activity_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('health_tasks').select('*').eq('user_id', uid),
        supabaseClient.from('health_logs').select('*').eq('user_id', uid).order('start_date', { ascending: false })
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];
    const hTasks = healthTasksRes.data || [];
    const hLogs = healthLogsRes.data || [];

    const today = new Date();
    today.setHours(0,0,0,0);

    let html = '';

    // ====================================================
    // 1. NAJPILNIEJSZE ZADANIA DOMOWE (Top 3)
    // ====================================================
    let scoredTasks = tasks.filter(t => t.interval_days && t.interval_days > 0).map(t => {
        const lastLog = logs.find(l => l.activity_name === t.name);
        let daysOverdue = 0;
        if (!lastLog) {
            daysOverdue = 999; 
        } else {
            const lastD = new Date(lastLog.created_at); lastD.setHours(0,0,0,0);
            const nextD = new Date(lastD); nextD.setDate(nextD.getDate() + t.interval_days);
            daysOverdue = Math.floor((today - nextD) / 86400000); 
        }
        return { t, daysOverdue };
    }).filter(item => item.daysOverdue >= 0); 

    scoredTasks.sort((a,b) => b.daysOverdue - a.daysOverdue);
    const top3 = scoredTasks.slice(0, 3);

    if (top3.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3 mt-2">🔥 Dom - Najpilniejsze</h3>`;
        html += top3.map(item => {
            const t = item.t;
            const roomBadge = t.room && t.room !== 'Inne' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${t.room}</span>` : '';
            let statusText = item.daysOverdue === 999 ? 'Jeszcze nie było robione' : (item.daysOverdue === 0 ? 'Czas na dziś' : `Przeterminowane o ${item.daysOverdue} dni`);
            
            return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 shadow-sm border-l-4 border-l-[#ffb4ab]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${t.name} ${roomBadge}</h3>
                    <p class="text-[11px] text-[#ffb4ab] mt-1">${statusText}</p>
                </div>
                <button onclick="window.quickLogTaskDashboard('${encodeURIComponent(t.name)}')" class="w-12 h-12 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 transition-transform shadow-lg shrink-0">
                    <span class="text-xl font-bold">✓</span>
                </button>
            </div>`;
        }).join('');
    }

    // ====================================================
    // 2. ZDROWIE (Zaplanowane i trwające objawy)
    // ====================================================
    const dueHealthTasks = hTasks.filter(ht => {
        if (ht.task_type !== 'cyclical' || !ht.interval_days || ht.interval_days <= 0) return false;
        const lastLog = hLogs.find(l => l.health_task_id === ht.id);
        if (!lastLog) return true;
        const next = new Date(lastLog.start_date);
        next.setHours(0,0,0,0);
        next.setDate(next.getDate() + ht.interval_days);
        return next <= today;
    });

    const activeDurationTasks = hTasks.filter(ht => {
        if (ht.task_type !== 'duration') return false;
        return hLogs.some(l => l.health_task_id === ht.id && l.end_date === null);
    });

    if (dueHealthTasks.length > 0 || activeDurationTasks.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3 mt-6">❤️ Zdrowie - Pod lupą</h3>`;
        
        html += dueHealthTasks.map(ht => {
            return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 shadow-sm border-l-4 border-l-[#8c1d18]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${ht.name}</h3>
                    <p class="text-[11px] text-[#ffb4ab] mt-1">Czas na dawkę</p>
                </div>
                <button onclick="window.quickLogHealthDashboard(${ht.id})" class="w-12 h-12 rounded-full bg-[#8c1d18]/20 border border-[#8c1d18]/50 text-[#ffb4ab] flex items-center justify-center active:scale-90 transition-transform shadow-lg shrink-0">
                    <span class="text-xl font-bold">✓</span>
                </button>
            </div>`;
        }).join('');

        html += activeDurationTasks.map(ht => {
            const aLog = hLogs.find(l => l.health_task_id === ht.id && l.end_date === null);
            return `
            <div class="flex items-center justify-between p-4 bg-rose-900/10 rounded-[24px] border border-rose-900/40 mb-2 shadow-sm border-l-4 border-l-rose-500">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('health')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${ht.name}</h3>
                    <p class="text-[11px] text-rose-400 mt-1">Zdarzenie w trakcie...</p>
                </div>
                <button onclick="window.quickEndHealthDashboard(${aLog.id})" class="px-5 py-3 rounded-full bg-rose-900/40 border border-rose-800/60 text-rose-200 text-xs font-bold uppercase tracking-wider active:scale-90 transition-transform shadow-lg shrink-0">
                    Zakończ
                </button>
            </div>`;
        }).join('');
    }

    // ====================================================
    // 3. STAN ZERO
    // ====================================================
    if (html === '') {
        html = `
        <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div class="text-5xl mb-4">✨</div>
            <h3 class="text-neutral-200 font-medium mb-2">Wszystko gotowe!</h3>
            <p class="text-neutral-500 text-xs leading-relaxed">Nie masz żadnych zaległych zadań w domu<br>ani zaplanowanych akcji zdrowotnych.</p>
        </div>`;
    }

    listEl.innerHTML = html;
};

// --- FUNKCJE SZYBKICH AKCJI ---
window.quickLogTaskDashboard = async function(activityNameEncoded) {
    const activityName = decodeURIComponent(activityNameEncoded);
    const d = new Date().toISOString().split('T')[0];
    await supabaseClient.from('activity_logs').insert([{
        activity_name: activityName, created_at: `${d}T12:00:00.000Z`, notes: '', user_id: window.currentUser.id
    }]);
    window.showToast('Zrobione! ✔️');
    window.loadDashboardOverview(); 
};

window.quickLogHealthDashboard = async function(taskId) {
    const now = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{
        health_task_id: taskId, start_date: now, end_date: now, user_id: window.currentUser.id
    }]);
    window.showToast('Zaakceptowano! ✔️');
    window.loadDashboardOverview();
};

window.quickEndHealthDashboard = async function(logId) {
    await supabaseClient.from('health_logs').update({ end_date: new Date().toISOString() }).eq('id', logId).eq('user_id', window.currentUser.id);
    window.showToast('Zdarzenie zakończone! ✔️');
    window.loadDashboardOverview();
};
