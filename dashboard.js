// ==========================================
// LOGIKA: PRZEGLĄD GŁÓWNY (dashboard.js)
// ==========================================

async function loadDashboardOverview() {
    const listEl = document.getElementById('dashboard-overview-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Analiza danych...</p>`;

    const [hTasksRes, hLogsRes, profRes, healthTasksRes, healthLogsRes, roomsRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*'),
        supabaseClient.from('health_tasks').select('*'),
        supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false }),
        supabaseClient.from('rooms').select('*')
    ]);

    const homeTasks = hTasksRes.data || [];
    const homeLogs = hLogsRes.data || [];
    const profiles = profRes.data || [];
    const healthTasks = healthTasksRes.data || [];
    const healthLogs = healthLogsRes.data || [];
    const dbRooms = roomsRes.data || [];

    const roomIconsMap = {};
    dbRooms.forEach(r => roomIconsMap[r.name] = r.icon);

    const today = new Date();
    today.setHours(0,0,0,0);

    let overviewHtml = "";
    let hasAnyAlerts = false;
    let totalAlertsCount = 0; // Licznik do powiadomień systemowych

    // SEKCJA 1: AKTYWNE STANY
    let activeHealthAlerts = [];
    healthTasks.filter(t => t.task_type === 'duration').forEach(task => {
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0];
        
        if (latestLog && latestLog.end_date === null) {
            const profile = profiles.find(p => p.id === task.profile_id);
            const start = new Date(latestLog.start_date); start.setHours(0,0,0,0);
            const diffDays = Math.floor((today - start) / 86400000);
            const durationText = diffDays === 0 ? "od dzisiaj" : (diffDays === 1 ? "od wczoraj" : `od ${diffDays} dni`);
            
            activeHealthAlerts.push({ profileName: profile ? profile.name : 'Ktoś', taskName: task.name, durationText: durationText });
            totalAlertsCount++;
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

    // SEKCJA 2: ZDROWIE - CYKLICZNE
    let overdueHealthCyclical = [];
    healthTasks.filter(t => t.task_type === 'cyclical' && t.interval_days > 0).forEach(task => {
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0];
        if (latestLog) {
            const last = new Date(latestLog.start_date); last.setHours(0,0,0,0);
            const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
            const diff = Math.ceil((next - today) / 86400000);
            if (diff <= 0) {
                const profile = profiles.find(p => p.id === task.profile_id);
                overdueHealthCyclical.push({ profileName: profile ? profile.name : 'Ktoś', taskName: task.name, daysDiff: diff, lastDate: last });
                totalAlertsCount++;
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
                                <h3 class="text-sm font-medium text-neutral-100">${alert.taskName} <span class="text-neutral-400">(${alert.profileName})</span></h3>
                                <p class="text-xs text-[#ffb4ab] mt-0.5">${alert.daysDiff < 0 ? `Zaległe o ${Math.abs(alert.daysDiff)} dni` : 'Do zrobienia dzisiaj'}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // SEKCJA 3: DOM - DYNAMICZNE POMIESZCZENIA
    let roomOverdueCounts = {};

    homeTasks.filter(t => t.interval_days > 0).forEach(task => {
        // Sprawdzamy czy zadanie w ogóle ma włączone powiadomienia (push_enabled)
        if(task.push_enabled === false) return; 

        const lastLog = homeLogs.find(l => l.activity_name === task.name);
        const roomName = task.room || 'Inne';
        if (roomOverdueCounts[roomName] === undefined) roomOverdueCounts[roomName] = 0;

        if (lastLog) {
            const last = new Date(lastLog.created_at); last.setHours(0,0,0,0);
            const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
            const diff = Math.ceil((next - today) / 86400000);
            if (diff <= 0) roomOverdueCounts[roomName]++;
        } else {
            roomOverdueCounts[roomName]++;
        }
    });

    const totalOverdueHome = Object.values(roomOverdueCounts).reduce((a, b) => a + b, 0);
    totalAlertsCount += totalOverdueHome;

    if (totalOverdueHome > 0) {
        hasAnyAlerts = true;
        let roomsGridHtml = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">`;
        
        Object.entries(roomOverdueCounts).forEach(([room, count]) => {
            if (count > 0) {
                const icon = roomIconsMap[room] || '📦';
                roomsGridHtml += `
                    <div onclick="filterHomeByRoom('${room}')" class="relative bg-[#1e1f20] p-4 rounded-[24px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center">
                        <div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                            ${count}
                        </div>
                        <div class="text-3xl mb-2 opacity-80">${icon}</div>
                        <h3 class="text-xs font-medium text-neutral-200">${room}</h3>
                    </div>
                `;
            }
        });
        roomsGridHtml += `</div>`;

        overviewHtml += `
            <div class="mb-2 mt-4">
                <h2 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-3 pl-1">Dom: Przeterminowane zadania</h2>
                ${roomsGridHtml}
            </div>
        `;
    }

    if (!hasAnyAlerts) {
        overviewHtml = `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="text-5xl mb-4 opacity-80">☕</div>
                <h3 class="text-lg font-medium text-neutral-200">Wszystko pod kontrolą!</h3>
                <p class="text-sm text-neutral-500 mt-1">Żadnych zaległych zadań ani aktywnie chorujących domowników.</p>
            </div>
        `;
    }

    listEl.innerHTML = overviewHtml;

    // WYZWALANIE POWIADOMIENIA SYSTEMOWEGO
    triggerLocalNotification(totalAlertsCount);
}

// Funkcja wysyłająca powiadomienie
function triggerLocalNotification(alertsCount) {
    if (!("Notification" in window) || Notification.permission !== "granted" || alertsCount === 0) return;

    const todayStr = new Date().toDateString();
    const lastNotified = localStorage.getItem('homevibe_last_notified');

    // Wysyłamy tylko jeśli dzisiaj jeszcze nie wysyłaliśmy powiadomienia
    if (lastNotified !== todayStr) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('HomeVibe: Masz zaległości!', {
                body: `Masz ${alertsCount} zadań, które wymagają Twojej uwagi. Czas się z nimi rozprawić! 💪`,
                icon: '/icon.png',
                vibrate: [200, 100, 200]
            });
            localStorage.setItem('homevibe_last_notified', todayStr);
        });
    }
}
