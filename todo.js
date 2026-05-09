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

    // NOWA FUNKCJA: Wywoływana przez Router, gdy checklist.html jest już gotowy w DOM
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
                        <button onclick="window.archiveChecklist(${list.id})" class="text-[#ffb4ab] text-xl active:scale-90 transition-transform">🗑️</button>
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
                        <button onclick="window.archiveTodo(${todo.id})" class="text-[#ffb4ab] text-xl active:scale-90 transition-transform">🗑️</button>
                    </div>
                    <div class="swipe-front relative z-10 flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] cursor-pointer w-full transition-transform">
                        <div class="js-edit-todo flex items-center gap-2 flex-1 min-w-0" data-id="${todo.id}" data-title="${window.esc(todo.title)}">
                            <div onclick="event.stopPropagation(); window.toggleTodo(${todo.id}, ${isDone})" class="w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
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
        // Kluczowe: trzymamy się UUID użytkownika
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
        // POPRAWKA AUDYTU: Parsujemy id na liczbę, bo z dataset.id przychodzi string
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
                    <button onclick="window.deleteChecklistItem(${item.id})" class="text-[#ffb4ab] text-lg active:scale-90 transition-transform">🗑️</button>
                </div>
                <div class="swipe-front relative z-10 flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] w-full transition-transform">
                    <div class="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onclick="window.toggleChecklistItem(${item.id}, ${item.is_completed})">
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
        // Kluczowe: trzymamy się UUID użytkownika
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

    window.toggleChecklistItem = async function(id, currentStatus) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
        await window.supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id);
        window.loadChecklistItems();
    };

    window.deleteChecklistItem = async function(id) {
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

    // Globalny nasłuchiwacz kliknięć dla Zadań
    document.addEventListener('click', (e) => {
        const openChecklistBtn = e.target.closest('.js-open-checklist');
        if (openChecklistBtn) {
            e.preventDefault();
            window.openChecklistScreen(openChecklistBtn.dataset.id, openChecklistBtn.dataset.title, openChecklistBtn.dataset.type);
        }
    });

    return { init: window.initTodoModule };
})();
