// ==========================================
// LOGIKA: WYSZUKIWARKA - LOCAL FIRST (search.js)
// ==========================================

window.SearchModule = (() => {
    let searchTimeout = null;

    window.openGlobalSearch = function() {
        const modal = document.getElementById('search-modal');
        const input = document.getElementById('global-search-input');
        if (!modal) return;
        
        if (input) input.value = '';
        const listEl = document.getElementById('search-results-list');
        if (listEl) {
            listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
        }
        
        modal.classList.remove('hidden');
        
        if (input) {
            input.focus();
        }
        
        requestAnimationFrame(() => {
            modal.classList.remove('-translate-y-full');
            modal.classList.add('translate-y-0');
        });
    };

    window.closeGlobalSearch = function() {
        const modal = document.getElementById('search-modal');
        const input = document.getElementById('global-search-input');
        
        if (input) input.blur(); 
        
        if (modal) {
            modal.classList.remove('translate-y-0');
            modal.classList.add('-translate-y-full');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300); 
        }
    };

    // WYSZUKIWANIE LOKALNE W RAM / APPSTORE (0 ms)
    window.performGlobalSearch = function(query) {
        const q = query.trim().toLowerCase();
        const listEl = document.getElementById('search-results-list');
        if (!listEl) return;

        if (q.length < 2) {
            listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Wpisz minimum 2 znaki...</p></div>`;
            return;
        }

        if (searchTimeout) clearTimeout(searchTimeout);

        // Niewielki debounce (50ms) wyłącznie dla zachowania płynności klawiatury
        searchTimeout = setTimeout(() => {
            try {
                const state = window.AppStore.get() || {};

                const tasks = state.tasks || [];
                const hTasks = state.hTasks || [];
                const todos = state.todos || [];
                const lists = state.checklists || [];
                const pharmacy = window.allPharmacyItems || state.pharmacy || [];

                let results = [];

                // 1. Zadania Domowe
                tasks.filter(t => !t.is_archived && t.name && t.name.toLowerCase().includes(q)).forEach(t => {
                    results.push({ id: t.id, title: t.name, type: 'Dom', icon: '🏠', extraData: t.room || 'Inne' });
                });

                // 2. Zdrowie
                hTasks.filter(t => !t.is_archived && t.name && t.name.toLowerCase().includes(q)).forEach(t => {
                    results.push({ id: t.id, title: t.name, type: 'Zdrowie', icon: '❤️', extraData: '' });
                });

                // 3. Szybkie zadania To-do
                todos.filter(t => !t.is_archived && t.title && t.title.toLowerCase().includes(q)).forEach(t => {
                    results.push({ id: t.id, title: t.title, type: 'Zadanie', icon: '📝', extraData: '' });
                });

                // 4. Checklisty / Listy zakupów
                lists.filter(l => !l.is_archived && l.title && l.title.toLowerCase().includes(q)).forEach(l => {
                    results.push({ id: l.id, title: l.title, type: 'Lista', icon: '🗂️', extraData: l.list_type || 'generic' });
                });

                // 5. Apteczka
                pharmacy.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.purpose && p.purpose.toLowerCase().includes(q))).forEach(p => {
                    results.push({ id: p.id, title: p.name, type: 'Apteczka', icon: '💊', extraData: p.purpose || '' });
                });

                if (results.length === 0) {
                    listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500">Brak wyników dla "${window.esc(q)}"</p></div>`;
                    return;
                }

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
                console.error("Błąd wyszukiwania lokalnego:", error);
                listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-[#ffb4ab]">Wystąpił błąd wyszukiwania.</p></div>`;
            }
        }, 50);
    };

    // Nasłuchiwanie pola wpisywania
    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'global-search-input') {
            window.performGlobalSearch(e.target.value);
        }
    });

    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-search', (e) => {
            e.preventDefault();
            window.openGlobalSearch();
        });

        window.EventDispatcher.onClick('.js-close-global-search', (e) => {
            e.preventDefault();
            window.closeGlobalSearch();
        });

        window.EventDispatcher.onClick('.js-search-result', (e, el) => {
            e.preventDefault();
            window.closeGlobalSearch();

            const id = parseInt(el.dataset.id, 10);
            const type = el.dataset.type;
            const title = el.dataset.title;
            const extra = el.dataset.extra;

            if (type === 'Dom') {
                window.switchView('home');
                if (typeof window.filterHomeByRoom === 'function') window.filterHomeByRoom(extra);
                setTimeout(() => { if (typeof window.openSettingsScreen === 'function') window.openSettingsScreen(id); }, 150);
            } 
            else if (type === 'Zdrowie') {
                window.switchView('health');
                setTimeout(() => { if (typeof window.openHealthSettingsScreen === 'function') window.openHealthSettingsScreen(id); }, 150);
            } 
            else if (type === 'Zadanie') {
                window.switchView('todo');
                setTimeout(() => {
                    if (typeof window.openEditTodoModal === 'function') {
                        window.openEditTodoModal(id, title);
                    }
                }, 150);
            } 
            else if (type === 'Lista') {
                window.switchView('todo');
                setTimeout(() => { if (typeof window.openChecklistScreen === 'function') window.openChecklistScreen(id, title, extra); }, 150); 
            }
            else if (type === 'Apteczka') {
                if (typeof window.openPharmacyScreen === 'function') window.openPharmacyScreen(); 
                setTimeout(() => { if (typeof window.openEditPharmacyModal === 'function') window.openEditPharmacyModal(id); }, 200); 
            }
        });
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return {};
})();
