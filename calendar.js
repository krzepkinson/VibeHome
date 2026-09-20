// ==========================================
// LOGIKA: ZUNIFIKOWANY KALENDARZ 2.0 - LOCAL FIRST + UX (calendar.js)
// ==========================================

window.CalendarModule = (() => {
    let currentTab = 'agenda'; 
    let activeFilter = 'all'; 
    let activeSubFilterTasks = [];
    let tempSelectedTasks = [];
    let activeSubFilterPerson = null; 
    
    let allEvents = []; 
    let appProfiles = [];
    
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let eventsSetupDone = false; 

    // Helpery
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    const getLocalDayStr = (dObj = new Date()) => {
        if (isNaN(dObj.getTime())) return '';
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getAvatarHtml = (profileId) => {
        if (!profileId) return '';
        const p = appProfiles.find(x => sameId(x.id, profileId));
        if (!p) return '';
        const initial = p.name.charAt(0).toUpperCase();
        const color = window.getAvatarColor ? window.getAvatarColor(p.name) : 'bg-[#333537] border-[#737373]';
        return `<div class="w-6 h-6 rounded-full ${color} border border-white/10 text-white text-[10px] flex items-center justify-center shrink-0 ml-1 font-bold shadow-sm" title="${window.esc(p.name)}">${initial}</div>`;
    };

    async function init() {
        const subtitle = document.getElementById('calendar-subtitle');
        if (subtitle) subtitle.innerText = 'Wczytywanie...';

        // 1. Instant render z AppStore (0 ms)
        buildEventsFromStore();
        renderProfilePills();
        renderCurrentTab();
        setupEvents();

        if (subtitle) subtitle.innerText = 'Gotowe';

        // 2. Tło: Dociągnięcie braków z chmury (odświeżenie danych)
        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview();
            buildEventsFromStore();
            renderProfilePills();
            renderCurrentTab();
        }
    }

    function buildEventsFromStore() {
        const state = window.AppStore.get() || {};
        allEvents = [];
        appProfiles = state.profiles || [];

        const tasks = (state.tasks || []).filter(t => !t.is_archived);
        const logs = state.logs || [];
        const hTasks = (state.hTasks || []).filter(t => !t.is_archived);
        const hLogs = state.hLogs || [];
        const calEvents = state.calendarEvents || [];

        // 1. Wydarzenia własne z kalendarza
        calEvents.forEach(ev => {
            const dateObj = new Date(ev.event_datetime);
            if(isNaN(dateObj.getTime())) return;
            const timeStr = dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            allEvents.push({
                id: ev.id, type: 'Wydarzenie', title: `${ev.title} • ${timeStr}`, rawTitle: ev.title, rawDatetime: ev.event_datetime, icon: '🎟️',
                date: getLocalDayStr(dateObj), color: 'text-fuchsia-400', bg: 'bg-[#d946ef]', profileId: null, isDuration: false
            });
        });

        // 2. Zadania Domowe
        tasks.forEach(t => {
            let isTaskAssigned = true; 
            if (t.assigned_to && window.currentUser && !sameId(t.assigned_to, window.currentUser.id) && t.assigned_to !== window.currentUser.name) {
                isTaskAssigned = false;
            }

            if (isTaskAssigned) {
                if (t.interval_days && t.interval_days > 0) {
                    const taskLogs = logs.filter(l => sameId(l.task_id, t.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                    let nextDateObj = new Date();
                    if (taskLogs.length > 0) {
                        nextDateObj = new Date(taskLogs[0].created_at);
                        nextDateObj.setDate(nextDateObj.getDate() + t.interval_days);
                    }
                    allEvents.push({
                        id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                        date: getLocalDayStr(nextDateObj), color: 'text-blue-400', bg: 'bg-[#3b82f6]', profileId: null, isDuration: false
                    });
                } else if (t.task_type === 'one_time' && t.event_date) {
                    const evDate = new Date(t.event_date);
                    if(!isNaN(evDate.getTime())) {
                        allEvents.push({
                            id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                            date: getLocalDayStr(evDate), color: 'text-blue-400', bg: 'bg-[#3b82f6]', profileId: null, isDuration: false
                        });
                    }
                }
            }
        });

        // 3. Zdrowie
        hTasks.forEach(ht => {
            if (ht.task_type === 'duration') {
                const taskLogs = hLogs.filter(l => sameId(l.health_task_id, ht.id));
                taskLogs.forEach(l => {
                    let start = new Date(l.start_date); 
                    let end = l.end_date ? new Date(l.end_date) : new Date();
                    allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '🤒', subTaskId: ht.id, date: getLocalDayStr(start), endDate: getLocalDayStr(end), color: 'text-red-400', bg: 'bg-[#ef4444]', profileId: ht.profile_id, isDuration: true, isSummary: true });
                    
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '🤒', subTaskId: ht.id, date: getLocalDayStr(d), color: 'text-red-400', bg: 'bg-[#ef4444]', profileId: ht.profile_id, isDuration: true, isSummary: false });
                    }
                });
            } else if (ht.task_type === 'one_time' && ht.event_date) {
                const evDate = new Date(ht.event_date);
                if(!isNaN(evDate.getTime())) {
                    allEvents.push({ id: ht.id, type: 'Zdrowie', title: ht.name, icon: '📅', subTaskId: ht.id, date: getLocalDayStr(evDate), color: 'text-amber-500', bg: 'bg-[#f59e0b]', profileId: ht.profile_id, isDuration: false });
                }
            }
        });

        // 4. Pigułki podfiltra
        const pillsContainer = document.getElementById('cal-subfilter-pills');
        if (pillsContainer && hTasks.length > 0) {
            const grouped = {};
            hTasks.forEach(ht => {
                const cat = ht.category || 'Inne';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(ht);
            });

            let html = '';
            const sortedKeys = Object.keys(grouped).sort((a, b) => a === 'Infekcja' ? -1 : b === 'Infekcja' ? 1 : a.localeCompare(b));
            
            sortedKeys.forEach(cat => {
                html += `<div><h4 class="text-[9px] text-neutral-500 uppercase tracking-widest mb-2 font-bold pl-1">${window.esc(cat)}</h4><div class="flex flex-wrap gap-2">`;
                grouped[cat].forEach(t => {
                    html += `<button class="js-cal-multi-pill px-3 py-1.5 bg-[#131314] border border-[#333537] text-neutral-400 rounded-xl text-xs font-medium transition-colors active:scale-95 cursor-pointer" data-id="${t.id}" data-name="${window.esc(t.name)}">${window.esc(t.name)}</button>`;
                });
                html += `</div></div>`;
            });
            pillsContainer.innerHTML = html;
        }
    }

    function getFilteredEvents(forHeatmap = false) {
        return allEvents.filter(e => {
            if (activeFilter !== 'all' && e.type !== activeFilter) return false;
            if (activeSubFilterTasks.length > 0 && !activeSubFilterTasks.some(id => sameId(id, e.subTaskId))) return false;
            if (activeSubFilterPerson && e.profileId && !sameId(e.profileId, activeSubFilterPerson)) return false;
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
        let html = `<button class="js-cal-profile-filter px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors cursor-pointer ${!activeSubFilterPerson ? 'bg-[#a8c7fa] text-[#004a77]' : 'bg-[#131314] border border-[#333537] text-neutral-400'}" data-id="null">Wszyscy</button>`;
        appProfiles.forEach(p => {
            const isActive = sameId(p.id, activeSubFilterPerson);
            const bgClass = isActive ? 'bg-[#004a77] border border-[#a8c7fa]/30 text-[#a8c7fa]' : 'bg-[#131314] border border-[#333537] text-neutral-400';
            html += `<button class="js-cal-profile-filter px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors cursor-pointer ${bgClass}" data-id="${p.id}">${window.esc(p.name)}</button>`;
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
        const agendaView = document.getElementById('cal-view-agenda');
        const monthView = document.getElementById('cal-view-month');
        const yearView = document.getElementById('cal-view-year');

        if (agendaView) agendaView.classList.add('hidden');
        if (monthView) monthView.classList.add('hidden');
        if (yearView) yearView.classList.add('hidden');

        if (currentTab === 'agenda') { 
            if (agendaView) agendaView.classList.remove('hidden'); 
            renderAgenda(); 
        } 
        else if (currentTab === 'month') { 
            if (monthView) monthView.classList.remove('hidden'); 
            renderMonth(); 
        } 
        else if (currentTab === 'year') { 
            if (yearView) yearView.classList.remove('hidden'); 
            renderYearHeatmap(); 
        }
    }

    function renderAgenda() {
        const container = document.getElementById('cal-view-agenda');
        if (!container) return;
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
            
            const durationTxt = e.isDuration ? `<span class="text-[8px] border border-[#ffb4ab]/30 px-1 ml-2 rounded text-neutral-400">Trwa od: ${e.endDate}</span>` : '';
            const avatarHtml = getAvatarHtml(e.profileId);
            const editBtn = e.type === 'Wydarzenie' ? `<button class="js-cal-edit-event w-8 h-8 rounded-full bg-[#d946ef]/10 text-[#d946ef] border border-[#d946ef]/30 flex items-center justify-center text-xs active:scale-90 shrink-0 cursor-pointer ml-2" data-id="${e.id}">✏️</button>` : '';

            // Szybkie odhaczanie (Quick Log) z kalendarza
            let quickLogBtn = '';
            if (e.type === 'Dom') {
                quickLogBtn = `<button class="js-cal-quick-log w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0 cursor-pointer ml-2" data-id="${e.id}" data-module="task" title="Odhacz zadanie">✓</button>`;
            } else if (e.type === 'Zdrowie' && !e.isDuration) {
                quickLogBtn = `<button class="js-cal-quick-log w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0 cursor-pointer ml-2" data-id="${e.subTaskId || e.id}" data-module="health" title="Odhacz zdarzenie">✓</button>`;
            }

            html += `
            <div class="bg-[#1e1f20] p-4 rounded-[16px] border border-[#333537] flex items-center gap-2 mb-2 shadow-sm animate-fade-in">
                <span class="text-2xl shrink-0 pr-1">${e.icon}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold ${e.color} truncate">${window.esc(e.title)} ${durationTxt}</p>
                    <p class="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">${e.type}</p>
                </div>
                ${avatarHtml}
                ${quickLogBtn}
                ${editBtn}
            </div>`;
        });
        container.innerHTML = html;
    }

    function renderMonth() {
        const grid = document.getElementById('cal-month-grid');
        const title = document.getElementById('cal-month-title');
        if (!grid || !title) return;

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
            html += `<button class="js-cal-day-details relative w-full p-2 h-10 ${bgClass} rounded-lg flex items-start justify-center active:scale-90 transition-transform select-none focus:outline-none cursor-pointer" data-date="${dateStr}">${d}${dotsHtml}</button>`;
        }
        html += `</div>`;
        grid.innerHTML = html;
        
        // Ukrywamy starą listę inline z poprzedniej wersji
        const oldDetails = document.getElementById('cal-month-details');
        if (oldDetails) oldDetails.classList.add('hidden');
    }

    function renderYearHeatmap() {
        const grid = document.getElementById('cal-year-grid');
        const titleEl = document.getElementById('cal-year-title');
        const statsTitleEl = document.getElementById('cal-stats-title');
        if (!grid || !titleEl) return;

        titleEl.innerText = `Heatmapa: ${currentYear}`;
        if (statsTitleEl) statsTitleEl.innerText = `Podsumowanie: ${currentYear}`;
        
        const eventsHeatmap = getFilteredEvents(true);
        const eventsAgenda = getFilteredEvents(false);
        const currentYearStr = currentYear.toString();

        const months = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
        let html = '';
        
        for (let m = 0; m < 12; m++) {
            const firstDay = (new Date(currentYear, m, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
            let monthHtml = `<div class="mb-4"><h3 class="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">${months[m]}</h3><div class="flex flex-wrap gap-1">`;
            
            for(let i=0; i<firstDay; i++) monthHtml += `<div class="w-3.5 h-3.5 rounded-sm bg-transparent"></div>`;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayEvents = eventsHeatmap.filter(e => e.date === dateStr);
                
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

                monthHtml += `<button class="js-cal-day-details ${cellClass} flex items-center justify-center focus:outline-none active:scale-90 transition-transform cursor-pointer" data-date="${dateStr}">${innerNum}</button>`;
            }
            monthHtml += `</div></div>`;
            html += monthHtml;
        }
        grid.innerHTML = html;

        // Statystyki
        const daysWithActivity = new Set(eventsHeatmap.filter(e => e.date.startsWith(currentYearStr)).map(e => e.date)).size;
        let uniqueEventsCount = activeFilter === 'Zdrowie'
            ? new Set(eventsHeatmap.filter(e => e.date.startsWith(currentYearStr)).map(e => e.id)).size
            : eventsAgenda.filter(e => e.date.startsWith(currentYearStr) || (e.isDuration && e.endDate && e.endDate.startsWith(currentYearStr))).length;

        const val1El = document.getElementById('cal-stats-val-1');
        const val2El = document.getElementById('cal-stats-val-2');
        const label1El = document.getElementById('cal-stats-label-1');
        const label2El = document.getElementById('cal-stats-label-2');

        if (val1El) val1El.innerText = daysWithActivity;
        if (val2El) val2El.innerText = uniqueEventsCount;

        if (label1El && label2El) {
            if (activeFilter === 'Zdrowie') {
                label1El.innerText = "Dni objawowych"; label2El.innerText = "Ilość zdarzeń";
                if (val1El) val1El.className = "text-2xl font-bold text-[#ffb4ab]";
            } else if (activeFilter === 'Wydarzenie') {
                label1El.innerText = "Dni z wyjściami"; label2El.innerText = "Ilość wydarzeń";
                if (val1El) val1El.className = "text-2xl font-bold text-[#f0abfc]";
            } else if (activeFilter === 'Dom') {
                label1El.innerText = "Dni sprzątania"; label2El.innerText = "Zrealizowane zadania";
                if (val1El) val1El.className = "text-2xl font-bold text-[#c2e7ff]";
            } else {
                label1El.innerText = "Aktywne dni"; label2El.innerText = "Suma akcji";
                if (val1El) val1El.className = "text-2xl font-bold text-neutral-200";
            }
        }
    }

    // UX: WSPÓLNY MODAL DLA SZCZEGÓŁÓW DNIA (Miesiąc i Rok)
    function openDayDetailsModal(dateStr) {
        const container = document.getElementById('cal-heatmap-modal-content');
        const title = document.getElementById('cal-heatmap-modal-title');
        if (!container || !title) return;
        
        // Zbieramy wydarzenia dla tego dnia
        const isHeatmap = (currentTab === 'year');
        const dayEvents = getFilteredEvents(isHeatmap).filter(e => e.date === dateStr || (!isHeatmap && e.isDuration && dateStr >= e.date && dateStr <= e.endDate));
        
        if (dayEvents.length === 0 && isHeatmap) return; 

        const dateObj = new Date(dateStr);
        title.innerText = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
        
        let html = '';
        if (dayEvents.length === 0) {
            html = `<p class="text-neutral-500 text-xs text-center py-6">Brak zdarzeń tego dnia.</p>`;
        } else {
            dayEvents.forEach(e => {
                const avatarHtml = getAvatarHtml(e.profileId);
                const editBtn = e.type === 'Wydarzenie' ? `<button class="js-cal-edit-event w-8 h-8 rounded-full bg-[#d946ef]/10 text-[#d946ef] border border-[#d946ef]/30 flex items-center justify-center text-xs active:scale-90 shrink-0 ml-2 cursor-pointer" data-id="${e.id}">✏️</button>` : '';
                
                let quickLogBtn = '';
                if (e.type === 'Dom') {
                    quickLogBtn = `<button class="js-cal-quick-log w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0 cursor-pointer ml-2" data-id="${e.id}" data-module="task" title="Odhacz zadanie">✓</button>`;
                } else if (e.type === 'Zdrowie' && !e.isDuration) {
                    quickLogBtn = `<button class="js-cal-quick-log w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0 cursor-pointer ml-2" data-id="${e.subTaskId || e.id}" data-module="health" title="Odhacz zdarzenie">✓</button>`;
                }

                html += `
                <div class="bg-[#131314] border border-[#333537] p-3 rounded-xl flex items-center justify-between group mb-2 animate-fade-in">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-2xl pr-1">${e.icon}</span>
                        <div class="min-w-0">
                            <p class="text-sm font-bold ${e.color} truncate">${window.esc(e.title)}</p>
                            <p class="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">${e.type}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${avatarHtml}
                        ${quickLogBtn}
                        ${editBtn}
                    </div>
                </div>`;
            });
        }
        container.innerHTML = html;

        // Otwieranie Modalu (wykorzystujemy Modal Heatmapy)
        const modal = document.getElementById('cal-heatmap-modal');
        const panel = document.getElementById('cal-heatmap-panel');
        if (modal && panel) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
        }
    }

    function closeDayDetailsModal() {
        const panel = document.getElementById('cal-heatmap-panel');
        const modal = document.getElementById('cal-heatmap-modal');
        if (panel && modal) {
            panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    function openEventModal(id = null) {
        const modal = document.getElementById('cal-event-modal');
        const panel = document.getElementById('cal-event-panel');
        const titleEl = document.getElementById('cal-event-modal-title');
        const delBtn = document.getElementById('cal-event-delete-btn');

        if (id) {
            const ev = allEvents.find(e => sameId(e.id, id) && e.type === 'Wydarzenie');
            if (!ev) return;
            document.getElementById('cal-event-id').value = id;
            document.getElementById('cal-event-title').value = ev.rawTitle;
            
            const dt = new Date(ev.rawDatetime);
            const tzOffset = dt.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dt - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('cal-event-datetime').value = localISOTime;

            if (titleEl) titleEl.innerText = 'Edytuj Wydarzenie';
            if (delBtn) delBtn.classList.remove('hidden');
        } else {
            document.getElementById('cal-event-id').value = '';
            document.getElementById('cal-event-title').value = '';
            document.getElementById('cal-event-datetime').value = '';

            if (titleEl) titleEl.innerText = 'Nowe Wydarzenie';
            if (delBtn) delBtn.classList.add('hidden');
        }

        if (modal && panel) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
        }
    }

    function closeEventModal() {
        const panel = document.getElementById('cal-event-panel');
        const modal = document.getElementById('cal-event-modal');
        if (panel && modal) {
            panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    async function saveEvent() {
        const id = document.getElementById('cal-event-id').value;
        const title = document.getElementById('cal-event-title').value.trim();
        const dtVal = document.getElementById('cal-event-datetime').value;

        if (!title || !dtVal) { window.showToast("Wypełnij tytuł i datę z godziną!"); return; }

        const evDate = new Date(dtVal);
        const tempId = id || Date.now();
        const payload = {
            id: tempId,
            title: title, 
            event_datetime: evDate.toISOString(), 
            household_id: window.currentUser ? window.currentUser.household_id : null, 
            user_id: window.currentUser ? window.currentUser.user_id : null
        };

        // 1. Instant update w AppStore i przerysowanie
        window.AppStore.set(state => {
            const currentEvents = state.calendarEvents || [];
            const updated = id 
                ? currentEvents.map(e => sameId(e.id, id) ? payload : e)
                : [payload, ...currentEvents];
            return { ...state, calendarEvents: updated };
        });

        window.showToast(id ? "Zaktualizowano!" : "Zapisano!");
        closeEventModal();
        buildEventsFromStore();
        renderCurrentTab();

        // 2. Synchronizacja w tle
        if (id) {
            const { error } = await window.supabaseClient.from('calendar_events').update({
                title: payload.title, event_datetime: payload.event_datetime
            }).eq('id', id);
            if (error) window.showToast("Błąd chmury: " + error.message);
        } else {
            const { data, error } = await window.supabaseClient.from('calendar_events').insert([{
                title: payload.title, event_datetime: payload.event_datetime,
                household_id: payload.household_id, user_id: payload.user_id
            }]).select().single();

            if (error) {
                window.showToast("Błąd chmury: " + error.message);
            } else if (data) {
                window.AppStore.set(state => ({
                    ...state,
                    calendarEvents: (state.calendarEvents || []).map(e => sameId(e.id, tempId) ? data : e)
                }));
            }
        }
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    }

    function deleteEvent() {
        const id = document.getElementById('cal-event-id').value;
        if (!id) return;
        window.customConfirm("Czy na pewno usunąć to wydarzenie?", async () => {
            window.AppStore.set(state => ({
                ...state,
                calendarEvents: (state.calendarEvents || []).filter(e => !sameId(e.id, id))
            }));

            window.showToast("Wydarzenie usunięte!");
            closeEventModal();
            closeDayDetailsModal(); 
            
            buildEventsFromStore();
            renderCurrentTab();

            const { error } = await window.supabaseClient.from('calendar_events').delete().eq('id', id);
            if (error) window.showToast("Błąd usuwania w chmurze");
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        });
    }

    function updatePillsUI() {
        document.querySelectorAll('.js-cal-multi-pill').forEach(btn => {
            const id = parseInt(btn.dataset.id, 10);
            if (tempSelectedTasks.includes(id)) {
                btn.classList.replace('bg-[#131314]', 'bg-[#3c1414]');
                btn.classList.replace('border-[#333537]', 'border-[#ffb4ab]/50');
                btn.classList.replace('text-neutral-400', 'text-[#ffb4ab]');
            } else {
                btn.classList.replace('bg-[#3c1414]', 'bg-[#131314]');
                btn.classList.replace('border-[#ffb4ab]/50', 'border-[#333537]');
                btn.classList.replace('text-[#ffb4ab]', 'text-neutral-400');
            }
        });
    }

    function toggleSubFilterPill(id) {
        const numId = parseInt(id, 10);
        const idx = tempSelectedTasks.indexOf(numId);
        if (idx > -1) tempSelectedTasks.splice(idx, 1);
        else tempSelectedTasks.push(numId);
        updatePillsUI();
    }

    function openSubFilterModal() {
        tempSelectedTasks = [...activeSubFilterTasks];
        updatePillsUI();
        
        const modal = document.getElementById('cal-subfilter-modal');
        const panel = document.getElementById('cal-subfilter-panel');
        if (modal && panel) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => { panel.classList.remove('translate-y-full'); panel.classList.add('translate-y-0'); });
        }
    }

    function closeSubFilterModal() {
        const panel = document.getElementById('cal-subfilter-panel');
        const modal = document.getElementById('cal-subfilter-modal');
        if (panel && modal) {
            panel.classList.remove('translate-y-0'); panel.classList.add('translate-y-full');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    function applySubFilter() {
        activeSubFilterTasks = [...tempSelectedTasks];
        const badgeContainer = document.getElementById('active-subfilter-badge');
        
        if (badgeContainer) {
            if (activeSubFilterTasks.length > 0) {
                const names = [];
                document.querySelectorAll('.js-cal-multi-pill').forEach(btn => {
                    if (activeSubFilterTasks.includes(parseInt(btn.dataset.id, 10))) names.push(btn.dataset.name);
                });
                
                const badgeTxt = names.length <= 2 ? names.join(', ') : `${names.length} wybrane`;
                
                badgeContainer.innerHTML = `
                    <span class="px-3 py-1.5 bg-[#3c1414] border border-[#ffb4ab]/30 text-[#ffb4ab] rounded-full text-[10px] font-bold shadow-sm flex items-center max-w-[150px] sm:max-w-[200px]">
                        <span class="truncate">${badgeTxt}</span>
                    </span>
                    <button class="js-cal-clear-subfilter text-neutral-500 text-xs font-bold ml-1 active:scale-90 cursor-pointer">CZYŚĆ ✕</button>
                `;
                badgeContainer.classList.remove('hidden');
            } else {
                badgeContainer.classList.add('hidden');
            }
        }
        renderCurrentTab();
        closeSubFilterModal();
    }

    function clearSubFilter() {
        activeSubFilterTasks = [];
        tempSelectedTasks = [];
        const badge = document.getElementById('active-subfilter-badge');
        if (badge) badge.classList.add('hidden');
        renderCurrentTab();
    }

    // GŁÓWNA REJESTRACJA ZDARZEŃ W MODULE
    function setupEvents() {
        if (eventsSetupDone) return;
        eventsSetupDone = true;

        if (window.EventDispatcher) {
            window.EventDispatcher.onClick('.js-cal-tab', (e, el) => setTab(el.dataset.tab));
            window.EventDispatcher.onClick('.js-cal-filter', (e, el) => setFilter(el.dataset.filter));
            window.EventDispatcher.onClick('.js-cal-profile-filter', (e, el) => {
                const id = el.dataset.id === 'null' ? null : el.dataset.id;
                setProfileFilter(id);
            });

            window.EventDispatcher.onClick('.js-cal-change-month', (e, el) => {
                const offset = parseInt(el.dataset.offset, 10);
                currentMonth += offset;
                if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
                else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
                renderMonth();
            });
            window.EventDispatcher.onClick('.js-cal-change-year', (e, el) => {
                currentYear += parseInt(el.dataset.offset, 10);
                renderYearHeatmap();
            });

            // Podgląd dnia - ujednolicony dla Miesiąca i Roku
            window.EventDispatcher.onClick('.js-cal-day-details', (e, el) => openDayDetailsModal(el.dataset.date));
            window.EventDispatcher.onClick('.js-cal-heatmap-day', (e, el) => openDayDetailsModal(el.dataset.date));

            // Obsługa Quick Log z kalendarza (Dom i Zdrowie)
            window.EventDispatcher.onClick('.js-cal-quick-log', (e, el) => {
                e.stopPropagation();
                const id = el.dataset.id;
                const module = el.dataset.module;
                if (module === 'task' && window.quickLogTaskDashboard) {
                    window.quickLogTaskDashboard(id);
                } else if (module === 'health' && window.quickLogHealthDashboard) {
                    window.quickLogHealthDashboard(id);
                } else {
                    window.showToast("Aby odhaczyć, wejdź w zakładkę na pasku");
                }
            });

            window.EventDispatcher.onClick('.js-cal-multi-pill', (e, el) => toggleSubFilterPill(el.dataset.id));

            window.EventDispatcher.onClick('.js-cal-open-subfilter', openSubFilterModal);
            window.EventDispatcher.onClick('.js-cal-close-subfilter', closeSubFilterModal);
            window.EventDispatcher.onClick('.js-cal-apply-subfilter', applySubFilter);
            window.EventDispatcher.onClick('.js-cal-clear-subfilter', clearSubFilter);

            window.EventDispatcher.onClick('.js-cal-open-new-event', () => openEventModal(null));
            window.EventDispatcher.onClick('.js-cal-edit-event', (e, el) => {
                e.stopPropagation();
                openEventModal(el.dataset.id);
            });
            window.EventDispatcher.onClick('.js-cal-close-event', closeEventModal);
            window.EventDispatcher.onClick('.js-cal-save-event', saveEvent);
            window.EventDispatcher.onClick('.js-cal-delete-event', deleteEvent);

            window.EventDispatcher.onClick('.js-cal-close-heatmap', closeDayDetailsModal);
            window.EventDispatcher.onClick('.js-cal-go-back', () => { if(typeof window.goBack === 'function') window.goBack(); });
            
            window.EventDispatcher.onClick('.js-cal-generate-pdf', () => window.showToast?.("Generowanie PDF w przygotowaniu! 📄"));
        }
    }

    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-calendar-filter', (e, el) => {
            const filter = el.dataset.filter || 'all';
            window.switchView('calendar');
            setTimeout(() => { if (typeof setFilter === 'function') setFilter(filter); }, 50);
        });
    }

    return { 
        init, 
        setFilter,
        setProfileFilter
    };
})();
