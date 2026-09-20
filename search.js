// ==========================================
// LOGIKA: WYSZUKIWARKA 2.1 - HYBRYDOWA (search.js)
// ==========================================

window.SearchModule = (() => {
    let searchTimeout = null;
    const HISTORY_KEY = 'bento_recent_searches_v1';

    // 1. HELPERY HISTORII WYSZUKIWANIA
    const getRecentSearches = () => {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } 
        catch (e) { return []; }
    };

    const saveToRecentSearches = (item) => {
        try {
            let list = getRecentSearches();
            list = list.filter(i => !(i.id === item.id && i.type === item.type));
            list.unshift(item);
            if (list.length > 5) list = list.slice(0, 5);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        } catch (e) {}
    };

    window.clearRecentSearches = function() {
        try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
        window.renderRecentSearches();
    };

    // 2. HIGHLIGHTING (PODŚWIETLANIE FRAZY)
    const highlightText = (text, query) => {
        if (!text) return '';
        if (!query) return window.esc(text);
        const escText = window.esc(text);
        const escQuery = window.esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(${escQuery})`, 'gi');
        return escText.replace(reg, '<mark class="bg-[#004a77] text-[#c2e7ff] px-1 rounded font-bold">$1</mark>');
    };

    // 3. RENDER HISTORII OSTATNICH WYSZUKIWAŃ
    window.renderRecentSearches = function() {
        const listEl = document.getElementById('search-results-list');
        if (!listEl) return;

        const recent = getRecentSearches();
        if (recent.length === 0) {
            listEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-center">
                    <p class="text-xs text-neutral-500 mb-1">Wpisz minimum 2 znaki...</p>
                    <p class="text-[10px] text-neutral-600">Szukaj w zadaniach, apteczce, zdrowiu i listach</p>
                </div>`;
            return;
        }

        let html = `
            <div class="mb-3 flex justify-between items-center px-1 animate-fade-in">
                <span class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ostatnio szukane</span>
                <button class="js-clear-search-history text-[10px] text-neutral-500 hover:text-[#ffb4ab] cursor-pointer active:scale-95">Wyczyszcz ✕</button>
            </div>`;

        html += recent.map(r => `
            <div class="js-search-result flex items-center gap-4 p-3 bg-[#1e1f20]/60 hover:bg-[#252627] border border-[#333537]/60 rounded-[14px] mb-1.5 cursor-pointer active:scale-95 transition-all animate-fade-in"
                 data-id="${r.id}"
                 data-title="${window.esc(r.title)}"
                 data-type="${window.esc(r.type)}"
                 data-icon="${window.esc(r.icon)}"
                 data-extra="${window.esc(r.extraData)}">
                <div class="text-xl opacity-70">${r.icon || '🔍'}</div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-medium text-neutral-300 truncate">${window.esc(r.title)}</h3>
                    <p class="text-[9px] text-neutral-500 uppercase tracking-widest">${r.type}</p>
                </div>
                <span class="text-neutral-600 text-xs">↩</span>
            </div>
        `).join('');

        listEl.innerHTML = html;
    };

    // 4. FUNKCJA RYSUJĄCA WYNIKI W HTML
    const renderResults = (resultsArray, q, isFetching) => {
        const listEl = document.getElementById('search-results-list');
        if (!listEl) return;

        if (resultsArray.length === 0) {
            if (isFetching) {
                listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-neutral-500 animate-pulse">Głębokie szukanie...</p></div>`;
            } else {
                listEl.innerHTML = `
                    <div class="flex justify-center py-10">
                        <p class="text-xs text-neutral-500">Brak wyników dla "<span class="text-neutral-300 font-medium">${window.esc(q)}</span>"</p>
                    </div>`;
            }
            return;
        }

        let html = resultsArray.map(r => {
            const highlightedTitle = highlightText(r.title, q);
            const highlightedExtra = r.extraData ? highlightText(r.extraData, q) : '';

            return `
            <div class="js-search-result flex items-center gap-4 p-4 bg-[#1e1f20] hover:bg-[#333537] border border-[#333537] rounded-[16px] mb-2 cursor-pointer active:scale-95 transition-all shadow-sm animate-fade-in"
                 data-id="${r.id}"
                 data-title="${window.esc(r.title)}"
                 data-type="${window.esc(r.type)}"
                 data-icon="${window.esc(r.icon)}"
                 data-extra="${window.esc(r.extraData)}">
                <div class="text-2xl">${r.icon}</div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-neutral-200 truncate">${highlightedTitle}</h3>
                    <p class="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">${r.type}${highlightedExtra ? ` • ${highlightedExtra}` : ''}</p>
                </div>
                <span class="text-neutral-500 text-lg">→</span>
            </div>`;
        }).join('');

        if (isFetching) {
            html += `<div class="py-3 text-center animate-pulse"><p class="text-[10px] text-neutral-500 uppercase tracking-widest">Przeszukuję wnętrza list i apteczkę...</p></div>`;
        }

        listEl.innerHTML = html;
    };

    window.openGlobalSearch = function() {
        const modal = document.getElementById('search-modal');
        const input = document.getElementById('global-search-input');
        if (!modal) return;
        
        if (input) input.value = '';
        window.renderRecentSearches();
        
        modal.classList.remove('hidden');
        if (input) input.focus();
        
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
            setTimeout(() => modal.classList.add('hidden'), 300); 
        }
    };

    // 5. HYBRYDOWE WYSZUKIWANIE (RAM + SUPABASE)
    window.performGlobalSearch = function(query) {
        const q = query.trim().toLowerCase();
        const listEl = document.getElementById('search-results-list');
        if (!listEl) return;

        if (q.length < 2) {
            window.renderRecentSearches();
            return;
        }

        if (searchTimeout) clearTimeout(searchTimeout);

        searchTimeout = setTimeout(async () => {
            try {
                // ETAP 1: Szukanie lokalne w 0ms (To co już mamy w RAM)
                const state = window.AppStore.get() || {};
                const tasks = state.tasks || [];
                const hTasks = state.hTasks || [];
                const todos = state.todos || [];
                const lists = state.checklists || [];

                let localResults = [];

                tasks.filter(t => !t.is_archived && t.name && t.name.toLowerCase().includes(q)).forEach(t => {
                    localResults.push({ id: t.id, title: t.name, type: 'Dom', icon: '🏠', extraData: t.room || 'Inne' });
                });
                hTasks.filter(t => !t.is_archived && t.name && t.name.toLowerCase().includes(q)).forEach(t => {
                    localResults.push({ id: t.id, title: t.name, type: 'Zdrowie', icon: '❤️', extraData: '' });
                });
                todos.filter(t => !t.is_archived && t.title && t.title.toLowerCase().includes(q)).forEach(t => {
                    localResults.push({ id: t.id, title: t.title, type: 'Zadanie', icon: '📝', extraData: '' });
                });
                lists.filter(l => !l.is_archived && l.title && l.title.toLowerCase().includes(q)).forEach(l => {
                    localResults.push({ id: l.id, title: l.title, type: 'Lista', icon: '🗂️', extraData: l.list_type || 'generic' });
                });

                // Rysujemy natychmiastowe wyniki z flagą isFetching = true
                renderResults(localResults, q, true);

                // ETAP 2: Głębokie Szukanie w Chmurze (Zwraca wyniki w ułamek sekundy)
                const hid = window.currentUser ? window.currentUser.household_id : null;
                if (!hid) {
                    renderResults(localResults, q, false);
                    return;
                }

                const [ciRes, pRes] = await Promise.all([
                    window.supabaseClient.from('checklist_items')
                        .select('checklist_id, content')
                        .eq('household_id', hid)
                        .ilike('content', `%${q}%`)
                        .limit(20),
                    window.supabaseClient.from('pharmacy_items')
                        .select('id, name, purpose')
                        .eq('household_id', hid)
                        .or(`name.ilike.%${q}%,purpose.ilike.%${q}%`)
                        .limit(20)
                ]);

                let remoteResults = [];

                if (ciRes.data) {
                    ciRes.data.forEach(ci => {
                        const parentList = lists.find(l => String(l.id) === String(ci.checklist_id));
                        const listTitle = parentList ? parentList.title : 'Nieznana lista';
                        const listType = parentList ? parentList.list_type : 'generic';
                        remoteResults.push({
                            id: ci.checklist_id,
                            title: ci.content,
                            type: `W liście "${listTitle}"`,
                            icon: '☑️',
                            extraData: listType
                        });
                    });
                }

                if (pRes.data) {
                    pRes.data.forEach(p => {
                        const extra = p.purpose && p.purpose.toLowerCase().includes(q) ? `Opis: ${p.purpose}` : (p.purpose || '');
                        remoteResults.push({ id: p.id, title: p.name, type: 'Apteczka', icon: '💊', extraData: extra });
                    });
                }

                // Łączymy wyniki lokalne z tymi pobranymi z chmury (zabezpieczenie przed dublami)
                const finalResults = [...localResults];
                const seen = new Set(localResults.map(r => `${r.type}-${r.id}-${r.title}`));
                
                remoteResults.forEach(r => {
                    const key = `${r.type}-${r.id}-${r.title}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        finalResults.push(r);
                    }
                });

                // Aktualizujemy ekran z kompletnymi wynikami
                renderResults(finalResults, q, false);

            } catch (error) {
                console.error("Błąd wyszukiwania hybrydowego:", error);
                const listEl = document.getElementById('search-results-list');
                if (listEl) listEl.innerHTML = `<div class="flex justify-center py-10"><p class="text-xs text-[#ffb4ab]">Brak sieci - wyniki mogą być niekompletne.</p></div>`;
            }
        }, 150); // Minimalne opóźnienie 150ms przed wysłaniem zapytania do serwera (Debounce)
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

        window.EventDispatcher.onClick('.js-clear-search-history', (e) => {
            e.preventDefault();
            window.clearRecentSearches();
        });

        window.EventDispatcher.onClick('.js-search-result', (e, el) => {
            e.preventDefault();

            const id = parseInt(el.dataset.id, 10);
            const type = el.dataset.type;
            const title = el.dataset.title;
            const icon = el.dataset.icon || '🔍';
            const extra = el.dataset.extra;

            // Zapis do historii wyszukiwania
            saveToRecentSearches({ id, title, type, icon, extraData: extra });

            window.closeGlobalSearch();

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
                    if (typeof window.openEditTodoModal === 'function') window.openEditTodoModal(id, title);
                }, 150);
            } 
            else if (type === 'Lista' || type.startsWith('W liście')) {
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
