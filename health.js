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
let calendarViewMode = 'month'; 

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
    const headerAvatar = document.getElementById('health-header-avatar');
    const nameTitle = document.getElementById('profile-name-title');
    const calWrapper = document.getElementById('health-calendar-wrapper');
    const sectionsWrapper = document.getElementById('health-sections-wrapper');

    if (!profile) {
        nameTitle.innerText = "Karta zdrowia"; 
        headerAvatar.innerText = "?";
        if (calWrapper) calWrapper.classList.add('hidden');
        if (sectionsWrapper) sectionsWrapper.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in px-4 mt-4 bg-[#1e1f20] rounded-[28px] border border-[#333537]">
                <div class="text-7xl mb-6 opacity-80 drop-shadow-lg">👨‍👩‍👧‍👦</div>
                <h3 class="text-neutral-100 font-medium text-xl mb-2 tracking-wide">Brak domowników</h3>
                <p class="text-neutral-400 text-xs mb-8 max-w-[260px] leading-relaxed">Dodaj pierwszy profil domownika, by móc śledzić jego leki, wizyty lekarskie i samopoczucie.</p>
                <button onclick="window.openNewProfileModal()" class="bg-[#e3e3e3] text-[#131314] font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    <span class="text-xl pb-1">+</span> Dodaj osobę
                </button>
            </div>`;
        return; 
    }
    
    nameTitle.innerText = profile.name; 
    headerAvatar.className = `ml-1 w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white transition-transform active:scale-90 ${window.getAvatarColor ? window.getAvatarColor(profile.name) : 'bg-rose-600'}`;
    headerAvatar.innerText = profile.name.charAt(0).toUpperCase();

    if (healthViewMode === 'calendar') {
        if(calWrapper) calWrapper.classList.remove('hidden');
        if(sectionsWrapper) sectionsWrapper.classList.add('hidden');
        window.renderCalendar();
    } else {
        if(calWrapper) calWrapper.classList.add('hidden');
        if(sectionsWrapper) sectionsWrapper.classList.remove('hidden');
        window.renderHealthSections();
    }
};

window.renderHealthSections = function() {
    const activeList = document.getElementById('health-active-list');
    const upcomingList = document.getElementById('health-upcoming-list');
    const routineList = document.getElementById('health-routine-list');
    const today = new Date(); today.setHours(0,0,0,0);

    // 1. Sekcja: AKTYWNE
    const activeTasks = healthTasks.filter(t => t.task_type === 'duration');
    const currentlyActive = [];
    activeTasks.forEach(t => {
        const log = healthLogs.find(l => l.health_task_id === t.id && l.end_date === null);
        if (log) currentlyActive.push({ task: t, log: log });
    });

    document.getElementById('health-active-section').classList.toggle('hidden', currentlyActive.length === 0);
    if(activeList) {
        activeList.innerHTML = currentlyActive.map(item => `
            <div class="flex items-center justify-between p-4 bg-rose-900/10 rounded-[20px] border border-rose-900/40 shadow-sm">
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-rose-200">${window.esc(item.task.name)}</h4>
                    <p class="text-[10px] text-rose-400/80 mt-0.5">Trwa od: ${new Date(item.log.start_date).toLocaleDateString('pl-PL')}</p>
                </div>
                <button onclick="window.closeHealthLog(${item.log.id})" class="w-10 h-10 rounded-full bg-rose-900/40 text-rose-200 flex items-center justify-center active:scale-90 border border-rose-800/60 shadow-inner">■</button>
            </div>
        `).join('');
    }

    // 2. Sekcja: NADCHODZĄCE
    const upcoming = healthTasks.filter(t => {
        if (t.task_type !== 'one_time' || !t.event_date) return false;
        const evDate = new Date(t.event_date); evDate.setHours(0,0,0,0);
        const isDone = healthLogs.some(l => l.health_task_id === t.id);
        return evDate >= today && !isDone;
    }).sort((a,b) => new Date(a.event_date) - new Date(b.event_date));

    document.getElementById('health-upcoming-section').classList.toggle('hidden', upcoming.length === 0);
    if(upcomingList) {
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
    }

    // 3. Sekcja: RUTYNA
    if(routineList) {
        routineList.innerHTML = healthTasks.filter(t => t.task_type === 'cyclical').map(t => {
            const tLogs = healthLogs.filter(l => l.health_task_id === t.id);
            const status = window.getHealthStatusString(t, null, tLogs);
            return `
            <div class="flex items-center justify-between p-3.5 bg-[#1e1f20] rounded-[18px] border border-[#333537] mb-1.5 shadow-sm">
                <div class="flex-1 pr-2 cursor-pointer" onclick="window.openHealthSettingsScreen(${t.id})">
                    <h4 class="text-sm font-medium text-neutral-100">${window.esc(t.name)}</h4>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${status}</p>
                </div>
                <button onclick="window.startHealthLog(${t.id}, 'cyclical')" class="w-9 h-9 rounded-full bg-[#3c1414] text-[#ffb4ab] flex items-center justify-center active:scale-90 border border-[#8c1d18]/40 shadow-sm">+</button>
            </div>`;
        }).join('') || `<p class="text-center py-10 text-neutral-500 text-xs uppercase tracking-widest">Brak zaplanowanych rutyn</p>`;
    }
};

window.renderCalendar = function() {
    const container = document.getElementById('calendar-container'); 
    const title = document.getElementById('calendar-title');
    if (!container || !title) return;
    
    if (isNaN(currentMonth) || isNaN(currentYear)) {
        currentMonth = new Date().getMonth();
        currentYear = new Date().getFullYear();
    }

    const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    
    let html = `<div class="grid grid-cols-7 gap-1 text-center mb-2">`;
    ['Pn','Wt','Śr','Czw','Pt','So','Nd'].forEach(d => { 
        html += `<div class="text-[9px] text-neutral-600 font-bold uppercase">${d}</div>`; 
    });
    html += `</div><div class="grid grid-cols-7 gap-1">`;
    
    const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { html += `<div></div>`; }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayLogs = healthLogs.filter(l => {
            const start = l.start_date.split('T')[0];
            const end = l.end_date ? l.end_date.split('T')[0] : new Date().toISOString().split('T')[0];
            return dateStr >= start && dateStr <= end;
        });
        const oneTimeEvents = healthTasks.filter(t => t.task_type === 'one_time' && t.event_date === dateStr);
        
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        const hasEvents = dayLogs.length > 0 || oneTimeEvents.length > 0;
        
        let dayClass = 'hover:bg-[#333537] text-neutral-300';
        if (isToday && hasEvents) dayClass = 'bg-[#ffb4ab] text-[#3c1414] font-bold border-2 border-rose-500';
        else if (isToday) dayClass = 'bg-[#ffb4ab] text-[#3c1414] font-bold';
        else if (hasEvents) dayClass = 'bg-rose-900/60 text-rose-200 border border-rose-700 font-bold';
        
        html += `<div onclick="window.openDayDetails('${dateStr}', 'health')" class="aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${dayClass}"><span class="text-xs">${d}</span></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
};

window.changeCalendarMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    window.renderCalendar();
};

