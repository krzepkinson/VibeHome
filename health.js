// ==========================================
// LOGIKA: ZDROWIE (health.js)
// ==========================================

let healthProfiles = []; let healthTasks = []; let healthLogs = [];
let currentProfileId = null; let currentMonth = new Date().getMonth(); let currentYear = new Date().getFullYear();
let calendarViewMode = 'month'; 

window.initHealthModule = async function() {
    const hid = window.currentUser.household_id;
    const { data: pData } = await window.supabaseClient.from('profiles')
        .select('*')
        .eq('household_id', hid)
        .order('name');
        
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
        window.supabaseClient.from('health_tasks')
            .select('*')
            .eq('profile_id', currentProfileId)
            .eq('household_id', hid)
            .eq('is_archived', false),
        window.supabaseClient.from('health_logs')
            .select('*')
            .eq('household_id', hid)
            .order('start_date', { ascending: false })
    ]);
    healthTasks = tRes.data || []; 
    healthLogs = lRes.data || [];
};

window.renderHealthUI = function() {
    const profile = healthProfiles.find(p => p.id === currentProfileId);
    const headerAvatar = document.getElementById('health-header-avatar');
    const nameTitle = document.getElementById('profile-name-title');

    if (profile) {
        nameTitle.innerText = profile.name; 
        headerAvatar.innerText = profile.name.charAt(0).toUpperCase();
        const colors = ['bg-rose-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'];
        headerAvatar.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white transition-transform active:scale-90 ${colors[profile.id % colors.length]}`;
    } else {
        nameTitle.innerText = "Brak profilu"; 
        headerAvatar.innerText = "?";
    }
    window.renderCalendar(); 
    window.renderHealthTasks();
};

window.renderCalendar = function() {
    const container = document.getElementById('calendar-container'); 
    const title = document.getElementById('calendar-title');
    if (!container || !title) return;
    
    const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    
    let html = '';
    if (calendarViewMode === 'month') {
        html += `<div class="grid grid-cols-7 gap-1 text-center mb-2">`;
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
            
            html += `<div onclick="window.openDayDetails('${dateStr}')" class="aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${dayClass}"><span class="text-xs">${d}</span></div>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
};

window.changeCalendarMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    window.renderCalendar();
};

window.toggleCalendarMode = function() { 
    window.showToast("Widok miesiąca"); 
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
    } else if (task.task_type === 'one_time') {
        if (taskLogs.length > 0) return '<span class="text-neutral-500">Zrealizowane</span>';
        if (!task.event_date) return 'Brak daty';
        return `Zaplanowane: <span class="text-[#c4eed0]">${new Date(task.event_date).toLocaleDateString('pl-PL')}</span>`;
    } else {
        if (task.interval_days > 0) return `Co ${task.interval_days} dni`;
        if (!taskLogs[0]) return 'Jeszcze nie było robione';
        const last = new Date(taskLogs[0].start_date); last.setHours(0,0,0,0);
        const diff = Math.floor((today - last) / 86400000);
        if (diff === 0) return 'Ostatni raz: dzisiaj';
        if (diff === 1) return 'Ostatni raz: wczoraj';
        return `Ostatni raz: ${diff} dni temu`;
    }
};

