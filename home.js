// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; 
let allHomeTasks = []; 
let currentSettingsTaskName = '';
let currentRoomFilter = null; 

// --- FILTROWANIE ---
function filterHomeByRoom(room) {
    currentRoomFilter = room;
    if (activeView !== 'home') window.switchView('home'); 
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
    const uid = window.currentUser.id;
    
    if (currentRoomFilter) {
        if (backBtn) { backBtn.classList.remove('hidden'); backBtn.innerHTML = '←'; }
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = currentRoomFilter; 
        if (p) p.innerText = 'Lista zadań';
    } else {
        if (backBtn) backBtn.classList.add('hidden');
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Wybierz pomieszczenie';
    }

    const [tRes, lRes, rRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid),
        supabaseClient.from('activity_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('rooms').select('*').eq('user_id', uid).order('name')
    ]);
    
    allHomeTasks = tRes.data || []; 
    allHomeLogs = lRes.data || [];
    const dbRooms = rRes.data || [];
    const today = new Date(); today.setHours(0,0,0,0);

    if (!currentRoomFilter) {
        let roomStats = {};
        dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
        if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
        
        let totalOverdueAll = 0;
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
                } else { isOverdue = true; }
                if (isOverdue) { roomStats[rName].overdue++; totalOverdueAll++; }
            }
        });

        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">`;
        const allBadge = totalOverdueAll > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${totalOverdueAll}</div>` : '';
        html += `
            <div onclick="filterHomeByRoom('Wszystkie')" class="relative bg-[#004a77]/20 p-4 rounded-[24px] border border-[#004a77]/50 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-28">
                ${allBadge}<div class="text-3xl mb-2 opacity-80">🗂️</div><h3 class="text-xs font-medium text-[#c2e7ff]">Wszystkie</h3>
                <p class="text-[9px] text-[#c2e7ff]/70 mt-1 uppercase tracking-widest">${allHomeTasks.length} zadań</p>
            </div>`;

        Object.entries(roomStats).sort((a,b) => (a[0] === 'Inne' ? 1 : b[0] === 'Inne' ? -1 : a[0].localeCompare(b[0]))).forEach(([roomName, stats]) => {
            const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
            html += `
                <div onclick="filterHomeByRoom('${esc(roomName)}')" class="relative bg-[#1e1f20] p-4 rounded-[24px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-28">
                    ${badge}<div class="text-3xl mb-2 opacity-80">${esc(stats.icon)}</div><h3 class="text-xs font-medium text-neutral-200">${esc(roomName)}</h3>
                    <p class="text-[9px] text-neutral-500 mt-1 uppercase tracking-widest">${stats.total} zadań</p>
                </div>`;
        });
        list.innerHTML = html + `</div>`;
        return;
    }

    let tasksToDisplay = currentRoomFilter === 'Wszystkie' ? allHomeTasks : allHomeTasks.filter(t => (t.room || 'Inne') === currentRoomFilter);
    let scored = tasksToDisplay.map(t => ({ t, last: allHomeLogs.find(l => l.activity_name === t.name), score: calculatePriority(t, allHomeLogs.find(l => l.activity_name === t.name)?.created_at) })).sort((a,b) => b.score - a.score || a.t.name.localeCompare(b.t.name));

    list.innerHTML = scored.length ? scored.map(item => {
        const status = getCompactStatus(item.last?.created_at, item.t.interval_days);
        const roomBadge = currentRoomFilter === 'Wszystkie' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${esc(item.t.room || 'Inne')}</span>` : '';
        const muteIcon = item.t.push_enabled === false ? `<span title="Wyciszone" class="ml-2 text-neutral-600 text-xs">🔕</span>` : '';

        return `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-1">
                <div class="flex-1 cursor-pointer pr-4" onclick="window.showToast('${esc(status.tooltip)}')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${esc(item.t.name)} ${roomBadge} ${muteIcon}</h3>
                    <p class="text-[11px] ${status.color} mt-1">${status.label}</p>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="openAddLogModal('${encodeURIComponent(item.t.name)}')" class="w-10 h-10 rounded-full bg-[#0f5223]/20 text-[#c4eed0] flex items-center justify-center active:scale-90 pb-0.5 text-lg">+</button>
                    <button onclick="openSettingsScreen('${encodeURIComponent(item.t.name)}')" class="w-10 h-10 rounded-full bg-[#333537]/50 text-neutral-400 flex items-center justify-center active:scale-90 text-sm">⚙️</button>
                </div>
            </div>`;
    }).join('') : `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań.</p>`;
}

// --- POMOCNICY ---
function getRelativeTime(d) {
    const diff = Math.floor((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
    return diff === 0 ? "dzisiaj" : diff === 1 ? "wczoraj" : diff < 7 ? `${diff} dni temu` : new Date(d).toLocaleDateString('pl-PL');
}

function getCompactStatus(lastDate, interval) {
    if (!lastDate) return { color: 'text-neutral-500', label: 'Jeszcze nie było robione', tooltip: 'Brak wpisów.' };
    
    const relText = `Ostatnio ${getRelativeTime(lastDate)}`;
    
    if (!interval || interval <= 0) return { color: 'text-neutral-500', label: relText, tooltip: 'Brak harmonogramu.' };
    
    const next = new Date(lastDate); next.setDate(next.getDate() + interval);
    const diff = Math.ceil((next - new Date().setHours(0,0,0,0)) / 86400000);
    
    return diff < 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: `Przeterminowane o ${Math.abs(diff)} dni.` } 
           : diff === 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: 'Dzisiaj!' } 
           : { color: 'text-[#c4eed0]', label: relText, tooltip: `Za ${diff} dni.` };
}

