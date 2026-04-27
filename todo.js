// ==========================================
// LOGIKA: TO-DO (todo.js)
// ==========================================

async function initTodoModule() {
    await loadTodos();
}

async function loadTodos() {
    const listEl = document.getElementById('todo-list');
    listEl.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10">Ładowanie zadań...</p>`;

    const { data, error } = await supabaseClient
        .from('todos')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        window.showToast("Błąd ładowania zadań");
        return;
    }

    if (data.length === 0) {
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań na liście. Dodaj coś!</p>`;
        return;
    }

    listEl.innerHTML = data.map(todo => `
        <div class="flex items-center justify-between p-4 bg-[#1e1f20] rounded-[24px] border border-[#333537] ${todo.is_completed ? 'opacity-50' : ''}">
            <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="toggleTodo(${todo.id}, ${todo.is_completed})">
                <div class="w-6 h-6 rounded-full border-2 ${todo.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#444746]'} flex items-center justify-center transition-colors">
                    ${todo.is_completed ? '<span class="text-[#0f5223] text-xs">✓</span>' : ''}
                </div>
                <span class="text-sm ${todo.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'}">${todo.title}</span>
            </div>
            <button onclick="deleteTodo(${todo.id})" class="text-neutral-600 hover:text-[#ffb4ab] p-2">🗑️</button>
        </div>
    `).join('');
}

function openNewTodoModal() {
    document.getElementById('new-todo-title').value = '';
    document.getElementById('new-todo-modal').classList.remove('hidden');
}

function closeNewTodoModal() {
    document.getElementById('new-todo-modal').classList.add('hidden');
}

async function saveNewTodo() {
    const title = document.getElementById('new-todo-title').value.trim();
    if (!title) return;

    await supabaseClient.from('todos').insert([{
        title: title,
        user_id: window.currentUser.id,
        is_completed: false
    }]);

    closeNewTodoModal();
    window.showToast("Zadanie dodane!");
    loadTodos();
}

async function toggleTodo(id, currentStatus) {
    await supabaseClient.from('todos')
        .update({ is_completed: !currentStatus })
        .eq('id', id)
        .eq('user_id', window.currentUser.id);
    
    loadTodos();
    if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
}

async function deleteTodo(id) {
    if (!confirm("Usunąć to zadanie?")) return;
    await supabaseClient.from('todos').delete().eq('id', id).eq('user_id', window.currentUser.id);
    loadTodos();
    if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
}
