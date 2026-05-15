// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

window.HomeModule = (() => {
    let logs = []; 
    let tasks = []; 
    let roomFilter = null; 
    let viewMode = 'list'; 
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    window.toggleHomeView = function() {
        viewMode = viewMode === 'list' ? 'calendar' : 'list';
        const toggleBtn = document.getElementById('home-view-toggle-btn');
        if (toggleBtn) toggleBtn.innerText = viewMode === 'list' ? '📅' : '📋';
        window.loadDashboard();
    };

    window.changeHomeMonth = function(offset) {
        currentMonth += parseInt(offset);
        if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
        else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        window.loadDashboard();
    };

    window.filterHomeByRoom = function(room) {
        roomFilter = room;
        if (window.activeView !== 'home') window.switchView('home'); 
        else window.loadDashboard();
    };

    window.clearRoomFilter = function() {
        roomFilter = null;
        window.loadDashboard(); 
    };

    window.loadDashboard = async function() {
        const list = document.getElementById('dashboard-list') || document.getElementById('home-task-list');
        const calWrapper = document.getElementById('home-calendar-wrapper');
        const backBtn = document.getElementById('home-back-btn');
        
        if (roomFilter) {
            if (backBtn) backBtn.classList.remove('hidden'); 
            const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
            if (h1) h1.innerText = roomFilter; if (p) p.innerText = 'Lista zadań';
            if (calWrapper) calWrapper.classList.add('hidden');
            if (list) list.classList.remove('hidden');
        } else {
            if (backBtn) backBtn.classList.add('hidden');
            const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
            if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Zarządzanie przestrzenią';
            
            if (viewMode === 'calendar') {
                if (list) list.classList.add('hidden');
                if (calWrapper) calWrapper.classList.remove('hidden');
            } else {
                if (calWrapper) calWrapper.classList.add('hidden');
                if (list) list.classList.remove('hidden');
            }
        }

        // ZMIANA KRYTYCZNA: Sprawdzamy czy cache nie wygasł (np. po dodaniu pokoju w ustawieniach)
        const now = Date.now();
        const isStale = (now - (window.dashboardCacheTime || 0) > window.CONFIG.CACHE_TTL);
        
        let state = window.AppStore.get() || {};
        if (isStale || !state.tasks || state.tasks.length === 0) {
            await window.loadDashboardOverview(true); // Wymuszamy świeże dane
            state = window.AppStore.get() || {};
        }
        
        tasks = state.tasks || []; 
        logs = state.logs || [];
        const dbRooms = state.rooms || [];

        if (tasks.length === 0 && !roomFilter) {
            if (list) {
                list.classList.remove('hidden');
                if (calWrapper) calWrapper.classList.add('hidden');
                list.innerHTML = window.UI.renderEmptyState("Twój dom jest pusty", "Dodaj pierwszą czynność, by zacząć dbać o przestrzeń.") + `
                <div class="flex justify-center -mt-10">
                    <button class="js-open-new-task-modal bg-[#004a77] text-[#c2e7ff] font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2">
                        <span class="text-xl pb-1">+</span> Dodaj pierwszą czynność
                    </button>
                </div>`;
            }
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!roomFilter) {
            if (viewMode === 'calendar') {
                window.renderHomeCalendar();
                return;
            }

            let roomStats = {};
            dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
            if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
            
            let totalOverdueAll = 0;
            tasks.forEach(task => {
                const rName = task.room || 'Inne';
                if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 };
                roomStats[rName].total++;
                
                const taskLogs = logs.filter(l => l.task_id === task.id);
                if (task.interval_days && task.interval_days > 0) {
                    if (taskLogs.length === 0) {
                        roomStats[rName].overdue++; 
                        totalOverdueAll++;
                    } else {
                        const nextDate = new Date(taskLogs[0].created_at);
                        nextDate.setDate(nextDate.getDate() + task.interval_days);
                        nextDate.setHours(0,0,0,0);
                        if (nextDate < today) {
                            roomStats[rName].overdue++; 
                            totalOverdueAll++;
                        }
                    }
                }
            });

            let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">`;
            const allBadge = totalOverdueAll > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${totalOverdueAll}</div>` : '';
            
            html += `
                <div class="js-filter-room relative bg-[#004a77]/20 p-4 rounded-[20px] border border-[#004a77]/50 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24" data-room="Wszystkie">
                    ${allBadge}<div class="text-2xl mb-1 opacity-80">🗂️</div><h3 class="text-xs font-medium text-[#c2e7ff]">Wszystkie</h3>
                    <p class="text-[9px] text-[#c2e7ff]/70 mt-0.5 uppercase tracking-widest">${tasks.length} zadań</p>
                </div>`;

            Object.entries(roomStats).sort((a,b) => (a[0] === 'Inne' ? 1 : b[0] === 'Inne' ? -1 : a[0].localeCompare(b[0]))).forEach(([roomName, stats]) => {
                const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
                html += `
                    <div class="js-filter-room relative bg-[#1e1f20] p-4 rounded-[20px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24" data-room="${window.esc(roomName)}">
                        ${badge}<div class="text-2xl mb-1 opacity-80">${window.esc(stats.icon)}</div><h3 class="text-xs font-medium text-neutral-200">${window.esc(roomName)}</h3>
                        <p class="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-widest">${stats.total} zadań</p>
                    </div>`;
            });
            if (list) list.innerHTML = html + `</div>`;
            return;
        }

        let tasksToDisplay = roomFilter === 'Wszystkie' ? tasks : tasks.filter(t => (t.room || 'Inne') === roomFilter);

        let scored = tasksToDisplay.map(t => {
            const taskLogs = logs.filter(l => l.task_id === t.id);
            const lastLog = taskLogs[0]; 
            let daysRemaining;
            
            if (!t.interval_days || t.interval_days === 0) {
                daysRemaining = taskLogs.length > 0 ? 999999 : 0; 
            } else {
                if (!lastLog) {
                    daysRemaining = -999999;
                } else {
                    const lastDate = new Date(lastLog.created_at);
                    lastDate.setHours(0,0,0,0);
                    const nextDueDate = new Date(lastDate);
                    nextDueDate.setDate(nextDueDate.getDate() + t.interval_days);
                    const diffTime = nextDueDate.getTime() - today.getTime();
                    daysRemaining = Math.ceil(diffTime / 86400000);
                }
            }
            return { t, last: lastLog, daysRemaining };
        });

        scored.sort((a, b) => {
            if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
            const intA = a.t.interval_days || 999999;
            const intB = b.t.interval_days || 999999;
            if (intA !== intB) return intA - intB;
            return a.t.name.localeCompare(b.t.name);
        });

        if (list) {
            list.innerHTML = scored.length 
                ? scored.map(item => window.UI.renderHomeTaskCard(item)).join('') 
                : window.UI.renderEmptyState("Brak zadań", "To pomieszczenie jest czyste.");
        }
    };

    window.renderHomeCalendar = function() {
        const container = document.getElementById('home-calendar-container');
        const title = document.getElementById('home-calendar-title');
        if (!container || !title) return;

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
            const isToday = window.getTodayLocalString() === dateStr;

            const dayLogs = logs.filter(l => l.created_at.startsWith(dateStr));
            const dueTasks = tasks.filter(task => {
                if (!task.interval_days || task.interval_days === 0) return false;
                const taskLogs = logs.filter(l => l.task_id === task.id);
                if (taskLogs.length === 0) return false; 
                const lastLog = taskLogs[0];
                const lastDate = new Date(lastLog.created_at); lastDate.setHours(0,0,0,0);
                const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
                return window.getTodayLocalString(nextDate) === dateStr;
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

            html += `<div class="js-open-home-day-details relative aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all active:scale-90 ${dayClass}" data-date="${dateStr}"><span class="text-xs">${d}</span>${indicator}</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;
    };

    window.openHomeDayDetails = function(dateStr) {
        const modal = document.getElementById('day-details-modal'); 
        const list = document.getElementById('day-details-list');
        document.getElementById('day-details-title').innerText = "Wydarzenia w Domu";
        document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const dayLogs = logs.filter(l => l.created_at.startsWith(dateStr));
        const dueTasks = tasks.filter(task => {
            if (!task.interval_days || task.interval_days === 0) return false;
            const taskLogs = logs.filter(l => l.task_id === task.id);
            if (taskLogs.length === 0) return false; 
            const lastLog = taskLogs[0];
            const lastDate = new Date(lastLog.created_at); lastDate.setHours(0,0,0,0);
            const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
            return window.getTodayLocalString(nextDate) === dateStr;
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
                const task = tasks.find(t => t.id === l.task_id) || { name: l.activity_name };
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

    window.closeHomeDayDetailsModal = function() { 
        setTimeout(() => {
            const modal = document.getElementById('day-details-modal');
            if(modal) modal.classList.add('hidden');
        }, 10);
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
        const diff = Math.ceil((next.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
        
        return diff < 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: `Przeterminowane o ${Math.abs(diff)} dni.` } 
               : diff === 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: 'Dzisiaj!' } 
               : { color: 'text-[#c4eed0]', label: relText, tooltip: `Za ${diff} dni.` };
    };

    window.openAddLogModal = function(id, name) {
        window.loadAndShowModal('add-log-modal', '/modals/add-log.html', () => {
            document.getElementById('add-log-subtitle').innerText = name;
            document.getElementById('add-log-name').value = id; 
            document.getElementById('add-log-date').value = window.getTodayLocalString();
            document.getElementById('add-log-notes').value = '';
            setTimeout(() => { const input = document.getElementById('add-log-notes'); if (input) input.focus(); }, 50);
        });
    };

    window.closeAddLogModal = function() { 
        setTimeout(() => {
            const modal = document.getElementById('add-log-modal');
            if (modal) modal.classList.add('hidden');
        }, 10);
    };

    window.saveNewLog = async function() {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const taskId = document.getElementById('add-log-name').value;
        const d = document.getElementById('add-log-date').value; 
        const nt = document.getElementById('add-log-notes').value;
        const taskObj = tasks.find(t => t.id == taskId);
        
        const todayStr = window.getTodayLocalString();
        const finalDate = (d === todayStr) ? new Date().toISOString() : `${d}T12:00:00.000Z`;
        
        const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
            task_id: taskId, activity_name: taskObj ? taskObj.name : 'Zadanie', 
            created_at: finalDate, notes: nt, 
            user_id: window.currentUser.user_id, 
            household_id: window.currentUser.household_id, user_name: window.currentUser.name 
        }]);
        
        if (error) { window.showToast("Błąd: " + error.message); return; }

        if (taskObj && taskObj.interval_days > 0) {
            const nextDate = new Date(finalDate); 
            nextDate.setDate(nextDate.getDate() + taskObj.interval_days);
            await window.supabaseClient.from('tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', taskId);
            window.showToast("Zapisano log!");
        } else if (taskObj) {
            await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', taskId);
            window.showToast("Zadanie jednorazowe zakończone!");
        } else {
            window.showToast("Zapisano log!");
        }

        window.invalidateDashboardCache(); 
        window.closeAddLogModal(); 
        window.loadDashboard();
    };

    window.openNewTaskModal = function() {
        window.loadAndShowModal('new-task-modal', '/modals/new-task.html', () => {
            document.getElementById('new-task-name').value = '';
            if(typeof window.populateRoomsDropdown === 'function') window.populateRoomsDropdown('new-task-room');
            document.getElementById('new-task-interval').value = '';
            document.getElementById('new-task-remind').value = '0';
            setTimeout(() => { const input = document.getElementById('new-task-name'); if (input) input.focus(); }, 50);
        });
    };

    window.closeNewTaskModal = function() { 
        setTimeout(() => {
            const modal = document.getElementById('new-task-modal');
            if (modal) modal.classList.add('hidden');
        }, 10);
    };

    window.saveNewTask = async function() {
        const n = document.getElementById('new-task-name').value.trim();
        const i = parseInt(document.getElementById('new-task-interval').value) || 0;
        const remind = parseInt(document.getElementById('new-task-remind').value) || 0;
        const r = document.getElementById('new-task-room').value;
        if (!n) return;

        const initialDue = new Date().toISOString();

        const { error } = await window.supabaseClient.from('tasks').insert([{ 
            name: n, interval_days: i, remind_days_before: remind, push_enabled: true, show_in_history: true, 
            room: r, user_id: window.currentUser.user_id,
            household_id: window.currentUser.household_id,
            next_due_at: initialDue
        }]);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        window.invalidateDashboardCache();
        window.closeNewTaskModal(); 
        window.showToast("Dodano czynność!"); 
        window.loadDashboard();
    };

    window.openEditLogModal = function(logId) {
        const log = logs.find(l => l.id === logId);
        if (!log) { window.showToast("Nie znaleziono wpisu."); return; }

        window.loadAndShowModal('edit-log-modal', '/modals/edit-log.html', () => {
            document.getElementById('edit-log-id').value = log.id;
            document.getElementById('edit-log-date').value = log.created_at.split('T')[0];
            document.getElementById('edit-log-notes').value = log.notes || '';
            setTimeout(() => { const input = document.getElementById('edit-log-notes'); if (input) input.focus(); }, 50);
        });
    };

    window.closeEditLogModal = function() { 
        setTimeout(() => {
            const modal = document.getElementById('edit-log-modal');
            if (modal) modal.classList.add('hidden');
        }, 10);
    };

    window.saveEditLog = async function() {
        const id = document.getElementById('edit-log-id').value;
        const date = document.getElementById('edit-log-date').value;
        const notes = document.getElementById('edit-log-notes').value.trim();

        if (!id || !date) return;
        const todayStr = window.getTodayLocalString();
        const finalDate = (date === todayStr) ? new Date().toISOString() : `${date}T12:00:00.000Z`;

        const { error } = await window.supabaseClient.from('activity_logs')
            .update({ created_at: finalDate, notes: notes })
            .eq('id', id).eq('household_id', window.currentUser.household_id);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Wpis zaktualizowany! ✏️"); 
        
        window.invalidateDashboardCache();
        window.closeEditLogModal();
        window.loadDashboard();
        if (typeof window.refreshCurrentView === 'function') await window.refreshCurrentView();
    };

    window.deleteTaskFromHome = function(id, name) {
        window.customConfirm(`Czy na pewno usunąć "${name}"?`, async () => {
            const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', id);
            if (error) { window.showToast("Błąd usuwania"); return; }
            
            window.invalidateDashboardCache();
            window.showToast("Usunięto!"); 
            window.loadDashboard();
        });
    };

    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-toggle-home-view', () => window.toggleHomeView());
        window.EventDispatcher.onClick('.js-open-home-stats', () => window.openStatsScreen());
        window.EventDispatcher.onClick('.js-refresh-home-view', () => window.refreshCurrentView());
        window.EventDispatcher.onClick('.js-open-new-task-modal', () => window.openNewTaskModal());
        window.EventDispatcher.onClick('.js-change-home-month', (e, el) => window.changeHomeMonth(el.dataset.offset));

        window.EventDispatcher.onClick('.js-home-back', (e) => {
            e.preventDefault(); e.stopPropagation(); // Blokada propagacji by nie kliknąć w nagłówek
            window.clearRoomFilter();
        });
        
        window.EventDispatcher.onClick('.js-open-home-day-details', (e, el) => window.openHomeDayDetails(el.dataset.date));
        window.EventDispatcher.onClick('.js-close-home-day-details', () => window.closeHomeDayDetailsModal());

        window.EventDispatcher.onClick('.js-add-log', (e, el) => {
            e.preventDefault(); e.stopPropagation();
            window.openAddLogModal(el.dataset.id, el.dataset.name);
        });

        window.EventDispatcher.onClick('.js-swipe-item', (e, el) => {
            if (e.target.closest('.js-add-log')) return; 
            if (el.style.transform === 'translateX(-80px)') { el.style.transform = 'translateX(0px)'; return; }
            window.openSettingsScreen(el.dataset.id);
        });

        window.EventDispatcher.onClick('.js-delete-task', (e, el) => window.deleteTaskFromHome(el.dataset.id, el.dataset.name));
        window.EventDispatcher.onClick('.js-filter-room', (e, el) => window.filterHomeByRoom(el.dataset.room));
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return {
        getLogs: () => logs, setLogs: (newLogs) => logs = newLogs, getRoomFilter: () => roomFilter
    };

})();
