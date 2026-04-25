// ==========================================
// LOGIKA: ZDROWIE & PROFILE (health.js)
// ==========================================

console.log("Health module loaded (Auto-load & Avatar Menu)");

let profiles = [];
let currentProfileId = null;
let healthTasks = [];
let healthLogs = [];
let currentSettingsHealthTaskId = null;

let currentCalDate = new Date();
let calendarMode = 'month'; 
const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function getDurationText(startDateStr) {
    const start = new Date(startDateStr); start.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - start) / 86400000);
    if (diffDays === 0) return "od dzisiaj";
    if (diffDays === 1) return "od wczoraj";
    if (diffDays === 2) return "od przedwczoraj";
    return `od ${diffDays} dni`;
}

// --- INICJALIZACJA ZDROWIA ---
async function initHealthModule() {
    const { data, error } = await supabaseClient.from('profiles').select('*').order('name');
    profiles = data || [];

    if (profiles.length === 0) {
        // Brak profili - wymuszamy dodanie pierwszego
        document.getElementById('health-tasks-list').innerHTML = `<p class="text-center text-neutral-500 py-10">Brak profili. Najpierw dodaj domownika klikając awatar w prawym górnym rogu.</p>`;
        document.getElementById('health-header-avatar').innerText = "?";
        document.getElementById('profile-name-title').innerText = "Witaj!";
        return;
    }

    // Szukamy zapisanego w pamięci telefonu profilu
    const savedId = localStorage.getItem('homevibe_last_profile');
    let targetProfile = profiles.find(p => p.id == savedId);
    
    // Jeśli nie ma zapisanego, bierzemy pierwszego z brzegu
    if (!targetProfile) targetProfile = profiles[0];

    loadProfileData(targetProfile);
}

function loadProfileData(profile) {
    currentProfileId = profile.id;
    localStorage.setItem('homevibe_last_profile', profile.id); // Zapamiętujemy na przyszłość
    
    document.getElementById('profile-name-title').innerText = profile.name;
    
    // Ustawiamy inicjał w prawym górnym rogu (Później podepniemy tu zdjęcie)
    const initial = profile.name.charAt(0).toUpperCase();
    document.getElementById('health-header-avatar').innerText = initial;
    
    currentCalDate = new Date();
    calendarMode = 'month';
    loadProfileDashboard();
}