window.getHealthStatusString = function(task, activeLog, taskLogs) {
    const today = new Date(); today.setHours(0,0,0,0);
    
    if (task.task_type === 'duration') {
        if (activeLog) {
            const start = new Date(activeLog.start_date); start.setHours(0,0,0,0);
            const diff = Math.floor((today - start) / 86400000);
            if (diff === 0) return '<span class="text-rose-400 font-medium">Dziś się zaczął</span>';
            if (diff === 1) return '<span class="text-rose-400 font-medium">Od wczoraj</span>';
            return `<span class="text-rose-400 font-medium">Od ${diff} dni</span>`;
        }
        return 'Brak aktywnych';
    } 
    else if (task.task_type === 'one_time') {
        if (taskLogs.length > 0) return '<span class="text-neutral-500">Wydarzenie zakończone</span>';
        if (!task.event_date) return 'Brak określonej daty';
        const evDate = new Date(task.event_date); evDate.setHours(0,0,0,0);
        const diff = Math.floor((evDate - today) / 86400000);
        if (diff < 0) return `<span class="text-[#ffb4ab]">Zaległe (${Math.abs(diff)} dni temu)</span>`;
        if (diff === 0) return `<span class="text-[#ffb4ab] font-bold">Dzisiaj!</span>`;
        return `Zaplanowane: <span class="text-[#c4eed0]">${new Date(task.event_date).toLocaleDateString('pl-PL')}</span>`;
    } 
    else {
        // NOWA, INTELIGENTNA LOGIKA DLA RUTYN (CYKLICZNYCH)
        if (!taskLogs || taskLogs.length === 0) {
            return `Ostatnio: <span class="text-neutral-600">nigdy</span> • Następna: <span class="text-[#ffb4ab] font-bold">Teraz</span>`;
        }
        
        const lastDate = new Date(taskLogs[0].start_date); 
        lastDate.setHours(0,0,0,0);
        const diffLast = Math.floor((today - lastDate) / 86400000);
        let lastStr = diffLast === 0 ? 'dziś' : (diffLast === 1 ? 'wczoraj' : `${diffLast} dni temu`);
        
        if (!task.interval_days || task.interval_days === 0) {
            return `Ostatnio: <span class="text-neutral-300">${lastStr}</span>`;
        }
        
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + task.interval_days);
        const diffNext = Math.ceil((nextDate - today) / 86400000);
        
        let nextStr = '';
        if (diffNext < 0) nextStr = `<span class="text-[#ffb4ab] font-bold">spóźnione ${Math.abs(diffNext)} dni!</span>`;
        else if (diffNext === 0) nextStr = `<span class="text-amber-400 font-bold">dziś!</span>`;
        else if (diffNext === 1) nextStr = `<span class="text-[#c4eed0]">jutro</span>`;
        else nextStr = `<span class="text-neutral-300">za ${diffNext} dni</span>`;
        
        return `Ostatnio: <span class="text-neutral-400">${lastStr}</span> • Następna: ${nextStr}`;
    }
};

