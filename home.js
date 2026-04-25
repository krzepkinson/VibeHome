let allHomeLogs = []; 
let allHomeTasks = []; 
let currentSettingsTaskName = '';
let currentRoomFilter = null; 

function filterHomeByRoom(room) {
    currentRoomFilter = room;
    navHistory.push('dashboard'); // dodajemy do historii by działał przycisk goBack
    switchView('home'); 
}

function clearRoomFilter() {
    currentRoomFilter = null;
    switchView('dashboard'); // Gdy czyścimy filtr, po prostu wracamy na dashboard
}

async function loadDashboard() {
    const list = document.getElementById('dashboard-list');
    const backBtn = document.getElementById('home-back-btn');
    
    // Pokazywanie strzałki wstecz
    if (currentRoomFilter) {
        backBtn.classList.remove('hidden');
        backBtn.innerHTML = '←'; // Lewa strzałka
        // Ustawiamy napis w headerze jako filtr
        document.querySelector('#view-home h1').innerText = currentRoomFilter;
        document.querySelector('#view-home p').innerText = 'Filtrowanie zadań';
    } else {
        backBtn.classList.add('hidden');
        document.querySelector('#view-home h1').innerText = 'Dom';
        document.querySelector('#view-home p').innerText = 'Zarządzanie przestrzenią';
    }

    const [tRes, lRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false })
    ]);
    allHomeTasks = tRes.data || []; 
    allHomeLogs = lRes.data || [];
    
    let tasksToDisplay = allHomeTasks;
    if (currentRoomFilter) {
        tasksToDisplay = tasksToDisplay.filter(t => (t.room || 'Inne') === currentRoomFilter);
    }
    
    let scored = tasksToDisplay.map(t => {
        const last = allHomeLogs.find(l => l.activity_name === t.name);
        return { t, last, score: calculatePriority(t, last?.created_at) };
    }).sort((a,b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.t.name.localeCompare(b.t.name);
    });

    if(scored.length === 0) { 
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań w tym widoku.</p>`; 
        return; 
    }

    list.innerHTML = scored.map(item => {
        // ... (reszta kodu mapującego element zostaje identyczna jak masz)
        const status = getCompactStatus(item.last?.created_at, item.t.interval_days);
        const muteIcon = item.t.push_enabled === false ? `<span title="Wyciszone" class="ml-2 text-neutral-600 text-xs">🔕</span>` : '';
        const roomBadge = `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${item.t.room || 'Inne'}</span>`;

        return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-1">
                <div class="flex-1 cursor-pointer pr-4" onclick="showToast('${status.tooltip}')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${item.t.name} ${roomBadge} ${muteIcon}</h3>
                    <p class="text-[11px] ${status.color} mt-1">${status.label}</p>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="openAddLogModal('${encodeURIComponent(item.t.name)}')" class="w-10 h-10 rounded-full bg-[#0f5223]/20 text-[#c4eed0] font-medium text-lg flex items-center justify-center pb-0.5 active:scale-90 transition-transform">+</button>
                    <button onclick="openSettingsScreen('${encodeURIComponent(item.t.name)}')" class="w-10 h-10 rounded-full bg-[#333537]/50 text-neutral-400 flex items-center justify-center active:scale-90 transition-transform text-sm">⚙️</button>
                </div>
            </div>`;
    }).join('');
}
// (resztę funkcji w home.js jak openSettingsScreen musisz zamienić na goForward('settings-screen') zamiast usuwania hidden ręcznie, żeby działała główna strzałka)

async function openSettingsScreen(name) {
    currentSettingsTaskName = decodeURIComponent(name);
    const task = allHomeTasks.find(t => t.name === currentSettingsTaskName);
    document.getElementById('settings-title').innerText = currentSettingsTaskName;
    document.getElementById('set-task-name').value = task.name;
    document.getElementById('set-task-interval').value = task.interval_days;
    document.getElementById('set-task-push').checked = task.push_enabled !== false;
    await populateRoomsDropdown('set-task-room', task.room || 'Inne');
    renderHistory();
    
    goForward('settings-screen'); // NOWE użycie paska nawigacji
}