function calculatePriority(task, lastDate) {
    if (!task.interval_days || task.interval_days <= 0) return -1;
    if (!lastDate) return 999;
    return Math.floor((new Date() - new Date(lastDate)) / 86400000) / task.interval_days;
}

// --- MODALE NOWE ZADANIE ---
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
    const i = parseInt(document.getElementById('new-task-interval').value) || 0;
    const remind = parseInt(document.getElementById('new-task-remind').value) || 0;
    const r = document.getElementById('new-task-room').value || 'Inne';
    if (!n) return;
    await supabaseClient.from('tasks').insert([{ name: n, interval_days: i, remind_days_before: remind, push_enabled: true, room: r, user_id: window.currentUser.id }]);
    closeNewTaskModal(); loadDashboard();
}

// --- MODALE NOWY WPIS (LOG) ---
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
    await supabaseClient.from('activity_logs').insert([{ activity_name: n, created_at: `${d}T12:00:00.000Z`, notes: nt, user_id: window.currentUser.id }]);
    closeAddLogModal(); loadDashboard();
}

// --- USTAWIENIA ZADANIA ---
async function openSettingsScreen(name) {
    currentSettingsTaskName = decodeURIComponent(name);
    const task = allHomeTasks.find(t => t.name === currentSettingsTaskName);
    document.getElementById('settings-title').innerText = currentSettingsTaskName;
    document.getElementById('set-task-name').value = task.name;
    document.getElementById('set-task-interval').value = task.interval_days;
    document.getElementById('set-task-push').checked = task.push_enabled !== false;
    if(typeof populateRoomsDropdown === 'function') await populateRoomsDropdown('set-task-room', task.room || 'Inne');
    renderHistory(); window.goForward('settings-screen');
}

function closeSettingsScreen() { window.goBack(); }

async function saveTaskSettings() {
    const n = document.getElementById('set-task-name').value.trim();
    const i = parseInt(document.getElementById('set-task-interval').value) || 0;
    const r = document.getElementById('set-task-room').value; 
    const pushEnabled = document.getElementById('set-task-push').checked;
    const uid = window.currentUser.id;

    if (currentSettingsTaskName !== n) {
        await supabaseClient.from('activity_logs').update({ activity_name: n }).eq('activity_name', currentSettingsTaskName).eq('user_id', uid);
        await supabaseClient.from('tasks').insert([{ name: n, interval_days: i, push_enabled: pushEnabled, room: r, user_id: uid }]);
        await supabaseClient.from('tasks').delete().eq('name', currentSettingsTaskName).eq('user_id', uid);
        currentSettingsTaskName = n;
    } else {
        await supabaseClient.from('tasks').update({ interval_days: i, push_enabled: pushEnabled, room: r }).eq('name', currentSettingsTaskName).eq('user_id', uid);
    }
    window.showToast("Zapisano!"); loadDashboard();
}

async function deleteCurrentTask() {
    if(confirm("Usunąć czynność?")) { 
        await supabaseClient.from('tasks').delete().eq('name', currentSettingsTaskName).eq('user_id', window.currentUser.id); 
        closeSettingsScreen(); 
    }
}

// --- HISTORIA I EDYCJA ---
function renderHistory() {
    const logs = allHomeLogs.filter(l => l.activity_name === currentSettingsTaskName);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] p-3 rounded-[16px] flex justify-between items-center border border-[#333537] mb-2">
            <p class="text-xs text-neutral-200">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
            <div class="flex gap-1">
                <button onclick="openEditLogModal(${l.id}, '${l.created_at.split('T')[0]}', '${encodeURIComponent(l.notes||'')}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">✏️</button>
                <button onclick="deleteLog(${l.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button>
            </div>
        </div>`).join('') || '<p class="text-neutral-500 text-xs py-4 text-center">Brak historii.</p>';
}

async function deleteLog(id) {
    if(confirm("Usunąć ten wpis?")) { 
        await supabaseClient.from('activity_logs').delete().eq('id', id).eq('user_id', window.currentUser.id); 
        loadDashboard(); 
        const res = await supabaseClient.from('activity_logs').select('*').eq('activity_name', currentSettingsTaskName).eq('user_id', window.currentUser.id).order('created_at', { ascending: false });
        allHomeLogs = res.data || [];
        renderHistory(); 
    }
}

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
    
    await supabaseClient.from('activity_logs').update({ created_at: `${d}T12:00:00.000Z`, notes: n }).eq('id', id).eq('user_id', window.currentUser.id);
    closeEditLogModal(); 
    
    loadDashboard();
    const res = await supabaseClient.from('activity_logs').select('*').eq('activity_name', currentSettingsTaskName).eq('user_id', window.currentUser.id).order('created_at', { ascending: false });
    allHomeLogs = res.data || [];
    renderHistory();
}
