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
    if (healthProfiles.length > 0 && !currentProfileId) currentProfileId = healthProfiles[0].id;
    if (currentProfileId) await refreshHealthData();
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
    if (profile) {
        document.getElementById('profile-name-title').innerText = profile.name;
        const avatar = document.getElementById('health-header-avatar');
        avatar.innerText = profile.name.charAt(0).toUpperCase();
        avatar.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white transition-transform active:scale-90 ${currentProfileId % 2 === 0 ? 'bg-blue-600' : 'bg-rose-600'}`;
    }
    renderCalendar();
    renderHealthTasks();
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
    closeNewHealthTaskModal(); initHealthModule();
}

// ... (reszta funkcji renderujących kalendarz zostaje bez zmian, bo korzystają z lokalnych zmiennych już przefiltrowanych)
