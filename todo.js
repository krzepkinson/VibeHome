window.initTodoModule = async function() { await loadTodosAndLists(); };
async function loadTodosAndLists() {
    const listEl = document.getElementById('todo-list'); const hid = window.currentUser.household_id;
    const [tRes, lRes] = await Promise.all([supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('is_completed', { ascending: true }), supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false)]);
    const todos = tRes.data || []; const lists = lRes.data || [];
    let html = (lists.length > 0 ? `<h3 class="text-[10px] text-neutral-500 uppercase mt-4 mb-2">Listy</h3>` + lists.map(l => `<div onclick="openChecklistScreen(${l.id}, '${window.esc(l.title)}')" class="p-3 bg-[#004a77]/20 rounded-xl mb-1.5 flex justify-between items-center"><span class="text-sm font-medium">🗂️ ${window.esc(l.title)}</span><button onclick="event.stopPropagation(); archiveChecklist(${l.id})" class="text-neutral-500">🗑️</button></div>`).join('') : '');
    html += `<h3 class="text-[10px] text-neutral-500 uppercase mt-4 mb-2">Zadania</h3>` + todos.map(t => `<div class="p-3 bg-[#1e1f20] rounded-xl mb-1.5 flex items-center gap-2 ${t.is_completed ? 'opacity-50' : ''}"><div onclick="toggleTodo(${t.id}, ${t.is_completed})" class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0">${t.is_completed ? '✓' : ''}</div><span class="text-sm flex-1 ${t.is_completed ? 'line-through' : ''}">${window.esc(t.title)}</span><button onclick="archiveTodo(${t.id})" class="text-neutral-600">🗑️</button></div>`).join('');
    listEl.innerHTML = html || '<p class="py-10 text-center text-xs text-neutral-500">Brak zadań.</p>';
}

window.archiveTodo = function(id) {
    window.customConfirm("Zarchiwizować to zadanie?", async () => {
        await supabaseClient.from('todos').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
        loadTodosAndLists();
    });
};

window.archiveChecklist = function(id) {
    window.customConfirm("Zarchiwizować całą listę?", async () => {
        await supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('household_id', window.currentUser.household_id);
        loadTodosAndLists();
    });
};

window.toggleTodo = async function(id, status) {
    await supabaseClient.from('todos').update({ is_completed: !status, completer_name: !status ? window.currentUser.name : null }).eq('id', id).eq('household_id', window.currentUser.household_id);
    loadTodosAndLists();
};
