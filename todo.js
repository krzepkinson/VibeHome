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
            window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('is_completed', { ascending: true }).order('created_at', { ascending: false }).limit(200),
            window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false })
        ]);

        const todos = todosRes.data || []; 
        const lists = listsRes.data || [];
        let html = '';

        if (lists.length > 0) {
            html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
            html += lists.map(list => {
                const lType = window.LIST_TYPES[list.list_type] || window.LIST_TYPES.generic;
                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-checklist text-[#ffb4ab] text-xl active:scale-90 transition-transform" data-id="${list.id}">🗑️</button>
                    </div>
                    <div class="js-open-checklist swipe-front relative z-10 flex items-center justify-between p-3 bg-[#0f2334] rounded-[16px] border border-[#004a77]/50 cursor-pointer w-full transition-transform" data-id="${list.id}" data-title="${window.esc(list.title)}" data-type="${list.list_type || 'generic'}">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="text-lg shrink-0">${lType.icon}</span>
                            <span class="text-sm font-medium text-[#c2e7ff] truncate">${window.esc(list.title)}</span>
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
                let currentName = isDone ? (todo.completer_name || 'Ja') : (todo.creator_name || 'Ja');
                let initial = currentName[0].toUpperCase();
                let badgeType = isDone ? 'todos' : 'todos_creator';
                let avatarClass = window.getAvatarColor ? window.getAvatarColor(currentName) : 'bg-[#333537] border-[#444746] text-neutral-300';
                if (isDone) avatarClass = 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]';
                let userBadge = `<div class="js-change-user w-6 h-6 rounded-full ${avatarClass} border text-[10px] flex items-center justify-center ml-2 shrink-0 cursor-pointer active:scale-90 transition-transform font-bold" data-type="${badgeType}" data-id="${todo.id}" data-username="${window.esc(currentName)}">${initial}</div>`;

                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group ${isDone ? 'opacity-50' : ''}">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-todo text-[#ffb4ab] text-xl active:scale-90 transition-transform" data-id="${todo.id}">🗑️</button>
                    </div>
                    <div class="swipe-front relative z-10 flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] cursor-pointer w-full transition-transform">
                        <div class="js-edit-todo flex items-center gap-2 flex-1 min-w-0" data-id="${todo.id}" data-title="${window.esc(todo.title)}">
                            <div class="js-toggle-todo w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0" data-id="${todo.id}" data-status="${isDone}">
                                ${isDone ? '<span class="text-[#0f5223] text-xs font-bold">✓</span>' : ''}
                            </div>
                            <span class="text-sm truncate flex-1 ${isDone ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(todo.title)}</span>
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
            setTimeout(() => document.getElementById('new-todo-title')?.focus(), 50);
        });
    };
    window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };

    window.saveNewTodo = async function() {
        const title = document.getElementById('new-todo-title').value.trim(); 
        if (!title) return;
        const { error } = await window.supabaseClient.from('todos').insert([{ 
            title, 
            user_id: window.currentUser.user_id, 
            household_id: window.currentUser.household_id, 
            is_completed: false, 
            is_archived: false, 
            creator_name: window.currentUser.name 
        }]);
        if (error) window.showToast("Błąd: " + error.message);
        else { window.closeNewTodoModal(); window.showToast("Zadanie dodane!"); window.loadTodosAndLists(); }
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
                        <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
                            ${item.is_completed ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : ''}
                        </div>
                        <span class="text-sm truncate ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(item.content)}</span>
                    </div>
                </div>
            </div>`).join('');
    };

    window.saveChecklistItem = async function() {
        const input = document.getElementById('new-checklist-item-input'); 
        const content = input.value.trim();
        if (!content || !currentChecklistId) return; 
        input.value = ''; 
        const { error } = await window.supabaseClient.from('checklist_items').insert([{ 
            checklist_id: currentChecklistId, 
            user_id: window.currentUser.user_id, 
            household_id: window.currentUser.household_id, 
            content, 
            is_completed: false 
        }]);
        if (error) window.showToast("Błąd: " + error.message);
        window.loadChecklistItems();
    };

    // ==========================================
    // OPTYMIZACJA UI: Szybkie zadania (Todo)
    // ==========================================
    window.toggleTodo = async function(id, currentStatus, el) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();

        // 1. Optymistyczny UI (Złudzenie natychmiastowości)
        if (el) {
            const container = el.closest('.group');
            const isDone = !currentStatus;
            
            if (container) {
                container.classList.toggle('opacity-50', isDone);
                const textSpan = container.querySelector('span.truncate');
                if (textSpan) {
                    textSpan.classList.toggle('line-through', isDone);
                    textSpan.classList.toggle('text-neutral-500', isDone);
                    textSpan.classList.toggle('text-neutral-200', !isDone);
                }
            }
            
            if (isDone) {
                el.classList.add('bg-[#c4eed0]', 'border-[#c4eed0]');
                el.classList.remove('border-[#444746]');
                el.innerHTML = '<span class="text-[#0f5223] text-xs font-bold">✓</span>';
            } else {
                el.classList.remove('bg-[#c4eed0]', 'border-[#c4eed0]');
                el.classList.add('border-[#444746]');
                el.innerHTML = '';
            }
            el.dataset.status = isDone.toString();
        }

        // 2. Właściwe zapytanie w tle
        await window.supabaseClient.from('todos').update({ 
            is_completed: !currentStatus, 
            completed_at: !currentStatus ? new Date().toISOString() : null, 
            completer_name: !currentStatus ? window.currentUser.name : null 
        }).eq('id', id);

        // 3. Ciche przeładowanie danych
        window.loadTodosAndLists();
    };

    window.archiveTodo = async function(id, el) {
        window.customConfirm("Zarchiwizować to zadanie?", async () => {
            // Optymistyczne ukrycie całej wizualnej karty
            if (el) {
                const container = el.closest('.group');
                if (container) container.classList.add('hidden');
            }
            await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', id);
            window.loadTodosAndLists();
        });
    };

    // ==========================================
    // OPTYMIZACJA UI: Elementy na listach
    // ==========================================
    window.toggleChecklistItem = async function(id, currentStatus, el) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();

        // 1. Optymistyczny UI
        if (el) {
            const container = el.closest('.group');
            const isDone = !currentStatus;
            
            if (container) container.classList.toggle('opacity-50', isDone);
            
            const circle = el.querySelector('div');
            if (circle) {
                circle.classList.toggle('bg-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#444746]', !isDone);
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

        // 2. Zapytanie w tle
        await window.supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id);
        window.loadChecklistItems();
    };

    window.deleteChecklistItem = async function(id, el) {
        // Optymistyczne ukrycie znikającego elementu checklisty
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
            await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id);
            window.loadTodosAndLists();
        });
    };

    // --- DELEGACJA ZDARZEŃ (VIA DISPATCHER) ---
    if (window.EventDispatcher) {
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
            // Przekazujemy element "el", aby funkcja mogła go natychmiast ukryć
            window.archiveTodo(parseInt(el.dataset.id, 10), el);
        });

        window.EventDispatcher.onClick('.js-toggle-todo', (e, el) => {
            e.stopPropagation();
            const isDone = el.dataset.status === 'true';
            // Przekazujemy element "el" do natychmiastowego pokolorowania
            window.toggleTodo(parseInt(el.dataset.id, 10), isDone, el);
        });

        window.EventDispatcher.onClick('.js-delete-checklist-item', (e, el) => {
            e.preventDefault();
            // Przekazujemy "el"
            window.deleteChecklistItem(parseInt(el.dataset.id, 10), el);
        });

        window.EventDispatcher.onClick('.js-toggle-checklist-item', (e, el) => {
            const isCompleted = el.dataset.status === 'true';
            // Przekazujemy "el"
            window.toggleChecklistItem(parseInt(el.dataset.id, 10), isCompleted, el);
        });
    } else {
        console.error("EventDispatcher nie jest załadowany!");
    }

    return { init: window.initTodoModule };
})();
