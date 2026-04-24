// ==========================================
// LOGIKA: PRZEGLĄD GŁÓWNY (dashboard.js)
// ==========================================

async function loadDashboardOverview() {
    const listEl = document.getElementById('dashboard-overview-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Analiza danych...</p>`;

    // Pobieramy wszystko co potrzebne z obu modułów
    const [hTasksRes, hLogsRes, profRes, healthTasksRes, healthLogsRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*'),
        supabaseClient.from('health_tasks').select('*'),
        supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false })
    ]);

    const homeTasks = hTasksRes.data || [];
    const homeLogs = hLogsRes.data || [];
    const profiles = profRes.data || [];
    const healthTasks = healthTasksRes.data || [];
    const healthLogs = healthLogsRes.data || [];

    const today = new Date();
    today.setHours(0,0,0,0);

    let overviewHtml = "";
    let hasAnyAlerts = false;

    // ----------------------------------------------------
    // SEKCJA 1: AKTYWNE STANY (Np. Katar) - Najwyższy priorytet
    // ----------------------------------------------------
    let activeHealthAlerts = [];
    
    healthTasks.filter(t => t.task_type === 'duration').forEach(task => {
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0];
        
        if (latestLog && latestLog.end_date === null) {
            const profile = profiles.find(p => p.id === task.profile_id);
            const start = new Date(latestLog.start_date); start.setHours(0,0,0,0);
            const diffDays = Math.floor((today - start) / 86400000);
            const durationText = diffDays === 0 ? "od dzisiaj" : (diffDays === 1 ? "od wczoraj" : `od ${diffDays} dni`);
            
            activeHealthAlerts.push({
                profileName: profile ? profile.name : 'Ktoś',
                taskName: task.name,
                durationText: durationText
            });
        }
    });

    if (activeHealthAlerts.length > 0) {
        hasAnyAlerts = true;
        overviewHtml += `
            <div class="mb-2">
                <h2 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-3 pl-1">Aktualnie trwające</h2>
                ${activeHealthAlerts.map(alert => `
                    <div onclick="switchView('health')" class="bg-[#3c1414] p-4 rounded-[24px] border border-[#8c1d18]/30 mb-2 cursor-pointer active:scale-95 transition-transform">
                        <div class="flex items-center gap-3">
                            <div class="text-2xl">🤒</div>
                            <div>
                                <h3 class="text-sm font-medium text-neutral-100"><span class="text-[#ffb4ab] font-bold">${alert.profileName}</span> ma ${alert.taskName}</h3>
                                <p class="text-xs text-[#ffb4ab] opacity-80 mt-0.5">Trwa ${alert.durationText}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ----------------------------------------------------
    // SEKCJA 2: ZDROWIE - CYKLICZNE (Przeterminowane)
    // ----------------------------------------------------
    let overdueHealthCyclical = [];
    
    healthTasks.filter(t => t.task_type === 'cyclical' && t.interval_days > 0).forEach(task => {
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0];
        
        if (latestLog) {
            const last = new Date(latestLog.start_date); last.setHours(0,0,0,0);
            const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
            const diff = Math.ceil((next - today) / 86400000);
            
            if (diff <= 0) { // Dzisiaj lub zaległe
                const profile = profiles.find(p => p.id === task.profile_id);
                overdueHealthCyclical.push({
                    profileName: profile ? profile.name : 'Ktoś',
                    taskName: task.name,
                    daysDiff: diff,
                    lastDate: last
                });
            }
        }
    });

    if (overdueHealthCyclical.length > 0) {
        hasAnyAlerts = true;
        overviewHtml += `
            <div class="mb-2 mt-4">
                <h2 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-3 pl-1">Zdrowie: Wymaga uwagi</h2>
                ${overdueHealthCyclical.map(alert => `
                    <div onclick="switchView('health')" class="bg-[#1e1f20] p-4 rounded-[24px] border border-[#ffb4ab]/30 mb-2 cursor-pointer active:scale-95 transition-transform">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-medium text-neutral-100">${alert.taskName} (${alert.profileName})</h3>
                                <p class="text-xs text-[#ffb4ab] mt-0.5">${alert.daysDiff < 0 ? `Zaległe o ${Math.abs(alert.daysDiff)} dni` : 'Do zrobienia dzisiaj'}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ----------------------------------------------------
    // SEKCJA 3: DOM (Przeterminowane)
    // ----------------------------------------------------
    let overdueHomeTasks = [];

    homeTasks.filter(t => t.interval_days > 0).forEach(task => {
        const lastLog = homeLogs.find(l => l.activity_name === task.name);
        if (lastLog) {
            const last = new Date(lastLog.created_at); last.setHours(0,0,0,0);
            const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
            const diff = Math.ceil((next - today) / 86400000);
            
            if (diff <= 0) { // Dzisiaj lub zaległe
                overdueHomeTasks.push({
                    taskName: task.name,
                    daysDiff: diff
                });
            }
        } else {
            // Nigdy nie wykonano, ale ma interwał - wymaga wykonania!
            overdueHomeTasks.push({ taskName: task.name, daysDiff: -999 });
        }
    });

    if (overdueHomeTasks.length > 0) {
        hasAnyAlerts = true;
        overviewHtml += `
            <div class="mb-2 mt-4">
                <h2 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-3 pl-1">Dom: Wymaga uwagi</h2>
                ${overdueHomeTasks.map(alert => `
                    <div onclick="switchView('home')" class="bg-[#1e1f20] p-4 rounded-[24px] border border-[#333537] mb-2 cursor-pointer active:scale-95 transition-transform">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-medium text-neutral-100">${alert.taskName}</h3>
                                <p class="text-xs text-[#a8c7fa] mt-0.5">${alert.daysDiff === -999 ? 'Nigdy nie wykonano' : (alert.daysDiff < 0 ? `Zaległe o ${Math.abs(alert.daysDiff)} dni` : 'Do zrobienia dzisiaj')}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Jeśli wszystko zrobione :)
    if (!hasAnyAlerts) {
        overviewHtml = `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="text-5xl mb-4">☕</div>
                <h3 class="text-lg font-medium text-neutral-200">Wszystko pod kontrolą!</h3>
                <p class="text-sm text-neutral-500 mt-1">Żadnych zaległych zadań domowych ani aktywnie chorujących domowników.</p>
            </div>
        `;
    }

    listEl.innerHTML = overviewHtml;
}
