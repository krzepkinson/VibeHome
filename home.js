// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; 
let allHomeTasks = []; 
let currentRoomFilter = null; 

// NOWE ZMIENNE DLA KALENDARZA
let homeViewMode = 'list'; 
let homeCurrentMonth = new Date().getMonth();
let homeCurrentYear = new Date().getFullYear();

window.toggleHomeView = function() {
    homeViewMode = homeViewMode === 'list' ? 'calendar' : 'list';
    const toggleBtn = document.getElementById('home-view-toggle-btn');
    if (toggleBtn) toggleBtn.innerText = homeViewMode === 'list' ? '📅' : '📋';
    window.loadDashboard();
};

window.changeHomeMonth = function(offset) {
    homeCurrentMonth += offset;
    if (homeCurrentMonth < 0) { homeCurrentMonth = 11; homeCurrentYear--; } 
    else if (homeCurrentMonth > 11) { homeCurrentMonth = 0; homeCurrentYear++; }
    window.loadDashboard();
};

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
    const calWrapper = document.getElementById('home-calendar-wrapper');
    const backBtn = document.getElementById('home-back-btn');
    const hid = window.currentUser.household_id;
    
    // Zarządzanie UI na podstawie filtrów
    if (currentRoomFilter) {
        if (backBtn) { backBtn.classList.remove('hidden'); backBtn.innerHTML = '←'; }
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = currentRoomFilter; if (p) p.innerText = 'Lista zadań';
        calWrapper.classList.add('hidden');
        list.classList.remove('hidden');
    } else {
        if (backBtn) backBtn.classList.add('hidden');
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Zarządzanie przestrzenią';
        
        if (homeViewMode === 'calendar') {
            list.classList.add('hidden');
            calWrapper.classList.remove('hidden');
        } else {
            calWrapper.classList.add('hidden');
            list.classList.remove('hidden');
        }
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
        list.classList.remove('hidden');
        calWrapper.classList.add('hidden');
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

    // RENDEROWANIE KALENDARZA LUB LISTY POKOJÓW
    if (!currentRoomFilter) {
        if (homeViewMode === 'calendar') {
            window.renderHomeCalendar();
            return;
        }

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
        last: allHomeLogs.find(l => l.task_id === t.id), 
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

// NOWOŚĆ: RENDEROWANIE KALENDARZA DOMOWEGO
window.renderHomeCalendar = function() {
    const container = document.getElementById('home-calendar-container');
    const title = document.getElementById('home-calendar-title');
    if (!container || !title) return;

    const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    title.innerText = `${monthNames[homeCurrentMonth]} ${homeCurrentYear}`;

    let html = `<div class="grid grid-cols-7 gap-1 text-center mb-2">`;
    ['Pn','Wt','Śr','Czw','Pt','So','Nd'].forEach(d => { html += `<div class="text-[9px] text-neutral-600 font-bold uppercase">${d}</div>`; });
    html += `</div><div class="grid grid-cols-7 gap-1">`;

    const firstDay = (new Date(homeCurrentYear, homeCurrentMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(homeCurrentYear, homeCurrentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) { html += `<div></div>`; }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${homeCurrentYear}-${String(homeCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        const dayLogs = allHomeLogs.filter(l => l.created_at.startsWith(dateStr));
        const dueTasks = allHomeTasks.filter(task => {
            if (!task.interval_days || task.interval_days === 0) return false;
            const lastLog = allHomeLogs.find(l => l.task_id === task.id);
            if (!lastLog) return false; 
            const lastDate = new Date(lastLog.created_at); lastDate.setHours(0,0,0,0);
            const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
            return nextDate.toISOString().split('T')[0] === dateStr;
        });

        let dayClass = 'hover:bg-[#333537] text-neutral-300';
        let indicator = '';

        if (dayLogs.length > 0 && dueTasks.length > 0) {
            dayClass = 'bg-[#004a77]/30 border border-[#004a77]/50 font-bold text-[#c2e7ff]';
            indicator = `<div class="absolute bottom-1 flex gap-0.5"><div class="w-1 h-1 rounded-full bg-[#c4eed0]"></div><div class="w-1 h-1 rounded-full bg-[#ffb4ab]"></div></div>`;
        } else if (dayLogs.length > 0) {
            dayClass = 'bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] font-bold';
            indicator = `<div class="absolute bottom-1 w-1 h-1 rounded-full bg-[#c4eed0]"></div>`;
        } else if (dueTasks.length > 0) {
            dayClass = 'bg-[#3c1414]/40 border border-[#8c1d18]/50 text-[#ffb4ab] font-bold';
            indicator = `<div class="absolute bottom-1 w-1 h-1 rounded-full bg-[#ffb4ab]"></div>`;
        }

        if (isToday) dayClass += ' ring-2 ring-[#a8c7fa] ring-offset-2 ring-offset-[#1e1f20]';

        html += `<div onclick="window.openHomeDayDetails('${dateStr}')" class="relative aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${dayClass}"><span class="text-xs">${d}</span>${indicator}</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
};

// NOWOŚĆ: SZCZEGÓŁY DNIA DLA DOMU
window.openHomeDayDetails = function(dateStr) {
    const modal = document.getElementById('day-details-modal'); 
    const list = document.getElementById('day-details-list');
    document.getElementById('day-details-title').innerText = "Wydarzenia w Domu";
    document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const dayLogs = allHomeLogs.filter(l => l.created_at.startsWith(dateStr));
    const dueTasks = allHomeTasks.filter(task => {
        if (!task.interval_days || task.interval_days === 0) return false;
        const lastLog = allHomeLogs.find(l => l.task_id === task.id);
        if (!lastLog) return false; 
        const lastDate = new Date(lastLog.created_at); lastDate.setHours(0,0,0,0);
        const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
        return nextDate.toISOString().split('T')[0] === dateStr;
    });

    if (dayLogs.length === 0 && dueTasks.length === 0) {
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań w tym dniu.</p>`;
    } else {
        let html = '';
        dueTasks.forEach(t => {
            html += `
            <div class="px-3 py-2 bg-[#1e1f20] rounded-xl border border-[#8c1d18]/50 mb-1.5 flex justify-between items-center">
                <div>
                    <p class="text-sm font-medium text-[#ffb4ab]">📅 ${window.esc(t.name)}</p>
                    <p class="text-[10px] text-neutral-500 mt-0.5">Zaplanowane do zrobienia</p>
                </div>
            </div>`;
        });
        dayLogs.forEach(l => {
            const task = allHomeTasks.find(t => t.id === l.task_id) || { name: l.activity_name };
            html += `
            <div class="px-3 py-2 bg-[#131314] rounded-xl border border-[#0f5223]/50 mb-1.5 flex justify-between items-center">
                <div>
                    <p class="text-sm font-medium text-[#c4eed0]">✓ ${window.esc(task.name)}</p>
                    <p class="text-[10px] text-neutral-500 mt-0.5">Wykonane (${l.user_name || '?'})</p>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    }
    modal.classList.remove('hidden');
};

window.getRelativeTime = function(d) {
    const diff = Math.floor((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
    return diff === 0 ? "dzisiaj" : diff === 1 ? "wczoraj" : diff < 7 ? `${diff} dni temu` : new Date(d).toLocaleDateString('pl-PL');
};

window.getCompactStatus = function(lastDate, interval) {
    if (!interval || interval <= 0) {
        if (!lastDate) return { color: 'text-[#ffb4ab]', label: 'Zadanie jednorazowe', tooltip: 'Czeka na wykonanie.' };
        return { color: 'text-neutral-500', label: `Zrobione ${window.getRelativeTime(lastDate)}`, tooltip: 'Wykonano.' };
    }

    if (!lastDate) return { color: 'text-neutral-500', label: 'Jeszcze nie robione', tooltip: 'Brak wpisów.' };
    const relText = `Ostatnio ${window.getRelativeTime(lastDate)}`;
    
    const next = new Date(lastDate); next.setDate(next.getDate() + interval);
    const diff = Math.ceil((next - new Date().setHours(0,0,0,0)) / 86400000);
    return diff < 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: `Przeterminowane o ${Math.abs(diff)} dni.` } 
           : diff === 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: 'Dzisiaj!' } 
           : { color: 'text-[#c4eed0]', label: relText, tooltip: `Za ${diff} dni.` };
};

window.calculatePriority = function(task, lastDate) {
    if (!task.interval_days || task.interval_days <= 0) return -1;
    if (!lastDate) return 999;
    return Math.floor((new Date() - new Date(lastDate)) / 86400000) / task.interval_days;
};

window.openAddLogModal = function(id, name) {
    window.loadAndShowModal('add-log-modal', '/modals/add-log.html', () => {
        document.getElementById('add-log-subtitle').innerText = name;
        document.getElementById('add-log-name').value = id; 
        document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('add-log-notes').value = '';
        
        setTimeout(() => {
            const input = document.getElementById('add-log-notes');
            if (input) input.focus();
        }, 50);
    });
};

window.closeAddLogModal = function() { document.getElementById('add-log-modal').classList.add('hidden'); };

window.saveNewLog = async function() {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const taskId = document.getElementById('add-log-name').value;
    const d = document.getElementById('add-log-date').value; 
    const nt = document.getElementById('add-log-notes').value;
    const taskObj = allHomeTasks.find(t => t.id == taskId);
    
    const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
        task_id: taskId, activity_name: taskObj ? taskObj.name : 'Zadanie', 
        created_at: `${d}T12:00:00.000Z`, notes: nt, 
        user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);
    
    if (error) { window.showToast("Błąd: " + error.message); return; }

    if (taskObj && (!taskObj.interval_days || taskObj.interval_days === 0)) {
        await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', taskId);
        window.showToast("Zadanie jednorazowe zakończone!");
    } else {
        window.showToast("Zapisano log!");
    }

    window.closeAddLogModal(); 
    window.loadDashboard();
};

window.openNewTaskModal = function() {
    window.loadAndShowModal('new-task-modal', '/modals/new-task.html', () => {
        // Wszystko w tym bloku wykona się DOPIERO jak plik HTML zostanie pobrany i wklejony do strony
        document.getElementById('new-task-name').value = '';
        if(typeof window.populateRoomsDropdown === 'function') window.populateRoomsDropdown('new-task-room');
        document.getElementById('new-task-interval').value = '';
        document.getElementById('new-task-remind').value = '0';
        
        // Fuksowanie po załadowaniu
        setTimeout(() => {
            const input = document.getElementById('new-task-name');
            if (input) input.focus();
        }, 50);
    });
};

window.closeNewTaskModal = function() { document.getElementById('new-task-modal').classList.add('hidden'); };

window.saveNewTask = async function() {
    const n = document.getElementById('new-task-name').value.trim();
    const i = parseInt(document.getElementById('new-task-interval').value) || 0;
    const remind = parseInt(document.getElementById('new-task-remind').value) || 0;
    const r = document.getElementById('new-task-room').value;
    if (!n) return;

    const { error } = await window.supabaseClient.from('tasks').insert([{ 
        name: n, interval_days: i, remind_days_before: remind, push_enabled: true, show_in_history: true, 
        room: r, user_id: window.currentUser.id, household_id: window.currentUser.household_id 
    }]);

    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.closeNewTaskModal(); window.showToast("Dodano czynność!"); window.loadDashboard();
};
