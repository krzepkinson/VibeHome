// ==========================================
// LOGIKA: ZDROWIE 2.0 (health.js)
// ==========================================

let healthProfiles = []; 
let healthTasks = []; 
let healthLogs = [];
let currentProfileId = null; 

let healthViewMode = 'list'; // 'list' lub 'calendar'
let currentMonth = new Date().getMonth(); 
let currentYear = new Date().getFullYear();

window.toggleHealthView = function() {
    healthViewMode = healthViewMode === 'list' ? 'calendar' : 'list';
    const toggleBtn = document.getElementById('health-view-toggle-btn');
    if (toggleBtn) toggleBtn.innerText = healthViewMode === 'list' ? '📅' : '📋';
    window.renderHealthUI();
};

window.initHealthModule = async function() {
    const hid = window.currentUser.household_id;
    const { data: pData } = await window.supabaseClient.from('profiles').select('*').eq('household_id', hid).order('name');
    healthProfiles = pData || [];
    
    if (healthProfiles.length > 0 && !currentProfileId) {
        currentProfileId = healthProfiles[0].id;
    }
    if (currentProfileId) {
        await window.refreshHealthData();
    }
    window.renderHealthUI();
};

window.refreshHealthData = async function() {
    if (!currentProfileId) return;
    const hid = window.currentUser.household_id;
    const [tRes, lRes] = await Promise.all([
        window.supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId).eq('household_id', hid).eq('is_archived', false),
        window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false })
    ]);
    healthTasks = tRes.data || []; 
    healthLogs = lRes.data || [];
};

window.renderHealthUI = function() {
    const profile = healthProfiles.find(p => p.id === currentProfileId);
    if (!profile) { /* render empty state code... */ return; }

    document.getElementById('profile-name-title').innerText = profile.name; 
    const avatar = document.getElementById('health-header-avatar');
    avatar.className = `ml-1 w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white ${window.getAvatarColor(profile.name)}`;
    avatar.innerText = profile.name.charAt(0).toUpperCase();

    const calWrapper = document.getElementById('health-calendar-wrapper');
    const sectionsWrapper = document.getElementById('health-sections-wrapper');

    if (healthViewMode === 'calendar') {
        calWrapper.classList.remove('hidden');
        sectionsWrapper.classList.add('hidden');
        window.renderCalendar();
    } else {
        calWrapper.classList.add('hidden');
        sectionsWrapper.classList.remove('hidden');
        window.renderHealthSections();
    }
};

window.renderHealthSections = function() {
    const activeList = document.getElementById('health-active-list');
    const upcomingList = document.getElementById('health-upcoming-list');
    const routineList = document.getElementById('health-routine-list');
    const today = new Date(); today.setHours(0,0,0,0);

    // 1. Sekcja: AKTYWNE (duration z end_date == null)
    const activeTasks = healthTasks.filter(t => t.task_type === 'duration');
    const currentlyActive = [];
    activeTasks.forEach(t => {
        const log = healthLogs.find(l => l.health_task_id === t.id && l.end_date === null);
        if (log) currentlyActive.push({ task: t, log: log });
    });

    document.getElementById('health-active-section').classList.toggle('hidden', currentlyActive.length === 0);
    activeList.innerHTML = currentlyActive.map(item => `
        <div class="flex items-center justify-between p-4 bg-rose-900/10 rounded-[20px] border border-rose-900/40 shadow-sm">
            <div class="flex-1">
                <h4 class="text-sm font-medium text-rose-200">${window.esc(item.task.name)}</h4>
                <p class="text-[10px] text-rose-400/80 mt-0.5">Trwa od: ${new Date(item.log.start_date).toLocaleDateString('pl-PL')}</p>
            </div>
            <button onclick="window.closeHealthLog(${item.log.id})" class="w-10 h-10 rounded-full bg-rose-900/40 text-rose-200 flex items-center justify-center active:scale-90 border border-rose-800/60 shadow-inner">■</button>
        </div>
    `).join('');

    // 2. Sekcja: NADCHODZĄCE (one_time w przyszłości)
    const upcoming = healthTasks.filter(t => {
        if (t.task_type !== 'one_time' || !t.event_date) return false;
        const evDate = new Date(t.event_date); evDate.setHours(0,0,0,0);
        const isDone = healthLogs.some(l => l.health_task_id === t.id);
        return evDate >= today && !isDone;
    }).sort((a,b) => new Date(a.event_date) - new Date(b.event_date));

    document.getElementById('health-upcoming-section').classList.toggle('hidden', upcoming.length === 0);
    upcomingList.innerHTML = upcoming.map(t => {
        const diff = Math.ceil((new Date(t.event_date) - today) / 86400000);
        const label = diff === 0 ? "Dzisiaj!" : `Za ${diff} dni`;
        return `
        <div class="flex items-center justify-between p-4 bg-amber-900/10 rounded-[20px] border border-amber-900/30">
            <div class="flex-1">
                <h4 class="text-sm font-medium text-amber-100">${window.esc(t.name)}</h4>
                <p class="text-[10px] text-amber-500/80 mt-0.5">${new Date(t.event_date).toLocaleDateString('pl-PL')} • ${label}</p>
            </div>
            <button onclick="window.startHealthLog(${t.id}, 'one_time')" class="w-10 h-10 rounded-full bg-amber-900/30 text-amber-200 flex items-center justify-center active:scale-90 border border-amber-800/40 shadow-sm">✓</button>
        </div>`;
    }).join('');

    // 3. Sekcja: RUTYNA (cyclical)
    routineList.innerHTML = healthTasks.filter(t => t.task_type === 'cyclical').map(t => {
        const tLogs = healthLogs.filter(l => l.health_task_id === t.id);
        const status = window.getHealthStatusString(t, null, tLogs);
        return `
        <div class="flex items-center justify-between p-3.5 bg-[#1e1f20] rounded-[18px] border border-[#333537] mb-1.5 shadow-sm">
            <div class="flex-1 pr-2" onclick="window.openHealthSettingsScreen(${t.id})">
                <h4 class="text-sm font-medium text-neutral-100">${window.esc(t.name)}</h4>
                <p class="text-[10px] text-neutral-500 mt-0.5">${status}</p>
            </div>
            <button onclick="window.startHealthLog(${t.id}, 'cyclical')" class="w-9 h-9 rounded-full bg-[#3c1414] text-[#ffb4ab] flex items-center justify-center active:scale-90 border border-[#8c1d18]/40 shadow-sm">+</button>
        </div>`;
    }).join('') || `<p class="text-center py-10 text-neutral-500 text-xs uppercase tracking-widest">Brak zaplanowanych rutyn</p>`;
};

// ... reszta funkcji (renderCalendar, startHealthLog, etc.) pozostaje bez zmian, 
// ale upewnij się, że window.openDayDetails ma drugi parametr 'health' 
// i wywołuje window.openDayDetails(dateStr, 'health') z kalendarza.