// --- MENU AWATARA (SWITCHER) ---
function toggleProfileSwitcher() {
    const modal = document.getElementById('profile-switcher-modal');
    if (modal.classList.contains('hidden')) {
        renderProfileSwitcherList();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function closeProfileSwitcher() {
    document.getElementById('profile-switcher-modal').classList.add('hidden');
}

function renderProfileSwitcherList() {
    const listEl = document.getElementById('switcher-profiles-list');
    
    listEl.innerHTML = profiles.map(p => {
        const isActive = p.id === currentProfileId;
        const bgClass = isActive ? 'bg-[#333537]' : 'bg-[#131314]';
        
        return `
            <button onclick="switchActiveProfile(${p.id})" class="w-full flex items-center gap-3 p-3 rounded-[20px] ${bgClass} border border-[#333537] active:scale-95 transition-all">
                <div class="w-10 h-10 rounded-full bg-[#444746] text-neutral-200 flex items-center justify-center font-bold">${p.name.charAt(0).toUpperCase()}</div>
                <span class="font-medium text-neutral-200">${p.name}</span>
                ${isActive ? '<span class="ml-auto text-[#a8c7fa]">✓</span>' : ''}
            </button>
        `;
    }).join('');
}

function switchActiveProfile(id) {
    closeProfileSwitcher();
    const profile = profiles.find(p => p.id === id);
    if (profile) loadProfileData(profile);
}

// --- DODAWANIE PROFILU ---
function openNewProfileModal() { 
    closeProfileSwitcher();
    document.getElementById('new-profile-modal').classList.remove('hidden'); 
}
function closeNewProfileModal() { document.getElementById('new-profile-modal').classList.add('hidden'); }

async function saveNewProfile() {
    const name = document.getElementById('new-profile-name').value.trim();
    if (!name) return;
    
    const { data } = await supabaseClient.from('profiles').insert([{ name }]).select();
    closeNewProfileModal(); 
    
    if (data && data.length > 0) {
        // Jeśli dodaliśmy z sukcesem, od razu przełączamy na nową osobę
        const { data: refreshedData } = await supabaseClient.from('profiles').select('*').order('name');
        profiles = refreshedData || [];
        const newProfile = profiles.find(p => p.id === data[0].id);
        if (newProfile) loadProfileData(newProfile);
    }
}

// --- KALENDARZ LOGIKA (Pozostaje bez zmian funkcjonalnych) ---
function toggleCalendarMode() { calendarMode = calendarMode === 'month' ? 'year' : 'month'; renderCalendar(); }
function changeCalendarMonth(offset) { if (calendarMode === 'month') { currentCalDate.setMonth(currentCalDate.getMonth() + offset); } else { currentCalDate.setFullYear(currentCalDate.getFullYear() + offset); } renderCalendar(); }
function zoomToMonth(monthIndex) { currentCalDate.setMonth(monthIndex); calendarMode = 'month'; renderCalendar(); }

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const titleEl = document.getElementById('calendar-title');
    const prevBtn = document.getElementById('cal-prev-btn');
    const nextBtn = document.getElementById('cal-next-btn');

    if (!container || !titleEl) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    if (calendarMode === 'month') {
        titleEl.innerHTML = `${monthNames[month]} ${year} <span class="text-[10px] text-neutral-500">🔍</span>`;
        if (prevBtn) prevBtn.classList.remove('invisible');
        if (nextBtn) nextBtn.classList.remove('invisible');
        renderMonthlyView(container, year, month);
    } else {
        titleEl.innerHTML = `Rok ${year} <span class="text-[10px] text-neutral-500">🔍</span>`;
        if (prevBtn) prevBtn.classList.add('invisible');
        if (nextBtn) nextBtn.classList.add('invisible');
        renderYearlyView(container, year);
    }
}

function renderMonthlyView(container, year, month) {
    let html = `<div class="grid grid-cols-7 text-center text-[9px] font-medium text-neutral-500 uppercase tracking-widest mb-3"><div>Pn</div><div>Wt</div><div>Śr</div><div>Cz</div><div>Pt</div><div>Sb</div><div>Nd</div></div><div class="grid grid-cols-7 gap-1">`;
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startOffset = firstDay - 1; if (startOffset === -1) startOffset = 6;
    for (let i = 0; i < startOffset; i++) { html += `<div></div>`; }
    const today = new Date(); today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = new Date(year, month, day); currentDay.setHours(0,0,0,0);
        let hasEvents = false;
        healthLogs.forEach(log => {
            const s = new Date(log.start_date); s.setHours(0,0,0,0);
            let e = log.end_date ? new Date(log.end_date) : today; e.setHours(0,0,0,0);
            if (currentDay >= s && currentDay <= e) hasEvents = true;
        });

        const isToday = currentDay.getTime() === today.getTime();
        let cellClass = "flex items-center justify-center aspect-square rounded-full text-xs transition-all duration-200 mx-auto w-8 h-8 ";
        if (hasEvents) { cellClass += "bg-[#444746] text-neutral-100 cursor-pointer active:scale-90 font-medium"; } else { cellClass += "text-neutral-400 bg-transparent"; }
        if (isToday) { cellClass += " border border-neutral-300 text-neutral-100 font-medium"; if (!hasEvents) cellClass += " bg-[#333537]"; }

        const onClickEvent = hasEvents ? `onclick="openDayDetails('${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}')"` : '';
        html += `<div class="flex justify-center items-center"><div ${onClickEvent} class="${cellClass}">${day}</div></div>`;
    }
    html += `</div>`; container.innerHTML = html;
}

