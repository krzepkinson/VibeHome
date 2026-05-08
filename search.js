// ==========================================
// LOGIKA: WYSZUKIWARKA (search.js)
// ==========================================

let searchTimeout = null;

window.openGlobalSearch = function() {
    // 1. Wywołujemy modal korzystając z naszego nowego, bezpiecznego loadera
    window.loadAndShowModal('search-modal', '/modals/search.html', () => {
        document.getElementById('global-search-input').value = '';
        document.getElementById('search-results-list').innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
        
        setTimeout(() => {
            const input = document.getElementById('global-search-input');
            if (input) input.focus();
        }, 50);
    });
};

window.closeGlobalSearch = function() {
    const modal = document.getElementById('search-modal');
    if (modal) modal.classList.add('hidden');
};

window.performGlobalSearch = function(query) {
    const q = query.trim().toLowerCase();
    const listEl = document.getElementById('search-results-list');

    if (q.length < 2) {
        listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
        return;
    }

    listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500 animate-pulse">Szukanie w Domu...</p></div>`;

    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
        try {
            const hid = window.currentUser.household_id;

            const [tasksRes, healthRes, todosRes, listsRes] = await Promise.all([
                window.supabaseClient.from('tasks').select('*').eq('household_id', hid).ilike('name', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).ilike('name', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('todos').select('*').eq('household_id', hid).ilike('title', `%${q}%`).eq('is_archived', false),
                window.supabaseClient.from('checklists').select('*').eq('household_id', hid).ilike('title', `%${q}%`).eq('is_archived', false)
            ]);

            let results = [];

            // Zbieramy czyste dane do tablicy wyników (żadnego kodu JS!)
            if (tasksRes.data) {
                tasksRes.data.forEach(t => results.push({ 
                    id: t.id, title: t.name, type: 'Dom', icon: '🏠', extraData: t.room || 'Inne' 
                }));
            }
            if (healthRes.data) {
                healthRes.data.forEach(t => results.push({ 
                    id: t.id, title: t.name, type: 'Zdrowie', icon: '❤️', extraData: '' 
                }));
            }
            if (todosRes.data) {
                todosRes.data.forEach(t => results.push({ 
                    id: t.id, title: t.title, type: 'Zadanie', icon: '📝', extraData: '' 
                }));
            }
            if (listsRes.data) {
                listsRes.data.forEach(t => results.push({ 
                    id: t.id, title: t.title, type: 'Lista', icon: '🗂️', extraData: t.list_type || 'generic' 
                }));
            }

            if (results.length === 0) {
                listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Brak wyników dla "${window.esc(q)}"</p></div>`;
                return;
            }

            // Generujemy czysty HTML z bezpiecznymi atrybutami data-*
            listEl.innerHTML = results.map(r => `
                <div class="js-search-result flex items-center gap-4 p-4 bg-[#1e1f20] hover:bg-[#333537] border border-[#333537] rounded-[16px] mb-2 cursor-pointer active:scale-95 transition-all shadow-sm"
                     data-id="${r.id}"
                     data-title="${window.esc(r.title)}"
                     data-type="${r.type}"
                     data-extra="${window.esc(r.extraData)}">
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
    }, 400);
};

// ==========================================
// NASŁUCHIWACZ KLIKNIĘĆ (EVENT DELEGATION)
// ==========================================
document.addEventListener('click', (e) => {
    const resultItem = e.target.closest('.js-search-result');
    if (!resultItem) return;

    e.preventDefault();
    window.closeGlobalSearch();

    const id = parseInt(resultItem.dataset.id);
    const type = resultItem.dataset.type;
    const title = resultItem.dataset.title;
    const extra = resultItem.dataset.extra;

    // Przekierowania zależne od typu klikniętego kafelka
    if (type === 'Dom') {
        window.switchView('home');
        window.filterHomeByRoom(extra); // extra to nazwa pomieszczenia
        setTimeout(() => window.openSettingsScreen(id), 150);
    } 
    else if (type === 'Zdrowie') {
        window.switchView('health');
        setTimeout(() => window.openHealthSettingsScreen(id), 150);
    } 
    else if (type === 'Zadanie') {
        window.switchView('todo');
        setTimeout(() => window.openEditTodoModal(id, title), 150);
    } 
    else if (type === 'Lista') {
        window.switchView('todo');
        setTimeout(() => window.openChecklistScreen(id, title, extra), 150); // extra to typ listy
    }
});
