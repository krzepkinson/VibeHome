// ==========================================
// LOGIKA: ZDROWIE & PROFILE (health.js)
// ==========================================

let profiles = [];
let currentProfileId = null;
let healthTasks = [];
let healthLogs = [];

async function loadProfiles() {
    const list = document.getElementById('profiles-list');
    const { data } = await supabaseClient.from('profiles').select('*').order('name');
    profiles = data || [];

    if (profiles.length === 0) {
        list.innerHTML = `<p class="col-span-2 text-center text-slate-400 py-10">Brak profili. Dodaj domownika.</p>`; return;
    }

    list.innerHTML = profiles.map(p => `
        <button onclick="openProfile(${p.id}, '${encodeURIComponent(p.name)}')" class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform">
            <div class="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-2xl font-bold">${p.name.charAt(0).toUpperCase()}</div>
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
    switchView('profile');
}

async function loadProfileDashboard() {
    const list = document.getElementById('health-tasks-list');
    
    // Pobieramy zdarzenia dla profilu oraz WSZYSTKIE logi zdrowotne by wyliczyć statusy
    const [tasksRes, logsRes] = await Promise.all([
        supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId),
        supabaseClient.from('health_logs').select('*').order('start_date', { ascending: false })
    ]);
    
    healthTasks = tasksRes.data || [];
    healthLogs = logsRes.data || [];

    if (healthTasks.length === 0) {
        list.innerHTML = `<p class="text-center text-slate-400 py-10">Brak śledzonych zdarzeń. Kliknij + na górze.</p>`; return;
    }

    list.innerHTML = healthTasks.map(task => {
        const isCyclical = task.task_type === 'cyclical';
        const taskLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const latestLog = taskLogs[0]; // Ponieważ sortujemy malejąco
        
        let uiState = {};

        if (isCyclical) {
            // Logika dla szczoteczki, leków (podobnie jak w module domowym)
            uiState.icon = '🔄';
            uiState.statusColor = 'text-slate-400';
            uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Nigdy nie wykonano';
            uiState.button = `<button onclick="logHealthAction(${task.id})" class="w-10 h-10 rounded-full bg-rose-50 text-rose-500 font-bold text-2xl flex items-center justify-center pb-1 active:scale-90">+</button>`;
            uiState.bgColor = 'bg-white';
        } else {
            // Logika trwających zdarzeń (np. Katar)
            uiState.icon = '⏱️';
            const isActive = latestLog && latestLog.end_date === null;

            if (isActive) {
                const daysOngoing = Math.floor((new Date() - new Date(latestLog.start_date)) / 86400000);
                uiState.statusColor = 'text-amber-600 font-bold';
                uiState.statusText = `Aktywne: Trwa od ${daysOngoing === 0 ? 'dzisiaj' : daysOngoing + ' dni'}`;
                uiState.bgColor = 'bg-amber-50 border-amber-200';
                uiState.button = `<button onclick="stopDurationTask(${latestLog.id})" class="w-10 h-10 rounded-full bg-amber-200 text-amber-700 font-bold text-xl flex items-center justify-center active:scale-90">■</button>`;
            } else {
                uiState.statusColor = 'text-slate-400';
                uiState.statusText = latestLog ? `Ostatnio: ${getRelativeTime(latestLog.start_date)}` : 'Brak historii';
                uiState.bgColor = 'bg-white';
                uiState.button = `<button onclick="startDurationTask(${task.id})" class="w-10 h-10 rounded-full bg-rose-50 text-rose-500 font-bold text-2xl flex items-center justify-center pb-1 active:scale-90">+</button>`;
            }
        }

        return `
            <div class="flex items-center justify-between p-4 ${uiState.bgColor} rounded-2xl shadow-sm border border-slate-100 transition-colors">
                <div class="flex-1 pr-4">
                    <h3 class="font-bold text-slate-800 text-base leading-tight flex items-center gap-2">
                        <span>${uiState.icon}</span> ${task.name}
                    </h3>
                    <p class="text-[12px] ${uiState.statusColor} mt-1">${uiState.statusText}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${uiState.button}
                </div>
            </div>
        `;
    }).join('');
}

// Obsługa Zdarzeń Zdrowotnych (Klikanie przycisków)
async function logHealthAction(taskId) {
    // Proste logowanie dla cyklicznych
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today, end_date: today }]);
    showToast('Zapisano!');
    loadProfileDashboard();
}

async function startDurationTask(taskId) {
    // Zaczynamy katar (end_date jest null)
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: today }]);
    showToast('Stan rozpoczęty.');
    loadProfileDashboard();
}

async function stopDurationTask(logId) {
    // Kończymy katar
    const today = new Date().toISOString();
    await supabaseClient.from('health_logs').update({ end_date: today }).eq('id', logId);
    showToast('Stan zakończony.');
    loadProfileDashboard();
}

// Tworzenie nowych zadań
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
    
    closeNewHealthTaskModal(); 
    loadProfileDashboard();
}
