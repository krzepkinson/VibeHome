// ==========================================
// LOGIKA: WYSZUKIWARKA (search.js)
// ==========================================

window.searchDataCache = null;

window.openGlobalSearch = async function() {
    // 1. Pokaż modal i wyczyść input
    document.getElementById('search-modal').classList.remove('hidden');
    const input = document.getElementById('global-search-input');
    input.value = '';
    input.focus();
    document.getElementById('search-results-list').innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Pobieranie danych...</p></div>`;

    // 2. Pobierz "mapę" danych do pamięci (tylko raz po otwarciu)
    const uid = window.currentUser.id;
    const [tasksRes, todosRes, healthRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('user_id', uid),
        supabaseClient.from('todos').select('*').eq('user_id', uid),
        supabaseClient.from('health_tasks').select('*').eq('user_id', uid)
    ]);

    window.searchDataCache = {
        tasks: tasksRes.data || [],
        todos: todosRes.data || [],
        health: healthRes.data || []
    };

    document.getElementById('search-results-list').innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-600">Gotowe! Wpisz szukaną frazę.</p></div>`;
};

window.closeGlobalSearch = function() {
    document.getElementById('search-modal').classList.add('hidden');
};

window.performGlobalSearch = function(query) {
    const list = document.getElementById('search-results-list');
    const q = query.toLowerCase().trim();
    
    if (q.length < 2) {
        list.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-600">Wpisz co najmniej 2 znaki...</p></div>`;
        return;
    }

    if (!window.searchDataCache) return;

    let resultsHTML = '';
    
    // -- SZUKANIE W DOMU --
    const matchedTasks = window.searchDataCache.tasks.filter(t => t.name.toLowerCase().includes(q) || (t.room && t.room.toLowerCase().includes(q)));
    if (matchedTasks.length > 0) {
        resultsHTML += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2 mt-4">🏠 Dom (${matchedTasks.length})</h3>`;
        resultsHTML += matchedTasks.map(t => `
            <div onclick="goToSearchTask('${encodeURIComponent(t.name)}')" class="p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 cursor-pointer active:scale-95 transition-transform">
                <h4 class="text-sm text-neutral-200 font-medium">${esc(t.name)}</h4>
                <p class="text-[10px] text-neutral-500 mt-0.5">Pomieszczenie: ${esc(t.room || 'Inne')}</p>
            </div>`).join('');
    }

    // -- SZUKANIE W ZADANIACH (TO-DO) --
    const matchedTodos = window.searchDataCache.todos.filter(t => t.title.toLowerCase().includes(q));
    if (matchedTodos.length > 0) {
        resultsHTML += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2 mt-4">📝 Zadania (${matchedTodos.length})</h3>`;
        resultsHTML += matchedTodos.map(t => `
            <div onclick="goToSearchTodo()" class="p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 cursor-pointer active:scale-95 transition-transform ${t.is_completed ? 'opacity-50' : ''}">
                <h4 class="text-sm ${t.is_completed ? 'text-neutral-500 line-through' : 'text-neutral-200'} font-medium">${esc(t.title)}</h4>
                <p class="text-[10px] text-neutral-500 mt-0.5">Status: ${t.is_completed ? 'Zakończone' : 'Do zrobienia'}</p>
            </div>`).join('');
    }

    // -- SZUKANIE W ZDROWIU --
    const matchedHealth = window.searchDataCache.health.filter(t => t.name.toLowerCase().includes(q));
    if (matchedHealth.length > 0) {
        resultsHTML += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2 mt-4">❤️ Zdrowie (${matchedHealth.length})</h3>`;
        resultsHTML += matchedHealth.map(t => `
            <div onclick="goToSearchHealth(${t.id})" class="p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 cursor-pointer active:scale-95 transition-transform">
                <h4 class="text-sm text-neutral-200 font-medium">${esc(t.name)}</h4>
                <p class="text-[10px] text-neutral-500 mt-0.5">Typ: ${t.task_type === 'cyclical' ? 'Cykliczne (Lek)' : 'Trwające (Objaw)'}</p>
            </div>`).join('');
    }

    if (resultsHTML === '') {
        resultsHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Brak wyników dla "${esc(q)}"</p></div>`;
    }

    list.innerHTML = resultsHTML;
};

// --- NAWIGACJA PO KLIKNIĘCIU W WYNIK ---
window.goToSearchTask = function(name) {
    closeGlobalSearch();
    window.switchView('home');
    setTimeout(() => { if(typeof openSettingsScreen === 'function') openSettingsScreen(name); }, 150);
};
window.goToSearchTodo = function() {
    closeGlobalSearch();
    window.switchView('todo');
};
window.goToSearchHealth = function(id) {
    closeGlobalSearch();
    window.switchView('health');
    setTimeout(() => { if(typeof openHealthSettingsScreen === 'function') openHealthSettingsScreen(id); }, 150);
};
