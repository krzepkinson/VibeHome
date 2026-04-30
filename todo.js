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

    const uid = window.currentUser.id;

    // Pobieramy TYLKO niezarchiwizowane elementy
    const [todosRes, listsRes] = await Promise.all([
        supabaseClient.from('todos').select('*').eq('user_id', uid).eq('is_archived', false).order('is_completed', { ascending: true }).order('created_at', { ascending: false }),
        supabaseClient.from('checklists').select('*').eq('user_id', uid).eq('is_archived', false).order('created_at', { ascending: false })
    ]);

    const todos = todosRes.data || [];
    const lists = listsRes.data || [];

    let html = '';

    // SEKCJA 1: LISTY (CHECKLISTY)
    if (lists.length > 0) {
        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
        html += lists.map(list => `
            <div onclick="openChecklistScreen(${list.id}, '${window.esc(list.title)}')" class="flex items-center justify-between p-4 bg-[#004a77]/20 rounded-[24px] border border-[#004a77]/50 mb-2 cursor-pointer active:scale-95 transition-transform shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="text-xl">🗂️</span>
                    <span class="text-sm font-medium text-[#c2e7ff]">${window.esc(list.title)}</span>
                </div>
                <button onclick="event.stopPropagation(); archiveChecklist(${list.id})" class="text-neutral-500 hover:text-[#ffb4ab] px-2">🗑️</button>
            </div>
        `).join('');
        html += `<div class="h-4"></div>`; // Odstęp
    }

    // SEKCJA 2: SZYBKIE ZADANIA
    html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Szybkie zadania</h3>`;
    
    if (todos.length === 0) {
        html += `<p class="text-center text-neutral-500 text-xs py-4">Brak zadań. Dodaj coś!</p>`;
    } else {
        html += todos.map(todo => `
            <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] mb-2 ${todo.is_completed ? 'opacity-50' : ''}">
                <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="toggleTodo(${todo.id}, ${todo.is_completed})">
                    <div class="w-6 h-6 rounded-full border-2 ${todo.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors">
                        ${todo.is_completed ? '<span class="text-[#0f5223] text-xs">✓</span>' : ''}
                    </div>
                    <span class="text-sm ${todo.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(todo.title)}</span>
                </div>
                <button onclick="archiveTodo(${todo.id})" class="text-neutral-600 hover:text-[#ffb4ab] p-2">🗑️</button>
            </div>
        `).join('');
    }

    listEl.innerHTML = html;
}

// --- MODALE NOWE ZADANIE / LISTA ---
window.openNewTodoModal = function() {
    document.getElementById('new-todo-title').value = '';
    document.getElementById('new-todo-modal').classList.remove('hidden');
};
window.closeNewTodoModal = function() { document.getElementById('new-todo-modal').classList.add('hidden'); };

window.openNewListModal = function() {
    document.getElementById('new-list-title').value = '';
    document.getElementById('new-list-modal').classList.remove('hidden');
};
window.closeNewListModal = function() { document.getElementById('new-list-modal').classList.add('hidden'); };

window.saveNewTodo = async function() {
    const title = document.getElementById('new-todo-title').value.trim();
    if (!title) return;
    await supabaseClient.from('todos').insert([{ title: title, user_id: window.currentUser.id, is_completed: false, is_archived: false }]);
    closeNewTodoModal(); window.showToast("Zadanie dodane!"); loadTodosAndLists();
};

window.saveNewList = async function() {
    const title = document.getElementById('new-list-title').value.trim();
    if (!title) return;
    await supabaseClient.from('checklists').insert([{ title: title, user_id: window.currentUser.id, is_archived: false }]);
    closeNewListModal(); window.showToast("Lista utworzona!"); loadTodosAndLists();
};

// --- AKCJE NA POJEDYNCZYCH ZADANIACH ---
window.toggleTodo = async function(id, currentStatus) {
    await supabaseClient.from('todos').update({ is_completed: !currentStatus }).eq('id', id).eq('user_id', window.currentUser.id);
    loadTodosAndLists();
};

window.archiveTodo = async function(id) {
    if (!confirm("Zarchiwizować to zadanie? Zniknie z głównej listy.")) return;
    // Zmieniamy fizyczne usuwanie na miękkie!
    await supabaseClient.from('todos').update({ is_archived: true }).eq('id', id).eq('user_id', window.currentUser.id);
    window.showToast("Zarchiwizowano!"); loadTodosAndLists();
};

window.archiveChecklist = async function(id) {
    if (!confirm("Zarchiwizować całą listę? Zniknie z głównego widoku.")) return;
    await supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('user_id', window.currentUser.id);
    window.showToast("Lista zarchiwizowana!"); loadTodosAndLists();
};

// --- EKRAN KONKRETNEJ CHECKLISTY ---
window.openChecklistScreen = function(id, title) {
    currentChecklistId = id;
    document.getElementById('checklist-screen-title').innerText = title;
    loadChecklistItems();
    window.goForward('checklist-screen');
};

window.closeChecklistScreen = function() { window.goBack(); };

window.loadChecklistItems = async function() {
    const listEl = document.getElementById('checklist-items-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie...</p>`;

    const { data } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
    const items = data || [];

    if (items.length === 0) {
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Dodaj coś poniżej.</p>`;
        return;
    }

    listEl.innerHTML = items.map(item => `
        <div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-2 ${item.is_completed ? 'opacity-50' : ''}">
            <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="toggleChecklistItem(${item.id}, ${item.is_completed})">
                <div class="w-6 h-6 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors">
                    ${item.is_completed ? '<span class="text-[#0f5223] text-xs">✓</span>' : ''}
                </div>
                <span class="text-sm ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${window.esc(item.content)}</span>
            </div>
            <button onclick="deleteChecklistItem(${item.id})" class="text-neutral-600 hover:text-[#ffb4ab] p-2">✕</button>
        </div>
    `).join('');
};

window.saveChecklistItem = async function() {
    const input = document.getElementById('new-checklist-item-input');
    const content = input.value.trim();
    if (!content || !currentChecklistId) return;

    input.value = ''; // Od razu czyścimy, żeby można było szybko wpisywać dalej
    await supabaseClient.from('checklist_items').insert([{ checklist_id: currentChecklistId, user_id: window.currentUser.id, content: content, is_completed: false }]);
    loadChecklistItems();
};

window.toggleChecklistItem = async function(id, currentStatus) {
    await supabaseClient.from('checklist_items').update({ is_completed: !currentStatus }).eq('id', id).eq('user_id', window.currentUser.id);
    loadChecklistItems();
};

window.deleteChecklistItem = async function(id) {
    // To usuwamy fizycznie, bo to tylko mały pod-element checklisty
    await supabaseClient.from('checklist_items').delete().eq('id', id).eq('user_id', window.currentUser.id);
    loadChecklistItems();
};
