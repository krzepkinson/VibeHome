// ==========================================
// LOGIKA: ZDROWIE 2.0 (health.js)
// ==========================================

window.HealthModule = (() => {
    // --- BEZPIECZNY STAN PRYWATNY ---
    let healthProfiles = []; 
    let healthTasks = []; 
    let healthLogs = [];
    let currentProfileId = null; 

    let healthViewMode = 'list';
    let currentMonth = new Date().getMonth(); 
    let currentYear = new Date().getFullYear();

    // Helper: Poprawne daty lokalne (zamiast split('T')[0] w UTC)
    const getLocalDayStr = (dObj = new Date()) => {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    window.toggleHealthView = function() {
        healthViewMode = healthViewMode === 'list' ? 'calendar' : 'list';
        const toggleBtn = document.getElementById('health-view-toggle-btn');
        if (toggleBtn) toggleBtn.innerText = healthViewMode === 'list' ? '📅' : '📋';
        window.renderHealthUI();
    };

    window.initHealthModule = async function() {
        let storeProfiles = window.AppStore && typeof window.AppStore.get === 'function' ? window.AppStore.get('profiles') : null;
        let pData = Array.isArray(storeProfiles) ? storeProfiles : (storeProfiles ? storeProfiles.data || [] : []);
        
        if (pData.length > 0) {
            healthProfiles = pData;
        } else {
            const hid = window.currentUser.household_id;
            const res = await window.supabaseClient.from('profiles').select('*').eq('household_id', hid).order('name');
            healthProfiles = res.data || [];
        }
        
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

        let needTasksFetch = true;
        let needLogsFetch = true;

        if (window.AppStore && typeof window.AppStore.get === 'function') {
            const storeTasks = window.AppStore.get('hTasks') || window.AppStore.get('healthTasks');
            const storeLogs = window.AppStore.get('hLogs') || window.AppStore.get('healthLogs');

            const allTasks = Array.isArray(storeTasks) ? storeTasks : (storeTasks ? storeTasks.data || [] : []);
            const allLogs = Array.isArray(storeLogs) ? storeLogs : (storeLogs ? storeLogs.data || [] : []);

            if (allTasks.length > 0) {
                healthTasks = allTasks.filter(t => t.profile_id == currentProfileId && t.is_archived !== true);
                needTasksFetch = false;
            }
            
            if (allLogs.length > 0) {
                healthLogs = allLogs;
                needLogsFetch = false;
            }
        }

        if (needTasksFetch) {
            const { data: tData } = await window.supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId).eq('household_id', hid).eq('is_archived', false);
            healthTasks = tData || [];
        }

        if (needLogsFetch) {
            const { data: lData } = await window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false }).limit(500);
            healthLogs = lData || [];
        }
    };

    window.renderHealthUI = function() {
        const profile = healthProfiles.find(p => p.id === currentProfileId);
        const calWrapper = document.getElementById('health-calendar-wrapper');
        const sectionsWrapper = document.getElementById('health-sections-wrapper');

        const pillsContainer = document.getElementById('health-profile-pills');
        if (pillsContainer && healthProfiles.length > 0) {
            pillsContainer.innerHTML = healthProfiles.map(p => {
                const isActive = p.id === currentProfileId;
                const color = window.getAvatarColor ? window.getAvatarColor(p.name) : 'bg-neutral-600';
                const activeClass = isActive
                    ? `${color} text-white border-transparent shadow-md scale-105`
                    : 'bg-[#1e1f20] text-neutral-400 border-[#333537]';
                return `
                <button class="js-select-health-profile flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all active:scale-95 ${activeClass}" data-id="${p.id}">
                    <span class="font-bold">${window.esc(p.name.charAt(0).toUpperCase())}</span>
                    <span>${window.esc(p.name)}</span>
                </button>`;
            }).join('');
            pillsContainer.classList.remove('hidden');
        } else if (pillsContainer) {
            pillsContainer.classList.add('hidden');
        }

        if (!profile) {
            const nameTitle = document.getElementById('profile-name-title');
            const headerAvatar = document.getElementById('health-header-avatar');
            if (nameTitle) nameTitle.innerText = "Karta zdrowia"; 
            if (headerAvatar) headerAvatar.innerText = "?";
            if (calWrapper) calWrapper.classList.add('hidden');
            if (sectionsWrapper) {
                sectionsWrapper.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in px-4 mt-4 bg-[#1e1f20] rounded-[28px] border border-[#333537]">
                        <div class="text-7xl mb-6 opacity-80 drop-shadow-lg">👨‍👩‍👧‍👦</div>
                        <h3 class="text-neutral-100 font-medium text-xl mb-2 tracking-wide">Brak domowników</h3>
                        <p class="text-neutral-400 text-xs mb-8 max-w-[260px] leading-relaxed">Dodaj pierwszy profil domownika, by móc śledzić jego leki, wizyty lekarskie i samopoczucie.</p>
                        <button onclick="window.openNewProfileModal()" class="bg-[#e3e3e3] text-[#131314] font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2">
                            <span class="text-xl pb-1">+</span> Dodaj osobę
                        </button>
                    </div>`;
            }
            return; 
        }
        
        const nameTitle = document.getElementById('profile-name-title');
        const headerAvatar = document.getElementById('health-header-avatar');
        if (nameTitle) nameTitle.innerText = profile.name; 
        
        if (headerAvatar) {
            headerAvatar.className = `w-9 h-9 rounded-full flex items-center justify-center font-bold border-2 border-[#131314] shadow-md text-white transition-transform active:scale-90 text-xs ${window.getAvatarColor ? window.getAvatarColor(profile.name) : 'bg-rose-600'}`;
            headerAvatar.innerText = profile.name.charAt(0).toUpperCase();
        }

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

        const activeTasks = healthTasks.filter(t => t.task_type === 'duration');
        const currentlyActive = [];
        activeTasks.forEach(t => {
            const log = healthLogs.find(l => l.health_task_id === t.id && l.end_date === null);
            if (log) currentlyActive.push({ task: t, log: log });
        });

        document.getElementById('health-active-section').classList.toggle('hidden', currentlyActive.length === 0);
        if(activeList) activeList.innerHTML = currentlyActive.map(item => window.UI.renderHealthActiveTask(item.task, item.log)).join('');

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
                return window.UI.renderHealthUpcomingTask(t, label);
            }).join('');
        }

        if(routineList) {
            routineList.innerHTML = healthTasks.filter(t => t.task_type === 'cyclical').map(t => {
                const tLogs = healthLogs.filter(l => l.health_task_id === t.id);
                const statusHtml = window.getHealthStatusString(t, null, tLogs);
                return window.UI.renderHealthRoutineTask(t, statusHtml);
            }).join('') || window.UI.renderEmptyState("Brak zaplanowanych rutyn", "");
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
        ['Pn','Wt','Śr','Czw','Pt','So','Nd'].forEach(d => { html += `<div class="text-[9px] text-neutral-600 font-bold uppercase">${d}</div>`; });
        html += `</div><div class="grid grid-cols-7 gap-1">`;
        
        const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) { html += `<div></div>`; }
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayLogs = healthLogs.filter(l => {
                const start = l.start_date.split('T')[0];
                const end = l.end_date ? l.end_date.split('T')[0] : getLocalDayStr();
                return dateStr >= start && dateStr <= end;
            });
            const oneTimeEvents = healthTasks.filter(t => t.task_type === 'one_time' && t.event_date === dateStr);
            const isToday = getLocalDayStr() === dateStr;
            const hasEvents = dayLogs.length > 0 || oneTimeEvents.length > 0;
            
            let dayClass = 'hover:bg-[#333537] text-neutral-300';
            if (isToday && hasEvents) dayClass = 'bg-[#ffb4ab] text-[#3c1414] font-bold border-2 border-rose-500';
            else if (isToday) dayClass = 'bg-[#ffb4ab] text-[#3c1414] font-bold';
            else if (hasEvents) dayClass = 'bg-rose-900/60 text-rose-200 border border-rose-700 font-bold';
            
            html += `<div class="js-open-day-details aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${dayClass}" data-date="${dateStr}"><span class="text-xs">${d}</span></div>`;
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
            if (!taskLogs || taskLogs.length === 0) return `Ostatnio: <span class="text-neutral-600">nigdy</span> • Następna: <span class="text-[#ffb4ab] font-bold">Teraz</span>`;
            const lastDate = new Date(taskLogs[0].start_date); lastDate.setHours(0,0,0,0);
            const diffLast = Math.floor((today - lastDate) / 86400000);
            let lastStr = diffLast === 0 ? 'dziś' : `${diffLast} dni temu`;
            if (!task.interval_days || task.interval_days === 0) return `Ostatnio: <span class="text-neutral-300">${lastStr}</span>`;
            const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
            const diffNext = Math.ceil((nextDate - today) / 86400000);
            let nextStr = diffNext < 0 ? `<span class="text-[#ffb4ab] font-bold">spóźnione ${Math.abs(diffNext)} dni!</span>` : (diffNext === 0 ? `<span class="text-amber-400 font-bold">dziś!</span>` : `<span class="text-neutral-300">za ${diffNext} dni</span>`);
            return `Ostatnio: <span class="text-neutral-400">${lastStr}</span> • Następna: ${nextStr}`;
        }
    };

    window.startHealthLog = async function(taskId, type) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const now = new Date().toISOString();
        
        const { error } = await window.supabaseClient.from('health_logs').insert([{ 
            health_task_id: taskId, start_date: now, end_date: (type === 'cyclical' || type === 'one_time') ? now : null, 
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
        }]);

        if (error) { window.showToast("Błąd: " + error.message); return; }

        const task = healthTasks.find(t => t.id == taskId);
        if (task && task.task_type === 'cyclical' && task.interval_days > 0) {
            const nextDate = new Date(now);
            nextDate.setDate(nextDate.getDate() + task.interval_days);
            await window.supabaseClient.from('health_tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', taskId);
        }

        window.showToast("Zapisano!"); 
        if(typeof window.loadDashboardOverview === 'function') { 
            window.invalidateDashboardCache(); 
            await window.loadDashboardOverview(); 
        }
        await window.refreshHealthData(); 
        window.renderHealthUI(); 
    };

    window.closeHealthLog = async function(logId) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const { error } = await window.supabaseClient.from('health_logs').update({ end_date: new Date().toISOString() }).eq('id', logId).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Zakończono"); 
        
        if(typeof window.loadDashboardOverview === 'function') { 
            window.invalidateDashboardCache(); 
            await window.loadDashboardOverview(); 
        }
        await window.refreshHealthData(); 
        window.renderHealthUI(); 
    };

    window.openHealthFabMenu = function() { document.getElementById('health-fab-menu').classList.remove('hidden'); };
    window.closeHealthFabMenu = function() { document.getElementById('health-fab-menu').classList.add('hidden'); };

    window.openNewHealthTaskModal = function(defaultType = 'cyclical') { 
        document.getElementById('h-task-name').value = ''; 
        document.getElementById('h-task-type').value = defaultType; 
        window.toggleHealthInterval(); 
        document.getElementById('new-health-task-modal').classList.remove('hidden'); 
    };
    window.openNewDurationModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('duration'); };
    window.openNewEventModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('one_time'); };
    window.openNewRoutineModal = function() { window.closeHealthFabMenu(); window.openNewHealthTaskModal('cyclical'); };
    window.closeNewHealthTaskModal = function() { document.getElementById('new-health-task-modal').classList.add('hidden'); };

    window.toggleHealthInterval = function() { 
        const type = document.getElementById('h-task-type').value;
        document.getElementById('h-task-interval-container').classList.toggle('hidden', type !== 'cyclical'); 
        document.getElementById('h-task-date-container').classList.toggle('hidden', type !== 'one_time'); 
    };

    window.saveNewHealthTask = async function() {
        const n = document.getElementById('h-task-name').value.trim(); 
        const type = document.getElementById('h-task-type').value;
        let interval = 0; let remind = 0; let evDate = null;
        let initialDue = null; 

        if (type === 'cyclical') { 
            interval = parseInt(document.getElementById('h-task-interval').value) || 0; 
            remind = parseInt(document.getElementById('h-task-remind').value) || 0; 
            initialDue = new Date().toISOString(); 
        } else if (type === 'one_time') { 
            evDate = document.getElementById('h-task-date').value || null; 
            remind = parseInt(document.getElementById('h-task-remind-date').value) || 0; 
            if (evDate) {
                initialDue = new Date(evDate).toISOString(); 
            }
        }
        
        if (!n || !currentProfileId) return;

        const { error } = await window.supabaseClient.from('health_tasks').insert([{ 
            profile_id: currentProfileId, name: n, task_type: type, interval_days: interval, 
            remind_days_before: remind, event_date: evDate, show_in_history: true, is_archived: false, 
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id,
            next_due_at: initialDue
        }]);
        
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.closeNewHealthTaskModal(); 
        
        if(typeof window.loadDashboardOverview === 'function') { 
            window.invalidateDashboardCache(); 
            await window.loadDashboardOverview(); 
        }
        window.initHealthModule();
    };

    window.currentHealthSettingsId = null;
    window.openHealthSettingsScreen = async function(taskId) {
        window.currentHealthSettingsId = parseInt(taskId); 
        const task = healthTasks.find(t => t.id === window.currentHealthSettingsId);
        document.getElementById('health-settings-title-top').innerText = task.name; 
        document.getElementById('health-settings-name').value = task.name;
        
        if (task.task_type === 'cyclical') { 
            document.getElementById('health-settings-interval').value = task.interval_days || 0; 
            document.getElementById('health-settings-remind-days').value = task.remind_days_before || 0; 
        } else if (task.task_type === 'one_time') { 
            // Fallback for UI elements if present in your specific health-settings.html
        }
        window.goForward('health-settings-screen');
    };
    
    window.closeHealthSettingsScreen = function() { window.goBack(); };

    window.saveHealthSettings = async function() {
        const task = healthTasks.find(t => t.id === window.currentHealthSettingsId);
        const n = document.getElementById('health-settings-name').value.trim(); 
        let updateData = { name: n };
        
        if (task.task_type === 'cyclical') { 
            updateData.interval_days = parseInt(document.getElementById('health-settings-interval').value) || 0; 
            updateData.remind_days_before = parseInt(document.getElementById('health-settings-remind-days').value) || 0; 
        } 
        
        const { error } = await window.supabaseClient.from('health_tasks').update(updateData).eq('id', window.currentHealthSettingsId).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Zapisano!"); 
        
        if(typeof window.loadDashboardOverview === 'function') { 
            window.invalidateDashboardCache(); 
            await window.loadDashboardOverview(); 
        }
        window.initHealthModule(); 
        window.goBack();
    };

    window.deleteHealthTask = function() {
        window.customConfirm("Zarchiwizować to zdarzenie?", async () => {
            const { error } = await window.supabaseClient.from('health_tasks').update({ is_archived: true }).eq('id', window.currentHealthSettingsId).eq('household_id', window.currentUser.household_id);
            if (error) { window.showToast("Błąd: " + error.message); return; }
            
            if(typeof window.loadDashboardOverview === 'function') { 
                window.invalidateDashboardCache(); 
                await window.loadDashboardOverview(); 
            }
            window.closeHealthSettingsScreen(); window.initHealthModule();
        });
    };

    window.openDayDetails = function(dateStr) {
        const modal = document.getElementById('day-details-modal'); 
        const list = document.getElementById('day-details-list');
        document.getElementById('day-details-title').innerText = "Szczegóły Zdrowia";
        document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        const dayLogs = healthLogs.filter(l => { 
            const start = l.start_date.split('T')[0]; 
            const end = l.end_date ? l.end_date.split('T')[0] : getLocalDayStr(); 
            return dateStr >= start && dateStr <= end; 
        });
        const oneTimeEvents = healthTasks.filter(t => t.task_type === 'one_time' && t.event_date === dateStr);
        if (dayLogs.length === 0 && oneTimeEvents.length === 0) { list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zdarzeń.</p>`; } 
        else {
            let itemsHtml = '';
            oneTimeEvents.forEach(t => { const isDone = healthLogs.some(l => l.health_task_id === t.id); itemsHtml += window.UI.renderHealthDayEvent(t, isDone); });
            dayLogs.forEach(l => { const task = healthTasks.find(t => t.id === l.health_task_id) || { name: 'Usunięte zadanie' }; itemsHtml += window.UI.renderHealthDayLog(task, l); });
            list.innerHTML = itemsHtml;
        }
        modal.classList.remove('hidden');
    };

    window.closeDayDetailsModal = function() { document.getElementById('day-details-modal').classList.add('hidden'); };

    window.selectHealthProfile = function(id) { 
        currentProfileId = parseInt(id); 
        if (typeof window.closeProfileSwitcher === 'function') window.closeProfileSwitcher();
        window.initHealthModule(); 
    };

    window.toggleProfileSwitcher = function() {
        const modal = document.getElementById('profile-switcher-modal');
        if (!modal) return;
        document.getElementById('switcher-profiles-list').innerHTML = healthProfiles.map(p => window.UI.renderProfileSwitcherItem(p, p.id === currentProfileId)).join('');
        modal.classList.remove('hidden');
    };

    window.closeProfileSwitcher = function() { 
        const modal = document.getElementById('profile-switcher-modal');
        if (modal) modal.classList.add('hidden'); 
    };

    // ==========================================
    // MODUŁ: DOMOWA APTECZKA
    // ==========================================

    window.allPharmacyItems = [];
    window.openPharmacyScreen = function() { window.goForward('pharmacy-screen'); window.loadPharmacyItems(); };
    window.closePharmacyScreen = function() { window.goBack(); };
    
    window.loadPharmacyItems = async function() {
        const listEl = document.getElementById('pharmacy-list');
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Szukam leków...</p>`;
        const { data, error } = await window.supabaseClient.from('pharmacy_items').select('*').eq('household_id', window.currentUser.household_id).order('expiration_date', { ascending: true, nullsFirst: false });
        if (error) { listEl.innerHTML = `<p class="text-center text-[#ffb4ab] text-xs py-10">Błąd pobierania bazy leków.</p>`; return; }
        window.allPharmacyItems = data || [];
        window.renderPharmacyList();
    };

    // LOKALNA WYSZUKIWARKA W APTECZCE
    window.renderPharmacyList = function() {
        const listEl = document.getElementById('pharmacy-list');
        const searchInput = document.getElementById('pharmacy-search-input');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        if (window.allPharmacyItems.length === 0) { 
            listEl.innerHTML = window.UI.renderEmptyState("Apteczka jest pusta", "Kliknij '+' powyżej"); 
            return; 
        }

        const filteredData = window.allPharmacyItems.filter(item => 
            item.name.toLowerCase().includes(query) || 
            (item.purpose && item.purpose.toLowerCase().includes(query))
        );

        if (filteredData.length === 0) {
            listEl.innerHTML = window.UI.renderEmptyState("Nie znaleziono", "Brak leku o takiej nazwie");
            return;
        }

        const today = new Date(); today.setHours(0,0,0,0);
        const thirtyDaysFromNow = new Date(today); thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        listEl.innerHTML = filteredData.map(item => {
            let statusHtml = ''; let borderClass = 'border-[#333537]'; let opacityClass = '';
            if (item.expiration_date) {
                const expDate = new Date(item.expiration_date); expDate.setHours(0,0,0,0);
                const displayDate = `${String(expDate.getMonth() + 1).padStart(2, '0')}.${expDate.getFullYear()}`;
                if (expDate < today) { 
                    statusHtml = `<span class="text-[9px] font-bold text-[#ffb4ab] bg-[#3c1414] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">⚠ ${displayDate}</span>`; 
                    borderClass = 'border-[#8c1d18]/50'; opacityClass = 'opacity-60'; 
                } 
                else if (expDate <= thirtyDaysFromNow) { 
                    statusHtml = `<span class="text-[9px] font-bold text-amber-200 bg-amber-900/50 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">⏳ ${displayDate}</span>`; 
                    borderClass = 'border-amber-700/50'; 
                } 
                else { 
                    statusHtml = `<span class="text-[10px] font-medium text-neutral-400">${displayDate}</span>`; 
                }
            } else { 
                statusHtml = `<span class="text-[9px] text-neutral-600 uppercase tracking-widest">Brak daty</span>`; 
            }
            return window.UI.renderPharmacyItem(item, statusHtml, borderClass, opacityClass);
        }).join('');
    };

    window.openNewPharmacyItemModal = function() { 
        window.loadAndShowModal('new-pharmacy-item-modal', '/modals/new-pharmacy-item.html', () => {
            document.getElementById('pharmacy-item-name').value = ''; 
            document.getElementById('pharmacy-item-exp').value = ''; 
            document.getElementById('pharmacy-item-purpose').value = '';
        });
    };
    window.closeNewPharmacyItemModal = function() { document.getElementById('new-pharmacy-item-modal').classList.add('hidden'); };

    window.saveNewPharmacyItem = async function() {
        const name = document.getElementById('pharmacy-item-name').value.trim();
        const expRaw = document.getElementById('pharmacy-item-exp').value || null; 
        const purpose = document.getElementById('pharmacy-item-purpose').value.trim() || null;
        if (!name) { window.showToast("Podaj nazwę leku!"); return; }
        
        let expDateSQL = null;
        if (expRaw) {
            const parts = expRaw.split('-');
            if (parts.length === 2) {
                const year = parseInt(parts[0]); const month = parseInt(parts[1]); const lastDay = new Date(year, month, 0).getDate();
                expDateSQL = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }
        }

        const { error } = await window.supabaseClient.from('pharmacy_items').insert([{
            household_id: window.currentUser.household_id, user_id: window.currentUser.user_id, name: name, expiration_date: expDateSQL, purpose: purpose
        }]);
        
        if (error) { window.showToast("Błąd zapisu: " + error.message); return; }
        window.closeNewPharmacyItemModal(); window.showToast("Lek dodany!"); window.loadPharmacyItems();
    };

    // --- NOWE FUNKCJE EDYCJI LEKÓW ---
    window.openEditPharmacyModal = function(id) {
        const item = window.allPharmacyItems.find(p => p.id == id);
        if (!item) return;

        window.loadAndShowModal('edit-pharmacy-item-modal', '/modals/edit-pharmacy-item.html', () => {
            document.getElementById('edit-pharmacy-id').value = item.id;
            document.getElementById('edit-pharmacy-name').value = item.name;
            document.getElementById('edit-pharmacy-purpose').value = item.purpose || '';
            if (item.expiration_date) {
                document.getElementById('edit-pharmacy-exp').value = item.expiration_date.substring(0, 7); 
            } else {
                document.getElementById('edit-pharmacy-exp').value = '';
            }
        });
    };

    window.closeEditPharmacyModal = function() { 
        const modal = document.getElementById('edit-pharmacy-item-modal');
        if (modal) modal.classList.add('hidden'); 
    };

    window.saveEditedPharmacyItem = async function() {
        const id = document.getElementById('edit-pharmacy-id').value;
        const name = document.getElementById('edit-pharmacy-name').value.trim();
        const expRaw = document.getElementById('edit-pharmacy-exp').value || null;
        const purpose = document.getElementById('edit-pharmacy-purpose').value.trim() || null;

        if (!name) { window.showToast("Podaj nazwę leku!"); return; }

        let expDateSQL = null;
        if (expRaw) {
            const parts = expRaw.split('-');
            if (parts.length === 2) {
                const year = parseInt(parts[0]); const month = parseInt(parts[1]); const lastDay = new Date(year, month, 0).getDate();
                expDateSQL = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }
        }

        const { error } = await window.supabaseClient.from('pharmacy_items')
            .update({ name: name, expiration_date: expDateSQL, purpose: purpose })
            .eq('id', id).eq('household_id', window.currentUser.household_id);

        if (error) { window.showToast("Błąd zapisu: " + error.message); return; }
        
        window.closeEditPharmacyModal(); 
        window.showToast("Lek zaktualizowany!"); 
        window.loadPharmacyItems();
    };

    window.deletePharmacyItem = function(id) {
        window.customConfirm("Usunąć ten lek?", async () => {
            const { error } = await window.supabaseClient.from('pharmacy_items').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
            if (error) { window.showToast("Błąd usuwania: " + error.message); return; }
            window.showToast("Lek wyrzucony!"); 
            window.closeEditPharmacyModal();
            window.loadPharmacyItems();
        });
    };

    // --- KSIĄŻECZKA ZDROWIA I POMIARY ---
    window.openNewMeasurementModal = function() { window.closeHealthFabMenu(); document.getElementById('measurement-value').value = ''; document.getElementById('measurement-date').value = getLocalDayStr(); document.getElementById('measurement-notes').value = ''; document.getElementById('new-measurement-modal').classList.remove('hidden'); };
    window.closeNewMeasurementModal = function() { document.getElementById('new-measurement-modal').classList.add('hidden'); };

    window.saveNewMeasurement = async function() {
        const type = document.getElementById('measurement-type').value;
        const valRaw = document.getElementById('measurement-value').value.trim();
        const date = document.getElementById('measurement-date').value;
        const notes = document.getElementById('measurement-notes').value.trim();
        if (!valRaw || !currentProfileId) return;
        const numericVal = parseFloat(valRaw.replace(',', '.'));
        if (isNaN(numericVal)) { window.showToast("Podaj poprawną liczbę!"); return; }
        let unit = type === 'Waga' ? 'kg' : (type === 'Wzrost' ? 'cm' : '°C');
        const todayStr = getLocalDayStr();
        const finalDate = (date === todayStr) ? new Date().toISOString() : `${date}T12:00:00.000Z`;

        const { error } = await window.supabaseClient.from('health_measurements').insert([{
            household_id: window.currentUser.household_id, profile_id: currentProfileId, user_id: window.currentUser.user_id,
            measurement_type: type, value: numericVal, unit: unit, notes: notes, created_at: finalDate 
        }]);
        if (error) { window.showToast("Błąd zapisu: " + error.message); return; }
        window.closeNewMeasurementModal(); window.showToast("Pomiar zapisany!");
        if (window.activeView === 'health-book-screen') window.loadHealthBook();
    };

    window.openHealthBook = function() { window.goForward('health-book-screen'); window.loadHealthBook(); };
    window.closeHealthBook = function() { window.goBack(); };

    window.loadHealthBook = async function() {
        const tl = document.getElementById('health-book-timeline');
        if (!tl) return;
        tl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Analizowanie danych...</p>`;
        
        try {
            const profile = healthProfiles.find(p => p.id === currentProfileId);
            if (profile) {
                const subtitle = document.getElementById('health-book-subtitle');
                if (subtitle) subtitle.innerText = `Pacjent: ${profile.name}`;
            }

            const { data: measurements, error: mError } = await window.supabaseClient
                .from('health_measurements')
                .select('*')
                .eq('profile_id', currentProfileId)
                .order('created_at', { ascending: false });

            if (mError) throw mError;

            const tasks = healthTasks || [];
            const logs = healthLogs || [];
            
            const profileLogs = logs.filter(l => tasks.some(t => t.id === l.health_task_id));
            
            let timelineItems = [];

            (measurements || []).forEach(m => {
                timelineItems.push({
                    date: new Date(m.created_at),
                    title: `Pomiar: ${m.measurement_type}`,
                    desc: `Wynik: <span class="text-[#c2e7ff] font-bold">${m.value} ${m.unit || ''}</span>${m.notes ? `<br><span class="text-[10px] opacity-70">${window.esc(m.notes)}</span>` : ''}`,
                    icon: '📏',
                    color: 'text-[#c2e7ff]',
                    bg: 'bg-[#004a77]/10 border-[#004a77]/30'
                });
            });

            profileLogs.forEach(l => {
                const task = tasks.find(t => t.id === l.health_task_id);
                if (!task) return;

                const wykonawca = l.user_name || 'Domownik';
                let szczegoly = '';
                
                if (task.task_type === 'duration') {
                    szczegoly = l.end_date ? `Zdarzenie trwało do ${new Date(l.end_date).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}` : 'Zdarzenie nadal trwa';
                } else {
                    szczegoly = `Zarejestrowano wykonanie zadania`;
                }

                timelineItems.push({
                    date: new Date(l.start_date),
                    title: task.name,
                    desc: `<span class="text-neutral-400">Pacjent:</span> ${window.esc(profile.name)}<br><span class="text-neutral-400">Wpisał(a):</span> ${window.esc(wykonawca)}`,
                    icon: task.task_type === 'duration' ? '🤒' : '🔄',
                    color: task.task_type === 'duration' ? 'text-[#ffb4ab]' : 'text-[#c4eed0]',
                    bg: task.task_type === 'duration' ? 'bg-[#3c1414]/30 border-[#8c1d18]/40' : 'bg-[#0f5223]/10 border-[#0f5223]/30'
                });
            });

            timelineItems.sort((a, b) => b.date - a.date);

            if (timelineItems.length === 0) {
                tl.innerHTML = `<div class="py-10 text-neutral-500 text-xs text-center">Brak wpisów w książeczce dla: ${profile.name}</div>`;
                return;
            }

            let html = '';
            let lastMonthYear = '';
            timelineItems.forEach(item => {
                const monthYear = item.date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
                if (monthYear !== lastMonthYear) {
                    html += window.UI.renderHealthBookSeparator(monthYear);
                    lastMonthYear = monthYear;
                }
                html += window.UI.renderHealthBookTimelineItem(item);
            });
            tl.innerHTML = html;

        } catch (err) {
            console.error("Błąd ładowania Książeczki:", err);
            tl.innerHTML = `<p class="text-center text-rose-400 text-xs py-10">Błąd: ${err.message}</p>`;
        }
    };

    // ==========================================
    // DELEGACJA ZDARZEŃ (VIA DISPATCHER)
    // ==========================================
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-select-health-profile', (e, el) => window.selectHealthProfile(el.dataset.id));
        window.EventDispatcher.onClick('.js-close-health-log', (e, el) => window.closeHealthLog(el.dataset.id));
        window.EventDispatcher.onClick('.js-start-health-log', (e, el) => window.startHealthLog(el.dataset.id, el.dataset.type));
        window.EventDispatcher.onClick('.js-open-health-settings', (e, el) => window.openHealthSettingsScreen(el.dataset.id));
        window.EventDispatcher.onClick('.js-open-day-details', (e, el) => window.openDayDetails(el.dataset.date));
        window.EventDispatcher.onClick('.js-select-profile', (e, el) => window.selectHealthProfile(el.dataset.id));
        window.EventDispatcher.onClick('.js-delete-pharmacy-item', (e, el) => window.deletePharmacyItem(el.dataset.id));
        
        window.EventDispatcher.onClick('.js-open-edit-pharmacy', (e, el) => {
            // Blokujemy odpalenie edycji, jeśli user zdołał kliknąć ikonę usuwania ze swipe'a
            if (e.target.closest('.js-delete-pharmacy-item')) return;
            window.openEditPharmacyModal(el.dataset.id);
        });
        
        window.EventDispatcher.onClick('.js-delete-health-log', (e, el) => window.deleteHealthLog(el.dataset.id));
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return {};
})();
