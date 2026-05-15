// ==========================================
// LOGIKA: ZUNIFIKOWANY KALENDARZ (calendar.js)
// ==========================================

window.CalendarModule = (() => {
    let currentTab = 'agenda'; // agenda, month, year
    let activeFilter = 'all'; // all, Dom, Zdrowie, Zadanie
    let activeSubFilterTask = null; // ID konkretnej choroby
    
    let allEvents = []; // Wszystkie zebrane eventy z bazy
    
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    const getLocalDayStr = (dObj = new Date()) => {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    window.init = async function() {
        document.getElementById('calendar-subtitle').innerText = 'Ładowanie danych...';
        await fetchAllData();
        setupEventListeners();
        renderCurrentTab();
    };

    async function fetchAllData() {
        const hid = window.currentUser.household_id;
        allEvents = []; // Czyścimy

        try {
            // Równoległe pobieranie z całego systemu
            const [tasksRes, tLogsRes, hTasksRes, hLogsRes, todosRes] = await Promise.all([
                window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid),
                window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                window.supabaseClient.from('health_logs').select('*').eq('household_id', hid),
                window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false)
            ]);

            const todayStr = getLocalDayStr();

            // 1. ZADANIA DOMOWE (Liczymy następne wystąpienia)
            if (tasksRes.data && tLogsRes.data) {
                tasksRes.data.forEach(t => {
                    if (t.interval_days && t.interval_days > 0) {
                        const logs = tLogsRes.data.filter(l => l.task_id === t.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                        if (logs.length > 0) {
                            const lastDate = new Date(logs[0].created_at);
                            const nextDate = new Date(lastDate);
                            nextDate.setDate(nextDate.getDate() + t.interval_days);
                            allEvents.push({
                                id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                                date: getLocalDayStr(nextDate), color: 'text-[#c2e7ff]', bg: 'bg-[#004a77]'
                            });
                        }
                    } else if (t.task_type === 'one_time' && t.event_date) {
                         allEvents.push({
                                id: t.id, type: 'Dom', title: t.name, icon: '🏠',
                                date: t.event_date.split('T')[0], color: 'text-[#c2e7ff]', bg: 'bg-[#004a77]'
                            });
                    }
                });
            }

            // 2. ZDROWIE (Infekcje, Leki, Wizyty)
            if (hTasksRes.data && hLogsRes.data) {
                // Wypełniamy listę do sub-filtrów
                const taskSelect = document.getElementById('cal-subfilter-task');
                if (taskSelect) {
                    taskSelect.innerHTML = '<option value="">-- Wszystkie --</option>' + 
                        hTasksRes.data.map(ht => `<option value="${ht.id}">${ht.name}</option>`).join('');
                }

                hTasksRes.data.forEach(ht => {
                    if (ht.task_type === 'duration') {
                        // Generujemy dni na podstawie logów (Heatmapa)
                        const logs = hLogsRes.data.filter(l => l.health_task_id === ht.id);
                        logs.forEach(l => {
                            let start = new Date(l.start_date);
                            let end = l.end_date ? new Date(l.end_date) : new Date();
                            // Dodajemy event dla każdego dnia infekcji (żeby heatmapa działała)
                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                allEvents.push({
                                    id: ht.id, type: 'Zdrowie', title: ht.name, icon: '🤒', subTaskId: ht.id,
                                    date: getLocalDayStr(d), color: 'text-[#ffb4ab]', bg: 'bg-[#8c1d18]'
                                });
                            }
                        });
                    } else if (ht.task_type === 'one_time' && ht.event_date) {
                         allEvents.push({
                            id: ht.id, type: 'Zdrowie', title: ht.name, icon: '📅', subTaskId: ht.id,
                            date: ht.event_date.split('T')[0], color: 'text-amber-200', bg: 'bg-amber-700'
                        });
                    }
                });
            }

            // 3. TO-DO (Szybkie zadania niezrobione)
            if (todosRes.data) {
                todosRes.data.forEach(todo => {
                    if (!todo.is_completed) {
                        allEvents.push({
                            id: todo.id, type: 'Zadanie', title: todo.title, icon: '📝',
                            date: todo.created_at.split('T')[0], color: 'text-neutral-200', bg: 'bg-[#333537]'
                        });
                    }
                });
            }

            document.getElementById('calendar-subtitle').innerText = 'Gotowe';

        } catch (e) {
            console.error("Błąd ładowania kalendarza:", e);
            document.getElementById('calendar-subtitle').innerText = 'Błąd pobierania danych';
        }
    }

    function getFilteredEvents() {
        return allEvents.filter(e => {
            if (activeFilter !== 'all' && e.type !== activeFilter) return false;
            if (activeSubFilterTask && e.subTaskId != activeSubFilterTask) return false;
            return true;
        });
    }

    function setupEventListeners() {
        document.querySelectorAll('.js-cal-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // UI Tabów
                document.querySelectorAll('.js-cal-tab').forEach(b => {
                    b.classList.remove('bg-[#333537]', 'text-white', 'shadow-sm');
                    b.classList.add('text-neutral-500');
                });
                e.target.classList.add('bg-[#333537]', 'text-white', 'shadow-sm');
                e.target.classList.remove('text-neutral-500');
                
                // Przełączanie zmiennej i render
                currentTab = e.target.dataset.tab;
                renderCurrentTab();
            });
        });

        document.querySelectorAll('.js-cal-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.js-cal-filter').forEach(b => {
                    b.classList.replace('bg-[#a8c7fa]', 'bg-[#131314]');
                    b.classList.replace('text-[#004a77]', 'text-neutral-400');
                    b.classList.add('border', 'border-[#333537]');
                });
                e.target.classList.replace('bg-[#131314]', 'bg-[#a8c7fa]');
                e.target.classList.replace('text-neutral-400', 'text-[#004a77]');
                e.target.classList.remove('border', 'border-[#333537]');
                
                activeFilter = e.target.dataset.filter;
                renderCurrentTab();
            });
        });
    }

    function renderCurrentTab() {
        document.getElementById('cal-view-agenda').classList.add('hidden');
        document.getElementById('cal-view-month').classList.add('hidden');
        document.getElementById('cal-view-year').classList.add('hidden');

        if (currentTab === 'agenda') {
            document.getElementById('cal-view-agenda').classList.remove('hidden');
            renderAgenda();
        } else if (currentTab === 'month') {
            document.getElementById('cal-view-month').classList.remove('hidden');
            renderMonth();
        } else if (currentTab === 'year') {
            document.getElementById('cal-view-year').classList.remove('hidden');
            renderYearHeatmap();
        }
    }

    function renderAgenda() {
        const container = document.getElementById('cal-view-agenda');
        const events = getFilteredEvents();
        const todayStr = getLocalDayStr();

        // Sortowanie chronologiczne od dziś w przód
        const futureEvents = events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));

        if (futureEvents.length === 0) {
            container.innerHTML = `<p class="text-center text-neutral-500 py-20 text-sm">Brak nadchodzących zdarzeń.</p>`;
            return;
        }

        let html = '';
        let lastDate = '';

        futureEvents.forEach(e => {
            if (e.date !== lastDate) {
                const dateObj = new Date(e.date);
                const isToday = e.date === todayStr;
                const dateLabel = isToday ? 'Dzisiaj' : dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
                
                html += `<h3 class="text-[10px] font-bold ${isToday ? 'text-[#a8c7fa]' : 'text-neutral-500'} uppercase tracking-widest mt-6 mb-2 border-b border-[#333537] pb-1 sticky top-0 bg-[#131314]/90 backdrop-blur z-10">${dateLabel}</h3>`;
                lastDate = e.date;
            }

            html += `
            <div class="bg-[#1e1f20] p-4 rounded-[16px] border border-[#333537] flex items-center gap-4 mb-2 shadow-sm">
                <span class="text-2xl">${e.icon}</span>
                <div>
                    <p class="text-sm font-bold ${e.color}">${window.esc(e.title)}</p>
                    <p class="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">${e.type}</p>
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
        const events = getFilteredEvents();

        for (let i = 0; i < firstDay; i++) html += `<div></div>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = getLocalDayStr() === dateStr;
            const dayEvents = events.filter(e => e.date === dateStr);
            
            let bgClass = 'bg-[#1e1f20] text-neutral-300';
            if (isToday) bgClass = 'bg-[#333537] border-2 border-[#a8c7fa] text-white font-bold';

            let dotsHtml = '';
            if (dayEvents.length > 0) {
                // Unikalne kolory z danego dnia
                const colors = [...new Set(dayEvents.map(e => e.bg))].slice(0, 3);
                dotsHtml = `<div class="absolute bottom-1 w-full flex justify-center gap-0.5">` + 
                           colors.map(c => `<div class="w-1.5 h-1.5 rounded-full ${c}"></div>`).join('') + 
                           `</div>`;
            }

            html += `<div onclick="window.CalendarModule.showMonthDetails('${dateStr}')" class="relative p-2 h-10 ${bgClass} rounded-lg flex items-start justify-center cursor-pointer active:scale-90 transition-transform select-none">${d}${dotsHtml}</div>`;
        }
        html += `</div>`;
        grid.innerHTML = html;
        document.getElementById('cal-month-details').innerHTML = `<p class="text-center text-neutral-500 text-xs mt-10">Wybierz dzień z kalendarza, aby zobaczyć szczegóły.</p>`;
    }

    window.changeMonth = function(offset) {
        currentMonth += offset;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
        else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderMonth();
    };

    window.showMonthDetails = function(dateStr) {
        const container = document.getElementById('cal-month-details');
        const dayEvents = getFilteredEvents().filter(e => e.date === dateStr);
        
        const dateObj = new Date(dateStr);
        const dateLabel = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

        if (dayEvents.length === 0) {
            container.innerHTML = `<h3 class="text-[10px] font-bold text-[#a8c7fa] uppercase tracking-widest mb-4 sticky top-0">${dateLabel}</h3><p class="text-neutral-500 text-xs text-center py-4">Brak zdarzeń tego dnia.</p>`;
            return;
        }

        let html = `<h3 class="text-[10px] font-bold text-[#a8c7fa] uppercase tracking-widest mb-4 sticky top-0">${dateLabel}</h3>`;
        dayEvents.forEach(e => {
            html += `
            <div class="border-l-2 border-[#333537] ml-2 pl-4 py-2 relative mb-2">
                <div class="absolute -left-[11px] top-3 w-5 h-5 bg-[#1e1f20] border border-[#333537] rounded-full text-[10px] flex items-center justify-center">${e.icon}</div>
                <p class="text-sm font-medium ${e.color}">${window.esc(e.title)}</p>
                <p class="text-[9px] text-neutral-500 uppercase">${e.type}</p>
            </div>`;
        });
        container.innerHTML = html;
    };

    // HEATMAPA (ROK)
    function renderYearHeatmap() {
        const grid = document.getElementById('cal-year-grid');
        const events = getFilteredEvents();
        
        // Tablica miesięcy
        const months = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
        let html = '';

        for (let m = 0; m < 12; m++) {
            const firstDay = (new Date(currentYear, m, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
            
            let monthHtml = `<div class="mb-4"><h3 class="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">${months[m]}</h3><div class="flex flex-wrap gap-1">`;
            
            // Puste pola przed 1. dniem miesiąca (żeby zachować układ tygodnia)
            for(let i=0; i<firstDay; i++) monthHtml += `<div class="w-3.5 h-3.5 rounded-sm bg-transparent"></div>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasEvent = events.some(e => e.date === dateStr);
                
                // Klasy dla mapy ciepła. Szare = czysto, Czerwone/Niebieskie = zdarzenie
                let cellClass = "w-3.5 h-3.5 rounded-sm bg-[#1e1f20]"; 
                if (hasEvent) {
                    const sampleEvent = events.find(e => e.date === dateStr);
                    cellClass = `w-3.5 h-3.5 rounded-sm ${sampleEvent.bg} shadow-sm border border-black/20`; 
                }

                monthHtml += `<div class="${cellClass}" title="${dateStr}"></div>`;
            }
            monthHtml += `</div></div>`;
            html += monthHtml;
        }

        grid.innerHTML = html;
    }

    // --- SYSTEM SUB-FILTRÓW ---
    window.openSubFilterModal = function() {
        const modal = document.getElementById('cal-subfilter-modal');
        const panel = document.getElementById('cal-subfilter-panel');
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            panel.classList.remove('translate-y-full');
            panel.classList.add('translate-y-0');
        });
    };

    window.closeSubFilterModal = function() {
        const modal = document.getElementById('cal-subfilter-modal');
        const panel = document.getElementById('cal-subfilter-panel');
        panel.classList.remove('translate-y-0');
        panel.classList.add('translate-y-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    window.applySubFilter = function() {
        const taskSelect = document.getElementById('cal-subfilter-task');
        activeSubFilterTask = taskSelect.value ? taskSelect.value : null;
        
        const badge = document.getElementById('active-subfilter-badge');
        if (activeSubFilterTask) {
            const taskName = taskSelect.options[taskSelect.selectedIndex].text;
            document.getElementById('subfilter-text').innerText = `Tylko: ${taskName}`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        renderCurrentTab();
        window.closeSubFilterModal();
    };

    window.clearSubFilter = function() {
        activeSubFilterTask = null;
        document.getElementById('cal-subfilter-task').value = "";
        document.getElementById('active-subfilter-badge').classList.add('hidden');
        renderCurrentTab();
    };

    return { 
        init, 
        changeMonth, 
        showMonthDetails, 
        openSubFilterModal, 
        closeSubFilterModal, 
        applySubFilter, 
        clearSubFilter 
    };
})();
