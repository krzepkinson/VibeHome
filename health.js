// ==========================================
// LOGIKA: ZDROWIE & PROFILE (health.js)
// ==========================================

console.log("Health module loaded (Color-blind friendly & Zoom Out)");

let profiles = [];
let currentProfileId = null;
let healthTasks = [];
let healthLogs = [];
let currentSettingsHealthTaskId = null;

// Konfiguracja Kalendarza
let currentCalDate = new Date();
let calendarMode = 'month'; // 'month' lub 'year'
const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

async function loadProfiles() {
    const list = document.getElementById('profiles-list');
    const { data, error } = await supabaseClient.from('profiles').select('*').order('name');
    
    if (error) {
        list.innerHTML = `<p class="col-span-2 text-center text-red-400 py-10">Błąd połączenia z bazą.</p>`; return;
    }

    profiles = data || [];

    if (profiles.length === 0) {
        list.innerHTML = `<p class="col-span-2 text-center text-slate-400 py-10">Brak profili. Dodaj domownika.</p>`; return;
    }

    list.innerHTML = profiles.map(p => `
        <button onclick="openProfile(${p.id}, '${encodeURIComponent(p.name)}')" class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform hover:border-slate-300">
            <div class="w-14 h-14 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center text-2xl font-bold">${p.name.charAt(0).toUpperCase()}</div>
            <span class="font-bold text-slate-700">${p.name}</span>
        </button>
    `).join('');
}

function openNewProfileModal() { document.getElementById('new-profile-modal').classList.remove('hidden'); }
function closeNewProfileModal() { document.getElementById('new-profile-modal').classList.add('hidden'); }

async function saveNewProfile() {
    const name = document.getElementById('new-profile-name').value.trim();
    if (!name) return;
    await supabaseClient.from('profiles').insert([{ name }]);
    closeNewProfileModal(); loadProfiles();
}

function openProfile(id, encodedName) {
    currentProfileId = id;
    document.getElementById('profile-name-title').innerText = decodeURIComponent(encodedName);
    currentCalDate = new Date();
    calendarMode = 'month';
    switchView('profile');
}

// === KALENDARZ LOGIKA ===

function toggleCalendarMode() {
    calendarMode = calendarMode === 'month' ? 'year' : 'month';
    renderCalendar();
}

function changeCalendarMonth(offset) {
    if (calendarMode === 'month') {
        currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    } else {
        currentCalDate.setFullYear(currentCalDate.getFullYear() + offset);
    }
    renderCalendar();
}

function zoomToMonth(monthIndex) {
    currentCalDate.setMonth(monthIndex);
    calendarMode = 'month';
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const titleEl = document.getElementById('calendar-title');
    const prevBtn = document.getElementById('cal-prev-btn');
    const nextBtn = document.getElementById('cal-next-btn');

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    if (calendarMode === 'month') {
        titleEl.innerHTML = `${monthNames[month]} ${year} <span class="text-xs text-slate-400">🔍</span>`;
        prevBtn.classList.remove('invisible');
        nextBtn.classList.remove('invisible');
        renderMonthlyView(container, year, month);
    } else {
        titleEl.innerHTML = `Rok ${year} <span class="text-xs text-slate-400">🔍</span>`;
        renderYearlyView(container, year);
    }
}

