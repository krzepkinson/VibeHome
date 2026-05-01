// ==========================================
// LOGIKA: WYSZUKIWARKA (search.js)
// ==========================================

let searchTimeout = null;

window.openGlobalSearch = function() {
    document.getElementById('global-search-input').value = '';
    document.getElementById('search-results-list').innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
    document.getElementById('search-modal').classList.remove('hidden');
    
    // Lekkie opóźnienie przed focusem klawiatury dla płynności animacji
    setTimeout(() => {
        const input = document.getElementById('global-search-input');
        if (input) input.focus();
    }, 100);
};

window.closeGlobalSearch = function() {
    document.getElementById('search-modal').classList.add('hidden');
};

window.performGlobalSearch = function(query) {
    const q = query.trim().toLowerCase();
    const listEl = document.getElementById('search-results-list');

    if (q.length < 2) {
        listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
        return;
    }

    listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500 animate-pulse">Szukanie w Domu...</p></div>`;

    // Czyścimy poprzedni timeout (zapobiega spamowaniu bazy przy szybkim pisaniu)
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
        try {
            // ZMIANA: Szukamy globalnie dla całego DOMU, a nie tylko dla jednego użytkownika
            const hid = window.currentUser.household_id;

            const [tasksRes, healthRes, todosRes, listsRes] = await Promise.all([
                window.supabaseClient.from('tasks').select('*').eq('household_id', hid).ilike('name', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).ilike('name', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('todos').select('*').eq('household_id', hid).ilike('title', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('checklists').select('*').eq('household_id', hid).ilike('title', `%${q}%`).eq('is_archived', false)
            ]);

            let results = [];

            if (tasksRes.data) {
                tasksRes.data.forEach(t => results.push({ id: t.id, title: t.name, type: 'Dom', icon: '🏠', action: `window.closeGlobalSearch(); window.switchView('home');` }));
            }
            if (healthRes.data) {
                healthRes.data.forEach(t => results.push({ id: t.id, title: t.name, type: 'Zdrowie', icon: '❤️', action: `window.closeGlobalSearch(); window.switchView('health');` }));
            }
            if (todosRes.data) {
                todosRes.data.forEach(t => results.push({ id: t.id, title: t.title, type: 'Zadanie', icon: '📝', action: `window.closeGlobalSearch(); window.switchView('todo');` }));
            }
            if (listsRes.data) {
                listsRes.data.forEach(t => results.push({ id: t.id, title: t.title, type: 'Lista', icon: '🗂️', action: `window.closeGlobalSearch(); window.switchView('todo'); window.openChecklistScreen(${t.id}, '${window.esc(t.title)}')` }));
            }

            if (results.length === 0) {
                listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Brak wyników dla "${window.esc(q)}"</p></div>`;
                return;
            }

            listEl.innerHTML = results.map(r => `
                <div onclick="${r.action}" class="flex items-center gap-4 p-4 bg-[#1e1f20] hover:bg-[#333537] border border-[#333537] rounded-[16px] mb-2 cursor-pointer active:scale-95 transition-all shadow-sm">
                    <div class="text-2xl">${r.icon}</div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-medium text-neutral-200 truncate">${window.esc(r.title)}</h3>
                        <p class="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">${r.type}</p>
                    </div>
                    <span class="text-neutral-500 text-lg">→</span>
                </div>
            `).join('');

        } catch (error) {
            console.error("Błąd wyszukiwania:", error);
            listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-[#ffb4ab]">Wystąpił błąd bazy danych.</p></div>`;
        }
    }, 400); // 400ms opóźnienia
};