window.startHealthLog = async function(taskId, type) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const now = new Date().toISOString();
    const { error } = await window.supabaseClient.from('health_logs').insert([{ 
        health_task_id: taskId, start_date: now, end_date: (type === 'cyclical' || type === 'one_time') ? now : null, 
        user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
    }]);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.showToast("Zapisano!"); 
    await window.refreshHealthData(); window.renderHealthUI(); 
    if(typeof window.loadDashboardOverview === 'function') { window.invalidateDashboardCache(); window.loadDashboardOverview(); }
};

window.closeHealthLog = async function(logId) {
    if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
    const { error } = await window.supabaseClient.from('health_logs').update({ end_date: new Date().toISOString() }).eq('id', logId).eq('household_id', window.currentUser.household_id);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.showToast("Zakończono"); 
    await window.refreshHealthData(); window.renderHealthUI(); 
    if(typeof window.loadDashboardOverview === 'function') { window.invalidateDashboardCache(); window.loadDashboardOverview(); }
};

// ==========================================
// MENU FAB I DODAWANIE ZADAŃ
// ==========================================

window.openHealthFabMenu = function() {
    document.getElementById('health-fab-menu').classList.remove('hidden');
};

window.closeHealthFabMenu = function() {
    document.getElementById('health-fab-menu').classList.add('hidden');
};

window.openNewHealthTaskModal = function(defaultType = 'cyclical') { 
    document.getElementById('h-task-name').value = ''; 
    document.getElementById('h-task-type').value = defaultType; 
    window.toggleHealthInterval(); 
    document.getElementById('new-health-task-modal').classList.remove('hidden'); 
};

window.openNewDurationModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('duration'); };
window.openNewEventModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('one_time'); };
window.openNewRoutineModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('cyclical'); };
// ==========================================
// NOWOŚĆ: KSIĄŻECZKA ZDROWIA I POMIARY
// ==========================================

