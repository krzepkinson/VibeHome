// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; 
let allHomeTasks = []; 
let currentSettingsTaskName = '';
let currentRoomFilter = null; 

// --- FIX GLOBALNEJ NAWIGACJI ---
// Nadpisujemy goBack, żeby zachowywał się idealnie z nowymi kafelkami
window.goBack = function() {
    const settingsOpen = !document.getElementById('settings-screen').classList.contains('hidden');
    const healthSettingsOpen = !document.getElementById('health-settings-screen').classList.contains('hidden');
    const editProfileOpen = !document.getElementById('edit-profile-screen').classList.contains('hidden');
    
    // Jeśli zamykamy okno Ustawień, robimy to i przerywamy (by nie zabić filtra pokoju)
    if (settingsOpen || healthSettingsOpen || editProfileOpen) {
        document.getElementById('settings-screen').classList.add('hidden');
        document.getElementById('health-settings-screen').classList.add('hidden');
        document.getElementById('edit-profile-screen').classList.add('hidden');
        
        if (activeView === 'home') loadDashboard(); // Odświeżamy listę pod spodem
        return; 
    }

    // Jeśli jesteśmy na liście zadań w pokoju -> Wracamy do siatki kafelków
    if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null) {
        clearRoomFilter(); 
        return; 
    }

    // Jeśli nic z powyższych, używamy historii dolnego paska
    const prev = navHistory.pop();
    switchView(prev || 'dashboard', true); 
};

// --- FILTROWANIE ---
function filterHomeByRoom(room) {
    currentRoomFilter = room;
    if (activeView !== 'home') switchView('home'); 
    else loadDashboard();
}

function clearRoomFilter() {
    currentRoomFilter = null;
    loadDashboard(); 
}

