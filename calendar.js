// ==========================================
// LOGIKA: ZUNIFIKOWANY KALENDARZ (calendar.js)
// ==========================================

window.CalendarModule = (() => {
    let currentTab = 'agenda'; 
    let activeFilter = 'all'; 
    let activeSubFilterTask = null; 
    let activeSubFilterPerson = null; 
    
    let allEvents = []; 
    let appProfiles = [];
    
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let eventsSetupDone = false; // Zapobiega duplikacji listenerów

    const getLocalDayStr = (dObj = new Date()) => {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    async function init() {
        document.getElementById('calendar-subtitle').innerText = 'Ładowanie danych...';
        await fetchAllData();
        renderProfilePills();
        renderCurrentTab();
        setupEvents();
    }

    async function fetchAllData() {
        const hid = window.currentUser.household_id;
        allEvents = [];

        try {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const dateLimit = oneYearAgo.toISOString();

            const [profilesRes, tasksRes, tLogsRes, hTasksRes, hLogsRes, eventsRes] = await Promise.all([
                window.supabaseClient.from('profiles').select('*').eq('household_id', hid).order('name'),
                window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid).gte('created_at', dateLimit).limit(2000),
                window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).gte('start_date', dateLimit).limit(2000),
                window.supabaseClient.from('calendar_events').select('*').eq('household_id', hid).gte('event_datetime', dateLimit).limit(1000)
            ]);

            appProfiles = profilesRes.data || [];

            // 0. WYDARZENIA TOWARZYSKIE
            if (eventsRes.data) {
                eventsRes.data.forEach(ev => {
                    const dateObj = new Date(ev.event_datetime);
                    const timeStr = dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                    allEvents.push({
                        id: ev.id, type: 'Wydarzenie', title: `${ev.title} • ${timeStr}`, icon: '🎟️',
                        date: getLocalDayStr(dateObj), color: 'text-fuchsia-400', bg: 'bg-[#d946ef]', profileId: null, isDuration: false
                    });
                });
            }

            // 1. ZADANIA DOMOWE
            if (tasksRes.data) {
                tasksRes.data.forEach(t => {
                    let isTaskAssigned = true; 
                    if (t.assigned_to && t.assigned_to !== window.currentUser.id && t.assigned_to !== window.currentUser.name) isTaskAssigned = false;

                    if (isTaskAssigned) {
                        if (t.interval_days && t.interval_days > 0) {
                            const logs = (tLogsRes.data || []).filter(l => l.task_id === t.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                            let nextDateObj = new Date();
                            if (logs.length > 0) {
                                nextDateObj = new Date(logs[0].created_at);
                                nextDateObj.setDate(nextDateObj.getDate() + t.interval_days);
                            }
                            allEvents.push({
                                id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                                date: getLocalDayStr(nextDateObj), color: 'text-blue-400', bg: 'bg-[#3b82f6]', profileId: null, isDuration: false
                            });
                        } else if (t.task_type === 'one_time' && t.event_date) {
                             allEvents.push({
                                id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                                date: t.event_date.split('T')[0], color: 'text-blue-400', bg: 'bg-[#3b82f6]', profileId: null, isDuration: false
                            });
                        }
                    }
                });
            }

            // 2. ZDROWIE
            if (hTasksRes.data && hLogsRes.data) {
                const taskSelect = document.getElementById('cal-subfilter-task');
                if (taskSelect) {
                    taskSelect.innerHTML = '<option value="">-- Wszystkie --</option>' + 
                        hTasksRes.data.map(ht => `<option value="${ht.id}">${ht.name}</option>`).join('');
                }

                hTasksRes.data.forEach(ht => {
                    if (ht.task_type === 'duration') {
                        const logs = hLogsRes.data.filter(l => l.health_task_id === ht.id);
                        logs.forEach(l => {
                            let start = new Date(l.start_date); let end = l.end_date ? new Date(l.end_date) : new Date();
                            allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '🤒', subTaskId: ht.id, date: getLocalDayStr(start), endDate: getLocalDayStr(end), color: 'text-red-400', bg: 'bg-[#ef4444]', profileId: ht.profile_id, isDuration: true, isSummary: true });
                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '🤒', subTaskId: ht.id, date: getLocalDayStr(d), color: 'text-red-400', bg: 'bg-[#ef4444]', profileId: ht.profile_id, isDuration: true, isSummary: false });
                            }
                        });
                    } else if (ht.task_type === 'one_time' && ht.event_date) {
                        allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '📅', subTaskId: ht.id, date: ht.event_date.split('T')[0], color: 'text-amber-500', bg: 'bg-[#f59e0b]', profileId: ht.profile_id, isDuration: false });
                    }
                });
            }

            document.getElementById('calendar-subtitle').innerText = 'Gotowe';

        } catch (e) {
            console.error(e);
            document.getElementById('calendar-subtitle').innerText = 'Błąd danych';
        }
    }

    function getFilteredEvents(forHeatmap = false) {
        return allEvents.filter(e => {
            if (activeFilter !== 'all' && e.type !== activeFilter) return false;
            if (activeSubFilterTask && e.subTaskId != activeSubFilterTask) return false;
            if (activeSubFilterPerson && e.profileId && e.profileId != activeSubFilterPerson) return false;
            if (e.isDuration) {
                if (forHeatmap && e.isSummary) return false;
                if (!forHeatmap && !e.isSummary) return false;
            }
            return true;
        });
    }

    function renderProfilePills() {
        const container = document.getElementById('cal-profile-filters');
        if (!container) return;
        let html = `<button class="js-cal-profile-filter px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${!activeSubFilterPerson ? 'bg-[#a8c7fa] text-[#004a77]' : 'bg-[#131314] border border-[#333537] text-neutral-400'}" data-id="null">Wszyscy</button>`;
        appProfiles.forEach(p => {
            const isActive = activeSubFilterPerson == p.id;
            const bgClass = isActive ? 'bg-[#004a77] border border-[#a8c7fa]/30 text-[#a8c7fa]' : 'bg-[#131314] border border-[#333537] text-neutral-400';
            html += `<button class="js-cal-profile-filter px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${bgClass}" data-id="${p.id}">${p.name}</button>`;
        });
        container.innerHTML = html;
    }

    function setTab(tabName) {
        currentTab = tabName;
        document.querySelectorAll('.js-cal-tab').forEach(b => { b.classList.remove('bg-[#333537]', 'text-white', 'shadow-sm'); b.classList.add('text-neutral-500'); });
        const target = document.getElementById(`tab-${tabName}`);
        if(target) { target.classList.add('bg-[#333537]', 'text-white', 'shadow-sm'); target.classList.remove('text-neutral-500'); }
        renderCurrentTab();
    }

    function setFilter(filterName) {
        activeFilter = filterName;
        document.querySelectorAll('.js-cal-filter').forEach(b => { b.classList.replace('bg-[#a8c7fa]', 'bg-[#131314]'); b.classList.replace('text-[#004a77]', 'text-neutral-400'); b.classList.add('border', 'border-[#333537]'); });
        const target = document.getElementById(`filter-${filterName}`);
        if(target) { target.classList.replace('bg-[#131314]', 'bg-[#a8c7fa]'); target.classList.replace('text-neutral-400', 'text-[#004a77]'); target.classList.remove('border', 'border-[#333537]'); }
        renderCurrentTab();
    }

    function setProfileFilter(id) {
        activeSubFilterPerson = id;
        renderProfilePills();
        renderCurrentTab();
    }

    function renderCurrentTab() {
        document.getElementById('cal-view-agenda').classList.add('hidden');
        document.getElementById('cal-view-month').classList.add('hidden');
        document.getElementById('cal-view-year').classList.add('hidden');

        if (currentTab === 'agenda') { document.getElementById('cal-view-agenda').classList.remove('hidden'); renderAgenda(); } 
        else if (currentTab === 'month') { document.getElementById('cal-view-month').classList.remove('hidden'); renderMonth(); } 
        else if (currentTab === 'year') { document.getElementById('cal-view-year').classList.remove('hidden'); renderYearHeatmap(); }
    }

    function renderAgenda() {
        const container = document.getElementById('cal-view-agenda');
        const events = getFilteredEvents(false);
        const todayStr = getLocalDayStr();
        const futureEvents = events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));

        if (futureEvents.length === 0) {
            container.innerHTML = `<p class="text-center text-neutral-500 py-20 text-sm">Masz czyste konto! Brak nadchodzących zdarzeń na horyzoncie.</p>`;
            return;
        }

        let html = ''; let lastDate = '';
        futureEvents.forEach(e => {
            if (e.date !== lastDate) {
                const dateObj = new Date(e.date);
                const isToday = e.date === todayStr;
                const dateLabel = isToday ? 'Dzisiaj' : dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
                html += `<h3 class="text-[10px] font-bold ${isToday ? 'text-[#a8c7fa]' : 'text-neutral-500'} uppercase tracking-widest mt-6 mb-2 border-b border-[#333537] pb-1 sticky top-0 bg-[#131314]/90 backdrop-blur z-10">${dateLabel}</h3>`;
                lastDate = e.date;
            }
            
            const durationTxt = e.isDuration ? `<span class="text-[8px] border border-[#ffb4ab]/30 px-1 ml-2 rounded text-neutral-400">Trwa do: ${e.endDate}</span>` : '';
            const pName = e.profileId ? appProfiles.find(p=>p.id == e.profileId)?.name || '' : '';
            const pTxt = pName ? ` • ${pName}` : '';

            html += `
            <div class="bg-[#1e1f20] p-4 rounded-[16px] border border-[#333537] flex items-center gap-4 mb-2 shadow-sm">
                <span class="text-2xl">${e.icon}</span>
                <div>
                    <p class="text-sm font-bold ${e.color}">${window.esc(e.title)} ${durationTxt}</p>
                    <p class="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">${e.type}${pTxt}</p>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }

    function renderMonth() {
        const grid = document.getElementById('cal-month-grid');
        const title = document.getElementById('cal-month-title');
        const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
        title.innerText = `${monthNames[currentMonth]} ${currentYear}`;

        let html = `<div class="grid grid-cols-7 gap-1 text-center mb-1"><div class="text-[10px] text-neutral-600 font-bold">Pn</div><div class="text-[10px] text-neutral-600 font-bold">Wt</div><div class="text-[10px] text-neutral-600 font-bold">Śr</div><div class="text-[10px] text-neutral-600 font-bold">Cz</div><div class="text-[10px] text-neutral-600 font-bold">Pt</div><div class="text-[10px] text-neutral-600 font-bold">So</div><div class="text-[10px] text-neutral-600 font-bold">Nd</div></div><div class="grid grid-cols-7 gap-1 text-sm">`;
        const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const events = getFilteredEvents(false); 
        
        for (let i = 0; i < firstDay; i++) html += `<div></div>`;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = getLocalDayStr() === dateStr;
            const dayEvents = events.filter(e => e.date === dateStr || (e.isDuration && dateStr >= e.date && dateStr <= e.endDate));
            
            let bgClass = 'bg-[#1e1f20] text-neutral-300';
            if (isToday) bgClass = 'bg-[#333537] border-2 border-[#a8c7fa] text-white font-bold';
            
            let dotsHtml = '';
            if (dayEvents.length > 0) {
                const colors = [...new Set(dayEvents.map(e => e.bg))].slice(0, 3);
                dotsHtml = `<div class="absolute bottom-1 w-full flex justify-center gap-0.5 pointer-events-none">` + colors.map(c => `<div class="w-1.5 h-1.5 rounded-full ${c}"></div>`).join('') + `</div>`;
            }
            // Zamiana onclick na js-cal-day-details
            html += `<button class="js-cal-day-details relative w-full p-2 h-10 ${bgClass} rounded-lg flex items-start justify-center active:scale-90 transition-transform select-none focus:outline-none" data-date="${dateStr}">${d}${dotsHtml}</button>`;
        }
        html += `</div>`;
        grid.innerHTML = html;
    }

    function showMonthDetails(dateStr) {
        const container = document.getElementById('cal-month-details');
        const dayEvents = getFilteredEvents(false).filter(e => e.date === dateStr || (e.isDuration && dateStr >= e.date && dateStr <= e.endDate));
        const dateObj = new Date(dateStr);
        const dateLabel = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

        if (dayEvents.length === 0) {
            container.innerHTML = `<h3 class="text-[10px] font-bold text-[#a8c7fa] uppercase tracking-widest mb-4 sticky top-0 bg-[#131314]">${dateLabel}</h3><p class="text-neutral-500 text-xs text-center py-4">Brak zdarzeń tego dnia.</p>`;
        } else {
            let html = `<h3 class="text-[10px] font-bold text-[#a8c7fa] uppercase tracking-widest mb-4 sticky top-0 bg-[#131314]">${dateLabel}</h3>`;
            dayEvents.forEach(e => {
                const pName = e.profileId ? appProfiles.find(p=>p.id == e.profileId)?.name || '' : '';
                const pTxt = pName ? ` • ${pName}` : '';
                html += `
                <div class="border-l-2 border-[#333537] ml-2 pl-4 py-2 relative mb-2">
                    <div class="absolute -left-[11px] top-3 w-5 h-5 bg-[#1e1f20] border border-[#333537] rounded-full text-[10px] flex items-center justify-center">${e.icon}</div>
                    <p class="text-sm font-medium ${e.color}">${window.esc(e.title)}</p>
                    <p class="text-[9px] text-neutral-500 uppercase">${e.type}${pTxt}</p>
                </div>`;
            });
            container.innerHTML = html;
        }
        if (window.innerWidth < 640) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderYearHeatmap() {
        const grid = document.getElementById('cal-year-grid');
        document.getElementById('cal-year-title').innerText = `Heatmapa: ${currentYear}`;
        
        const events = getFilteredEvents(true);
        const months = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
        let html = '';
        
        for (let m = 0; m < 12; m++) {
            const firstDay = (new Date(currentYear, m, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
            let monthHtml = `<div class="mb-4"><h3 class="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">${months[m]}</h3><div class="flex flex-wrap gap-1">`;
            
            for(let i=0; i<firstDay; i++) monthHtml += `<div class="w-3.5 h-3.5 rounded-sm bg-transparent"></div>`;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.date === dateStr);
                
                let cellClass = "w-3.5 h-3.5 rounded-sm bg-[#1e1f20]"; 
                let innerNum = '';

                if (dayEvents.length > 0) {
                    const hasEventT = dayEvents.some(e => e.bg === 'bg-[#d946ef]');
                    const hasInfection = dayEvents.some(e => e.bg === 'bg-[#ef4444]');
                    const hasVisit = dayEvents.some(e => e.bg === 'bg-[#f59e0b]');

                    if (hasEventT) cellClass = `w-3.5 h-3.5 rounded-sm bg-[#d946ef] shadow-sm border border-black/20`;
                    else if (hasInfection) cellClass = `w-3.5 h-3.5 rounded-sm bg-[#ef4444] shadow-sm border border-black/20`;
                    else if (hasVisit) cellClass = `w-3.5 h-3.5 rounded-sm bg-[#f59e0b] shadow-sm border border-black/20`;
                    else cellClass = `w-3.5 h-3.5 rounded-sm ${dayEvents[0].bg} shadow-sm border border-black/20`; 
                    
                    if (dayEvents.length > 1) {
                        innerNum = `<span class="text-[7.5px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-none pointer-events-none">${dayEvents.length}</span>`;
                    }
                }

                // Zamiana onclick na js-cal-heatmap-day
                monthHtml += `<button class="js-cal-heatmap-day ${cellClass} flex items-center justify-center focus:outline-none active:scale-90 transition-transform" data-date="${dateStr}">${innerNum}</button>`;
            }
            monthHtml += `</div></div>`;
            html += monthHtml;
        }
        grid.innerHTML = html;
    }

    function openHeatmapModal(dateStr) {
        const container = document.getElementById('cal-heatmap-modal-content');
        const title = document.getElementById('cal-heatmap-modal-title');
        
        const dayEvents = getFilteredEvents(true).filter(e => e.date === dateStr);
        if(dayEvents.length === 0) return; 

        const dateObj = new Date(dateStr);
        title.innerText = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
        
        let html = '';
        dayEvents.forEach(e => {
            const pName = e.profileId ? appProfiles.find(p=>p.id == e.profileId)?.name || '' : '';
            const pTxt = pName ? ` • ${pName}` : '';
            html += `
            <div class="bg-[#131314] border border-[#333537] p-3 rounded-xl flex items-center gap-3">
                <span class="text-2xl">${e.icon}</span>
                <div>
                    <p class="text-sm font-bold ${e.color}">${window.esc(e.title)}</p>
                    <p class="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">${e.type}${pTxt}</p>
                </div>
            </div>`;
        });
        container.innerHTML = html;

        const modal = document.getElementById('cal-heatmap-modal');
        const panel = document.getElementById('cal-heatmap-panel');
        modal.classList.remove('hidden');
        requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
    }

    function closeHeatmapModal() {
        const panel = document.getElementById('cal-heatmap-panel');
        panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
        setTimeout(() => document.getElementById('cal-heatmap-modal').classList.add('hidden'), 300);
    }

    function openSubFilterModal() {
        const modal = document.getElementById('cal-subfilter-modal');
        const panel = document.getElementById('cal-subfilter-panel');
        modal.classList.remove('hidden');
        requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
    }

    function closeSubFilterModal() {
        const panel = document.getElementById('cal-subfilter-panel');
        panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
        setTimeout(() => document.getElementById('cal-subfilter-modal').classList.add('hidden'), 300);
    }

    function applySubFilter() {
        const taskSelect = document.getElementById('cal-subfilter-task');
        activeSubFilterTask = taskSelect.value || null;
        const badgeContainer = document.getElementById('active-subfilter-badge');
        
        if (activeSubFilterTask) {
            const tName = taskSelect.options[taskSelect.selectedIndex].text;
            badgeContainer.innerHTML = `
                <span class="px-3 py-1.5 bg-[#3c1414] border border-[#ffb4ab]/30 text-[#ffb4ab] rounded-full text-[10px] font-bold shadow-sm">Zdarzenie: ${tName}</span>
                <button class="js-cal-clear-subfilter text-neutral-500 text-xs font-bold ml-1 active:scale-90">CZYŚĆ ✕</button>
            `;
            badgeContainer.classList.remove('hidden');
        } else {
            badgeContainer.classList.add('hidden');
        }
        renderCurrentTab();
        closeSubFilterModal();
    }

    function clearSubFilter() {
        activeSubFilterTask = null;
        document.getElementById('cal-subfilter-task').value = "";
        document.getElementById('active-subfilter-badge').classList.add('hidden');
        renderCurrentTab();
    }

    function openNewEventModal() {
        const modal = document.getElementById('cal-new-event-modal');
        const panel = document.getElementById('cal-new-event-panel');
        document.getElementById('cal-new-event-title').value = '';
        document.getElementById('cal-new-event-datetime').value = '';
        
        modal.classList.remove('hidden');
        requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
    }

    function closeNewEventModal() {
        const panel = document.getElementById('cal-new-event-panel');
        panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
        setTimeout(() => document.getElementById('cal-new-event-modal').classList.add('hidden'), 300);
    }

    async function saveNewEvent() {
        const title = document.getElementById('cal-new-event-title').value.trim();
        const dtVal = document.getElementById('cal-new-event-datetime').value;

        if (!title || !dtVal) { window.showToast("Wypełnij tytuł i datę z godziną!"); return; }

        const evDate = new Date(dtVal);
        const { error } = await window.supabaseClient.from('calendar_events').insert([{
            title: title, event_datetime: evDate.toISOString(), household_id: window.currentUser.household_id, user_id: window.currentUser.user_id
        }]);

        if (error) { window.showToast("Błąd zapisu: " + error.message); return; }

        window.showToast("Zapisano wydarzenie!");
        closeNewEventModal();
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        await fetchAllData();
        renderCurrentTab();
    }

    // ==========================================
    // DELEGACJA ZDARZEŃ W JEDNYM MIEJSCU
    // ==========================================
    function setupEvents() {
        if (eventsSetupDone) return;
        eventsSetupDone = true;

        if (window.EventDispatcher) {
            // Filtry i Taby
            window.EventDispatcher.onClick('.js-cal-tab', (e, el) => setTab(el.dataset.tab));
            window.EventDispatcher.onClick('.js-cal-filter', (e, el) => setFilter(el.dataset.filter));
            window.EventDispatcher.onClick('.js-cal-profile-filter', (e, el) => {
                const id = el.dataset.id === 'null' ? null : el.dataset.id;
                setProfileFilter(id);
            });

            // Nawigacja
            window.EventDispatcher.onClick('.js-cal-change-month', (e, el) => {
                const offset = parseInt(el.dataset.offset);
                currentMonth += offset;
                if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
                else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
                renderMonth();
            });
            window.EventDispatcher.onClick('.js-cal-change-year', (e, el) => {
                currentYear += parseInt(el.dataset.offset);
                renderYearHeatmap();
            });

            // Akcje na dniach
            window.EventDispatcher.onClick('.js-cal-day-details', (e, el) => showMonthDetails(el.dataset.date));
            window.EventDispatcher.onClick('.js-cal-heatmap-day', (e, el) => openHeatmapModal(el.dataset.date));

            // Sub-filtry modal
            window.EventDispatcher.onClick('.js-cal-open-subfilter', openSubFilterModal);
            window.EventDispatcher.onClick('.js-cal-close-subfilter', closeSubFilterModal);
            window.EventDispatcher.onClick('.js-cal-apply-subfilter', applySubFilter);
            window.EventDispatcher.onClick('.js-cal-clear-subfilter', clearSubFilter);

            // Nowe wydarzenie modal
            window.EventDispatcher.onClick('.js-cal-open-new-event', openNewEventModal);
            window.EventDispatcher.onClick('.js-cal-close-new-event', closeNewEventModal);
            window.EventDispatcher.onClick('.js-cal-save-new-event', saveNewEvent);

            // Reszta modali i nav
            window.EventDispatcher.onClick('.js-cal-close-heatmap', closeHeatmapModal);
            window.EventDispatcher.onClick('.js-cal-go-back', () => { if(typeof window.goBack === 'function') window.goBack(); });
        }
    }

    // Globalny nasłuchiwacz uodporniający uruchamianie kalendarza z przypisanym filtrem (z innych modułów)
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-calendar-filter', (e, el) => {
            const filter = el.dataset.filter || 'all';
            window.switchView('calendar');
            setTimeout(() => { if (typeof setFilter === 'function') setFilter(filter); }, 50);
        });
    }

    return { 
        init, 
        setFilter // Eksportujemy tylko to co niezbędne z zewnątrz
    };
})();