// --- WIDOK MIESIĄCA ---
function renderMonthlyView(container, year, month) {
    let html = `
        <div class="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
            <div>Pn</div><div>Wt</div><div>Śr</div><div>Cz</div><div>Pt</div><div>Sb</div><div>Nd</div>
        </div>
        <div class="grid grid-cols-7 gap-1">
    `;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let startOffset = firstDay - 1;
    if (startOffset === -1) startOffset = 6;

    for (let i = 0; i < startOffset; i++) {
        html += `<div></div>`;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = new Date(year, month, day);
        currentDay.setHours(0,0,0,0);
        
        let activeTaskIds = new Set();

        healthLogs.forEach(log => {
            const s = new Date(log.start_date); s.setHours(0,0,0,0);
            let e = log.end_date ? new Date(log.end_date) : today; e.setHours(0,0,0,0);
            if (currentDay >= s && currentDay <= e) activeTaskIds.add(log.health_task_id);
        });

        const isToday = currentDay.getTime() === today.getTime();
        const hasEvents = activeTaskIds.size > 0;

        // BARDZIEJ DOSTĘPNY STYL (Brak polegania na kolorze tęczy)
        let cellClass = "flex flex-col items-center justify-center py-2 rounded-xl text-sm transition-all duration-200 ";
        
        if (hasEvents) {
            // Dzień z chorobą/zdarzeniem: Wyraźne szare tło, pogrubienie
            cellClass += "bg-slate-300 text-slate-900 font-bold cursor-pointer active:scale-95 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]";
        } else {
            // Zwykły dzień
            cellClass += "text-slate-600 bg-slate-50";
        }

        // Dzisiejszy dzień zawsze zyskuje obramowanie i wyróżniony tekst
        if (isToday) {
            cellClass += " border-2 border-slate-800 font-black";
        } else if (!hasEvents) {
            cellClass += " border border-transparent";
        }

        const onClickEvent = hasEvents ? `onclick="openDayDetails('${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}')"` : '';

        html += `
            <div ${onClickEvent} class="${cellClass} min-h-[44px]">
                ${day}
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// --- WIDOK ROKU (Zoom Out Heatmapa) ---
function renderYearlyView(container, year) {
    let html = `<div class="grid grid-cols-3 gap-3">`;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let m = 0; m < 12; m++) {
        html += `
            <div onclick="zoomToMonth(${m})" class="bg-slate-50 p-2 rounded-xl cursor-pointer active:scale-95 transition-transform hover:bg-slate-100 border border-slate-100">
                <h4 class="text-[9px] font-bold text-center text-slate-500 uppercase tracking-widest mb-1">${monthNames[m].substring(0,3)}</h4>
                <div class="grid grid-cols-7 gap-[2px]">
        `;

        const daysInMonth = new Date(year, m + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDay = new Date(year, m, day);
            currentDay.setHours(0,0,0,0);
            
            let hasEvents = false;
            healthLogs.forEach(log => {
                const s = new Date(log.start_date); s.setHours(0,0,0,0);
                let e = log.end_date ? new Date(log.end_date) : today; e.setHours(0,0,0,0);
                if (currentDay >= s && currentDay <= e) hasEvents = true;
            });

            // Mikro kwadraciki
            const bgClass = hasEvents ? "bg-slate-400" : "bg-white border border-slate-200";
            html += `<div class="aspect-square rounded-[2px] ${bgClass}"></div>`;
        }
        
        html += `</div></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// --- SZCZEGÓŁY DNIA ---
function openDayDetails(dateString) {
    const targetDate = new Date(dateString);
    targetDate.setHours(0,0,0,0);

    let activeEvents = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    healthLogs.forEach(log => {
        const s = new Date(log.start_date); s.setHours(0,0,0,0);
        let e = log.end_date ? new Date(log.end_date) : today; e.setHours(0,0,0,0);
        
        if (targetDate >= s && targetDate <= e) {
            const task = healthTasks.find(t => t.id === log.health_task_id);
            if(task) activeEvents.push({ task, log });
        }
    });

    const listEl = document.getElementById('day-details-list');
    document.getElementById('day-details-date').innerText = targetDate.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    listEl.innerHTML = activeEvents.map(ev => {
        const isDuration = ev.task.task_type === 'duration';
        const icon = isDuration ? '⏱️' : '🔄';
        return `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 class="font-bold text-slate-800 flex items-center gap-2 mb-1">
                    <span>${icon}</span> ${ev.task.name}
                </h4>
                ${ev.log.notes ? `<p class="text-sm text-slate-600 mt-2 bg-white p-2 rounded border border-slate-100">${ev.log.notes}</p>` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('day-details-modal').classList.remove('hidden');
}

function closeDayDetailsModal() {
    document.getElementById('day-details-modal').classList.add('hidden');
}

async function loadProfileDashboard() {
    const list = document.getElementById('health-tasks-list');
    
    const [tasksRes, logsRes] = await Promise.all([
        supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId),
        supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false })
    ]);
    
    healthTasks = tasksRes.data || [];
    healthLogs = logsRes.data || [];

    renderCalendar();

    if (healthTasks.length === 0) {
        list.innerHTML = `<p class="text-center text-slate-400 py-10">Brak śledzonych zdarzeń. Kliknij + na górze.</p>`; return;
    }

    const enrichedTasks = healthTasks.map(task => {
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0];
        const isActive = task.task_type === 'duration' && latestLog && latestLog.end_date === null;
        return { task, latestLog, isActive };
    }).sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.task.name.localeCompare(b.task.name);
    });

    list.innerHTML = enrichedTasks.map(({task, latestLog, isActive}) => {
        const isCyclical = task.task_type === 'cyclical';
        let uiState = {};

        if (isCyclical) {
            uiState.icon = '🔄';
            uiState.statusColor = 'text-slate-500';
            uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Nigdy nie wykonano';
            uiState.button = `<button onclick="logHealthAction(${task.id})" class="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold text-2xl flex items-center justify-center pb-1 active:scale-90">+</button>`;
            uiState.bgColor = 'bg-white';
        } else {
            uiState.icon = '⏱️';
            if (isActive) {
                const daysOngoing = Math.floor((new Date() - new Date(latestLog.start_date)) / 86400000);
                uiState.statusColor = 'text-slate-800 font-bold';
                uiState.statusText = `Aktywne: Trwa od ${daysOngoing === 0 ? 'dzisiaj' : daysOngoing + ' dni'}`;
                uiState.bgColor = 'bg-slate-200 border-slate-300';
                uiState.button = `<button onclick="stopDurationTask(${latestLog.id})" class="w-10 h-10 rounded-full bg-slate-800 text-white font-bold text-xl flex items-center justify-center active:scale-90">■</button>`;
            } else {
                uiState.statusColor = 'text-slate-500';
                uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Brak historii';
                uiState.bgColor = 'bg-white';
                uiState.button = `<button onclick="startDurationTask(${task.id})" class="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold text-2xl flex items-center justify-center pb-1 active:scale-90">+</button>`;
            }
        }

        return `
            <div class="flex items-center justify-between p-4 ${uiState.bgColor} rounded-2xl shadow-sm border border-slate-100 transition-colors">
                <div class="flex-1 pr-4">
                    <h3 class="font-bold text-slate-800 text-base leading-tight flex items-center gap-2">
                        <span>${uiState.icon}</span> ${task.name}
                    </h3>
                    <p class="text-[12px] ${uiState.statusColor} mt-1 flex items-center gap-1">
                        ${uiState.statusText}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    ${uiState.button}
                    <button onclick="openHealthSettingsScreen(${task.id})" class="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center active:scale-90 transition-transform">⚙️</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- AKCJE ZDROWOTNE ---
async function logHealthAction(taskId) {
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today, end_date: today }]);
    showToast('Zapisano!');
    loadProfileDashboard();
}

async function startDurationTask(taskId) {
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today }]);
    showToast('Stan rozpoczęty.');
    loadProfileDashboard();
}