// --- GŁÓWNA LOGIKA KOKPITU ---
async function loadDashboard() {
    const list = document.getElementById('dashboard-list');
    const backBtn = document.getElementById('home-back-btn');
    
    // 1. ZMIANA UI NAGŁÓWKA W ZALEŻNOŚCI OD STANU
    if (currentRoomFilter) {
        if (backBtn) { backBtn.classList.remove('hidden'); backBtn.innerHTML = '←'; }
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = currentRoomFilter === 'Wszystkie' ? 'Cały dom' : currentRoomFilter; 
        if (p) p.innerText = 'Lista zadań';
    } else {
        if (backBtn) backBtn.classList.add('hidden');
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Wybierz pomieszczenie';
    }

    // 2. POBIERANIE DANYCH
    const [tRes, lRes, rRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('rooms').select('*').order('name')
    ]);
    
    allHomeTasks = tRes.data || []; 
    allHomeLogs = lRes.data || [];
    const dbRooms = rRes.data || [];
    const today = new Date(); today.setHours(0,0,0,0);

    // 3. WIDOK GŁÓWNY (SIATKA KAFELKÓW POMIESZCZEŃ)
    if (!currentRoomFilter) {
        let roomStats = {};
        
        // Inicjalizacja pokoi z bazy
        dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
        if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
        
        let totalOverdueAll = 0;

        // Liczenie zadań
        allHomeTasks.forEach(task => {
            const rName = task.room || 'Inne';
            if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 };
            
            roomStats[rName].total++;
            
            if (task.interval_days > 0) {
                const lastLog = allHomeLogs.find(l => l.activity_name === task.name);
                let isOverdue = false;
                if (lastLog) {
                    const last = new Date(lastLog.created_at); last.setHours(0,0,0,0);
                    const next = new Date(last); next.setDate(last.getDate() + task.interval_days);
                    if (next <= today) isOverdue = true;
                } else {
                    isOverdue = true;
                }
                
                if (isOverdue) {
                    roomStats[rName].overdue++;
                    totalOverdueAll++;
                }
            }
        });

        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">`;
        
        // Zawsze pierwszy: Kafelek "Cały dom"
        const allBadge = totalOverdueAll > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${totalOverdueAll}</div>` : '';
        html += `
            <div onclick="filterHomeByRoom('Wszystkie')" class="relative bg-[#004a77]/20 p-4 rounded-[24px] border border-[#004a77]/50 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-28">
                ${allBadge}
                <div class="text-3xl mb-2 opacity-80">🏠</div>
                <h3 class="text-xs font-medium text-[#c2e7ff]">Cały dom</h3>
                <p class="text-[9px] text-[#c2e7ff]/70 mt-1 uppercase tracking-widest">${allHomeTasks.length} zadań</p>
            </div>
        `;

        // Reszta Kafelków
        Object.entries(roomStats).sort((a,b) => {
            if(a[0] === 'Inne') return 1;
            if(b[0] === 'Inne') return -1;
            return a[0].localeCompare(b[0]);
        }).forEach(([roomName, stats]) => {
            const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
            html += `
                <div onclick="filterHomeByRoom('${roomName}')" class="relative bg-[#1e1f20] p-4 rounded-[24px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-28">
                    ${badge}
                    <div class="text-3xl mb-2 opacity-80">${stats.icon}</div>
                    <h3 class="text-xs font-medium text-neutral-200">${roomName}</h3>
                    <p class="text-[9px] text-neutral-500 mt-1 uppercase tracking-widest">${stats.total} zadań</p>
                </div>
            `;
        });
        
        html += `</div>`;
        list.innerHTML = html;
        return;
    }

    // 4. WIDOK LISTY (Gdy włączony jest konkretny pokój)
    let tasksToDisplay = allHomeTasks;
    if (currentRoomFilter !== 'Wszystkie') {
        tasksToDisplay = tasksToDisplay.filter(t => (t.room || 'Inne') === currentRoomFilter);
    }
    
    let scored = tasksToDisplay.map(t => {
        const last = allHomeLogs.find(l => l.activity_name === t.name);
        return { t, last, score: calculatePriority(t, last?.created_at) };
    }).sort((a,b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.t.name.localeCompare(b.t.name);
    });

    if (scored.length === 0) { 
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań w tym widoku.</p>`; 
        return; 
    }

    list.innerHTML = scored.map(item => {
        const status = getCompactStatus(item.last?.created_at, item.t.interval_days);
        const muteIcon = item.t.push_enabled === false ? `<span title="Wyciszone" class="ml-2 text-neutral-600 text-xs">🔕</span>` : '';
        
        // Pigułkę "Pomieszczenie" dodajemy do nazwy tylko, gdy przeglądamy "Cały dom"
        const roomBadge = currentRoomFilter === 'Wszystkie' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${item.t.room || 'Inne'}</span>` : '';

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

// --- POMOCNICZE WYLICZENIA ---
function getRelativeTime(d) {
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(d); target.setHours(0,0,0,0);
    const diff = Math.floor((now - target) / 86400000);
    if (diff === 0) return "dzisiaj"; 
    if (diff === 1) return "wczoraj";
    if (diff < 7) return `${diff} dni temu`;
    return target.toLocaleDateString('pl-PL');
}

function getCompactStatus(lastDate, interval) {
    if (!lastDate) return { color: 'text-neutral-500', label: 'Nigdy', tooltip: 'Brak wpisów.' };
    if (!interval || interval <= 0) return { color: 'text-neutral-500', label: getRelativeTime(lastDate), tooltip: 'Brak harmonogramu.' };
    
    const last = new Date(lastDate); last.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    const next = new Date(last); next.setDate(last.getDate() + interval);
    const diff = Math.ceil((next - today) / 86400000);
    
    if (diff < 0) return { color: 'text-[#ffb4ab]', label: getRelativeTime(lastDate), tooltip: `Przeterminowane o ${Math.abs(diff)} dni.` };
    if (diff === 0) return { color: 'text-[#ffb4ab]', label: getRelativeTime(lastDate), tooltip: 'Dzisiaj!' };
    return { color: 'text-[#c4eed0]', label: getRelativeTime(lastDate), tooltip: `Za ${diff} dni.` };
}

function calculatePriority(task, lastDate) {
    if (!task.interval_days || task.interval_days <= 0) return -1;
    if (!lastDate) return 999;
    const diff = Math.floor((new Date() - new Date(lastDate)) / 86400000);
    return diff / task.interval_days;
}

// --- USTAWIENIA ZADANIA DOMOWEGO ---
async function openSettingsScreen(name) {
    currentSettingsTaskName = decodeURIComponent(name);
    const task = allHomeTasks.find(t => t.name === currentSettingsTaskName);
    
    document.getElementById('settings-title').innerText = currentSettingsTaskName;
    document.getElementById('set-task-name').value = task.name;
    document.getElementById('set-task-interval').value = task.interval_days;
    document.getElementById('set-task-push').checked = task.push_enabled !== false;
    
    if(typeof populateRoomsDropdown === 'function') {
        await populateRoomsDropdown('set-task-room', task.room || 'Inne');
    }
    
    renderHistory();
    goForward('settings-screen');
}

function closeSettingsScreen() {
    goBack();
}

async function saveTaskSettings() {
    const n = document.getElementById('set-task-name').value.trim();
    const i = parseInt(document.getElementById('set-task-interval').value) || 0;
    const r = document.getElementById('set-task-room').value; 
    const pushEnabled = document.getElementById('set-task-push').checked;

    if (!n) return;

    if (currentSettingsTaskName !== n) {
        await supabaseClient.from('activity_logs').update({ activity_name: n }).eq('activity_name', currentSettingsTaskName);
        await supabaseClient.from('tasks').insert([{ name: n, interval_days: i, push_enabled: pushEnabled, room: r }]);
        await supabaseClient.from('tasks').delete().eq('name', currentSettingsTaskName);
        currentSettingsTaskName = n;
    } else {
        await supabaseClient.from('tasks').update({ interval_days: i, push_enabled: pushEnabled, room: r }).eq('name', currentSettingsTaskName);
    }
    showToast("Zapisano!");
    
    const tRes = await supabaseClient.from('tasks').select('*');
    allHomeTasks = tRes.data || [];
    document.getElementById('settings-title').innerText = n;
}

async function deleteCurrentTask() {
    if(confirm("Usunąć czynność?")) {
        await supabaseClient.from('tasks').delete().eq('name', currentSettingsTaskName);
        closeSettingsScreen();
    }
}

// --- HISTORIA I LOGI ---
function renderHistory() {
    const logs = allHomeLogs.filter(l => l.activity_name === currentSettingsTaskName);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] p-3 rounded-[16px] flex justify-between items-center border border-[#333537] mb-2">
            <p class="text-xs font-medium text-neutral-200 pl-1">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
            <div class="flex gap-1">
                <button onclick="openEditLogModal(${l.id}, '${l.created_at.split('T')[0]}', '${encodeURIComponent(l.notes||'')}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">✏️</button>
                <button onclick="deleteLog(${l.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button>
            </div>
        </div>`).join('') || '<p class="text-center py-4 text-neutral-500 text-xs">Brak wpisów.</p>';
}