function renderYearlyView(container, year) {
    let html = `<div class="grid grid-cols-3 gap-3">`;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let m = 0; m < 12; m++) {
        html += `<div onclick="zoomToMonth(${m})" class="bg-[#131314] p-2 rounded-2xl cursor-pointer active:scale-95 transition-transform border border-[#333537]"><h4 class="text-[8px] font-medium text-center text-neutral-500 uppercase tracking-widest mb-1.5">${monthNames[m].substring(0,3)}</h4><div class="grid grid-cols-7 gap-[2px]">`;
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDay = new Date(year, m, day); currentDay.setHours(0,0,0,0);
            let hasEvents = false;
            healthLogs.forEach(log => {
                const s = new Date(log.start_date); s.setHours(0,0,0,0);
                let e = log.end_date ? new Date(log.end_date) : today; e.setHours(0,0,0,0);
                if (currentDay >= s && currentDay <= e) hasEvents = true;
            });
            const bgClass = hasEvents ? "bg-[#a8c7fa]" : "bg-[#333537]";
            html += `<div class="aspect-square rounded-[2px] ${bgClass}"></div>`;
        }
        html += `</div></div>`;
    }
    html += `</div>`; container.innerHTML = html;
}

function openDayDetails(dateString) {
    const targetDate = new Date(dateString); targetDate.setHours(0,0,0,0);
    let activeEvents = []; const today = new Date(); today.setHours(0,0,0,0);
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
        const isDuration = ev.task.task_type === 'duration'; const icon = isDuration ? '⏱️' : '🔄';
        return `<div class="bg-[#131314] p-4 rounded-[20px] border border-[#333537] mb-2"><h4 class="font-medium text-neutral-200 text-sm flex items-center gap-2 mb-1"><span>${icon}</span> ${ev.task.name}</h4>${ev.log.notes ? `<p class="text-xs text-neutral-400 mt-2 bg-[#1e1f20] p-2 rounded-lg">${ev.log.notes}</p>` : ''}</div>`;
    }).join('');
    document.getElementById('day-details-modal').classList.remove('hidden');
}

function closeDayDetailsModal() { document.getElementById('day-details-modal').classList.add('hidden'); }

