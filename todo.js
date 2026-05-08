// ==========================================
// LOGIKA: TO-DO I CHECKLISTY (todo.js)
// ==========================================

let currentChecklistId = null;
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

window.loadTodosAndLists = async function() {
    const listEl = document.getElementById('todo-list');
    if (!listEl) return;
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Ładowanie zadań...</p>`;
    
    const hid = window.currentUser.household_id;

    const [todosRes, listsRes] = await Promise.all([
        window.supabaseClient.from('todos')
            .select('*')
            .eq('household_id', hid)
            .eq('is_archived', false)
            .order('is_completed', { ascending: true })
            .order('created_at', { ascending: false }),
        window.supabaseClient.from('checklists')
            .select('*')
            .eq('household_id', hid)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
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
                    <button onclick="event.stopPropagation(); window.archiveChecklist(${list.id})" class="hidden md:block opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-[#ffb4ab] px-2 text-sm shrink-0 transition-opacity">🗑️</button>
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
            
            // Kolorowy awatar na podstawie imienia
            let avatarClass = window.getAvatarColor ? window.getAvatarColor(currentName) : 'bg-[#333537] border-[#444746] text-neutral-300';
            if (isDone) avatarClass = 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]';
            else if (window.getAvatarColor) avatarClass += ' border-[#131314] text-white shadow-inner';

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
                    <button onclick="event.stopPropagation(); window.archiveTodo(${todo.id})" class="hidden md:block opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-[#ffb4ab] pl-3 text-sm shrink-0 transition-opacity">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }
    listEl.innerHTML = html;
};

window.openNewTodoModal = function() { 
    // Wywołujemy naszą funkcję ładującą: podajemy ID modala, ścieżkę do pliku i otwieramy nawias "paczki" () => {
    window.loadAndShowModal('new-todo-modal', '/modals/new-todo.html', () => {
        
        // Ten kod wykona się DOPIERO po załadowaniu pliku HTML
        document.getElementById('new-todo-title').value = ''; 
        
        // Fokusowanie (dodajemy małe 50ms opóźnienia, żeby przeglądarka zdążyła narysować okienko na ekranie)
        setTimeout(() => {
            const input = document.getElementById('new-todo-title');
            if (input) input.focus();
        }, 50);

    }); // <-- Zamykamy paczkę
};
window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };

window.openNewListModal = function() { 
    window.loadAndShowModal('new-list-modal', '/modals/new-list.html', () => {
        document.getElementById('new-list-title').value = ''; 
        document.getElementById('new-list-type').value = 'generic'; 
        window.toggleListTemplates();
        
        setTimeout(() => {
            const input = document.getElementById('new-list-title');
            if (input) input.focus();
        }, 50);
    });
};
window.closeNewListModal = function() { document.getElementById('new-list-modal').classList.add('hidden'); };

window.toggleListTemplates = function() {
    const type = document.getElementById('new-list-type').value;
    document.getElementById('new-list-template-container').classList.toggle('hidden', type !== 'packing');
    document.getElementById('new-list-template').value = '';
};

window.saveNewTodo = async function() {
    const title = document.getElementById('new-todo-title').value.trim(); 
    if (!title) return;
    const { error } = await window.supabaseClient.from('todos').insert([{ 
        title: title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, 
        is_completed: false, is_archived: false, creator_name: window.currentUser.name 
    }]);
    
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.closeNewTodoModal(); window.showToast("Zadanie dodane!"); window.loadTodosAndLists();
};

window.saveNewList = async function() {
    const title = document.getElementById('new-list-title').value.trim(); 
    const listType = document.getElementById('new-list-type').value;
    const template = document.getElementById('new-list-template').value;
    if (!title) return;

    // Tworzymy samą listę (używając .select().single() żeby natychmiast otrzymać jej nowe ID)
    const { data: newList, error } = await window.supabaseClient.from('checklists').insert([{ 
        title: title, 
        list_type: listType,
        user_id: window.currentUser.id, 
        household_id: window.currentUser.household_id, 
        is_archived: false 
    }]).select().single();
    
    if (error) { window.showToast("Błąd: " + error.message); return; }

    // Wstawienie elementów z szablonu jeśli wybrano "Do spakowania"
    if (listType === 'packing' && template && window.PACKING_TEMPLATES[template]) {
        const itemsToInsert = window.PACKING_TEMPLATES[template].map(content => ({
            checklist_id: newList.id,
            user_id: window.currentUser.id,
            household_id: window.currentUser.household_id,
            content: content,
            is_completed: false
        }));
        
        await window.supabaseClient.from('checklist_items').insert(itemsToInsert);
    }

    window.closeNewListModal(); window.showToast("Lista utworzona!"); window.loadTodosAndLists();
};

window.toggleTodo = async function(id, currentStatus) {
    if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
    
    const now = new Date().toISOString();
    let updateData = { 
        is_completed: !currentStatus,
        // Jeśli zadanie jest właśnie kończone (currentStatus był false), ustaw czas. 
        // Jeśli jest przywracane do zrobienia, wyczyść czas (null).
        completed_at: !currentStatus ? now : null,
        completer_name: !currentStatus ? window.currentUser.name : null
    };

    const { error } = await window.supabaseClient.from('todos')
        .update(updateData).eq('id', id).eq('household_id', window.currentUser.household_id);
        
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.loadTodosAndLists();
};

window.archiveTodo = function(id) {
    window.customConfirm("Zarchiwizować to zadanie? Zniknie z głównej listy.", async () => {
        const { error } = await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Zarchiwizowano!"); window.loadTodosAndLists();
    });
};

window.archiveChecklist = function(id) {
    window.customConfirm("Zarchiwizować całą listę? Zniknie z głównego widoku.", async () => {
        const { error } = await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Lista zarchiwizowana!"); window.loadTodosAndLists();
    });
};

window.openEditTodoModal = function(id, title) {
    window.loadAndShowModal('edit-todo-modal', '/modals/edit-todo.html', () => {
        document.getElementById('edit-todo-id').value = id;
        document.getElementById('edit-todo-title').value = title;
        
        setTimeout(() => {
            const input = document.getElementById('edit-todo-title');
            if (input) input.focus();
        }, 50);
    });
};
window.closeEditTodoModal = function() { document.getElementById('edit-todo-modal').classList.add('hidden'); };

window.saveEditedTodo = async function() {
    const id = document.getElementById('edit-todo-id').value;
    const title = document.getElementById('edit-todo-title').value.trim();
    if(!title) return;
    const { error } = await window.supabaseClient.from('todos').update({ title: title }).eq('id', id);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.closeEditTodoModal(); window.showToast("Zapisano zmiany!"); window.loadTodosAndLists();
};

window.openChecklistScreen = function(id, title, type) {
    currentChecklistId = id; 
    currentChecklistType = type || 'generic';
    const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
    
    document.getElementById('checklist-screen-title').innerText = title; 
    
    const clearBtn = document.getElementById('checklist-clear-btn');
    if (clearBtn) clearBtn.innerText = lType.clearLabel;

    window.loadChecklistItems(); 
    window.goForward('checklist-screen');
};
window.closeChecklistScreen = function() { window.goBack(); };

window.loadChecklistItems = async function() {
    const listEl = document.getElementById('checklist-items-list');
    if (!listEl) return;
    listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Ładowanie...</p>`;

    const { data } = await window.supabaseClient.from('checklist_items')
        .select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
        
    const items = data || [];
    const hasCompleted = items.some(i => i.is_completed);
    
    const clearBtn = document.getElementById('checklist-clear-btn');
    if (clearBtn) {
        if (hasCompleted) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
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
                <button onclick="window.deleteChecklistItem(${item.id})" class="hidden md:block opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-[#ffb4ab] px-2 text-sm shrink-0 transition-opacity">✕</button>
            </div>
        </div>
    `).join('');
};

window.saveChecklistItem = async function() {
    const input = document.getElementById('new-checklist-item-input'); 
    const content = input.value.trim();
    if (!content || !currentChecklistId) return; 
    
    input.value = ''; 
    const { error } = await window.supabaseClient.from('checklist_items').insert([{ 
        checklist_id: currentChecklistId, user_id: window.currentUser.id, household_id: window.currentUser.household_id, 
        content: content, is_completed: false 
    }]);
    
    if (error) window.showToast("Błąd: " + error.message);
    window.loadChecklistItems();
};

window.toggleChecklistItem = async function(id, currentStatus) {
    if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
    
    const { error } = await window.supabaseClient.from('checklist_items')
        .update({ is_completed: !currentStatus }).eq('id', id);
        
    if (error) window.showToast("Błąd: " + error.message);
    window.loadChecklistItems();
};

window.deleteChecklistItem = async function(id) {
    const { error } = await window.supabaseClient.from('checklist_items').delete().eq('id', id);
    if (error) window.showToast("Błąd: " + error.message);
    window.loadChecklistItems();
};

// NOWOŚĆ: Masowe usuwanie zrobionych pozycji (zależnie od typu listy)
window.clearCompletedItems = async function() {
    if (!currentChecklistId) return;
    
    const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
    
    window.customConfirm(`Czy na pewno chcesz wykonać operację: ${lType.clearLabel}?`, async () => {
        const { error } = await window.supabaseClient.from('checklist_items')
            .delete()
            .eq('checklist_id', currentChecklistId)
            .eq('is_completed', true)
            .eq('household_id', window.currentUser.household_id);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        window.showToast("Lista oczyszczona!");
        window.loadChecklistItems();
    });
};
// Globalny nasłuchiwacz kliknięć dla Zadań (Delegacja Zdarzeń)
document.addEventListener('click', (e) => {
    // 1. Sprawdzamy najgłębsze elementy (najpierw zmiana osoby)
    const changeUserBtn = e.target.closest('.js-change-user');
    if (changeUserBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.openChangeUserModal(changeUserBtn.dataset.type, changeUserBtn.dataset.id, changeUserBtn.dataset.username);
        return; // Przerywamy, żeby nie odpaliła się edycja zadania pod spodem!
    }

    // 2. Kliknięcie w zadanie (edycja)
    const editTodoBtn = e.target.closest('.js-edit-todo');
    if (editTodoBtn) {
        e.preventDefault();
        window.openEditTodoModal(editTodoBtn.dataset.id, editTodoBtn.dataset.title);
        return;
    }

    // 3. Kliknięcie w listę (otwieranie)
    const openChecklistBtn = e.target.closest('.js-open-checklist');
    if (openChecklistBtn) {
        e.preventDefault();
        window.openChecklistScreen(openChecklistBtn.dataset.id, openChecklistBtn.dataset.title, openChecklistBtn.dataset.type);
        return;
    }
});