async function deleteLog(id) {
    if(!confirm("Usunąć ten wpis z historii?")) return;
    await supabaseClient.from('activity_logs').delete().eq('id', id);
    const res = await supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false });
    allHomeLogs = res.data; 
    renderHistory();
}

// --- NOWE ZADANIE ---
async function openNewTaskModal() { 
    if(typeof populateRoomsDropdown === 'function') {
        await populateRoomsDropdown('new-task-room');
    }
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-interval').value = '';
    document.getElementById('new-task-modal').classList.remove('hidden'); 
}

function closeNewTaskModal() { document.getElementById('new-task-modal').classList.add('hidden'); }

async function saveNewTask() {
    const n = document.getElementById('new-task-name').value.trim();
    const i = document.getElementById('new-task-interval').value;
    const r = document.getElementById('new-task-room').value || 'Inne';
    
    if (!n) return;
    await supabaseClient.from('tasks').insert([{ name: n, interval_days: parseInt(i)||0, push_enabled: true, room: r }]);
    closeNewTaskModal(); loadDashboard();
}

// --- LOGOWANIE WYKONANIA (+) ---
function openAddLogModal(n) {
    const name = decodeURIComponent(n);
    document.getElementById('add-log-subtitle').innerText = name;
    document.getElementById('add-log-name').value = name;
    document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('add-log-notes').value = '';
    document.getElementById('add-log-modal').classList.remove('hidden');
}

function closeAddLogModal() { document.getElementById('add-log-modal').classList.add('hidden'); }

async function saveNewLog() {
    const n = document.getElementById('add-log-name').value;
    const d = document.getElementById('add-log-date').value;
    const nt = document.getElementById('add-log-notes').value;
    
    await supabaseClient.from('activity_logs').insert([{ activity_name: n, created_at: `${d}T12:00:00.000Z`, notes: nt }]);
    closeAddLogModal(); loadDashboard();
}

// --- EDYCJA WYKONANIA ---
function openEditLogModal(id, date, notes) {
    document.getElementById('edit-log-id').value = id;
    document.getElementById('edit-log-date').value = date;
    document.getElementById('edit-log-notes').value = decodeURIComponent(notes);
    document.getElementById('edit-log-modal').classList.remove('hidden');
}

function closeEditLogModal() { document.getElementById('edit-log-modal').classList.add('hidden'); }

async function saveEditLog() {
    const id = document.getElementById('edit-log-id').value;
    const d = document.getElementById('edit-log-date').value;
    const n = document.getElementById('edit-log-notes').value;
    
    await supabaseClient.from('activity_logs').update({ created_at: `${d}T12:00:00.000Z`, notes: n }).eq('id', id);
    closeEditLogModal(); 
    const res = await supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false });
    allHomeLogs = res.data; renderHistory();
}
