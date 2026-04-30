// ==========================================
// LOGIKA: TO-DO I CHECKLISTY (todo.js)
// ==========================================

let currentChecklistId = null;

window.initTodoModule = async function() {
    await loadTodosAndLists();
};

async function loadTodosAndLists() {
    const listEl = document.getElementById('todo-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie zadań...</p>`;

    const hid = window.currentUser.household_id;

    const [todosRes, listsRes] = await Promise.all([
        supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('is_completed', { ascending: true }).order('created_at', { ascending: false }),
        supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false })
    ]);

    const todos = todosRes.data || [];
    const lists = listsRes.data || [];

    let html = '';

    if (lists.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
        html += lists.map(list => `
            <div onclick="openChecklistScreen(${list.id}, '${window.esc(list.title)}')" class="flex items-center justify-between p-3 bg-[#004a77]/20 rounded-[16px] border border-[#004a77]/50 mb-1.5 cursor-pointer active:scale-95 transition-transform shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="text-lg">🗂️</span>
                    <span class="text-sm font-medium text-[#c2e7ff]">${window.esc(list.title)}</span>
                </div>
                <button onclick="event.stopPropagation(); archiveChecklist(${list.id})" class="text-neutral-500 hover:text-[#ffb4ab] px-2 text-sm">🗑️</button>
            </div>
        `).join('');
        html += `<div class="h-3"></div>`; 
    }

    html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Szybkie zadania</h3>`;
    
    if (todos.length === 0) {
        html += `<p class="text-center text-neutral-500 text-xs py-4">Brak zadań. Dodaj coś!</p>`;
    } else {
        html += todos.map(todo => {
            // INICJAŁY DLA TO-DO
            let creatorBadge = `<div class="w-5 h-5 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[9px] flex items-center justify-center ml-2 shrink-0" title="Dodał(a): ${todo.creator_name || 'Kogoś'}">${(todo.creator_name || '?')[0].toUpperCase()}</div>`;
            let completerBadge = todo.is_completed && todo.completer_name ? `<div class="w-5 h-5 rounded-full bg-[#0f5223]/30 border border-[#0f5223]/50 text-[#c4eed0] text-[9px] flex items-center justify-center ml-1 shrink-0" title="Zakończył(a): ${todo.completer_name}">${todo.completer_name[0].toUpperCase()}</div>` : '';

            return `
            <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 ${todo.is_completed ? 'opacity-50' : ''}">
                <div class="flex items-center gap-2 flex-1 cursor-pointer" onclick="toggleTodo(${todo.id}, ${todo.is_completed})">
                    <div class="w-5 h-5 rounded-full border-2 ${todo.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
                        ${todo.is_completed ? '<span class="text-[#0f5223] text-[10px]">✓</span>' : ''}
                    </div>
                    <span class="text-sm truncate ${todo.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(todo.title)}</span>
                    <div class="flex">${creatorBadge}${completerBadge}</div>
                </div>
                <button onclick="archiveTodo(${todo.id})" class="text-neutral-600 hover:text-[#ffb4ab] pl-3 text-sm shrink-0">🗑️</button>
            </div>`;
        }).join('');
    }

    listEl.innerHTML = html;
}

window.openNewTodoModal = function() { document.getElementById('new-todo-title').value = ''; document.getElementById('new-todo-modal').classList.remove('hidden'); };
window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };

window.openNewListModal = function() { document.getElementById('new-list-title').value = ''; document.getElementById('new-list-modal').classList.remove('hidden'); };
window.closeNewListModal = function() { document.getElementById('new-list-modal').classList.add('hidden'); };

window.saveNewTodo = async function() {
    const title = document.getElementById('new-todo-title').value.trim();
    if (!title) return;
    await supabaseClient.from('todos').insert([{ 
        title: title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, 
        is_completed: false, is_archived: false, creator_name: window.currentUser.name 
    }]);
    closeNewTodoModal(); window.showToast("Zadanie dodane!"); loadTodosAndLists();
};

window.saveNewList = async function() {
    const title = document.getElementById('new-list-title').value.trim();
    if (!title) return;
    await supabaseClient.from('checklists').insert([{ 
        title: title, user_id: window.currentUser.id, household_id: window.currentUser.household_id, is_archived: false 
    }]);
    closeNewListModal(); window.showToast("Lista utworzona!"); loadTodosAndLists();
};

window.toggleTodo = async function(id, currentStatus) {
    let updateData = { is_completed: !currentStatus };
    if (!currentStatus) updateData.completer_name = window.currentUser.name; // Jak oznaczam jako zrobione
    else updateData.completer_name = null; // Jak odznaczam
    
    await supabaseClient.from('todos').update(updateData).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadTodosAndLists();
};

window.archiveTodo = async function(id) {
    if (!confirm("Zarchiwizować to zadanie? Zniknie z głównej listy.")) return;
    await supabaseClient.from('todos').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.showToast("Zarchiwizowano!"); loadTodosAndLists();
};

window.archiveChecklist = async function(id) {
    if (!confirm("Zarchiwizować całą listę? Zniknie z głównego widoku.")) return;
    await supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.showToast("Lista zarchiwizowana!"); loadTodosAndLists();
};

window.openChecklistScreen = function(id, title) {
    currentChecklistId = id; document.getElementById('checklist-screen-title').innerText = title; loadChecklistItems(); window.goForward('checklist-screen');
};
window.closeChecklistScreen = function() { window.goBack(); };

window.loadChecklistItems = async function() {
    const listEl = document.getElementById('checklist-items-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie...</p>`;

    const { data } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
    const items = data || [];

    if (items.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Dodaj coś poniżej.</p>`; return; }

    listEl.innerHTML = items.map(item => `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 ${item.is_completed ? 'opacity-50' : ''}">
            <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="toggleChecklistItem(${item.id}, ${item.is_completed})">
                <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors shrink-0">
                    ${item.is_completed ? '<span class="text-[#0f5223] text-[10px]">✓</span>' : ''}
                </div>
                <span class="text-sm ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(item.content)}</span>
            </div>
            <button onclick="deleteChecklistItem(${item.id})" class="text-neutral-600 hover:text-[#ffb4ab] px-2 text-sm">✕</button>
        </div>
    `).join('');
};

window.saveChecklistItem = async function() {
    const input = document.getElementById('new-checklist-item-input'); const content = input.value.trim();
    if (!content || !currentChecklistId) return;
    input.value = ''; 
    await supabaseClient.from('checklist_items').insert([{ checklist_id: currentChecklistId, user_id: window.currentUser.id, household_id: window.currentUser.household_id, content: content, is_completed: false }]);
    loadChecklistItems();
};

window.toggleChecklistItem = async function(id, currentStatus) {
    await supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadChecklistItems();
};

window.deleteChecklistItem = async function(id) {
    await supabaseClient.from('checklist_items').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
    loadChecklistItems();
};