async function stopDurationTask(logId) {
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').update({ end_date: today }).eq('id', logId);
    showToast('Stan zakończony.');
    loadProfileDashboard();
}

function openNewHealthTaskModal() {
    document.getElementById('h-task-name').value = '';
    document.getElementById('h-task-type').value = 'cyclical';
    document.getElementById('h-task-interval').value = '';
    toggleHealthInterval();
    document.getElementById('new-health-task-modal').classList.remove('hidden');
}

function closeNewHealthTaskModal() { document.getElementById('new-health-task-modal').classList.add('hidden'); }

function toggleHealthInterval() {
    const type = document.getElementById('h-task-type').value;
    const container = document.getElementById('h-task-interval-container');
    if (type === 'duration') container.classList.add('hidden');
    else container.classList.remove('hidden');
}

async function saveNewHealthTask() {
    const name = document.getElementById('h-task-name').value.trim();
    const type = document.getElementById('h-task-type').value;
    const interval = document.getElementById('h-task-interval').value;
    
    if (!name) return;
    
    await supabaseClient.from('health_tasks').insert([{ 
        profile_id: currentProfileId, 
        name: name, 
        task_type: type, 
        interval_days: type === 'cyclical' ? (parseInt(interval) || 0) : 0
    }]);
    
    closeNewHealthTaskModal(); loadProfileDashboard();
}

// --- USTAWIENIA I EDYCJA ---
function openHealthSettingsScreen(taskId) {
    currentSettingsHealthTaskId = taskId;
    const task = healthTasks.find(t => t.id === taskId);
    
    document.getElementById('h-settings-title').innerText = task.name;
    document.getElementById('set-h-task-name').value = task.name;
    
    const intervalContainer = document.getElementById('set-h-task-interval-container');
    if (task.task_type === 'cyclical') {
        intervalContainer.classList.remove('hidden');
        document.getElementById('set-h-task-interval').value = task.interval_days;
    } else {
        intervalContainer.classList.add('hidden');
    }

    renderHealthHistory();
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('health-settings-screen').classList.remove('hidden');
}