window.renderHealthTasks = function() {
    const list = document.getElementById('health-tasks-list');
    if (healthTasks.length === 0) { 
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak przypisanych leków lub zdarzeń.</p>`; 
        return; 
    }

    list.innerHTML = healthTasks.map(task => {
        const tLogs = healthLogs.filter(l => l.health_task_id === task.id);
        const activeLog = tLogs.find(l => l.end_date === null);
        
        let actionBtn = '';
        if (task.task_type === 'one_time') {
            if (tLogs.length === 0) {
                actionBtn = `<button onclick="window.startHealthLog(${task.id}, 'one_time')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 text-[#c4eed0] font-bold text-base flex items-center justify-center active:scale-90 border border-[#0f5223]/50">✓</button>`;
            }
        } else {
            actionBtn = activeLog 
                ? `<button onclick="window.closeHealthLog(${activeLog.id})" class="px-3 py-1.5 rounded-full bg-rose-900/30 text-rose-300 text-[9px] font-bold uppercase tracking-wider">Zakończ</button>`
                : `<button onclick="window.startHealthLog(${task.id}, '${task.task_type}')" class="w-8 h-8 rounded-full bg-[#3c1414] text-[#ffb4ab] font-bold text-base flex items-center justify-center active:scale-90 pb-0.5">+</button>`;
        }

        return `
            <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1 shadow-sm">
                <div class="flex-1 cursor-pointer pr-2" onclick="window.openHealthSettingsScreen(${task.id})">
                    <h3 class="font-medium text-neutral-100 text-sm">${window.esc(task.name)}</h3>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${window.getHealthStatusString(task, activeLog, tLogs)}</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">${actionBtn}</div>
            </div>`;
    }).join('');
};

window.startHealthLog = async function(taskId, type) {
    const now = new Date().toISOString();
    const { error } = await window.supabaseClient.from('health_logs').insert([{ 
        health_task_id: taskId, 
        start_date: now, 
        end_date: (type === 'cyclical' || type === 'one_time') ? now : null, 
        user_id: window.currentUser.id, 
        household_id: window.currentUser.household_id, 
        user_name: window.currentUser.name 
    }]);
    if (error) { 
        window.showToast("Błąd: " + error.message); 
        return; 
    }
    window.showToast("Zapisano!"); 
    await window.refreshHealthData(); 
    window.renderHealthUI(); 
    if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
};

window.closeHealthLog = async function(logId) {
    const { error } = await window.supabaseClient.from('health_logs')
        .update({ end_date: new Date().toISOString() })
        .eq('id', logId)
        .eq('household_id', window.currentUser.household_id);
        
    if (error) { 
        window.showToast("Błąd: " + error.message); 
        return; 
    }
    window.showToast("Zakończono"); 
    await window.refreshHealthData(); 
    window.renderHealthUI(); 
    if(typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
};

window.openNewHealthTaskModal = function() { 
    document.getElementById('h-task-name').value = ''; 
    document.getElementById('h-task-type').value = 'cyclical'; 
    window.toggleHealthInterval(); 
    document.getElementById('new-health-task-modal').classList.remove('hidden'); 
    setTimeout(() => {
        const input = document.getElementById('h-task-name');
        if (input) input.focus();
    }, 100);
};

window.closeNewHealthTaskModal = function() { 
    document.getElementById('new-health-task-modal').classList.add('hidden'); 
};

window.toggleHealthInterval = function() { 
    const type = document.getElementById('h-task-type').value;
    document.getElementById('h-task-interval-container').classList.toggle('hidden', type !== 'cyclical'); 
    document.getElementById('h-task-date-container').classList.toggle('hidden', type !== 'one_time'); 
};

window.saveNewHealthTask = async function() {
    const n = document.getElementById('h-task-name').value.trim(); 
    const type = document.getElementById('h-task-type').value;
    let interval = 0; 
    let remind = 0; 
    let evDate = null;
    
    if (type === 'cyclical') { 
        interval = parseInt(document.getElementById('h-task-interval').value) || 0; 
        remind = parseInt(document.getElementById('h-task-remind').value) || 0; 
    } else if (type === 'one_time') { 
        evDate = document.getElementById('h-task-date').value || null; 
        remind = parseInt(document.getElementById('h-task-remind-date').value) || 0; 
    }

    if (!n || !currentProfileId) return;
    
    const { error } = await window.supabaseClient.from('health_tasks').insert([{ 
        profile_id: currentProfileId, 
        name: n, 
        task_type: type, 
        interval_days: interval, 
        remind_days_before: remind, 
        event_date: evDate, 
        show_in_history: true, 
        is_archived: false, 
        user_id: window.currentUser.id, 
        household_id: window.currentUser.household_id 
    }]);
    
    if (error) { 
        window.showToast("Błąd: " + error.message); 
        return; 
    }
    window.closeNewHealthTaskModal(); 
    window.initHealthModule();
};

window.currentHealthSettingsId = null;

window.openHealthSettingsScreen = async function(taskId) {
    window.currentHealthSettingsId = taskId; 
    const task = healthTasks.find(t => t.id === taskId);
    document.getElementById('h-settings-title').innerText = task.name; 
    document.getElementById('set-h-task-name').value = task.name;
    
    document.getElementById('set-h-task-interval-container').classList.toggle('hidden', task.task_type !== 'cyclical');
    document.getElementById('set-h-task-date-container').classList.toggle('hidden', task.task_type !== 'one_time');
    
    if (task.task_type === 'cyclical') { 
        document.getElementById('set-h-task-interval').value = task.interval_days || 0; 
        document.getElementById('set-h-task-remind').value = task.remind_days_before || 0; 
    } else if (task.task_type === 'one_time') { 
        document.getElementById('set-h-task-date').value = task.event_date || ''; 
        document.getElementById('set-h-task-remind-date').value = task.remind_days_before || 0; 
    }
    document.getElementById('set-h-task-history').checked = task.show_in_history !== false;
    
    window.renderHealthHistory(); 
    window.goForward('health-settings-screen');
};

window.closeHealthSettingsScreen = function() { 
    window.goBack(); 
};

window.saveHealthTaskSettings = async function() {
    const task = healthTasks.find(t => t.id === window.currentHealthSettingsId);
    const n = document.getElementById('set-h-task-name').value.trim(); 
    const showHist = document.getElementById('set-h-task-history').checked;
    
    let updateData = { name: n, show_in_history: showHist };
    
    if (task.task_type === 'cyclical') { 
        updateData.interval_days = parseInt(document.getElementById('set-h-task-interval').value) || 0; 
        updateData.remind_days_before = parseInt(document.getElementById('set-h-task-remind').value) || 0; 
    } else if (task.task_type === 'one_time') { 
        updateData.event_date = document.getElementById('set-h-task-date').value || null; 
        updateData.remind_days_before = parseInt(document.getElementById('set-h-task-remind-date').value) || 0; 
    }

    const { error } = await window.supabaseClient.from('health_tasks')
        .update(updateData)
        .eq('id', window.currentHealthSettingsId)
        .eq('household_id', window.currentUser.household_id);
        
    if (error) { 
        window.showToast("Błąd: " + error.message); 
        return; 
    }
    window.showToast("Zapisano!"); 
    window.initHealthModule();
};

window.renderHealthHistory = function() {
    const logs = healthLogs.filter(l => l.health_task_id === window.currentHealthSettingsId);
    document.getElementById('h-settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5">
            <div>
                <p class="text-xs font-medium text-neutral-200">${new Date(l.start_date).toLocaleDateString('pl-PL')}</p>
                <p class="text-[9px] text-neutral-500">${l.end_date ? 'do ' + new Date(l.end_date).toLocaleDateString('pl-PL') : 'trwa'}</p>
            </div>
            <button onclick="window.deleteHealthLog(${l.id})" class="text-neutral-500 text-sm">🗑️</button>
        </div>`).join('') || '<p class="text-center py-4 text-neutral-500 text-xs">Brak wpisów.</p>';
};

