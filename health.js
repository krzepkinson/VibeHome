// ==========================================
// LOGIKA: ZDROWIE (health.js)
// ==========================================

let healthProfiles = [];
let healthTasks = [];
let healthLogs = [];
let currentProfileId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarViewMode = 'month'; 

async function initHealthModule() {
    const uid = window.currentUser.id;
    const { data: pData } = await supabaseClient.from('profiles').select('*').eq('user_id', uid).order('name');
    healthProfiles = pData || [];
    
    if (healthProfiles.length > 0 && !currentProfileId) {
        currentProfileId = healthProfiles[0].id;
    }
    
    if (currentProfileId) {
        await refreshHealthData();
    }
    renderHealthUI();
}

async function refreshHealthData() {
    if (!currentProfileId) return;
    const uid = window.currentUser.id;
    
    const [tRes, lRes] = await Promise.all([
        supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId).eq('user_id', uid),
        supabaseClient.from('health_logs').select('*').eq('user_id', uid).order('start_date', { ascending: false })
    ]);
    
    healthTasks = tRes.data || [];
    healthLogs = lRes.data || [];
}

function renderHealthUI() {
    const profile = healthProfiles.find(p => p.id === currentProfileId);
    const headerAvatar = document.getElementById('health-header-avatar');
    const nameTitle = document.getElementById('profile-name-title');

    if (profile) {
        nameTitle.innerText = profile.name;
        headerAvatar.innerText = profile.name.charAt(0).toUpperCase();
        // Dynamiczny kolor avatara
        const colors = ['bg-rose-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'];
        headerAvatar.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white transition-transform active:scale-90 ${colors[profile.id % colors.length]}`;
    } else {
        nameTitle.innerText = "Brak profilu";
        headerAvatar.innerText = "?";
    }

    renderCalendar();
    renderHealthTasks();
}

// --- KALENDARZ ---
function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const title = document.getElementById('calendar-title');
    const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    
    let html = '';
    if (calendarViewMode === 'month') {
        html = `<div class="grid grid-cols-7 gap-1 text-center mb-2">${['Pn','Wt','Śr','Czw','Pt','So','Nd'].map(d => `<div class="text-[9px] text-neutral-600 font-bold uppercase">${d}</div>`).join('')}</div>`;
        html += `<div class="grid grid-cols-7 gap-1">`;
        
        const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        for (let i = 0; i < firstDay; i++) html += `<div></div>`;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayLogs = healthLogs.filter(l => {
                const start = l.start_date.split('T')[0];
                const end = l.end_date ? l.end_date.split('T')[0] : new Date().toISOString().split('T')[0];
                return dateStr >= start && dateStr <= end;
            });
            
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const hasLogs = dayLogs.length > 0;
            
            html += `
                <div onclick="openDayDetails('${dateStr}')" class="aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${isToday ? 'bg-[#ffb4ab] text-[#3c1414] font-bold' : 'hover:bg-[#333537] text-neutral-300'}">
                    <span class="text-xs">${d}</span>
                    ${hasLogs ? `<div class="w-1 h-1 bg-rose-500 rounded-full mt-0.5"></div>` : ''}
                </div>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
}

function changeCalendarMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

function toggleCalendarMode() {
    // Na razie tylko widok miesiąca, ale tu można dodać widok roku
    showToast("Widok miesiąca");
}

// --- LISTA ZADAŃ (Leki/Objawy) ---
function renderHealthTasks() {
    const list = document.getElementById('health-tasks-list');
    if (healthTasks.length === 0) {
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak przypisanych leków lub objawów.</p>`;
        return;
    }

    list.innerHTML = healthTasks.map(task => {
        const activeLog = healthLogs.find(l => l.health_task_id === task.id && l.end_date === null);
        const isActionable = task.task_type === 'duration';

        return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-1">
                <div class="flex-1 cursor-pointer" onclick="openHealthSettingsScreen(${task.id})">
                    <h3 class="font-medium text-neutral-100 text-sm">${task.name}</h3>
                    <p class="text-[11px] text-neutral-500 mt-0.5">${task.task_type === 'cyclical' ? `Co ${task.interval_days} dni` : (activeLog ? '<span class="text-rose-400">W trakcie...</span>' : 'Brak aktywnych')}</p>
                </div>
                <div class="flex items-center gap-1.5">
                    ${activeLog 
                        ? `<button onclick="closeHealthLog(${activeLog.id})" class="px-3 py-2 rounded-full bg-rose-900/30 text-rose-300 text-[10px] font-bold uppercase tracking-wider">Zakończ</button>`
                        : `<button onclick="startHealthLog(${task.id}, '${task.task_type}')" class="w-10 h-10 rounded-full bg-[#3c1414] text-[#ffb4ab] font-medium text-lg flex items-center justify-center active:scale-90">+</button>`
                    }
                </div>
            </div>`;
    }).join('');
}

// --- AKCJE ---
async function startHealthLog(taskId, type) {
    const uid = window.currentUser.id;
    const now = new Date().toISOString();
    
    await supabaseClient.from('health_logs').insert([{
        health_task_id: taskId,
        start_date: now,
        end_date: type === 'cyclical' ? now : null,
        user_id: uid
    }]);
    
    showToast(type === 'cyclical' ? "Zapisano przyjęcie" : "Rozpoczęto śledzenie");
    await refreshHealthData();
    renderHealthUI();
    if(typeof loadDashboardOverview === 'function') loadDashboardOverview();
}

