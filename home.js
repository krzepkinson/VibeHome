// ==========================================
// LOGIKA: DOM 2.0 - LOCAL FIRST + UX GESTURES (home.js)
// ==========================================

window.HomeModule = (() => {
    let roomFilter = null; 
    let afterEditLogClose = null;
    let editLogSaving = false;

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
            window.history.pushState({ view: 'home', roomFilter: room }, '', '/?view=home');
            window.loadDashboard();
        }
    };

    window.clearRoomFilter = function() {
        roomFilter = null;
        window.loadDashboard(); 
    };

    window.loadDashboard = async function(forceRefresh = false) {
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

        // INSTANT RENDER z AppStore (0 ms)
        window.renderHomeUI();

        // Dane lokalne są już widoczne; synchronizacja korzysta z TTL i odświeża widok po zakończeniu.
        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview(forceRefresh);
            window.renderHomeUI();
        }
    };

    window.renderHomeUI = function() {
        const list = document.getElementById('dashboard-list') || document.getElementById('home-task-list');
        if (!list) return;
        if (!window.TaskModel || !window.TaskDetails) { list.innerHTML = '<p class="ux-muted">Ładowanie zadań…</p>'; return; }
        const state = window.AppStore.get() || {};
        const esc = value => window.esc(String(value ?? ''));
        let tasks = window.TaskModel.list().filter(task => task.area === 'Dom');
        const selectedRoom = roomFilter && roomFilter !== 'Wszystkie' ? roomFilter : '';
        let html = `<div class="ux-actions ux-task-filters" role="group" aria-label="Pomieszczenie"><button type="button" class="ux-chip js-filter-room ${!selectedRoom ? 'active' : ''}" data-room="Wszystkie">Wszystkie</button>${(state.rooms || []).map(room => `<button type="button" class="ux-chip js-filter-room ${selectedRoom === room.name ? 'active' : ''}" data-room="${esc(room.name)}">${esc(room.name)}</button>`).join('')}</div>`;
        tasks = tasks.filter(task => !selectedRoom || task.room === selectedRoom).sort((a, b) => Number(b.important) - Number(a.important) || (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity) || a.name.localeCompare(b.name, 'pl'));
        html += tasks.map(window.TaskDetails.row).join('') || '<p class="ux-empty">Brak aktywnych zadań. Dodaj zadanie, termin lub cykl dla domu.</p>';
        list.innerHTML = html;
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

    // INSTANT LOCAL-FIRST: Zapis nowego logu po wyborze z okienka
    window.saveNewLog = async function() {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        if (document.activeElement) document.activeElement.blur();

        const taskId = document.getElementById('add-log-name').value;
        const dStr = document.getElementById('add-log-date').value; 
        const nt = document.getElementById('add-log-notes').value;
        
        if (!dStr) { window.showToast("Wprowadź datę i godzinę!"); return; }
        const finalDate = parseLocalDatetime(dStr).toISOString();

        window.closeAddLogModal(); 
        await executeTaskLog(taskId, finalDate, nt);
    };

    // UX: SZYBKIE ZAKOŃCZENIE ZADANIA (Swipe to Complete / Przesunięcie w prawo)
    window.quickCompleteHomeTask = async function(taskId) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const finalDate = new Date().toISOString();
        await executeTaskLog(taskId, finalDate, '');
    };

    // Wewnętrzna funkcja realizująca logowanie w 0 ms
    async function executeTaskLog(taskId, finalDate, notes) {
        if (window.TaskModel) {
            try {
                const result = await window.TaskModel.complete(`tasks:${taskId}`, { completedAt: finalDate, notes });
                const message = result.task?.repeat.every ? `Wykonano · kolejny termin ${window.TaskModel.dueLabel(result.task)}` : 'Zadanie wykonane';
                if (window.UX?.actionToast && result.undo) window.UX.actionToast(message, 'Cofnij', result.undo);
                else window.showToast(message);
            } catch (error) { console.error('Task completion failed:', error); window.showToast('Nie udało się zapisać wykonania.'); }
            return;
        }

        const state = window.AppStore.get() || {};
        const taskObj = (state.tasks || []).find(t => sameId(t.id, taskId));
        if (!taskObj) return;

        const tempLogId = Date.now();
        const newLog = {
            id: tempLogId,
            task_id: taskId,
            activity_name: taskObj.name,
            created_at: finalDate,
            notes: notes,
            user_id: window.currentUser ? window.currentUser.user_id : null,
            household_id: window.currentUser ? window.currentUser.household_id : null,
            user_name: window.currentUser ? window.currentUser.name : 'Ja'
        };

        // 1. Zapis w pamięci i natychmiastowy render
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

        window.showToast("Wykonano! ✨");
        window.renderHomeUI();

        // 2. Tło: Supabase
        const { data, error } = await window.supabaseClient.from('activity_logs').insert([{ 
            task_id: taskId, activity_name: newLog.activity_name, 
            created_at: finalDate, notes: notes, 
            user_id: newLog.user_id, household_id: newLog.household_id, user_name: newLog.user_name 
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
    }

    // UX: NATYWNA OBSŁUGA GESTÓW SWIPE (W Prawo: Zrobione / W Lewo: Ustawienia)
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeElement = null;
    let isSwiping = false;
    let swipeMoved = false;

    document.addEventListener('touchstart', (e) => {
        if (window.activeView !== 'home') return;
        const card = e.target.closest('.js-swipe-item');
        if (!card) return;
        
        if (e.target.closest('button') || e.target.closest('.js-add-log')) return;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        swipeElement = card;
        isSwiping = false;
        swipeMoved = false;
        card.style.transition = 'none';
    }, {passive: true});

    document.addEventListener('touchmove', (e) => {
        if (!swipeElement || window.activeView !== 'home') return;
        const diffX = e.touches[0].clientX - touchStartX;
        const diffY = e.touches[0].clientY - touchStartY;

        if (!isSwiping) {
            if (Math.abs(diffY) > Math.abs(diffX) + 5) {
                swipeElement.style.transition = 'transform 0.3s ease';
                swipeElement.style.transform = 'translateX(0px)';
                swipeElement = null;
                return;
            }
            if (Math.abs(diffX) > 10) isSwiping = true;
        }

        if (isSwiping) {
            swipeMoved = true;
            let tx = diffX;
            if (tx < -80) tx = -80 + (tx + 80) * 0.2; // Oporność na ustawienia
            if (tx > 120) tx = 120 + (tx - 120) * 0.2; // Oporność na zrobione
            swipeElement.style.transform = `translateX(${tx}px)`;
            
            // Wygaszanie kafelka na zielono podczas pociągnięcia w prawo
            if (tx > 40) {
                swipeElement.style.backgroundColor = 'rgba(15, 82, 35, 0.4)';
                swipeElement.style.borderColor = 'rgba(196, 238, 208, 0.5)';
            } else {
                swipeElement.style.backgroundColor = '';
                swipeElement.style.borderColor = '';
            }
        }
    }, {passive: true});

    document.addEventListener('touchend', (e) => {
        if (!swipeElement || window.activeView !== 'home') return;
        
        const diffX = e.changedTouches[0].clientX - touchStartX;
        
        if (isSwiping && swipeMoved) {
            swipeElement.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            
            if (diffX > 75) {
                // Odhaczenie (Odlatuje w prawo)
                swipeElement.style.transform = `translateX(120%)`; 
                const id = swipeElement.dataset.id;
                setTimeout(() => window.quickCompleteHomeTask(id), 250);
            } else if (diffX < -40) {
                // Ustawienia (Zostaje na -80px)
                swipeElement.style.backgroundColor = '';
                swipeElement.style.borderColor = '';
                swipeElement.style.transform = `translateX(-80px)`;
            } else {
                // Sprężysty powrót do 0
                swipeElement.style.backgroundColor = '';
                swipeElement.style.borderColor = '';
                swipeElement.style.transform = `translateX(0px)`;
            }
        } else {
            swipeElement.style.transition = 'transform 0.3s ease';
            swipeElement.style.transform = `translateX(0px)`;
        }
        
        swipeElement = null;
        isSwiping = false;
        swipeMoved = false;
    });

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

        window.AppStore.set(prevState => ({
            ...prevState,
            tasks: [newTask, ...(prevState.tasks || [])]
        }));

        window.closeNewTaskModal(); 
        window.showToast("Dodano czynność!"); 
        window.renderHomeUI();

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

    window.openEditLogModal = function(logId, options = {}) {
        const state = window.AppStore.get() || {};
        const log = (state.logs || []).find(l => sameId(l.id, logId));
        
        if (!log) { window.showToast("Nie znaleziono wpisu."); return; }
        afterEditLogClose = typeof options.onClose === 'function' ? options.onClose : null;

        window.loadAndShowModal('edit-log-modal', '/modals/edit-log.html', () => {
            document.getElementById('edit-log-id').value = log.id;
            document.getElementById('edit-log-date').value = formatLocalDatetime(log.created_at);
            document.getElementById('edit-log-notes').value = log.notes || '';
            const error = document.getElementById('edit-log-error');
            if (error) error.textContent = '';
            window.UX?.openDialog('edit-log-modal');
            setTimeout(() => { const input = document.getElementById('edit-log-notes'); if (input) input.focus(); }, 50);
        });
    };

    window.closeEditLogModal = function() { 
        if (editLogSaving) return;
        const modal = document.getElementById('edit-log-modal');
        if (window.UX?.closeDialog) window.UX.closeDialog('edit-log-modal');
        else if (modal) modal.classList.add('hidden');
        const callback = afterEditLogClose;
        afterEditLogClose = null;
        callback?.();
    };

    window.saveEditLog = async function() {
        if (editLogSaving) return;
        if (document.activeElement) document.activeElement.blur();

        const id = document.getElementById('edit-log-id').value;
        const dateStr = document.getElementById('edit-log-date').value;
        const notes = document.getElementById('edit-log-notes').value.trim();

        if (!id || !dateStr) { window.showToast("Wprowadź datę i godzinę!"); return; }
        const parsedDate = parseLocalDatetime(dateStr);
        if (!parsedDate || isNaN(parsedDate.getTime())) { window.showToast('Wprowadź prawidłową datę i godzinę.'); return; }
        const finalDate = parsedDate.toISOString();
        const state = window.AppStore.get() || {};
        const original = (state.logs || []).find(log => sameId(log.id, id));
        if (!original) { window.showToast('Nie znaleziono wpisu.'); return; }
        const activeScope = { householdId: window.currentUser?.household_id, userId: window.currentUser?.user_id || window.currentUser?.id };
        const assertScope = () => {
            if (window.currentUser?.household_id !== activeScope.householdId || (window.currentUser?.user_id || window.currentUser?.id) !== activeScope.userId) throw new Error('Konto lub dom zmieniły się podczas zapisywania.');
        };
        const task = window.TaskModel?.get(`tasks:${original.task_id}`);
        const taskLogs = (state.logs || []).filter(log => sameId(log.task_id, original.task_id));
        const latestBefore = taskLogs.reduce((latest, log) => Math.max(latest, new Date(log.created_at).getTime()), -Infinity);
        const latestAfter = taskLogs.reduce((latest, log) => Math.max(latest, new Date(sameId(log.id, id) ? finalDate : log.created_at).getTime()), -Infinity);
        const nextDue = task?.repeat?.every && task.repeat.mode === 'completion' && latestBefore !== latestAfter && Number.isFinite(latestAfter) ? window.TaskModel.addRepeat(new Date(latestAfter), task.repeat).toISOString() : null;
        editLogSaving = true;
        const modal = document.getElementById('edit-log-modal');
        modal?.querySelectorAll('button,input,textarea').forEach(element => { element.disabled = true; });
        const errorElement = document.getElementById('edit-log-error');
        if (errorElement) errorElement.textContent = '';
        window.invalidateDashboardCache?.();
        try {
            const { error } = await window.supabaseClient.from('activity_logs').update({ created_at: finalDate, notes }).eq('id', id).eq('household_id', activeScope.householdId);
            if (error) throw error;
            assertScope();
            if (nextDue) {
                const update = await window.supabaseClient.from('tasks').update({ next_due_at: nextDue }).eq('id', original.task_id).eq('household_id', activeScope.householdId);
                if (update.error) {
                    const rollback = await window.supabaseClient.from('activity_logs').update({ created_at: original.created_at, notes: original.notes || '' }).eq('id', id).eq('household_id', activeScope.householdId);
                    if (rollback.error) window.loadDashboardOverview?.(true);
                    throw update.error;
                }
                assertScope();
            }
            window.invalidateDashboardCache?.();
            window.AppStore.set(prevState => ({ ...prevState,
                logs: (prevState.logs || []).map(log => sameId(log.id, id) ? { ...log, created_at: finalDate, notes } : log),
                tasks: nextDue ? (prevState.tasks || []).map(row => sameId(row.id, original.task_id) ? { ...row, next_due_at: nextDue } : row) : prevState.tasks
            }));
            editLogSaving = false;
            window.closeEditLogModal();
            window.showToast('Zaktualizowano zapis wykonania.');
            window.UX?.refresh?.();
        } catch (error) {
            console.error('Completion edit failed:', error);
            if (errorElement) errorElement.textContent = 'Nie udało się zapisać. Data i notatka pozostają w formularzu.';
            else window.showToast('Nie udało się zapisać wykonania.');
        } finally {
            editLogSaving = false;
            modal?.querySelectorAll('button,input,textarea').forEach(element => { element.disabled = false; });
        }
    };

    window.deleteTaskFromHome = function(id, name) {
        window.customConfirm(`Czy na pewno usunąć "${name}"?`, async () => {
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
