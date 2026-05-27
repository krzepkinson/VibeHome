// ==========================================
// LOGIKA: TO-DO I CHECKLISTY (todo.js)
// ==========================================

window.TodoModule = (() => {
    let currentChecklistId = null;
    let currentChecklistTitle = '';
    let currentChecklistType = 'generic';

    // KONFIGURACJA TYPÓW LIST I SZABLONÓW
    window.LIST_TYPES = {
        generic:  { label: 'Lista',         icon: '🗂️', clearLabel: 'Usuń zrobione',  color: 'blue'  },
        shopping: { label: 'Zakupy',        icon: '🛒', clearLabel: 'Usuń kupione',   color: 'green' },
        packing:  { label: 'Do spakowania', icon: '🧳', clearLabel: 'Usuń spakowane', color: 'amber' }
    };

    window.PACKING_TEMPLATES = {
        'weekend': ['Ubrania na 2 dni', 'Kosmetyczka (szczoteczka, pasta, żel)', 'Ładowarka do telefonu', 'Dokumenty i portfel', 'Bielizna na zmianę', 'Piżama'],
        'week': ['Ubrania na 7 dni', 'Kosmetyczka pełna', 'Ładowarka i powerbank', 'Dokumenty, portfel, bilety', 'Bielizna x8', 'Ręcznik', 'Apteczka', 'Klapki']
    };

    window.initTodoModule = async function() {
        await window.loadTodosAndLists();
    };

    window.initChecklistUI = function() {
        const titleEl = document.getElementById('checklist-screen-title');
        if (!titleEl) return;

        const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
        titleEl.innerText = currentChecklistTitle; 
        
        const clearBtn = document.getElementById('checklist-clear-btn');
        if (clearBtn) {
            clearBtn.innerText = lType.clearLabel;
        }
        
        window.loadChecklistItems();
    };

    window.loadTodosAndLists = async function() {
        const listEl = document.getElementById('todo-list');
        if (!listEl) return;
        listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Ładowanie zadań...</p>`;
        
        const hid = window.currentUser.household_id;

        const [todosRes, listsRes] = await Promise.all([
            window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).limit(200),
            window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false })
        ]);

        let todos = todosRes.data || []; 
        const lists = listsRes.data || [];
        let html = '';

        todos.sort((a, b) => {
            if (a.is_completed !== b.is_completed) return a.is_completed - b.is_completed; 
            if (a.is_urgent !== b.is_urgent) return (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0); 
            return new Date(b.created_at) - new Date(a.created_at);
        });

        if (lists.length > 0) {
            html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
            html += lists.map(list => {
                const lType = window.LIST_TYPES[list.list_type] || window.LIST_TYPES.generic;
                
                let dateBadge = '';
                if (list.list_type === 'packing' && list.start_date) {
                    const st = new Date(list.start_date).toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit'});
                    dateBadge = `<span class="text-[9px] px-1.5 py-0.5 rounded border border-[#004a77]/50 bg-[#004a77]/20 text-[#a8c7fa] ml-2 shrink-0">${st}</span>`;
                }

                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-checklist text-[#ffb4ab] text-xl active:scale-90 transition-transform" data-id="${list.id}">🗑️</button>
                    </div>
                    <div class="js-open-checklist swipe-front relative z-10 flex items-center justify-between p-3 bg-[#0f2334] rounded-[16px] border border-[#004a77]/50 cursor-pointer w-full transition-transform" data-id="${list.id}" data-title="${window.esc(list.title)}" data-type="${list.list_type || 'generic'}">
                        <div class="flex items-center gap-3 min-w-0 w-full">
                            <span class="text-lg shrink-0">${lType.icon}</span>
                            <span class="text-sm font-medium text-[#c2e7ff] truncate">${window.esc(list.title)}</span>
                            ${dateBadge}
                        </div>
                    </div>
                </div>`;
            }).join('');
            html += `<div class="h-3"></div>`; 
        }

        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Szybkie zadania</h3>`;
        
        if (todos.length === 0) {
            html += `<p class="text-center text-neutral-500 text-xs py-4">Brak zadań. Dodaj coś!</p>`;
        } else {
            html += todos.map(todo => {
                let isDone = todo.is_completed;
                let isUrgent = todo.is_urgent;

                let currentName = isDone ? (todo.completer_name || 'Ja') : (todo.creator_name || 'Ja');
                let initial = currentName[0].toUpperCase();
                let badgeType = isDone ? 'todos' : 'todos_creator';
                let avatarClass = window.getAvatarColor ? window.getAvatarColor(currentName) : 'bg-[#333537] border-[#737373] text-neutral-300';
                if (isDone) avatarClass = 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]';
                
                let userBadge = `<div class="js-change-user w-6 h-6 rounded-full ${avatarClass} border text-[10px] flex items-center justify-center ml-2 shrink-0 cursor-pointer active:scale-90 transition-transform font-bold" data-type="${badgeType}" data-id="${todo.id}" data-username="${window.esc(currentName)}">${initial}</div>`;

                let urgentIcon = isUrgent ? '🚨' : '🔔';
                let urgentClass = isUrgent ? 'text-[#ffb4ab] opacity-100' : 'text-neutral-600 opacity-30 group-hover:opacity-60';
                let urgentBtn = isDone ? '' : `<button class="js-toggle-todo-urgency p-1 text-sm shrink-0 active:scale-90 transition-all ${urgentClass}" data-id="${todo.id}" data-urgent="${isUrgent}" title="Przełącz priorytet pilny">${urgentIcon}</button>`;

                let urgentBorderClass = (isUrgent && !isDone) ? 'border-l-4 border-l-[#ffb4ab]' : '';

                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group ${isDone ? 'opacity-50' : ''}">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-todo text-[#ffb4ab] text-xl active:scale-90 transition-transform" data-id="${todo.id}">🗑️</button>
                    </div>
                    <div class="swipe-front relative z-10 flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] ${urgentBorderClass} cursor-pointer w-full transition-transform">
                        <div class="js-edit-todo flex items-center gap-2 flex-1 min-w-0" data-id="${todo.id}" data-title="${window.esc(todo.title)}">
                            <div class="js-toggle-todo w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#737373]'} flex items-center justify-center transition-colors shrink-0" data-id="${todo.id}" data-status="${isDone}">
                                ${isDone ? '<span class="text-[#0f5223] text-xs font-bold">✓</span>' : ''}
                            </div>
                            <span class="text-sm truncate flex-1 ${isDone ? 'line-through text-neutral-500' : 'text-neutral-200'}">
                                ${isUrgent && !isDone ? '<span class="text-[#ffb4ab] text-xs font-bold mr-1">[PILNE]</span>' : ''}${window.esc(todo.title)}
                            </span>
                            ${urgentBtn}
                            ${userBadge}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        listEl.innerHTML = html;
    };

    window.openNewTodoModal = function() { 
        window.loadAndShowModal('new-todo-modal', '/modals/new-todo.html', () => {
            document.getElementById('new-todo-title').value = ''; 
            const urgentInput = document.getElementById('new-todo-urgent');
            if (urgentInput) urgentInput.checked = false;
            setTimeout(() => document.getElementById('new-todo-title')?.focus(), 50);
        });
    };
    
    window.closeNewTodoModal = function() { 
        const modal = document.getElementById('new-todo-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.pointerEvents = 'none';
            setTimeout(() => { modal.style.pointerEvents = ''; }, 300);
        }
    };

    window.saveNewTodo = async function() {
        const title = document.getElementById('new-todo-title').value.trim(); 
        if (!title) return;

        const urgentInput = document.getElementById('new-todo-urgent');
        const isUrgent = urgentInput ? urgentInput.checked : false;

        const { error } = await window.supabaseClient.from('todos').insert([{ 
            title, 
            user_id: window.currentUser.user_id, 
            household_id: window.currentUser.household_id, 
            is_completed: false, 
            is_archived: false, 
            is_urgent: isUrgent,
            creator_name: window.currentUser.name 
        }]);
        
        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        window.closeNewTodoModal(); 
        window.showToast("Zadanie dodane!"); 
        window.loadTodosAndLists();
    };

    window.openNewChecklistModal = function() {
        window.loadAndShowModal('new-checklist-modal', '/modals/new-checklist.html', () => {
            document.getElementById('new-checklist-title').value = '';
            document.getElementById('new-checklist-type').value = 'generic';
            document.getElementById('new-checklist-start').value = '';
            document.getElementById('new-checklist-end').value = '';
            window.toggleChecklistDates();
            setTimeout(() => document.getElementById('new-checklist-title')?.focus(), 50);
        });
    };

    window.closeNewChecklistModal = function() { 
        const modal = document.getElementById('new-checklist-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.pointerEvents = 'none';
            setTimeout(() => { modal.style.pointerEvents = ''; }, 300);
        }
    };

    window.toggleChecklistDates = function() {
        const type = document.getElementById('new-checklist-type').value;
        const container = document.getElementById('checklist-dates-container');
        if (container) container.classList.toggle('hidden', type !== 'packing');
    };

    window.saveNewChecklist = async function() {
        const title = document.getElementById('new-checklist-title').value.trim();
        const type = document.getElementById('new-checklist-type').value;
        const start = document.getElementById('new-checklist-start').value || null;
        const end = document.getElementById('new-checklist-end').value || null;

        if (!title) return;

        // FIX: Dodane .select().single() aby uzyskać ID nowej listy dla szablonów!
        const { data, error } = await window.supabaseClient.from('checklists').insert([{
            title, list_type: type, start_date: start, end_date: end,
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id
        }]).select().single();

        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        // FIX: Zastosowanie szablonu w tle
        if (type === 'packing') {
            const template = window.PACKING_TEMPLATES['weekend'];
            if (template && data && data.id) {
                const templateItems = template.map(content => ({
                    checklist_id: data.id,
                    user_id: window.currentUser.user_id,
                    household_id: window.currentUser.household_id,
                    content: content,
                    is_completed: false
                }));
                // Wrzucamy w tle paczkę elementów
                await window.supabaseClient.from('checklist_items').insert(templateItems);
            }
        }

        window.closeNewChecklistModal();
        window.showToast("Lista utworzona!");
        window.loadTodosAndLists();
    };

    window.openChecklistScreen = function(id, title, type) {
        currentChecklistId = parseInt(id, 10); 
        currentChecklistTitle = title;
        currentChecklistType = type || 'generic';
        window.goForward('checklist-screen');
    };

    window.loadChecklistItems = async function() {
        const listEl = document.getElementById('checklist-items-list');
        if (!listEl || !currentChecklistId) return;
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Ładowanie...</p>`;
        
        const { data } = await window.supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
        const items = data || [];
        
        // FIX: Płynne sortowanie - ukończone lecą na dół!
        items.sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1));

        const clearBtn = document.getElementById('checklist-clear-btn');
        if (clearBtn) {
            const hasCompleted = items.some(i => i.is_completed);
            clearBtn.classList.toggle('hidden', !hasCompleted);
        }
        
        if (items.length === 0) {
            listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Dodaj coś poniżej.</p>`;
            return;
        }

        listEl.innerHTML = items.map(item => `
            <div class="relative overflow-hidden mb-1 rounded-[12px] group ${item.is_completed ? 'opacity-50' : ''}">
                <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-4">
                    <button class="js-delete-checklist-item text-[#ffb4ab] text-lg active:scale-90 transition-transform" data-id="${item.id}">🗑️</button>
                </div>
                <div class="swipe-front relative z-10 flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] w-full transition-transform">
                    <div class="js-toggle-checklist-item flex items-center gap-3 flex-1 cursor-pointer min-w-0" data-id="${item.id}" data-status="${item.is_completed}">
                        <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#737373]'} flex items-center justify-center transition-colors shrink-0">
                            ${item.is_completed ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : ''}
                        </div>
                        <span class="text-sm truncate flex-1 ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(item.content)}</span>
                    </div>
                </div>
            </div>`).join('');
    };

    window.saveChecklistItem = async function() {
        const input = document.getElementById('new-checklist-item-input'); 
        const content = input.value.trim();
        if (!content || !currentChecklistId) return; 
        
        // Czekamy z czyszczeniem na potwierdzenie od serwera
        const { error } = await window.supabaseClient.from('checklist_items').insert([{ 
            checklist_id: currentChecklistId, 
            user_id: window.currentUser.user_id, 
            household_id: window.currentUser.household_id, 
            content, 
            is_completed: false 
        }]);
        
        if (error) {
            window.showToast("Błąd: " + error.message);
            return; // Wychodzimy, zostawiając wpisany tekst
        }
        
        // FIX: Czyszczenie inputa po sukcesie!
        input.value = ''; 
        window.loadChecklistItems();
    };

    // ==========================================
    // OPTYMIZACJA UI: Szybkie zadania (Todo)
    // ==========================================
    window.toggleTodo = async function(id, currentStatus) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const newStatus = !currentStatus;

        window.AppStore.set(state => {
            const updatedTodos = (state.todos || []).map(t => t.id === id ? { 
                ...t, 
                is_completed: newStatus,
                completed_at: newStatus ? new Date().toISOString() : null,
                completer_name: newStatus ? window.currentUser.name : null
            } : t);
            return { ...state, todos: updatedTodos };
        });
        
        window.renderTodoUI();

        const { error } = await window.supabaseClient.from('todos').update({ 
            is_completed: newStatus, 
            completed_at: newStatus ? new Date().toISOString() : null, 
            completer_name: newStatus ? window.currentUser.name : null 
        }).eq('id', id);

        if (error) {
            window.showToast("Błąd bazy: " + error.message);
            await window.loadTodosAndLists(true); 
        } else {
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        }
    };

    window.archiveTodo = async function(id) {
        window.customConfirm("Zarchiwizować to zadanie?", async () => {
            window.AppStore.set(state => ({
                ...state,
                todos: (state.todos || []).filter(t => t.id !== id)
            }));
            window.renderTodoUI();

            const { error } = await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', id);
            if (error) {
                window.showToast("Błąd archiwizacji");
                await window.loadTodosAndLists(true);
            } else {
                if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            }
        });
    };

    window.toggleTodoUrgency = async function(id, currentUrgent, btnEl) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const newUrgent = !currentUrgent;
        
        window.AppStore.set(state => {
            const updatedTodos = (state.todos || []).map(t => t.id === id ? { ...t, is_urgent: newUrgent } : t);
            return { ...state, todos: updatedTodos };
        });

        window.renderTodoUI();

        const { error } = await window.supabaseClient.from('todos')
            .update({ is_urgent: newUrgent })
            .eq('id', id);

        if (error) {
            window.showToast("Błąd zapisu priorytetu: " + error.message);
            window.AppStore.set(state => {
                const revertedTodos = (state.todos || []).map(t => t.id === id ? { ...t, is_urgent: currentUrgent } : t);
                return { ...state, todos: revertedTodos };
            });
            window.renderTodoUI();
        } else {
            window.showToast(newUrgent ? "Oznaczono jako pilne! 🚨" : "Usunięto priorytet");
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        }
    };

    // ==========================================
    // OPTYMIZACJA UI: Elementy na listach
    // ==========================================
    window.toggleChecklistItem = async function(id, currentStatus, el) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();

        if (el) {
            const container = el.closest('.group');
            const isDone = !currentStatus;
            
            if (container) {
                container.classList.toggle('opacity-50', isDone);
                // Triko UX: płynne przerzucenie odhaczonego elementu na koniec po chwili
                if (isDone && container.parentNode) {
                    setTimeout(() => {
                        container.parentNode.appendChild(container);
                    }, 400); // 400ms żeby użytkownik zobaczył odhaczenie
                }
            }
            
            const circle = el.querySelector('div.js-toggle-checklist-item > div');
            if (circle) {
                circle.classList.toggle('bg-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#737373]', !isDone);
                circle.innerHTML = isDone ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : '';
            }
            
            const textSpan = el.querySelector('span.truncate');
            if (textSpan) {
                textSpan.classList.toggle('line-through', isDone);
                textSpan.classList.toggle('text-neutral-500', isDone);
                textSpan.classList.toggle('text-neutral-200', !isDone);
            }
            
            el.dataset.status = isDone.toString();
        }

        const { error } = await window.supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id);
        
        // FIX: Reagujemy w przypadku błędu. Sukces dzieje się płynnie lokalnie.
        if (error) {
            window.showToast("Błąd zapisu!");
            window.loadChecklistItems();
        }
    };

    window.deleteChecklistItem = async function(id, el) {
        if (el) {
            const container = el.closest('.group');
            if (container) container.classList.add('hidden');
        }
        await window.supabaseClient.from('checklist_items').delete().eq('id', id);
        window.loadChecklistItems();
    };

    window.clearCompletedItems = async function() {
        const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
        window.customConfirm(`Czy na pewno wykonać: ${lType.clearLabel}?`, async () => {
            await window.supabaseClient.from('checklist_items').delete().eq('checklist_id', currentChecklistId).eq('is_completed', true);
            window.loadChecklistItems();
        });
    };

    window.archiveChecklist = function(id) {
        window.customConfirm("Zarchiwizować całą listę?", async () => {
            window.AppStore.set(state => ({
                ...state,
                checklists: (state.checklists || []).filter(l => l.id !== id)
            }));
            window.renderTodoUI();
            await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id);
        });
    };

    // --- DELEGACJA ZDARZEŃ (VIA DISPATCHER) ---
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-refresh-todo-view', () => window.loadTodosAndLists(true));
        window.EventDispatcher.onClick('.js-open-new-todo-modal', () => window.openNewTodoModal());
        window.EventDispatcher.onClick('.js-open-new-checklist', () => window.openNewChecklistModal());

        window.EventDispatcher.onClick('.js-open-checklist', (e, el) => {
            e.preventDefault();
            window.openChecklistScreen(el.dataset.id, el.dataset.title, el.dataset.type);
        });

        window.EventDispatcher.onClick('.js-archive-checklist', (e, el) => {
            e.preventDefault();
            window.archiveChecklist(parseInt(el.dataset.id, 10));
        });

        window.EventDispatcher.onClick('.js-archive-todo', (e, el) => {
            e.preventDefault();
            window.archiveTodo(parseInt(el.dataset.id, 10));
        });

        window.EventDispatcher.onClick('.js-toggle-todo', (e, el) => {
            e.stopPropagation();
            const isDone = el.dataset.status === 'true';
            window.toggleTodo(parseInt(el.dataset.id, 10), isDone);
        });

        window.EventDispatcher.onClick('.js-toggle-todo-urgency', (e, el) => {
            e.stopPropagation();
            const isUrgent = el.dataset.urgent === 'true';
            window.toggleTodoUrgency(parseInt(el.dataset.id, 10), isUrgent, el);
        });

        window.EventDispatcher.onClick('.js-change-user', (e, el) => {
            e.stopPropagation(); 
            window.openChangeUserModal(el.dataset.type, el.dataset.id, el.dataset.username);
        });

        window.EventDispatcher.onClick('.js-delete-checklist-item', (e, el) => {
            e.preventDefault();
            window.deleteChecklistItem(parseInt(el.dataset.id, 10), el);
        });

        window.EventDispatcher.onClick('.js-toggle-checklist-item', (e, el) => {
            const isCompleted = el.dataset.status === 'true';
            window.toggleChecklistItem(parseInt(el.dataset.id, 10), isCompleted, el);
        });
    } else {
        console.error("EventDispatcher nie jest załadowany!");
    }

    return { init: window.initTodoModule };
})();