window.openNewMeasurementModal = function() { 
    window.closeHealthFabMenu(); 
    document.getElementById('measurement-value').value = '';
    document.getElementById('measurement-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('measurement-notes').value = '';
    document.getElementById('new-measurement-modal').classList.remove('hidden'); 
};

window.closeNewMeasurementModal = function() {
    document.getElementById('new-measurement-modal').classList.add('hidden');
};

window.saveNewMeasurement = async function() {
    const type = document.getElementById('measurement-type').value;
    const valRaw = document.getElementById('measurement-value').value.trim();
    const date = document.getElementById('measurement-date').value;
    const notes = document.getElementById('measurement-notes').value.trim();

    if (!valRaw || !currentProfileId) return;

    // Zamiana ewentualnego przecinka na kropkę, żeby baza SQL (Numeric) przyjęła liczbę zmiennoprzecinkową
    const numericVal = parseFloat(valRaw.replace(',', '.'));
    if (isNaN(numericVal)) {
        window.showToast("Podaj poprawną wartość liczbową!");
        return;
    }

    let unit = '';
    if (type === 'Waga') unit = 'kg';
    else if (type === 'Wzrost') unit = 'cm';
    else if (type === 'Temperatura') unit = '°C';

    const { error } = await window.supabaseClient.from('health_measurements').insert([{
        household_id: window.currentUser.household_id,
        profile_id: currentProfileId,
        user_id: window.currentUser.id,
        measurement_type: type,
        value: numericVal,
        unit: unit,
        notes: notes,
        created_at: `${date}T12:00:00.000Z` // Oszukujemy czas, by zgadzała się data
    }]);

    if (error) { window.showToast("Błąd zapisu: " + error.message); return; }
    
    window.closeNewMeasurementModal();
    window.showToast("Pomiar zapisany!");
    if (window.activeView === 'health-book-screen') window.loadHealthBook();
};

window.openHealthBook = function() { 
    window.goForward('health-book-screen');
    window.loadHealthBook();
};

window.closeHealthBook = function() {
    window.goBack();
};

window.loadHealthBook = async function() {
    const tl = document.getElementById('health-book-timeline');
    tl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Analizowanie historii pacjenta...</p>`;

    const profile = healthProfiles.find(p => p.id === currentProfileId);
    if (profile) document.getElementById('health-book-subtitle').innerText = `Pacjent: ${profile.name}`;

    // Pobieramy pomiary specjalnie dla Książeczki
    const { data: measurements } = await window.supabaseClient.from('health_measurements')
        .select('*')
        .eq('profile_id', currentProfileId)
        .order('created_at', { ascending: false });

    // Filtrujemy globalne logi, żeby pokazać tylko te dotyczące bieżącego profilu
    const profileTaskIds = healthTasks.map(t => t.id);
    const profileLogs = healthLogs.filter(l => profileTaskIds.includes(l.health_task_id));

    // Zbieramy wszystko do jednej spójnej listy
    let timelineItems = [];

    // 1. Dorzucamy pomiary
    (measurements || []).forEach(m => {
        timelineItems.push({
            date: new Date(m.created_at),
            title: `Pomiar: ${m.measurement_type}`,
            desc: `<span class="text-[#c2e7ff] font-bold text-base">${m.value} ${m.unit || ''}</span> ${m.notes ? `<br><span class="opacity-70">${window.esc(m.notes)}</span>` : ''}`,
            icon: '📏',
            color: 'text-[#c2e7ff]',
            bg: 'bg-[#004a77]/10 border-[#004a77]/30'
        });
    });

    // 2. Dorzucamy logi (choroby, szczepienia, cykle)
    profileLogs.forEach(l => {
        const task = healthTasks.find(t => t.id === l.health_task_id);
        if (!task) return;

        if (task.task_type === 'duration') {
            // Rejestrujemy moment rozpoczęcia (np. gorączki)
            timelineItems.push({
                date: new Date(l.start_date),
                title: `Zgłoszono: ${task.name}`,
                desc: l.notes ? window.esc(l.notes) : 'Początek objawu/kuracji',
                icon: '🤒',
                color: 'text-[#ffb4ab]',
                bg: 'bg-[#3c1414]/30 border-[#8c1d18]/40'
            });
            
            // Rejestrujemy moment zakończenia
            if (l.end_date) {
                const days = Math.max(1, Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / 86400000));
                timelineItems.push({
                    date: new Date(l.end_date),
                    title: `Zakończono: ${task.name}`,
                    desc: `Czas trwania: <b>${days} dni</b>`,
                    icon: '🏁',
                    color: 'text-rose-300',
                    bg: 'bg-rose-900/10 border-rose-800/30'
                });
            }
        } else if (task.task_type === 'one_time') {
            timelineItems.push({
                date: new Date(l.start_date),
                title: task.name,
                desc: l.notes ? window.esc(l.notes) : 'Wydarzenie medyczne',
                icon: '📅',
                color: 'text-amber-200',
                bg: 'bg-amber-900/10 border-amber-700/30'
            });
        } else {
            timelineItems.push({
                date: new Date(l.start_date),
                title: task.name,
                desc: 'Wykonano z rutyny',
                icon: '🔄',
                color: 'text-[#c4eed0]',
                bg: 'bg-[#0f5223]/10 border-[#0f5223]/30'
            });
        }
    });

    // Sortujemy wszystko od najnowszego do najstarszego
    timelineItems.sort((a, b) => b.date - a.date);

    if (timelineItems.length === 0) {
        tl.innerHTML = `<div class="py-10 text-neutral-500 text-xs text-center relative -left-[16px]">Książeczka jest pusta. Dodaj wpisy, by budować historię medyczną.</div>`;
        return;
    }

    // Generator renderowania osi czasu
    let html = '';
    let lastMonthYear = '';

    timelineItems.forEach(item => {
        const monthYear = item.date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
        
        // Grupowanie miesiącami - ładne bańki z nazwą miesiąca
        if (monthYear !== lastMonthYear) {
            html += `
                <div class="relative -left-7 mb-4 mt-6">
                    <span class="bg-[#1e1f20] px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-neutral-400 border border-[#333537] shadow-sm">${monthYear}</span>
                </div>
            `;
            lastMonthYear = monthYear;
        }

        html += `
            <div class="relative mb-5 last:mb-0">
                <div class="absolute -left-[22px] top-4 w-2.5 h-2.5 rounded-full ${item.bg.split(' ')[0]} border border-[#333537] shadow-[0_0_8px_rgb(0,0,0,0.5)]"></div>
                
                <div class="bg-[#1e1f20] rounded-[20px] border ${item.bg} p-3.5 shadow-sm">
                    <div class="flex items-start justify-between gap-3 mb-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-base shrink-0">${item.icon}</span>
                            <h4 class="font-medium text-sm ${item.color} truncate">${window.esc(item.title)}</h4>
                        </div>
                        <span class="text-[9px] text-neutral-500 font-medium shrink-0 pt-0.5">${item.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                    <p class="text-[11px] text-neutral-400 leading-relaxed ml-7">${item.desc}</p>
                </div>
            </div>
        `;
    });

    tl.innerHTML = html;
};
