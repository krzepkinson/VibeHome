// ==========================================
// LOGIKA: DOM - LOCAL FIRST (home.js)
// ==========================================

window.HomeModule = (() => {
    let roomFilter = null; 

    // Helper do bezpiecznego porównywania ID (String vs Number)
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    const formatLocalDatetime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const parseLocalDatetime = (dtStr) => {
        if (!dtStr) return null;
        if (dtStr.length === 16) dtStr += ':00';
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return new Date(dtStr.replace('T', ' ').replace(/-/g, '/'));
        return d;
    };

    window.filterHomeByRoom = function(room) {
        roomFilter = room;
        if (window.activeView !== 'home') {
            window.switchView('home'); 
        } else {
            window.history.pushState(
                { view: 'home', roomFilter: room }, 
                '', 
                '/?view=home'
            );
            window.loadDashboard();
        }
    };

    window.clearRoomFilter = function() {
        roomFilter = null;
        window.loadDashboard(); 
    };

    window.loadDashboard = async function() {
        const list = document.getElementById('dashboard-list') || document.getElementById('home-task-list');
        const backBtn = document.getElementById('home-back-btn');
        
        if (roomFilter) {
            if (backBtn) backBtn.classList.remove('hidden'); 
            const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
            if (h1) h1.innerText = roomFilter; if (p) p.innerText = 'Lista zadań';
            if (list) list.classList.remove('hidden');
        } else {
            if (backBtn) backBtn.classList.add('hidden');
            const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
            if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Zarządzanie przestrzenią';
            if (list) list.classList.remove('hidden');
        }

        // 1. INSTANT RENDER z AppStore (0 ms)
        window.renderHomeUI();

        // 2. Tło: Dociągnięcie danych z Supabase w razie potrzeby
        const state = window.AppStore.get() || {};
        if (!state.tasks || state.tasks.length === 0) {
            if (typeof window.loadDashboardOverview === 'function') {
                await window.loadDashboardOverview(true);
                window.renderHomeUI();
            }
        }
    };

    window.renderHomeUI = function() {
        const list = document.getElementById('dashboard-list') || document.getElementById('home-task-list');
        const state = window.AppStore.get() || {};
        
        const tasks = (state.tasks || []).filter(t => !t.is_archived); 
        const logs = state.logs || [];
        const dbRooms = state.rooms || [];

        if (tasks.length === 0 && !roomFilter) {
            if (list) {
                list.innerHTML = window.UI.renderEmptyState("Twój dom jest pusty", "Dodaj pierwszą czynność, by zacząć dbać o przestrzeń.") + `
                <div class="flex justify-center -mt-10">
                    <button class="js-open-new-task-modal bg-[#004a77] text-[#c2e7ff] font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2 cursor-pointer">
                        <span class="text-xl pb-1">+</span> Dodaj pierwszą czynność
                    </button>
                </div>`;
            }
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!roomFilter) {
            let roomStats = {};
            dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
            if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
            
            let totalOverdueAll = 0;
            tasks.forEach(task => {
                const rName = task.room || 'Inne';
                if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 };
                roomStats[rName].total++;
                
                const taskLogs = logs.filter(l => sameId(l.task_id, task.id));
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
            const taskLogs = logs.filter(l => sameId(l.task_id, t.id));
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
            document.getElementById('add-log-date').value = formatLocalDatetime(new Date().toISOString());
            document.getElementById('add-log-notes').value = '';
            setTimeout(() => { const input = document.getElementById('add-log-notes'); if (input) input.focus(); }, 50);
        });
    };

    window.closeAddLogModal = function() { 
        const modal = document.getElementById('add-log-modal');
        if (modal) modal.classList.add('hidden');
    };

    // INSTANT LOCAL-FIRST: Zapis nowego wykonania sprzątania w 0 ms
    window.saveNewLog = async function() {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        if (document.activeElement) document.activeElement.blur();

        const taskId = document.getElementById('add-log-name').value;
        const dStr = document.getElementById('add-log-date').value; 
        const nt = document.getElementById('add-log-notes').value;
        
        const state = window.AppStore.get() || {};
        const taskObj = (state.tasks || []).find(t => sameId(t.id, taskId));
        
        if (!dStr) { window.showToast("Wprowadź datę i godzinę!"); return; }
        const finalDate = parseLocalDatetime(dStr).toISOString();

        const tempLogId = Date.now();
        const newLog = {
            id: tempLogId,
            task_id: taskId,
            activity_name: taskObj ? taskObj.name : 'Zadanie',
            created_at: finalDate,
            notes: nt,
            user_id: window.currentUser ? window.currentUser.user_id : null,
            household_id: window.currentUser ? window.currentUser.household_id : null,
            user_name: window.currentUser ? window.currentUser.name : 'Ja'
        };

        // 1. Natychmiastowy update w AppStore i przerysowanie
        window.AppStore.set(prevState => {
            const updatedLogs = [newLog, ...(prevState.logs || [])];
            let updatedTasks = prevState.tasks || [];
            
            if (taskObj && taskObj.interval_days > 0) {
                const nextDate = new Date(finalDate); 
                nextDate.setDate(nextDate.getDate() + taskObj.interval_days);
                updatedTasks = updatedTasks.map(t => sameId(t.id, taskId) ? { ...t, next_due_at: nextDate.toISOString() } : t);
            }
            return { ...prevState, logs: updatedLogs, tasks: updatedTasks };
        });

        window.closeAddLogModal(); 
        window.showToast("Zapisano log!");
        window.renderHomeUI();

        // 2. Synchronizacja z chmurą w tle
        const { data, error } = await window.supabaseClient.from('activity_logs').insert([{ 
            task_id: taskId, activity_name: newLog.activity_name, 
            created_at: finalDate, notes: nt, 
            user_id: newLog.user_id, 
            household_id: newLog.household_id, user_name: newLog.user_name 
        }]).select().single();

        if (error) {
            window.showToast("Błąd zapisu w chmurze");
            window.loadDashboardOverview(true);
            return;
        }

        if (data) {
            window.AppStore.set(prevState => ({
                ...prevState,
                logs: (prevState.logs || []).map(l => l.id === tempLogId ? data : l)
            }));
        }

        if (taskObj && taskObj.interval_days > 0) {
            const nextDate = new Date(finalDate); 
            nextDate.setDate(nextDate.getDate() + taskObj.interval_days);
            await window.supabaseClient.from('tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', taskId);
        }

        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
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
        const modal = document.getElementById('new-task-modal');
        if (modal) modal.classList.add('hidden');
    };

    // INSTANT LOCAL-FIRST: Tworzenie nowej czynności w 0 ms
    window.saveNewTask = async function() {
        if (document.activeElement) document.activeElement.blur();

        const n = document.getElementById('new-task-name').value.trim();
        const i = parseInt(document.getElementById('new-task-interval').value) || 0;
        const remind = parseInt(document.getElementById('new-task-remind').value) || 0;
        const r = document.getElementById('new-task-room').value;
        if (!n) return;

        const initialDue = new Date().toISOString();
        const tempTaskId = Date.now();

        const newTask = {
            id: tempTaskId,
            name: n, interval_days: i, remind_days_before: remind, push_enabled: true, show_in_history: true, 
            room: r, user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, 
            next_due_at: initialDue, is_archived: false
        };

        // 1. Zapis w pamięci urządzenia i natychmiastowe przerysowanie
        window.AppStore.set(prevState => ({
            ...prevState,
            tasks: [newTask, ...(prevState.tasks || [])]
        }));

        window.closeNewTaskModal(); 
        window.showToast("Dodano czynność!"); 
        window.renderHomeUI();

        // 2. Synchronizacja z baza Supabase w tle
        const { data, error } = await window.supabaseClient.from('tasks').insert([{ 
            name: n, interval_days: i, remind_days_before: remind, push_enabled: true, show_in_history: true, 
            room: r, user_id: newTask.user_id, household_id: newTask.household_id, next_due_at: initialDue
        }]).select().single();

        if (error) {
            window.showToast("Błąd zapisu w chmurze");
            window.loadDashboardOverview(true);
        } else if (data) {
            window.AppStore.set(prevState => ({
                ...prevState,
                tasks: (prevState.tasks || []).map(t => t.id === tempTaskId ? data : t)
            }));
        }

        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    };

    window.openEditLogModal = function(logId) {
        const state = window.AppStore.get() || {};
        const log = (state.logs || []).find(l => sameId(l.id, logId));
        
        if (!log) { window.showToast("Nie znaleziono wpisu."); return; }

        window.loadAndShowModal('edit-log-modal', '/modals/edit-log.html', () => {
            document.getElementById('edit-log-id').value = log.id;
            document.getElementById('edit-log-date').value = formatLocalDatetime(log.created_at);
            document.getElementById('edit-log-notes').value = log.notes || '';
            setTimeout(() => { const input = document.getElementById('edit-log-notes'); if (input) input.focus(); }, 50);
        });
    };

    window.closeEditLogModal = function() { 
        const modal = document.getElementById('edit-log-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.saveEditLog = async function() {
        if (document.activeElement) document.activeElement.blur();

        const id = document.getElementById('edit-log-id').value;
        const dateStr = document.getElementById('edit-log-date').value;
        const notes = document.getElementById('edit-log-notes').value.trim();

        if (!id || !dateStr) { window.showToast("Wprowadź datę i godzinę!"); return; }
        const finalDate = parseLocalDatetime(dateStr).toISOString();

        // Instant local update
        window.AppStore.set(prevState => ({
            ...prevState,
            logs: (prevState.logs || []).map(l => sameId(l.id, id) ? { ...l, created_at: finalDate, notes: notes } : l)
        }));

        window.closeEditLogModal();
        window.showToast("Wpis zaktualizowany! ✏️"); 
        window.renderHomeUI();

        const { error } = await window.supabaseClient.from('activity_logs')
            .update({ created_at: finalDate, notes: notes })
            .eq('id', id);

        if (error) { 
            window.showToast("Błąd zapisu w chmurze"); 
            window.loadDashboardOverview(true);
        }
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    };

    window.deleteTaskFromHome = function(id, name) {
        window.customConfirm(`Czy na pewno usunąć "${name}"?`, async () => {
            // Instant local update
            window.AppStore.set(prevState => ({
                ...prevState,
                tasks: (prevState.tasks || []).filter(t => !sameId(t.id, id))
            }));
            window.renderHomeUI();
            window.showToast("Usunięto!");

            const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', id);
            if (error) { 
                window.showToast("Błąd usuwania w chmurze"); 
                window.loadDashboardOverview(true);
            }
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        });
    };

    // --- DELEGACJA ZDARZEŃ (VIA DISPATCHER) ---
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-toggle-home-view', async () => {
            await window.switchView('calendar');
            if (typeof window.CalendarModule?.setFilter === 'function') {
                window.CalendarModule.setFilter('Dom');
            }
        });

        window.EventDispatcher.onClick('.js-open-home-stats', () => window.openStatsScreen());
        window.EventDispatcher.onClick('.js-refresh-home-view', () => window.loadDashboardOverview(true));
        window.EventDispatcher.onClick('.js-open-new-task-modal', () => window.openNewTaskModal());

        window.EventDispatcher.onClick('.js-home-back', (e) => {
            e.preventDefault(); e.stopPropagation(); 
            window.clearRoomFilter();
        });

        window.EventDispatcher.onClick('.js-open-home-day-details', (e, el) => window.openHomeDayDetails(el.dataset.date));
        window.EventDispatcher.onClick('.js-close-day-details-modal', () => window.closeHomeDayDetailsModal());

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

        window.EventDispatcher.onClick('.js-close-new-task', () => window.closeNewTaskModal());
        window.EventDispatcher.onClick('.js-save-new-task', () => window.saveNewTask());
        
        window.EventDispatcher.onClick('.js-close-add-log', () => window.closeAddLogModal());
        window.EventDispatcher.onClick('.js-save-add-log', () => window.saveNewLog());

        window.EventDispatcher.onClick('.js-close-edit-log', () => window.closeEditLogModal());
        window.EventDispatcher.onClick('.js-save-edit-log', () => window.saveEditLog());
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return {
        getLogs: () => (window.AppStore.get() || {}).logs || [], 
        getRoomFilter: () => roomFilter
    };

})();
