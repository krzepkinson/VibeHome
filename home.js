// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; 
let allHomeTasks = []; 
let currentRoomFilter = null; 

window.filterHomeByRoom = function(room) {
    currentRoomFilter = room;
    if (window.activeView !== 'home') window.switchView('home'); 
    else window.loadDashboard();
};

window.clearRoomFilter = function() {
    currentRoomFilter = null;
    window.loadDashboard(); 
};

window.loadDashboard = async function() {
    const list = document.getElementById('dashboard-list');
    const backBtn = document.getElementById('home-back-btn');
    const hid = window.currentUser.household_id;
    
    if (currentRoomFilter) {
        if (backBtn) { 
            backBtn.classList.remove('hidden'); 
            backBtn.innerHTML = '←'; 
        }
        const h1 = document.querySelector('#view-home h1'); 
        const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = currentRoomFilter; 
        if (p) p.innerText = 'Lista zadań';
    } else {
        if (backBtn) backBtn.classList.add('hidden');
        const h1 = document.querySelector('#view-home h1'); 
        const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = 'Dom'; 
        if (p) p.innerText = 'Wybierz pomieszczenie';
    }

    const [tRes, lRes, rRes] = await Promise.all([
        window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
        window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }),
        window.supabaseClient.from('rooms').select('*').eq('household_id', hid).order('name')
    ]);
    
    allHomeTasks = tRes.data || []; 
    allHomeLogs = lRes.data || [];
    const dbRooms = rRes.data || [];

    if (allHomeTasks.length === 0 && !currentRoomFilter) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in px-4">
                <div class="text-7xl mb-6 opacity-80 drop-shadow-lg">🏠</div>
                <h3 class="text-neutral-100 font-medium text-xl mb-2 tracking-wide">Twój dom jest pusty</h3>
                <p class="text-neutral-400 text-xs mb-8 max-w-[260px] leading-relaxed">Dodaj pierwszą czynność, by zacząć dbać o swoją przestrzeń.</p>
                <button onclick="window.openNewTaskModal()" class="bg-[#004a77] text-[#c2e7ff] font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    <span class="text-xl pb-1">+</span> Dodaj pierwszą czynność
                </button>
            </div>`;
        return;
    }

    if (!currentRoomFilter) {
        let roomStats = {};
        dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
        if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
        
        let totalOverdueAll = 0;
        allHomeTasks.forEach(task => {
            const rName = task.room || 'Inne';
            if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 };
            roomStats[rName].total++;
            if (window.isTaskOverdue(task, allHomeLogs)) {
                roomStats[rName].overdue++; 
                totalOverdueAll++;
            }
        });

        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">`;
        const allBadge = totalOverdueAll > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${totalOverdueAll}</div>` : '';
        html += `
            <div onclick="window.filterHomeByRoom('Wszystkie')" class="relative bg-[#004a77]/20 p-4 rounded-[20px] border border-[#004a77]/50 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24">
                ${allBadge}<div class="text-2xl mb-1 opacity-80">🗂️</div><h3 class="text-xs font-medium text-[#c2e7ff]">Wszystkie</h3>
                <p class="text-[9px] text-[#c2e7ff]/70 mt-0.5 uppercase tracking-widest">${allHomeTasks.length} zadań</p>
            </div>`;

        Object.entries(roomStats).sort((a,b) => (a[0] === 'Inne' ? 1 : b[0] === 'Inne' ? -1 : a[0].localeCompare(b[0]))).forEach(([roomName, stats]) => {
            const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
            html += `
                <div onclick="window.filterHomeByRoom('${window.esc(roomName)}')" class="relative bg-[#1e1f20] p-4 rounded-[20px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24">
                    ${badge}<div class="text-2xl mb-1 opacity-80">${window.esc(stats.icon)}</div><h3 class="text-xs font-medium text-neutral-200">${window.esc(roomName)}</h3>
                    <p class="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-widest">${stats.total} zadań</p>
                </div>`;
        });
        list.innerHTML = html + `</div>`;
        return;
    }

    let tasksToDisplay = currentRoomFilter === 'Wszystkie' ? allHomeTasks : allHomeTasks.filter(t => (t.room || 'Inne') === currentRoomFilter);
    let scored = tasksToDisplay.map(t => ({ 
        t, 
        last: allHomeLogs.find(l => l.task_id === t.id), // ZMIANA: Szukamy po ID 
        score: window.calculatePriority(t, allHomeLogs.find(l => l.task_id === t.id)?.created_at) 
    })).sort((a,b) => b.score - a.score || a.t.name.localeCompare(b.t.name));

    list.innerHTML = scored.length ? scored.map(item => {
        const status = window.getCompactStatus(item.last?.created_at, item.t.interval_days);
        const roomBadge = currentRoomFilter === 'Wszystkie' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${window.esc(item.t.room || 'Inne')}</span>` : '';
        return `
            <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1 shadow-sm">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.showToast('${window.esc(status.tooltip)}')">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${window.esc(item.t.name)} ${roomBadge}</h3>
                    <p class="text-[10px] ${status.color} mt-0.5">${status.label}</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.openAddLogModal(${item.t.id}, '${window.esc(item.t.name)}')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 text-[#c4eed0] flex items-center justify-center active:scale-90 pb-0.5 text-base border border-[#0f5223]/50">+</button>
                    <button onclick="window.openSettingsScreen(${item.t.id})" class="w-8 h-8 rounded-full bg-[#333537]/50 text-neutral-400 flex items-center justify-center active:scale-90 text-xs">⚙️</button>
                </div>
            </div>`;
    }).join('') : `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań w tym pomieszczeniu.</p>`;
};

// ... (reszta funkcji bez zmian do momentu openAddLogModal)

window.openAddLogModal = function(id, name) {
    document.getElementById('add-log-subtitle').innerText = name;
    document.getElementById('add-log-name').value = id; // ZMIANA: Przechowujemy ID w ukrytym polu
    document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('add-log-notes').value = '';
    document.getElementById('add-log-modal').classList.remove('hidden');
};

window.saveNewLog = async function() {
    window.triggerHaptic();
    const taskId = document.getElementById('add-log-name').value; // To jest teraz ID
    const d = document.getElementById('add-log-date').value; 
    const nt = document.getElementById('add-log-notes').value;
    
    // Pobieramy nazwę zadania dla czytelności w tabeli (choć ID jest kluczowe)
    const taskObj = allHomeTasks.find(t => t.id == taskId);
    
    const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
        task_id: taskId,
        activity_name: taskObj ? taskObj.name : 'Zadanie',
        created_at: `${d}T12:00:00.000Z`, 
        notes: nt, 
        user_id: window.currentUser.id, 
        household_id: window.currentUser.household_id, 
        user_name: window.currentUser.name 
    }]);
    
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.closeAddLogModal(); window.loadDashboard();
};
