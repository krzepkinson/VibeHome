// ==========================================
// LOGIKA: PRZEGLĄD (dashboard.js)
// ==========================================

window.loadDashboardOverview = async function() {
    const listEl = document.getElementById('dashboard-overview-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie przeglądu...</p>`;

    const uid = window.currentUser.id;

    // Pobieramy dane
    const [tasksRes, logsRes, roomsRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid),
        supabaseClient.from('activity_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('rooms').select('*').eq('user_id', uid)
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];
    const rooms = roomsRes.data || [];

    const today = new Date();
    today.setHours(0,0,0,0);

    // ====================================================
    // 1. KAFELKI POMIESZCZEŃ (Jak dawniej)
    // ====================================================
    let roomStats = {};
    rooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
    if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
    
    tasks.forEach(task => {
        const rName = task.room || 'Inne';
        if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 };
        roomStats[rName].total++;
        
        if (task.interval_days > 0) {
            const lastLog = logs.find(l => l.activity_name === task.name);
            let isOverdue = false;
            if (lastLog) {
                const last = new Date(lastLog.created_at); last.setHours(0,0,0,0);
                const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
                if (next <= today) isOverdue = true;
            } else { isOverdue = true; }
            if (isOverdue) roomStats[rName].overdue++;
        }
    });

    let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 mt-2">`;
    
    Object.entries(roomStats).sort((a,b) => (a[0] === 'Inne' ? 1 : b[0] === 'Inne' ? -1 : a[0].localeCompare(b[0]))).forEach(([roomName, stats]) => {
        const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
        html += `
            <div onclick="window.goToRoomFromDashboard('${roomName}')" class="relative bg-[#1e1f20] p-4 rounded-[24px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-28">
                ${badge}<div class="text-3xl mb-2 opacity-80">${stats.icon}</div><h3 class="text-xs font-medium text-neutral-200">${roomName}</h3>
                <p class="text-[9px] text-neutral-500 mt-1 uppercase tracking-widest">${stats.total} zadań</p>
            </div>`;
    });
    html += `</div>`;

    // ====================================================
    // 2. NAJPILNIEJSZE ZADANIA (Top 3)
    // ====================================================
    html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-3">🔥 Najpilniejsze zadania</h3>`;

    let scoredTasks = tasks.filter(t => t.interval_days && t.interval_days > 0).map(t => {
        const lastLog = logs.find(l => l.activity_name === t.name);
        let daysOverdue = 0;
        
        if (!lastLog) {
            daysOverdue = 999; // Najwyższy priorytet dla nigdy nierobionych
        } else {
            const lastD = new Date(lastLog.created_at); lastD.setHours(0,0,0,0);
            const nextD = new Date(lastD); nextD.setDate(nextD.getDate() + t.interval_days);
            daysOverdue = Math.floor((today - nextD) / 86400000); 
        }
        return { t, daysOverdue };
    }).filter(item => item.daysOverdue >= 0); // Bierzemy tylko te na dziś i zaległe

    // Sortujemy malejąco wg opóźnienia
    scoredTasks.sort((a,b) => b.daysOverdue - a.daysOverdue);
    
    // Pobieramy top 3
    const top3 = scoredTasks.slice(0, 3);

    if (top3.length > 0) {
        html += top3.map(item => {
            const t = item.t;
            const roomBadge = t.room && t.room !== 'Inne' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${t.room}</span>` : '';
            let statusText = item.daysOverdue === 999 ? 'Jeszcze nie było robione' : (item.daysOverdue === 0 ? 'Czas na dziś' : `Przeterminowane o ${item.daysOverdue} dni`);
            
            return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 shadow-sm border-l-4 border-l-[#ffb4ab]">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.goToRoomFromDashboard('${t.room || 'Inne'}')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${t.name} ${roomBadge}</h3>
                    <p class="text-[11px] text-[#ffb4ab] mt-1">${statusText}</p>
                </div>
                <button onclick="window.quickLogTaskDashboard('${encodeURIComponent(t.name)}')" class="w-12 h-12 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 transition-transform shadow-lg shrink-0">
                    <span class="text-xl font-bold">✓</span>
                </button>
            </div>`;
        }).join('');
    } else {
        html += `
        <div class="flex flex-col items-center justify-center py-10 text-center bg-[#1e1f20] rounded-[24px] border border-[#333537]">
            <div class="text-4xl mb-3">✨</div>
            <h3 class="text-neutral-200 text-sm font-medium">Wszystko gotowe!</h3>
            <p class="text-neutral-500 text-[10px] uppercase tracking-widest mt-1">Brak zaległych zadań</p>
        </div>`;
    }

    listEl.innerHTML = html;
};

// --- FUNKCJE POMOCNICZE DLA KOKPITU ---

window.goToRoomFromDashboard = function(roomName) {
    window.switchView('home');
    if(typeof filterHomeByRoom === 'function') {
        // Czekamy chwilę, aż DOM załaduje zakładkę "Dom"
        setTimeout(() => filterHomeByRoom(roomName), 50);
    }
};

window.quickLogTaskDashboard = async function(activityNameEncoded) {
    const activityName = decodeURIComponent(activityNameEncoded);
    const d = new Date().toISOString().split('T')[0];
    
    // Zapisujemy dzisiejszą datę
    await supabaseClient.from('activity_logs').insert([{
        activity_name: activityName,
        created_at: `${d}T12:00:00.000Z`,
        notes: '',
        user_id: window.currentUser.id
    }]);
    
    window.showToast('Zrobione! ✔️');
    
    // Przeładowujemy widok Przeglądu, aby zadanie zniknęło z Top 3
    window.loadDashboardOverview(); 
};
