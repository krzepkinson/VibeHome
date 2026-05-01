// ==========================================
// LOGIKA: TO-DO I CHECKLISTY (todo.js)
// ==========================================

let currentChecklistId = null;

window.initTodoModule = async function() {
    await loadTodosAndLists();
};

window.loadTodosAndLists = async function() {
    const listEl = document.getElementById('todo-list');
    if (!listEl) return;
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie zadań...</p>`;
    
    const hid = window.currentUser.household_id;

    const [todosRes, listsRes] = await Promise.all([
        window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('is_completed', { ascending: true }).order('created_at', { ascending: false }),
        window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false })
    ]);

    const todos = todosRes.data || []; 
    const lists = listsRes.data || [];
    let html = '';

    if (lists.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
        html += lists.map(list => `
            <div onclick="window.openChecklistScreen(${list.id}, '${window.esc(list.title)}')" class="flex items-center justify-between p-3 bg-[#004a77]/20 rounded-[16px] border border-[#004a77]/50 mb-1.5 cursor-pointer active:scale-95 transition-transform shadow-sm">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-lg shrink-0">🗂️</span>
                    <span class="text-sm font-medium text-[#c2e7ff] truncate">${window.esc(list.title)}</span>
                </div>
                <button onclick="event.stopPropagation(); window.archiveChecklist(${list.id})" class="text-neutral-500 hover:text-[#ffb4ab] px-2 text-sm shrink-0">🗑️</button>
            </div>
        `).join('');
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
            
            let userBadge = `<div onclick="event.stopPropagation(); window.openChangeUserModal('${badgeType}', ${todo.id}, '${window.esc(currentName)}')" class="w-6 h-6 rounded-full ${isDone ? 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]' : 'bg-[#333537] border-[#444746] text-neutral-300'} border text-[10px] flex items-center justify-center ml-2 shrink-0 cursor-pointer active:scale-90 transition-transform font-bold" data-user-name="${window.esc(currentName)}">${initial}</div>`;

            return `
            <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 ${isDone ? 'opacity-50' : ''}">
                <div class="flex items-center gap-2 flex-1 cursor-pointer min-w-0" onclick="window.openEditTodoModal(${todo.id}, '${window.esc(todo.title)}')">
                    <div onclick="event.stopPropagation(); window.toggleTodo(${todo.id}, ${isDone})" class="w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
                        ${isDone ? '<span class="text-[#0f5223] text-xs font-bold">✓</span>' : ''}
                    </div>
                    <span class="text-sm truncate flex-1 ${isDone ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(todo.title)}</span>
                    ${userBadge}
                </div>
                <button onclick="event.stopPropagation(); window.archiveTodo(${todo.id})" class="text-neutral-600 hover:text-[#ffb4ab] pl-3 text-sm shrink-0">🗑️</button>
            </div>`;
        }).join('');
    }
    listEl.innerHTML = html;
};

window.openNewTodoModal = function() { document.getElementById('new-todo-title').value = ''; document.getElementById('new-todo-modal').classList.remove('hidden'); };
window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };

window.openNewListModal = function() { document.getElementById('new-list-title').value = ''; document.getElementById('new-list-modal').classList.remove('hidden'); };
window.closeNewListModal = function() { document.getElementById('new-list-modal').classList.add('hidden'); };

window.saveNewTodo = async function() {
    const title = document.getElementById('new-todo-title').value.trim(); 
    if (!title) return;
    await window.supabaseClient.from('todos').insert([{ title: title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, is_completed: false, is_archived: false, creator_name: window.currentUser.name }]);
    window.closeNewTodoModal(); window.showToast("Zadanie dodane!"); window.loadTodosAndLists();
};

window.saveNewList = async function() {
    const title = document.getElementById('new-list-title').value.trim(); 
    if (!title) return;
    await window.supabaseClient.from('checklists').insert([{ title: title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, is_archived: false }]);
    window.closeNewListModal(); window.showToast("Lista utworzona!"); window.loadTodosAndLists();
};

window.toggleTodo = async function(id, currentStatus) {
    let updateData = { is_completed: !currentStatus };
    updateData.completer_name = !currentStatus ? window.currentUser.name : null;
    await window.supabaseClient.from('todos').update(updateData).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.loadTodosAndLists();
};

window.archiveTodo = function(id) {
    window.customConfirm("Zarchiwizować to zadanie? Zniknie z głównej listy.", async () => {
        await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
        window.showToast("Zarchiwizowano!"); window.loadTodosAndLists();
    });
};

window.archiveChecklist = function(id) {
    window.customConfirm("Zarchiwizować całą listę? Zniknie z głównego widoku.", async () => {
        await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
        window.showToast("Lista zarchiwizowana!"); window.loadTodosAndLists();
    });
};

window.openEditTodoModal = function(id, title) {
    document.getElementById('edit-todo-id').value = id;
    document.getElementById('edit-todo-title').value = title;
    document.getElementById('edit-todo-modal').classList.remove('hidden');
};

window.closeEditTodoModal = function() { document.getElementById('edit-todo-modal').classList.add('hidden'); };

window.saveEditedTodo = async function() {
    const id = document.getElementById('edit-todo-id').value;
    const title = document.getElementById('edit-todo-title').value.trim();
    if(!title) return;
    
    await window.supabaseClient.from('todos').update({ title: title }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.closeEditTodoModal(); window.showToast("Zapisano zmiany!"); window.loadTodosAndLists();
};

window.openChecklistScreen = function(id, title) {
    currentChecklistId = id; document.getElementById('checklist-screen-title').innerText = title; window.loadChecklistItems(); window.goForward('checklist-screen');
};
window.closeChecklistScreen = function() { window.goBack(); };

window.loadChecklistItems = async function() {
    const listEl = document.getElementById('checklist-items-list');
    if (!listEl) return;
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie...</p>`;

    const { data } = await window.supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
    const items = data || [];

    if (items.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Dodaj coś poniżej.</p>`; return; }

    listEl.innerHTML = items.map(item => `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 ${item.is_completed ? 'opacity-50' : ''}">
            <div class="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onclick="window.toggleChecklistItem(${item.id}, ${item.is_completed})">
                <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
                    ${item.is_completed ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : ''}
                </div>
                <span class="text-sm truncate ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(item.content)}</span>
            </div>
            <button onclick="window.deleteChecklistItem(${item.id})" class="text-neutral-600 hover:text-[#ffb4ab] px-2 text-sm shrink-0">✕</button>
        </div>
    `).join('');
};

window.saveChecklistItem = async function() {
    const input = document.getElementById('new-checklist-item-input'); const content = input.value.trim();
    if (!content || !currentChecklistId) return; 
    input.value = ''; 
    await window.supabaseClient.from('checklist_items').insert([{ checklist_id: currentChecklistId, user_id: window.currentUser.id, household_id: window.currentUser.household_id, content: content, is_completed: false }]);
    window.loadChecklistItems();
};

window.toggleChecklistItem = async function(id, currentStatus) {
    await window.supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.loadChecklistItems();
};

window.deleteChecklistItem = async function(id) {
    await window.supabaseClient.from('checklist_items').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
    window.loadChecklistItems();
};