// --- DASHBOARD KOKPITU ---
async function loadProfileDashboard() {
    const list = document.getElementById('health-tasks-list');
    const [tasksRes, logsRes] = await Promise.all([
        supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId),
        supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false })
    ]);
    
    healthTasks = tasksRes.data || [];
    healthLogs = logsRes.data || [];

    renderCalendar();

    if (healthTasks.length === 0) { list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak śledzonych zdarzeń.</p>`; return; }

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
            uiState.statusColor = 'text-neutral-500';
            uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Nigdy nie wykonano';
            uiState.button = `<button onclick="logHealthAction(${task.id})" class="w-10 h-10 rounded-full bg-[#444746] text-neutral-200 font-medium text-lg flex items-center justify-center pb-0.5 active:scale-90 transition-transform">+</button>`;
            uiState.bgColor = 'bg-[#1e1f20]';
            uiState.borderColor = 'border-[#333537]';
        } else {
            uiState.icon = '⏱️';
            if (isActive) {
                uiState.statusColor = 'text-[#ffb4ab] font-medium';
                uiState.statusText = `Trwa ${getDurationText(latestLog.start_date)}`;
                uiState.bgColor = 'bg-[#3c1414]'; 
                uiState.borderColor = 'border-[#8c1d18]/30';
                uiState.button = `<button onclick="stopDurationTask(${latestLog.id})" class="w-10 h-10 rounded-full bg-[#ffb4ab] text-[#3c1414] font-bold text-sm flex items-center justify-center active:scale-90 transition-transform">■</button>`;
            } else {
                uiState.statusColor = 'text-neutral-500';
                uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Brak historii';
                uiState.bgColor = 'bg-[#1e1f20]';
                uiState.borderColor = 'border-[#333537]';
                uiState.button = `<button onclick="startDurationTask(${task.id})" class="w-10 h-10 rounded-full bg-[#444746] text-neutral-200 font-medium text-lg flex items-center justify-center pb-0.5 active:scale-90 transition-transform">+</button>`;
            }
        }

        return `
            <div class="flex items-center justify-between p-4 ${uiState.bgColor} rounded-[24px] border ${uiState.borderColor} mb-1 transition-colors">
                <div class="flex-1 pr-4">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center gap-2">${task.name}</h3>
                    <p class="text-[11px] ${uiState.statusColor} mt-0.5 flex items-center gap-1"><span>${uiState.icon}</span> ${uiState.statusText}</p>
                </div>
                <div class="flex items-center gap-1.5">
                    ${uiState.button}
                    <button onclick="openHealthSettingsScreen(${task.id})" class="w-10 h-10 rounded-full bg-[#333537]/50 text-neutral-400 flex items-center justify-center active:scale-90 transition-transform text-sm">⚙️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Reszta helperów dla Zdrowia
async function logHealthAction(taskId) { const today = new Date().toISOString(); await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today, end_date: today }]); showToast('Zapisano!'); loadProfileDashboard(); }
async function startDurationTask(taskId) { const today = new Date().toISOString(); await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today }]); showToast('Stan rozpoczęty.'); loadProfileDashboard(); }
async function stopDurationTask(logId) { const today = new Date().toISOString(); await supabaseClient.from('health_logs').update({ end_date: today }).eq('id', logId); showToast('Stan zakończony.'); loadProfileDashboard(); }

function openNewHealthTaskModal() { document.getElementById('h-task-name').value = ''; document.getElementById('h-task-type').value = 'cyclical'; document.getElementById('h-task-interval').value = ''; toggleHealthInterval(); document.getElementById('new-health-task-modal').classList.remove('hidden'); }
function closeNewHealthTaskModal() { document.getElementById('new-health-task-modal').classList.add('hidden'); }
function toggleHealthInterval() { const type = document.getElementById('h-task-type').value; const container = document.getElementById('h-task-interval-container'); if (type === 'duration') container.classList.add('hidden'); else container.classList.remove('hidden'); }
async function saveNewHealthTask() { const name = document.getElementById('h-task-name').value.trim(); const type = document.getElementById('h-task-type').value; const interval = document.getElementById('h-task-interval').value; if (!name) return; await supabaseClient.from('health_tasks').insert([{ profile_id: currentProfileId, name: name, task_type: type, interval_days: type === 'cyclical' ? (parseInt(interval) || 0) : 0 }]); closeNewHealthTaskModal(); loadProfileDashboard(); }

function openHealthSettingsScreen(taskId) { currentSettingsHealthTaskId = taskId; const task = healthTasks.find(t => t.id === taskId); document.getElementById('h-settings-title').innerText = task.name; document.getElementById('set-h-task-name').value = task.name; const intervalContainer = document.getElementById('set-h-task-interval-container'); if (task.task_type === 'cyclical') { intervalContainer.classList.remove('hidden'); document.getElementById('set-h-task-interval').value = task.interval_days; } else { intervalContainer.classList.add('hidden'); } renderHealthHistory(); goForward('health-settings-screen'); }
function closeHealthSettingsScreen() { goBack(); loadProfileDashboard(); }
async function saveHealthTaskSettings() { const name = document.getElementById('set-h-task-name').value.trim(); const interval = parseInt(document.getElementById('set-h-task-interval').value) || 0; if (!name) return; const task = healthTasks.find(t => t.id === currentSettingsHealthTaskId); let updateData = { name: name }; if (task.task_type === 'cyclical') updateData.interval_days = interval; await supabaseClient.from('health_tasks').update(updateData).eq('id', currentSettingsHealthTaskId); showToast('Zapisano zmiany'); const res = await supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId); healthTasks = res.data; document.getElementById('h-settings-title').innerText = name; }
async function deleteHealthTask() { if(!confirm("Trwale usunąć to zdarzenie z profilu?")) return; await supabaseClient.from('health_tasks').delete().eq('id', currentSettingsHealthTaskId); closeHealthSettingsScreen(); }

