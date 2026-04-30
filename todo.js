// ==========================================
// LOGIKA: TO-DO (todo.js)
// ==========================================

window.initTodoModule = async function() {
    await loadTodosAndLists();
};

async function loadTodosAndLists() {
    const listEl = document.getElementById('todo-list');
    const hid = window.currentUser.household_id;
    const [todosRes, listsRes] = await Promise.all([
        supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('is_completed', { ascending: true }).order('created_at', { ascending: false }),
        supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false })
    ]);
    const todos = todosRes.data || []; const lists = listsRes.data || [];
    let html = '';
    if (lists.length > 0) {
        html += `<h3 class="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Twoje Listy</h3>`;
        html += lists.map(list => `<div onclick="openChecklistScreen(${list.id}, '${window.esc(list.title)}')" class="flex items-center justify-between p-3 bg-[#004a77]/20 rounded-[16px] border border-[#004a77]/50 mb-1.5 shadow-sm"><span class="text-sm font-medium text-[#c2e7ff]">🗂️ ${window.esc(list.title)}</span><button onclick="event.stopPropagation(); archiveChecklist(${list.id})" class="text-neutral-500 text-sm px-2">🗑️</button></div>`).join('');
    }
    html += `<h3 class="text-[10px] text-neutral-500 uppercase tracking-widest mt-4 mb-2">Szybkie zadania</h3>`;
    if (todos.length === 0) html += `<p class="text-center py-4 text-xs text-neutral-500">Brak zadań.</p>`;
    else {
        html += todos.map(todo => {
            let isDone = todo.is_completed;
            let currentName = isDone ? (todo.completer_name || 'Ja') : (todo.creator_name || 'Ja');
            let initial = currentName[0].toUpperCase();
            let badgeType = isDone ? 'todos' : 'todos_creator';
            let userBadge = `<div onclick="event.stopPropagation(); window.openChangeUserModal('${badgeType}', ${todo.id}, '${window.esc(currentName)}')" class="w-6 h-6 rounded-full ${isDone ? 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]' : 'bg-[#333537] border-[#444746] text-neutral-300'} border text-[10px] flex items-center justify-center ml-2 shrink-0 font-bold" data-user-name="${window.esc(currentName)}">${initial}</div>`;
            return `
            <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 ${isDone ? 'opacity-50' : ''}">
                <div class="flex items-center gap-2 flex-1 cursor-pointer min-w-0" onclick="openEditTodoModal(${todo.id}, '${window.esc(todo.title)}')">
                    <div onclick="event.stopPropagation(); toggleTodo(${todo.id}, ${isDone})" class="w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center shrink-0">${isDone ? '<span class="text-[#0f5223] text-xs font-bold">✓</span>' : ''}</div>
                    <span class="text-sm truncate flex-1 ${isDone ? 'line-through text-neutral-500' : ''}">${window.esc(todo.title)}</span>
                    ${userBadge}
                </div>
                <button onclick="event.stopPropagation(); archiveTodo(${todo.id})" class="text-neutral-600 px-3 text-sm shrink-0">🗑️</button>
            </div>`;
        }).join('');
    }
    listEl.innerHTML = html;
}

window.openNewTodoModal = function() { document.getElementById('new-todo-title').value = ''; document.getElementById('new-todo-modal').classList.remove('hidden'); };
window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };
window.saveNewTodo = async function() {
    const title = document.getElementById('new-todo-title').value.trim(); if (!title) return;
    await supabaseClient.from('todos').insert([{ title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, is_archived: false, creator_name: window.currentUser.name }]);
    closeNewTodoModal(); loadTodosAndLists();
};

window.openNewListModal = function() { document.getElementById('new-list-title').value = ''; document.getElementById('new-list-modal').classList.remove('hidden'); };
window.closeNewListModal = function() { document.getElementById('new-list-modal').classList.add('hidden'); };
window.saveNewList = async function() {
    const title = document.getElementById('new-list-title').value.trim(); if (!title) return;
    await supabaseClient.from('checklists').insert([{ title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, is_archived: false }]);
    closeNewListModal(); loadTodosAndLists();
};

window.toggleTodo = async function(id, status) {
    let updateData = { is_completed: !status };
    updateData.completer_name = !status ? window.currentUser.name : null;
    await supabaseClient.from('todos').update(updateData).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadTodosAndLists();
};

window.archiveTodo = async function(id) {
    await supabaseClient.from('todos').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadTodosAndLists();
};

window.archiveChecklist = async function(id) {
    await supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadTodosAndLists();
};

window.openEditTodoModal = function(id, title) {
    document.getElementById('edit-todo-id').value = id; document.getElementById('edit-todo-title').value = title;
    document.getElementById('edit-todo-modal').classList.remove('hidden');
};
window.closeEditTodoModal = function() { document.getElementById('edit-todo-modal').classList.add('hidden'); };
window.saveEditedTodo = async function() {
    const id = document.getElementById('edit-todo-id').value; const title = document.getElementById('edit-todo-title').value.trim();
    if(!title) return;
    await supabaseClient.from('todos').update({ title }).eq('id', id).eq('household_id', window.currentUser.household_id);
    closeEditTodoModal(); loadTodosAndLists();
};

window.openChecklistScreen = function(id, title) { currentChecklistId = id; document.getElementById('checklist-screen-title').innerText = title; loadChecklistItems(); window.goForward('checklist-screen'); };
window.closeChecklistScreen = function() { window.goBack(); };
window.loadChecklistItems = async function() {
    const listEl = document.getElementById('checklist-items-list');
    const { data } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
    listEl.innerHTML = (data || []).map(item => `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 ${item.is_completed ? 'opacity-50' : ''}">
            <div class="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onclick="toggleChecklistItem(${item.id}, ${item.is_completed})">
                <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center shrink-0">${item.is_completed ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : ''}</div>
                <span class="text-sm truncate ${item.is_completed ? 'line-through text-neutral-500' : ''}">${window.esc(item.content)}</span>
            </div>
            <button onclick="deleteChecklistItem(${item.id})" class="text-neutral-600 px-2 text-sm">✕</button>
        </div>`).join('') || '<p class="text-center py-4 text-xs text-neutral-500">Pusto.</p>';
};
window.saveChecklistItem = async function() {
    const input = document.getElementById('new-checklist-item-input'); const content = input.value.trim();
    if (!content || !currentChecklistId) return; input.value = '';
    await supabaseClient.from('checklist_items').insert([{ checklist_id: currentChecklistId, user_id: window.currentUser.id, household_id: window.currentUser.household_id, content, is_completed: false }]);
    loadChecklistItems();
};
window.toggleChecklistItem = async function(id, status) { await supabaseClient.from('checklist_items').update({ is_completed: !status }).eq('id', id).eq('household_id', window.currentUser.household_id); loadChecklistItems(); };
window.deleteChecklistItem = async function(id) { await supabaseClient.from('checklist_items').delete().eq('id', id).eq('household_id', window.currentUser.household_id); loadChecklistItems(); };
