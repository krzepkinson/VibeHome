// ==========================================
// LOGIKA: DOM 2.0 - LOCAL FIRST + UX GESTURES (home.js)
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
            window.history.pushState({ view: 'home', roomFilter: room }, '', '/?view=home');
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

        // INSTANT RENDER z AppStore (0 ms)
        window.renderHomeUI();

        // Tło: Dociągnięcie danych z Supabase w razie potrzeby
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
                
                const taskLogs = logs.filter(l => sameId(l.task_id, task.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
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

            // UX: Pokoje Smart (Dynamiczne sortowanie po ilości zaległości)
            const sortedRooms = Object.entries(roomStats).sort((a, b) => {
                if (a[0] === 'Inne') return 1;
                if (b[0] === 'Inne') return -1;
                if (b[1].overdue !== a[1].overdue) return b[1].overdue - a[1].overdue; // Zaległe na początek
                if (b[1].total !== a[1].total) return b[1].total - a[1].total;
                return a[0].localeCompare(b[0]);
            });

            sortedRooms.forEach(([roomName, stats]) => {
                const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
                
                // UX: Dynamiczna zmiana koloru zabrudzonych pokoi
                let bgClass = 'bg-[#1e1f20]';
                let borderClass = 'border-[#333537]';
                let iconOpacity = 'opacity-80';
                let nameColor = 'text-neutral-200';
                
                if (stats.overdue >= 3) {
                    bgClass = 'bg-rose-900/30';
                    borderClass = 'border-rose-900/50';
                    nameColor = 'text-rose-200 font-bold';
                    iconOpacity = 'opacity-100 scale-110 drop-shadow-md';
                } else if (stats.overdue > 0) {
                    bgClass = 'bg-[#3c1414]/30';
                    borderClass = 'border-[#ffb4ab]/20';
                    nameColor = 'text-[#ffb4ab]';
                }

                html += `
                    <div class="js-filter-room relative ${bgClass} p-4 rounded-[20px] border ${borderClass} cursor-pointer active:scale-95 transition-all duration-300 flex flex-col items-center justify-center text-center h-24" data-room="${window.esc(roomName)}">
                        ${badge}<div class="text-2xl mb-1 ${iconOpacity} transition-all duration-300">${window.esc(stats.icon)}</div><h3 class="text-xs ${nameColor} transition-colors duration-300">${window.esc(roomName)}</h3>
                        <p class="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-widest">${stats.total} zadań</p>
                    </div>`;
            });
            
            if (list) list.innerHTML = html + `</div>`;
            return;
        }

        let tasksToDisplay = roomFilter === 'Wszystkie' ? tasks : tasks.filter(t => (t.room || 'Inne') === roomFilter);

        let scored = tasksToDisplay.map(t => {
            const taskLogs = logs.filter(l => sameId(l.task_id, t.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
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