function renderHealthHistory() { const task = healthTasks.find(t => t.id === currentSettingsHealthTaskId); const logs = healthLogs.filter(l => l.health_task_id === currentSettingsHealthTaskId); const container = document.getElementById('h-settings-history-list'); container.innerHTML = logs.map(l => { const startDate = new Date(l.start_date).toLocaleDateString('pl-PL'); let dateText = startDate; if (task.task_type === 'duration') { const endDate = l.end_date ? new Date(l.end_date).toLocaleDateString('pl-PL') : 'Trwa'; dateText = `<span class="text-[9px] uppercase tracking-widest text-neutral-500">Od:</span> ${startDate} <span class="text-[9px] uppercase tracking-widest text-neutral-500 ml-1">Do:</span> ${endDate}`; } const encodedNotes = encodeURIComponent(l.notes || ''); const safeStart = l.start_date; const safeEnd = l.end_date || 'null'; return ` <div class="bg-[#131314] p-3 rounded-[16px] flex justify-between items-center border border-[#333537] mb-2"> <div> <p class="text-xs font-medium text-neutral-200">${dateText}</p> ${l.notes ? `<p class="text-[10px] text-neutral-400 mt-1">${l.notes}</p>` : ''} </div> <div class="flex gap-1"> <button onclick="openEditHealthLogModal(${l.id}, '${safeStart}', '${safeEnd}', '${encodedNotes}', '${task.task_type}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">✏️</button> <button onclick="deleteHealthLog(${l.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button> </div> </div>`; }).join('') || '<p class="text-center py-4 text-neutral-500 text-xs">Brak wpisów w historii.</p>'; }
function openEditHealthLogModal(id, startDate, endDate, encodedNotes, taskType) { document.getElementById('edit-hlog-id').value = id; document.getElementById('edit-hlog-start').value = startDate ? startDate.split('T')[0] : ''; const endInput = document.getElementById('edit-hlog-end'); const endContainer = document.getElementById('edit-hlog-end-container'); if (taskType === 'duration') { endContainer.classList.remove('hidden'); endInput.value = (endDate !== 'null') ? endDate.split('T')[0] : ''; } else { endContainer.classList.add('hidden'); endInput.value = ''; } document.getElementById('edit-hlog-notes').value = decodeURIComponent(encodedNotes); document.getElementById('edit-health-log-modal').classList.remove('hidden'); }
function closeEditHealthLogModal() { document.getElementById('edit-health-log-modal').classList.add('hidden'); }
async function saveEditHealthLog() { const id = document.getElementById('edit-hlog-id').value; const start = document.getElementById('edit-hlog-start').value; const endRaw = document.getElementById('edit-hlog-end').value; const notes = document.getElementById('edit-hlog-notes').value; let updateData = { start_date: `${start}T12:00:00.000Z`, notes: notes || null }; if (!document.getElementById('edit-hlog-end-container').classList.contains('hidden')) { updateData.end_date = endRaw ? `${endRaw}T12:00:00.000Z` : null; } else { updateData.end_date = updateData.start_date; } await supabaseClient.from('health_logs').update(updateData).eq('id', id); closeEditHealthLogModal(); const res = await supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false }); healthLogs = res.data || []; renderHealthHistory(); }
async function deleteHealthLog(id) { if(!confirm("Usunąć ten wpis z historii?")) return; await supabaseClient.from('health_logs').delete().eq('id', id); const res = await supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false }); healthLogs = res.data || []; renderHealthHistory(); }