async function closeHealthLog(logId) {
    await supabaseClient.from('health_logs').update({ 
        end_date: new Date().toISOString() 
    }).eq('id', logId).eq('user_id', window.currentUser.id);
    
    showToast("Zakończono");
    await refreshHealthData();
    renderHealthUI();
    if(typeof loadDashboardOverview === 'function') loadDashboardOverview();
}

// --- MODALE I USTAWIENIA ZDROWIA ---
function openNewHealthTaskModal() {
    document.getElementById('h-task-name').value = '';
    document.getElementById('new-health-task-modal').classList.remove('hidden');
}
function closeNewHealthTaskModal() { document.getElementById('new-health-task-modal').classList.add('hidden'); }

function toggleHealthInterval() {
    const type = document.getElementById('h-task-type').value;
    document.getElementById('h-task-interval-container').classList.toggle('hidden', type !== 'cyclical');
}

async function saveNewHealthTask() {
    const n = document.getElementById('h-task-name').value.trim();
    const type = document.getElementById('h-task-type').value;
    const interval = parseInt(document.getElementById('h-task-interval').value) || 0;
    if (!n || !currentProfileId) return;

    await supabaseClient.from('health_tasks').insert([{ 
        profile_id: currentProfileId, 
        name: n, 
        task_type: type, 
        interval_days: type === 'cyclical' ? interval : 0,
        user_id: window.currentUser.id 
    }]);
    closeNewHealthTaskModal();
    initHealthModule();
}

let currentHealthSettingsId = null;
async function openHealthSettingsScreen(taskId) {
    currentHealthSettingsId = taskId;
    const task = healthTasks.find(t => t.id === taskId);
    document.getElementById('h-settings-title').innerText = task.name;
    document.getElementById('set-h-task-name').value = task.name;
    document.getElementById('set-h-task-interval').value = task.interval_days;
    document.getElementById('set-h-task-interval-container').classList.toggle('hidden', task.task_type !== 'cyclical');
    
    renderHealthHistory();
    goForward('health-settings-screen');
}

function closeHealthSettingsScreen() { goBack(); }

function renderHealthHistory() {
    const logs = healthLogs.filter(l => l.health_task_id === currentHealthSettingsId);
    document.getElementById('h-settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] p-3 rounded-[16px] flex justify-between items-center border border-[#333537] mb-2">
            <div>
                <p class="text-xs font-medium text-neutral-200">${new Date(l.start_date).toLocaleDateString('pl-PL')}</p>
                <p class="text-[10px] text-neutral-500">${l.end_date ? 'do ' + new Date(l.end_date).toLocaleDateString('pl-PL') : 'trwa'}</p>
            </div>
            <button onclick="deleteHealthLog(${l.id})" class="text-neutral-500 text-sm">🗑️</button>
        </div>`).join('') || '<p class="text-center py-4 text-neutral-500 text-xs">Brak wpisów.</p>';
}

async function deleteHealthLog(id) {
    if(!confirm("Usunąć ten wpis?")) return;
    await supabaseClient.from('health_logs').delete().eq('id', id).eq('user_id', window.currentUser.id);
    await refreshHealthData();
    renderHealthHistory();
    renderHealthUI();
}

async function deleteHealthTask() {
    if(!confirm("Usunąć całą kartę tego leku/objawu wraz z historią?")) return;
    await supabaseClient.from('health_tasks').delete().eq('id', currentHealthSettingsId).eq('user_id', window.currentUser.id);
    closeHealthSettingsScreen();
    initHealthModule();
}

// --- SZCZEGÓŁY DNIA ---
function openDayDetails(dateStr) {
    const modal = document.getElementById('day-details-modal');
    const list = document.getElementById('day-details-list');
    document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const dayLogs = healthLogs.filter(l => {
        const start = l.start_date.split('T')[0];
        const end = l.end_date ? l.end_date.split('T')[0] : new Date().toISOString().split('T')[0];
        return dateStr >= start && dateStr <= end;
    });

    if (dayLogs.length === 0) {
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zdarzeń w tym dniu.</p>`;
    } else {
        list.innerHTML = dayLogs.map(l => {
            const task = healthTasks.find(t => t.id === l.health_task_id) || { name: 'Usunięte zadanie' };
            return `
                <div class="p-3 bg-[#131314] rounded-xl border border-[#333537]">
                    <p class="text-sm font-medium text-neutral-200">${task.name}</p>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${l.end_date ? 'Zdarzenie zakończone' : 'W trakcie...'}</p>
                </div>`;
        }).join('');
    }
    modal.classList.remove('hidden');
}

function closeDayDetailsModal() { document.getElementById('day-details-modal').classList.add('hidden'); }

// Przełącznik profili (avatar w rogu)
function toggleProfileSwitcher() {
    const modal = document.getElementById('profile-switcher-modal');
    const list = document.getElementById('switcher-profiles-list');
    
    list.innerHTML = healthProfiles.map(p => `
        <div onclick="selectHealthProfile(${p.id})" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-[#333537] ${p.id === currentProfileId ? 'bg-[#333537] border border-[#a8c7fa]' : ''}">
            <div class="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-xs font-bold">${p.name.charAt(0).toUpperCase()}</div>
            <span class="text-sm text-neutral-200">${p.name}</span>
        </div>
    `).join('');
    modal.classList.remove('hidden');
}

function selectHealthProfile(id) {
    currentProfileId = id;
    document.getElementById('profile-switcher-modal').classList.add('hidden');
    initHealthModule();
}

function closeProfileSwitcher() { document.getElementById('profile-switcher-modal').classList.add('hidden'); }