window.deleteHealthLog = function(id) {
    window.customConfirm("Usunąć ten wpis z historii?", async () => {
        const { error } = await window.supabaseClient.from('health_logs')
            .delete()
            .eq('id', id)
            .eq('household_id', window.currentUser.household_id);
            
        if (error) { 
            window.showToast("Błąd: " + error.message); 
            return; 
        }
        await window.refreshHealthData(); 
        window.renderHealthHistory(); 
        window.renderHealthUI();
    });
};

window.deleteHealthTask = function() {
    window.customConfirm("Zarchiwizować to zdarzenie? Zniknie z głównych widoków.", async () => {
        const { error } = await window.supabaseClient.from('health_tasks')
            .update({ is_archived: true })
            .eq('id', window.currentHealthSettingsId)
            .eq('household_id', window.currentUser.household_id);
            
        if (error) { 
            window.showToast("Błąd: " + error.message); 
            return; 
        }
        window.closeHealthSettingsScreen(); 
        window.initHealthModule();
    });
};

window.openDayDetails = function(dateStr) {
    const modal = document.getElementById('day-details-modal'); 
    const list = document.getElementById('day-details-list');
    
    document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const dayLogs = healthLogs.filter(l => { 
        const start = l.start_date.split('T')[0]; 
        const end = l.end_date ? l.end_date.split('T')[0] : new Date().toISOString().split('T')[0]; 
        return dateStr >= start && dateStr <= end; 
    });
    
    const oneTimeEvents = healthTasks.filter(t => t.task_type === 'one_time' && t.event_date === dateStr);
    
    if (dayLogs.length === 0 && oneTimeEvents.length === 0) { 
        list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zdarzeń w tym dniu.</p>`; 
    } else {
        let itemsHtml = '';
        oneTimeEvents.forEach(t => { 
            const isDone = healthLogs.some(l => l.health_task_id === t.id); 
            itemsHtml += `
                <div class="px-3 py-2 bg-[#1e1f20] rounded-xl border border-[#004a77]/30 mb-1.5">
                    <p class="text-sm font-medium text-[#c2e7ff]">📅 ${window.esc(t.name)}</p>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${isDone ? 'Zrealizowane' : 'Do zrobienia'}</p>
                </div>`; 
        });
        
        dayLogs.forEach(l => { 
            const task = healthTasks.find(t => t.id === l.health_task_id) || { name: 'Usunięte zadanie' }; 
            itemsHtml += `
                <div class="px-3 py-2 bg-[#131314] rounded-xl border border-[#333537] mb-1.5">
                    <p class="text-sm font-medium text-neutral-200">${window.esc(task.name)}</p>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${l.end_date ? 'Zdarzenie zakończone' : 'W trakcie...'}</p>
                </div>`; 
        });
        list.innerHTML = itemsHtml;
    }
    modal.classList.remove('hidden');
};

window.closeDayDetailsModal = function() { 
    document.getElementById('day-details-modal').classList.add('hidden'); 
};

window.toggleProfileSwitcher = function() {
    const modal = document.getElementById('profile-switcher-modal');
    document.getElementById('switcher-profiles-list').innerHTML = healthProfiles.map(p => `
        <div onclick="window.selectHealthProfile(${p.id})" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-[#333537] ${p.id === currentProfileId ? 'bg-[#333537] border border-[#a8c7fa]' : ''}">
            <div class="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-xs font-bold">${window.esc(p.name.charAt(0).toUpperCase())}</div>
            <span class="text-sm text-neutral-200">${window.esc(p.name)}</span>
        </div>
    `).join('');
    modal.classList.remove('hidden');
};

window.selectHealthProfile = function(id) { 
    currentProfileId = id; 
    window.closeProfileSwitcher(); 
    window.initHealthModule(); 
};

window.closeProfileSwitcher = function() { 
    document.getElementById('profile-switcher-modal').classList.add('hidden'); 
};
