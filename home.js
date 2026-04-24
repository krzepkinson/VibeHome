// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; 
let allHomeTasks = []; 
let currentSettingsTaskName = '';
let currentRoomFilter = null; // NOWE: Przechowuje aktualny filtr

// NOWE: Funkcja odbierająca kliknięcie z Dashboardu
function filterHomeByRoom(room) {
    currentRoomFilter = room;
    switchView('home'); // Ta funkcja z index.html wywoła loadDashboard()
}

// NOWE: Funkcja czyszcząca filtr
function clearRoomFilter() {
    currentRoomFilter = null;
    loadDashboard();
}

async function loadDashboard() {
    const list = document.getElementById('dashboard-list');
    
    // Budowanie nagłówka filtra, jeśli filtr jest aktywny
    let filterHeaderHtml = '';
    if (currentRoomFilter) {
        filterHeaderHtml = `
            <div class="flex justify-between items-center mb-4 bg-[#a8c7fa]/10 p-3 rounded-[16px] border border-[#a8c7fa]/20">
                <span class="text-xs font-medium text-[#a8c7fa] flex items-center gap-2">
                    <span>🔍</span> Filtr: ${currentRoomFilter}
                </span>
                <button onclick="clearRoomFilter()" class="text-[10px] uppercase tracking-wider font-bold bg-[#a8c7fa]/20 text-[#a8c7fa] px-3 py-1.5 rounded-full active:scale-95 transition-colors">Wyczyść</button>
            </div>
        `;
    }

    const [tRes, lRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false })
    ]);
    allHomeTasks = tRes.data || []; 
    allHomeLogs = lRes.data || [];
    
    // Filtrowanie zadań
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
        list.innerHTML = filterHeaderHtml + `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań w tym widoku.</p>`; 
        return; 
    }

    list.innerHTML = filterHeaderHtml + scored.map(item => {
        const status = getCompactStatus(item.last?.created_at, item.t.interval_days);
        const muteIcon = item.t.push_enabled === false ? `<span title="Wyciszone" class="ml-2 text-neutral-600 text-xs">🔕</span>` : '';
        
        // Pigułka z pomieszczeniem (możemy ją wyświetlać zawsze, nawet gdy filtr jest włączony)
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

async function openSettingsScreen(name) {
    currentSettingsTaskName = decodeURIComponent(name);
    const task = allHomeTasks.find(t => t.name === currentSettingsTaskName);
    
    document.getElementById('settings-title').innerText = currentSettingsTaskName;
    document.getElementById('set-task-name').value = task.name;
    document.getElementById('set-task-interval').value = task.interval_days;
    document.getElementById('set-task-push').checked = task.push_enabled !== false;
    
    await populateRoomsDropdown('set-task-room', task.room || 'Inne');
    
    renderHistory();
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('settings-screen').classList.remove('hidden');
}

function closeSettingsScreen() {
    document.getElementById('settings-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    loadDashboard();
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
}

async function deleteCurrentTask() {
    if(confirm("Usunąć czynność?")) {
        await supabaseClient.from('tasks').delete().eq('name', currentSettingsTaskName);
        closeSettingsScreen();
    }
}

function renderHistory() {
    const logs = allHomeLogs.filter(l => l.activity_name === currentSettingsTaskName);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] p-3 rounded-[16px] flex justify-between items-center border border-[#333537]">
            <p class="text-xs font-medium text-neutral-200 pl-1">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
            <div class="flex gap-1">
                <button onclick="openEditLogModal(${l.id}, '${l.created_at.split('T')[0]}', '${encodeURIComponent(l.notes||'')}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">✏️</button>
                <button onclick="deleteLog(${l.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button>
            </div>
        </div>`).join('') || '<p class="text-center py-4 text-neutral-500 text-xs">Brak wpisów.</p>';
}

async function deleteLog(id) {
    await supabaseClient.from('activity_logs').delete().eq('id', id);
    const res = await supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false });
    allHomeLogs = res.data; 
    renderHistory();
}

async function openNewTaskModal() { 
    await populateRoomsDropdown('new-task-room');
    
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-interval').value = '';
    document.getElementById('new-task-modal').classList.remove('hidden'); 
}

function closeNewTaskModal() { 
    document.getElementById('new-task-modal').classList.add('hidden'); 
}

async function saveNewTask() {
    const n = document.getElementById('new-task-name').value.trim();
    const i = document.getElementById('new-task-interval').value;
    const r = document.getElementById('new-task-room').value;
    
    if (!n) return;
    
    await supabaseClient.from('tasks').insert([{ name: n, interval_days: parseInt(i)||0, push_enabled: true, room: r }]);
    closeNewTaskModal(); 
    loadDashboard();
}

function openAddLogModal(n) {
    const name = decodeURIComponent(n);
    document.getElementById('add-log-subtitle').innerText = name;
    document.getElementById('add-log-name').value = name;
    document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('add-log-notes').value = '';
    document.getElementById('add-log-modal').classList.remove('hidden');
}

function closeAddLogModal() { 
    document.getElementById('add-log-modal').classList.add('hidden'); 
}

async function saveNewLog() {
    const n = document.getElementById('add-log-name').value;
    const d = document.getElementById('add-log-date').value;
    const nt = document.getElementById('add-log-notes').value;
    
    await supabaseClient.from('activity_logs').insert([{ activity_name: n, created_at: `${d}T12:00:00.000Z`, notes: nt }]);
    closeAddLogModal(); 
    
    // Jeśli używamy filtra a zadanie przestało być zaległe i ma opóźnienie = 0
    // To list po przeładowaniu sama obniży jego priorytet, ale zostanie w tym filtrze pomieszczenia!
    loadDashboard();
}

function openEditLogModal(id, date, notes) {
    document.getElementById('edit-log-id').value = id;
    document.getElementById('edit-log-date').value = date;
    document.getElementById('edit-log-notes').value = decodeURIComponent(notes);
    document.getElementById('edit-log-modal').classList.remove('hidden');
}

function closeEditLogModal() { 
    document.getElementById('edit-log-modal').classList.add('hidden'); 
}

async function saveEditLog() {
    const id = document.getElementById('edit-log-id').value;
    const d = document.getElementById('edit-log-date').value;
    const n = document.getElementById('edit-log-notes').value;
    
    await supabaseClient.from('activity_logs').update({ created_at: `${d}T12:00:00.000Z`, notes: n }).eq('id', id);
    closeEditLogModal(); 
    
    const res = await supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false });
    allHomeLogs = res.data; 
    renderHistory();
}