function closeHealthSettingsScreen() {
    document.getElementById('health-settings-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    loadProfileDashboard();
}

async function saveHealthTaskSettings() {
    const name = document.getElementById('set-h-task-name').value.trim();
    const interval = parseInt(document.getElementById('set-h-task-interval').value) || 0;
    
    if (!name) return;
    const task = healthTasks.find(t => t.id === currentSettingsHealthTaskId);
    let updateData = { name: name };
    if (task.task_type === 'cyclical') updateData.interval_days = interval;

    await supabaseClient.from('health_tasks').update(updateData).eq('id', currentSettingsHealthTaskId);
    showToast('Zapisano zmiany');
    
    const res = await supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId);
    healthTasks = res.data;
    document.getElementById('h-settings-title').innerText = name;
}

async function deleteHealthTask() {
    if(!confirm("Trwale usunąć to zdarzenie z profilu?")) return;
    await supabaseClient.from('health_tasks').delete().eq('id', currentSettingsHealthTaskId);
    closeHealthSettingsScreen();
}

function renderHealthHistory() {
    const task = healthTasks.find(t => t.id === currentSettingsHealthTaskId);
    const logs = healthLogs.filter(l => l.health_task_id === currentSettingsHealthTaskId);
    const container = document.getElementById('h-settings-history-list');

    container.innerHTML = logs.map(l => {
        const startDate = new Date(l.start_date).toLocaleDateString('pl-PL');
        let dateText = startDate;
        
        if (task.task_type === 'duration') {
            const endDate = l.end_date ? new Date(l.end_date).toLocaleDateString('pl-PL') : 'Trwa';
            dateText = `<span class="text-xs text-slate-400">Od:</span> ${startDate} <span class="text-xs text-slate-400 ml-1">Do:</span> ${endDate}`;
        }

        const encodedNotes = encodeURIComponent(l.notes || '');
        const safeStart = l.start_date;
        const safeEnd = l.end_date || 'null';

        return `
            <div class="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100 mb-2">
                <div>
                    <p class="text-sm font-bold text-slate-700">${dateText}</p>
                    ${l.notes ? `<p class="text-[11px] text-slate-500 mt-0.5">${l.notes}</p>` : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="openEditHealthLogModal(${l.id}, '${safeStart}', '${safeEnd}', '${encodedNotes}', '${task.task_type}')" class="w-8 h-8 rounded hover:bg-slate-200">✏️</button>
                    <button onclick="deleteHealthLog(${l.id})" class="w-8 h-8 rounded hover:bg-red-100">🗑️</button>
                </div>
            </div>`;
    }).join('') || '<p class="text-center py-4 text-slate-400 text-sm">Brak wpisów w historii.</p>';
}

function openEditHealthLogModal(id, startDate, endDate, encodedNotes, taskType) {
    document.getElementById('edit-hlog-id').value = id;
    document.getElementById('edit-hlog-start').value = startDate ? startDate.split('T')[0] : '';

    const endInput = document.getElementById('edit-hlog-end');
    const endContainer = document.getElementById('edit-hlog-end-container');
    
    if (taskType === 'duration') {
        endContainer.classList.remove('hidden');
        endInput.value = (endDate !== 'null') ? endDate.split('T')[0] : '';
    } else {
        endContainer.classList.add('hidden');
        endInput.value = '';
    }

    document.getElementById('edit-hlog-notes').value = decodeURIComponent(encodedNotes);
    document.getElementById('edit-health-log-modal').classList.remove('hidden');
}

function closeEditHealthLogModal() { document.getElementById('edit-health-log-modal').classList.add('hidden'); }

async function saveEditHealthLog() {
    const id = document.getElementById('edit-hlog-id').value;
    const start = document.getElementById('edit-hlog-start').value;
    const endRaw = document.getElementById('edit-hlog-end').value;
    const notes = document.getElementById('edit-hlog-notes').value;

    let updateData = {
        start_date: `${start}T12:00:00.000Z`,
        notes: notes || null
    };

    if (!document.getElementById('edit-hlog-end-container').classList.contains('hidden')) {
        updateData.end_date = endRaw ? `${endRaw}T12:00:00.000Z` : null;
    } else {
        updateData.end_date = updateData.start_date;
    }

    await supabaseClient.from('health_logs').update(updateData).eq('id', id);
    closeEditHealthLogModal(); 
    
    const res = await supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false });
    healthLogs = res.data || []; 
    renderHealthHistory();
}

async function deleteHealthLog(id) {
    if(!confirm("Usunąć ten wpis z historii?")) return;
    await supabaseClient.from('health_logs').delete().eq('id', id);
    const res = await supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false });
    healthLogs = res.data || []; 
    renderHealthHistory();
}
