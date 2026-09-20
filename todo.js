// ==========================================
// LOGIKA: TO-DO I CHECKLISTY 2.1 - MOBILE FIXED & CLOUD SYNC (todo.js)
// ==========================================

window.TodoModule = (() => {
    let currentChecklistId = null;
    let currentChecklistTitle = '';
    let currentChecklistType = 'generic';

    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    // KONFIGURACJA TYPÓW LIST I SZABLONÓW
    window.LIST_TYPES = {
        generic:  { label: 'Lista',         icon: '🗂️', clearLabel: 'Usuń zrobione',  colorHex: '#a8c7fa' },
        shopping: { label: 'Zakupy',        icon: '🛒', clearLabel: 'Usuń kupione',   colorHex: '#6ee7b7' },
        packing:  { label: 'Do spakowania', icon: '🧳', clearLabel: 'Usuń spakowane', colorHex: '#fcd34d' }
    };

    window.PACKING_TEMPLATES = {
        'weekend': ['Ubrania na 2 dni', 'Kosmetyczka (szczoteczka, pasta, żel)', 'Ładowarka do telefonu', 'Dokumenty i portfel', 'Bielizna na zmianę', 'Piżama'],
        'week': ['Ubrania na 7 dni', 'Kosmetyczka pełna', 'Ładowarka i powerbank', 'Dokumenty, portfel, bilety', 'Bielizna x8', 'Ręcznik', 'Apteczka', 'Klapki']
    };

    // SŁOWNIK INTELIGENTNYCH KATEGORII ZAKUPÓW
    const SHOPPING_CATEGORIES = [
        { name: '🥦 Warzywa i Owoce', keys: ['jabłk', 'banan', 'ziemniak', 'pomidor', 'cebul', 'marchew', 'owoc', 'warzyw', 'cytryn', 'czosnek', 'ogór', 'papryk', 'sałat', 'malin', 'truskaw'] },
        { name: '🥛 Nabiał i Jaja', keys: ['mlek', 'ser', 'jogurt', 'masł', 'śmietan', 'jaj', 'twaróg', 'kefir'] },
        { name: '🥖 Pieczywo', keys: ['chleb', 'bułk', 'bagiet', 'rogal', 'drożdżówk', 'pieczyw'] },
        { name: '🥩 Mięso i Wędliny', keys: ['kurczak', 'schab', 'kiełbas', 'parówk', 'wędlin', 'szynk', 'boczek', 'mięs', 'wołow'] },
        { name: '🧴 Chemia i Dom', keys: ['mydł', 'papier', 'płyn', 'proszek', 'szampon', 'pasta', 'żel', 'gąbk', 'mop', 'ścier', 'work'] }
    ];

    window.initTodoModule = async function() {
        await window.loadTodosAndLists();
    };

    window.initChecklistUI = function() {
        const titleEl = document.getElementById('checklist-screen-title');
        if (!titleEl) return;

        const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
        titleEl.innerText = currentChecklistTitle; 
        
        const clearBtn = document.getElementById('checklist-clear-btn');
        if (clearBtn) {
            clearBtn.innerText = lType.clearLabel;
        }

        const actionsContainer = clearBtn ? clearBtn.parentElement : null;
        if (actionsContainer && !document.getElementById('checklist-reset-btn')) {
            const resetBtn = document.createElement('button');
            resetBtn.id = 'checklist-reset-btn';
            resetBtn.className = 'js-reset-checklist text-xs font-bold text-neutral-400 border border-[#333537] bg-[#1e1f20] px-3 py-1.5 rounded-full active:scale-95 transition-transform ml-2 cursor-pointer touch-manipulation';
            resetBtn.innerText = 'Zresetuj stan 🔄';
            actionsContainer.appendChild(resetBtn);
        }
        
        window.loadChecklistItems();
    };

    // Ładowanie zadań (Local First: RAM + Supabase)
    window.loadTodosAndLists = async function(forceRefresh = false) {
        window.renderTodoUI();

        const state = window.AppStore.get() || {};
        const hid = window.currentUser ? window.currentUser.household_id : null;
        if (!hid) return;

        if (forceRefresh || !state.todos || state.todos.length === 0) {
            try {
                const [todosRes, listsRes, itemsRes] = await Promise.all([
                    window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).limit(200),
                    window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false }),
                    window.supabaseClient.from('checklist_items').select('*').eq('household_id', hid)
                ]);

                window.AppStore.set({
                    ...state,
                    todos: todosRes.data || [],
                    checklists: listsRes.data || [],
                    checklistItems: itemsRes.data || []
                });
                
                window.renderTodoUI();
            } catch (err) {
                console.warn("Brak połączenia - pracuję na danych lokalnych:", err);
            }
        }
    };

    // Szybkie zadanie bezpośrednio nad listą (0 ms)
    window.saveInlineTodo = async function() {
        const input = document.getElementById('inline-todo-input');
        if (!input) return;
        const title = input.value.trim();
        if (!title) return;

        if (document.activeElement) document.activeElement.blur();
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        input.value = ''; 

        const tempId = Date.now();
        const newTodoObj = {
            id: tempId, title, 
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, 
            is_completed: false, is_archived: false, is_urgent: false,
            creator_name: window.currentUser.name, created_at: new Date().toISOString()
        };

        window.AppStore.set(state => ({
            ...state,
            todos: [newTodoObj, ...(state.todos || [])]
        }));
        window.renderTodoUI();

        const { data, error } = await window.supabaseClient.from('todos').insert([{
            title: newTodoObj.title, user_id: newTodoObj.user_id, household_id: newTodoObj.household_id,
            is_completed: false, is_archived: false, is_urgent: false, creator_name: newTodoObj.creator_name
        }]).select().single();

        if (error) {
            window.showToast("Błąd zapisu w chmurze: " + error.message);
            window.loadTodosAndLists(true);
        } else if (data) {
            window.AppStore.set(state => ({
                ...state,
                todos: (state.todos || []).map(t => sameId(t.id, tempId) ? data : t)
            }));
            window.showToast("Zapisano ☁️");
        }
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    };

    window.renderTodoUI = function() {
        const listEl = document.getElementById('todo-list');
        if (!listEl) return;

        const state = window.AppStore.get() || {};
        const rawTodos = state.todos || [];
        const lists = state.checklists || [];
        const allItems = state.checklistItems || [];
        
        let todos = [...rawTodos];
        let html = '';

        // Inline Quick Add
        html += `
        <div class="mb-5 relative animate-fade-in">
            <input type="text" id="inline-todo-input" class="w-full bg-[#1e1f20] border border-[#333537] rounded-[16px] py-3.5 pl-4 pr-12 text-sm text-neutral-200 focus:outline-none focus:border-[#a8c7fa] transition-colors shadow-sm" placeholder="Dodaj szybkie zadanie...">
            <button class="js-save-inline-todo absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#004a77] text-[#c2e7ff] rounded-full active:scale-90 transition-transform font-bold text-lg cursor-pointer touch-manipulation">
                <span class="pointer-events-none">↑</span>
            </button>
        </div>`;

        todos.sort((a, b) => {
            if (a.is_completed !== b.is_completed) return a.is_completed - b.is_completed; 
            if (a.is_urgent !== b.is_urgent) return (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0); 
            return new Date(b.created_at) - new Date(a.created_at);
        });

        if (lists.length > 0) {
            html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Twoje Listy</h3>`;
            html += lists.map(list => {
                const lType = window.LIST_TYPES[list.list_type] || window.LIST_TYPES.generic;
                let dateBadge = '';
                if (list.list_type === 'packing' && list.start_date) {
                    const st = new Date(list.start_date).toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit'});
                    dateBadge = `<span class="text-[9px] px-1.5 py-0.5 rounded border border-[#004a77]/50 bg-[#004a77]/20 text-[#a8c7fa] ml-2 shrink-0">${st}</span>`;
                }

                // Progress Bar kalkulacja
                const cItems = allItems.filter(i => sameId(i.checklist_id, list.id));
                const total = cItems.length;
                const completed = cItems.filter(i => i.is_completed).length;
                const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
                const progressHtml = total > 0 ? `
                    <div class="mt-2.5 flex items-center gap-2">
                        <div class="flex-1 h-1.5 bg-[#131314] rounded-full overflow-hidden border border-[#333537]/50">
                            <div class="h-full transition-all duration-500" style="width: ${pct}%; background-color: ${lType.colorHex};"></div>
                        </div>
                        <span class="text-[9px] text-neutral-400 font-bold shrink-0">${completed}/${total}</span>
                    </div>
                ` : '<p class="text-[9px] text-neutral-600 mt-1.5 italic">Pusta lista</p>';

                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group animate-fade-in">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-checklist text-[#ffb4ab] text-xl active:scale-95 transition-transform cursor-pointer touch-manipulation" data-id="${list.id}">🗑️</button>
                    </div>
                    <div class="js-open-checklist swipe-front relative z-10 flex flex-col p-3 bg-[#0f2334] rounded-[16px] border border-[#004a77]/50 cursor-pointer w-full transition-transform touch-manipulation" data-id="${list.id}" data-title="${window.esc(list.title)}" data-type="${list.list_type || 'generic'}">
                        <div class="flex items-center justify-between min-w-0 w-full pointer-events-none">
                            <div class="flex items-center gap-3 min-w-0">
                                <span class="text-lg shrink-0">${lType.icon}</span>
                                <span class="text-sm font-bold text-[#c2e7ff] truncate">${window.esc(list.title)}</span>
                            </div>
                            ${dateBadge}
                        </div>
                        <div class="pointer-events-none">${progressHtml}</div>
                    </div>
                </div>`;
            }).join('');
            html += `<div class="h-4"></div>`; 
        }

        html += `<h3 class="text-[10px] font-medium text-neutral-500 uppercase tracking-widest pl-1 mb-2">Szybkie zadania</h3>`;
        
        if (todos.length === 0) {
            html += `<p class="text-center text-neutral-500 text-xs py-4">Brak zadań.</p>`;
        } else {
            html += todos.map(todo => {
                let isDone = todo.is_completed;
                let isUrgent = todo.is_urgent;

                let currentName = isDone ? (todo.completer_name || 'Ja') : (todo.creator_name || 'Ja');
                let initial = currentName[0].toUpperCase();
                let badgeType = isDone ? 'todos' : 'todos_creator';
                let avatarClass = window.getAvatarColor ? window.getAvatarColor(currentName) : 'bg-[#333537] border-[#737373] text-neutral-300';
                if (isDone) avatarClass = 'bg-[#0f5223]/30 border-[#0f5223]/50 text-[#c4eed0]';
                
                let userBadge = `<div class="js-change-user w-6 h-6 rounded-full ${avatarClass} border text-[10px] flex items-center justify-center ml-2 shrink-0 cursor-pointer active:scale-90 transition-transform font-bold touch-manipulation" data-type="${badgeType}" data-id="${todo.id}" data-username="${window.esc(currentName)}"><span class="pointer-events-none">${initial}</span></div>`;

                let urgentIcon = isUrgent ? '🚨' : '🔔';
                let urgentClass = isUrgent ? 'text-[#ffb4ab] opacity-100 scale-110' : 'text-neutral-600 opacity-30 group-hover:opacity-60';
                let urgentBtn = isDone ? '' : `<button class="js-toggle-todo-urgency p-1 text-sm shrink-0 active:scale-90 transition-all cursor-pointer touch-manipulation ${urgentClass}" data-id="${todo.id}" data-urgent="${isUrgent}" title="Przełącz priorytet pilny"><span class="pointer-events-none">${urgentIcon}</span></button>`;

                let urgentBorderClass = (isUrgent && !isDone) ? 'border-l-4 border-l-[#ffb4ab]' : '';

                return `
                <div class="relative overflow-hidden mb-1.5 rounded-[16px] group animate-fade-in ${isDone ? 'opacity-50' : ''}">
                    <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-5">
                        <button class="js-archive-todo text-[#ffb4ab] text-xl active:scale-95 transition-transform cursor-pointer touch-manipulation" data-id="${todo.id}">🗑️</button>
                    </div>
                    <div class="swipe-front relative z-10 flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] ${urgentBorderClass} cursor-pointer w-full transition-transform touch-manipulation">
                        <div class="js-edit-todo flex items-center gap-2 flex-1 min-w-0" data-id="${todo.id}" data-title="${window.esc(todo.title)}">
                            <div class="js-toggle-todo w-6 h-6 rounded-full border-2 ${isDone ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#737373]'} flex items-center justify-center transition-colors shrink-0 cursor-pointer touch-manipulation" data-id="${todo.id}" data-status="${isDone}">
                                ${isDone ? '<span class="text-[#0f5223] text-xs font-bold pointer-events-none">✓</span>' : ''}
                            </div>
                            <span class="text-sm truncate flex-1 ${isDone ? 'line-through text-neutral-500' : 'text-neutral-200'} pointer-events-none">
                                ${isUrgent && !isDone ? '<span class="text-[#ffb4ab] text-[10px] font-bold mr-1 align-middle uppercase tracking-widest bg-[#3c1414] px-1 py-0.5 rounded">Pilne</span>' : ''}${window.esc(todo.title)}
                            </span>
                            ${urgentBtn}
                            ${userBadge}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        listEl.innerHTML = html;
        
        const inlineInput = document.getElementById('inline-todo-input');
        if (inlineInput) {
            inlineInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); window.saveInlineTodo(); }
            });
        }
    };

    window.openNewTodoModal = function() { 
        window.loadAndShowModal('new-todo-modal', '/modals/new-todo.html', () => {
            document.getElementById('new-todo-title').value = ''; 
            const urgentInput = document.getElementById('new-todo-urgent');
            if (urgentInput) urgentInput.checked = false;
            setTimeout(() => document.getElementById('new-todo-title')?.focus(), 50);
        });
    };
    
    window.closeNewTodoModal = function() { 
        const modal = document.getElementById('new-todo-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.saveNewTodo = async function() {
        if (document.activeElement) document.activeElement.blur();
        const title = document.getElementById('new-todo-title').value.trim(); 
        if (!title) return;

        const urgentInput = document.getElementById('new-todo-urgent');
        const isUrgent = urgentInput ? urgentInput.checked : false;
        const tempId = Date.now();

        const newTodoObj = {
            id: tempId, title, user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, 
            is_completed: false, is_archived: false, is_urgent: isUrgent,
            creator_name: window.currentUser.name, created_at: new Date().toISOString()
        };

        window.AppStore.set(state => ({ ...state, todos: [newTodoObj, ...(state.todos || [])] }));
        window.renderTodoUI();
        window.closeNewTodoModal(); 
        window.showToast("Zadanie dodane!"); 

        const { data, error } = await window.supabaseClient.from('todos').insert([{
            title: newTodoObj.title, user_id: newTodoObj.user_id, household_id: newTodoObj.household_id,
            is_completed: false, is_archived: false, is_urgent: isUrgent, creator_name: newTodoObj.creator_name
        }]).select().single();

        if (error) {
            window.showToast("Błąd zapisu w chmurze");
            window.loadTodosAndLists(true);
        } else if (data) {
            window.AppStore.set(state => ({
                ...state,
                todos: (state.todos || []).map(t => sameId(t.id, tempId) ? data : t)
            }));
        }
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    };

    window.openNewChecklistModal = function() {
        window.loadAndShowModal('new-checklist-modal', '/modals/new-checklist.html', () => {
            document.getElementById('new-checklist-title').value = '';
            document.getElementById('new-checklist-type').value = 'generic';
            document.getElementById('new-checklist-start').value = '';
            document.getElementById('new-checklist-end').value = '';
            window.toggleChecklistDates();
            setTimeout(() => document.getElementById('new-checklist-title')?.focus(), 50);
        });
    };

    window.closeNewChecklistModal = function() { 
        const modal = document.getElementById('new-checklist-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.toggleChecklistDates = function() {
        const type = document.getElementById('new-checklist-type').value;
        const container = document.getElementById('checklist-dates-container');
        if (container) container.classList.toggle('hidden', type !== 'packing');
    };

    window.saveNewChecklist = async function() {
        if (document.activeElement) document.activeElement.blur();
        const title = document.getElementById('new-checklist-title').value.trim();
        const type = document.getElementById('new-checklist-type').value;
        const start = document.getElementById('new-checklist-start').value || null;
        const end = document.getElementById('new-checklist-end').value || null;

        if (!title) return;

        const { data, error } = await window.supabaseClient.from('checklists').insert([{
            title, list_type: type, start_date: start, end_date: end,
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id
        }]).select().single();

        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        if (type === 'packing') {
            const template = window.PACKING_TEMPLATES['weekend'];
            if (template && data && data.id) {
                const templateItems = template.map(content => ({
                    checklist_id: data.id, user_id: window.currentUser.user_id,
                    household_id: window.currentUser.household_id, content: content, is_completed: false
                }));
                await window.supabaseClient.from('checklist_items').insert(templateItems);
            }
        }

        window.closeNewChecklistModal();
        window.showToast("Lista utworzona!");
        await window.loadTodosAndLists(true);
    };

    window.openChecklistScreen = function(id, title, type) {
        currentChecklistId = parseInt(id, 10); 
        currentChecklistTitle = title;
        currentChecklistType = type || 'generic';
        window.goForward('checklist-screen');
    };

    // Wewnętrzna funkcja generująca wiersze HTML dla pozycji na liście
    function renderChecklistRows(items) {
        return items.map(item => `
            <div class="relative overflow-hidden mb-1 rounded-[12px] group animate-fade-in ${item.is_completed ? 'opacity-50' : ''}">
                <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-4">
                    <button class="js-delete-checklist-item text-[#ffb4ab] text-lg active:scale-90 transition-transform cursor-pointer touch-manipulation" data-id="${item.id}">🗑️</button>
                </div>
                <div class="swipe-front relative z-10 flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] w-full transition-transform">
                    <div class="js-toggle-checklist-item flex items-center gap-3 flex-1 cursor-pointer min-w-0 touch-manipulation" data-id="${item.id}" data-status="${item.is_completed}">
                        <div class="w-5 h-5 rounded-full border-2 ${item.is_completed ? 'bg-[#c4eed0] border-[#c4eed0]' : 'border-[#737373]'} flex items-center justify-center transition-colors shrink-0 pointer-events-none">
                            ${item.is_completed ? '<span class="text-[#0f5223] text-[10px] font-bold">✓</span>' : ''}
                        </div>
                        <span class="text-sm truncate flex-1 ${item.is_completed ? 'line-through text-neutral-500' : 'text-neutral-200'} pointer-events-none">${window.esc(item.content)}</span>
                    </div>
                </div>
            </div>`).join('');
    }

    window.loadChecklistItems = async function() {
        const listEl = document.getElementById('checklist-items-list');
        if (!listEl || !currentChecklistId) return;
        
        const state = window.AppStore.get() || {};
        let items = (state.checklistItems || []).filter(i => sameId(i.checklist_id, currentChecklistId));
        
        if (items.length === 0) {
            listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Ładowanie zawartości...</p>`;
            const { data } = await window.supabaseClient.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true });
            items = data || [];
            window.AppStore.set(s => ({...s, checklistItems: [...(s.checklistItems||[]).filter(i=>!sameId(i.checklist_id, currentChecklistId)), ...items]}));
        }

        const clearBtn = document.getElementById('checklist-clear-btn');
        if (clearBtn) clearBtn.classList.toggle('hidden', !items.some(i => i.is_completed));
        
        if (items.length === 0) {
            listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Wpisz lub wklej elementy poniżej.</p>`;
            return;
        }

        let html = '';
        
        // Inteligentne Grupowanie Zakupów
        if (currentChecklistType === 'shopping') {
            const categorized = { '🛒 Pozostałe / Inne': [] };
            SHOPPING_CATEGORIES.forEach(c => categorized[c.name] = []);
            
            items.forEach(item => {
                const txt = item.content.toLowerCase();
                let matched = false;
                for (const cat of SHOPPING_CATEGORIES) {
                    if (cat.keys.some(k => txt.includes(k))) {
                        categorized[cat.name].push(item);
                        matched = true; break;
                    }
                }
                if (!matched) categorized['🛒 Pozostałe / Inne'].push(item);
            });

            for (const [catName, catItems] of Object.entries(categorized)) {
                if (catItems.length === 0) continue;
                catItems.sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1));
                html += `<h4 class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-4 mb-2 pl-1">${catName}</h4>`;
                html += renderChecklistRows(catItems);
            }
        } else {
            items.sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1));
            html += renderChecklistRows(items);
        }

        listEl.innerHTML = html;

        // Podpięcie Enter do pola tekstowego pozycji checklisty
        const itemInput = document.getElementById('new-checklist-item-input');
        if (itemInput && !itemInput.dataset.hasEnter) {
            itemInput.dataset.hasEnter = "true";
            itemInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.saveChecklistItem();
                }
            });
        }
    };

    // Wklejanie wielowierszowe (Bulk Add) i Bezpośredni Zapis do Chmury
    window.saveChecklistItem = async function() {
        const input = document.getElementById('new-checklist-item-input'); 
        if (!input) return;
        const contentRaw = input.value.trim();
        if (!contentRaw || !currentChecklistId) return; 
        
        if (document.activeElement) document.activeElement.blur();
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        input.value = ''; 

        const lines = contentRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const hid = window.currentUser ? window.currentUser.household_id : null;
        const uid = window.currentUser ? window.currentUser.user_id : null;

        const newItemsLocal = lines.map(line => ({
            id: Date.now() + Math.random(), 
            checklist_id: currentChecklistId,
            user_id: uid,
            household_id: hid,
            content: line,
            is_completed: false,
            created_at: new Date().toISOString()
        }));

        // 1. Instant local render
        window.AppStore.set(state => ({
            ...state,
            checklistItems: [...(state.checklistItems || []), ...newItemsLocal]
        }));
        window.loadChecklistItems(); 

        // 2. Pewny zapis w Supabase z weryfikacją błędów
        const payload = newItemsLocal.map(i => ({ 
            checklist_id: i.checklist_id, 
            user_id: i.user_id, 
            household_id: i.household_id, 
            content: i.content, 
            is_completed: false 
        }));

        const { data, error } = await window.supabaseClient.from('checklist_items').insert(payload).select();
        
        if (error) {
            console.error("Błąd zapisu do chmury:", error);
            window.showToast("Błąd zapisu w chmurze: " + error.message);
            window.loadTodosAndLists(true); 
        } else if (data) {
            window.showToast("Zapisano ☁️");
            window.AppStore.set(state => {
                const filtered = (state.checklistItems || []).filter(i => !newItemsLocal.some(nl => sameId(nl.id, i.id)));
                return { ...state, checklistItems: [...filtered, ...data] };
            });
        }
    };

    window.toggleTodo = async function(id, currentStatus) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const newStatus = !currentStatus;

        window.AppStore.set(state => {
            const updatedTodos = (state.todos || []).map(t => sameId(t.id, id) ? { 
                ...t, 
                is_completed: newStatus,
                completed_at: newStatus ? new Date().toISOString() : null,
                completer_name: newStatus ? window.currentUser.name : null
            } : t);
            return { ...state, todos: updatedTodos };
        });
        
        window.renderTodoUI();

        const { error } = await window.supabaseClient.from('todos').update({ 
            is_completed: newStatus, 
            completed_at: newStatus ? new Date().toISOString() : null, 
            completer_name: newStatus ? window.currentUser.name : null 
        }).eq('id', id);

        if (error) {
            window.showToast("Błąd zapisu w chmurze");
            await window.loadTodosAndLists(true); 
        } else {
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        }
    };

    window.archiveTodo = async function(id) {
        window.customConfirm("Zarchiwizować to zadanie?", async () => {
            window.AppStore.set(state => ({
                ...state,
                todos: (state.todos || []).filter(t => !sameId(t.id, id))
            }));
            window.renderTodoUI();

            const { error } = await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', id);
            if (error) {
                window.showToast("Błąd archiwizacji");
                await window.loadTodosAndLists(true);
            } else {
                if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            }
        });
    };

    window.toggleTodoUrgency = async function(id, currentUrgent) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const newUrgent = !currentUrgent;
        
        window.AppStore.set(state => {
            const updatedTodos = (state.todos || []).map(t => sameId(t.id, id) ? { ...t, is_urgent: newUrgent } : t);
            return { ...state, todos: updatedTodos };
        });
        window.renderTodoUI();

        const { error } = await window.supabaseClient.from('todos').update({ is_urgent: newUrgent }).eq('id', id);

        if (error) {
            window.showToast("Błąd zapisu priorytetu");
            await window.loadTodosAndLists(true);
        } else {
            window.showToast(newUrgent ? "Oznaczono jako pilne! 🚨" : "Usunięto priorytet");
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        }
    };

    window.toggleChecklistItem = async function(id, currentStatus, el) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const isDone = !currentStatus;

        window.AppStore.set(state => ({
            ...state,
            checklistItems: (state.checklistItems || []).map(i => sameId(i.id, id) ? { ...i, is_completed: isDone } : i)
        }));
        
        if (el) {
            const container = el.closest('.group');
            if (container) {
                container.classList.toggle('opacity-50', isDone);
                if (isDone && container.parentNode) {
                    setTimeout(() => container.parentNode.appendChild(container), 400); 
                }
            }
            
            const circle = el.querySelector('div.js-toggle-checklist-item > div');
            if (circle) {
                circle.classList.toggle('bg-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#c4eed0]', isDone);
                circle.classList.toggle('border-[#737373]', !isDone);
                circle.innerHTML = isDone ? '<span class="text-[#0f5223] text-[10px] font-bold pointer-events-none">✓</span>' : '';
            }
            
            const textSpan = el.querySelector('span.truncate');
            if (textSpan) {
                textSpan.classList.toggle('line-through', isDone);
                textSpan.classList.toggle('text-neutral-500', isDone);
                textSpan.classList.toggle('text-neutral-200', !isDone);
            }
            el.dataset.status = isDone.toString();
        } else {
            window.loadChecklistItems();
        }

        const { error } = await window.supabaseClient.from('checklist_items').update({ is_completed: isDone }).eq('id', id);
        if (error) { window.showToast("Błąd zapisu!"); window.loadTodosAndLists(true); }
    };

    window.deleteChecklistItem = async function(id, el) {
        if (el) {
            const container = el.closest('.group');
            if (container) container.classList.add('hidden');
        }
        window.AppStore.set(state => ({
            ...state,
            checklistItems: (state.checklistItems || []).filter(i => !sameId(i.id, id))
        }));
        await window.supabaseClient.from('checklist_items').delete().eq('id', id);
        window.loadChecklistItems();
    };

    window.clearCompletedItems = async function() {
        const lType = window.LIST_TYPES[currentChecklistType] || window.LIST_TYPES.generic;
        window.customConfirm(`Czy na pewno wykonać: ${lType.clearLabel}?`, async () => {
            window.AppStore.set(state => ({
                ...state,
                checklistItems: (state.checklistItems || []).filter(i => !(sameId(i.checklist_id, currentChecklistId) && i.is_completed))
            }));
            window.loadChecklistItems();
            await window.supabaseClient.from('checklist_items').delete().eq('checklist_id', currentChecklistId).eq('is_completed', true);
        });
    };

    window.resetChecklist = async function() {
        if (!currentChecklistId) return;
        window.customConfirm("Odznaczyć wszystkie elementy na tej liście?", async () => {
            window.AppStore.set(state => ({
                ...state,
                checklistItems: (state.checklistItems || []).map(i => sameId(i.checklist_id, currentChecklistId) ? { ...i, is_completed: false } : i)
            }));
            window.loadChecklistItems(); 

            const { error } = await window.supabaseClient.from('checklist_items')
                .update({ is_completed: false }).eq('checklist_id', currentChecklistId);
            
            if (error) { window.showToast("Błąd resetowania."); window.loadTodosAndLists(true); }
            else { window.showToast("Lista zresetowana!"); }
        });
    };

    window.archiveChecklist = function(id) {
        window.customConfirm("Zarchiwizować całą listę?", async () => {
            window.AppStore.set(state => ({
                ...state,
                checklists: (state.checklists || []).filter(l => !sameId(l.id, id))
            }));
            window.renderTodoUI();
            await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id);
        });
    };

    // --- DELEGACJA ZDARZEŃ (VIA DISPATCHER) ---
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-refresh-todo-view', () => window.loadTodosAndLists(true));
        window.EventDispatcher.onClick('.js-open-new-todo-modal', () => window.openNewTodoModal());
        window.EventDispatcher.onClick('.js-open-new-checklist', () => window.openNewChecklistModal());

        // Przyciski i akcje na listach z bezpieczną delegacją dla Mobile
        window.EventDispatcher.onClick('.js-save-inline-todo', (e) => {
            e.preventDefault();
            window.saveInlineTodo();
        });

        window.EventDispatcher.onClick('.js-save-checklist-item', (e) => {
            e.preventDefault();
            window.saveChecklistItem();
        });

        window.EventDispatcher.onClick('.js-add-checklist-item', (e) => {
            e.preventDefault();
            window.saveChecklistItem();
        });

        window.EventDispatcher.onClick('.js-reset-checklist', (e) => {
            e.preventDefault();
            window.resetChecklist();
        });

        window.EventDispatcher.onClick('.js-open-checklist', (e, el) => {
            e.preventDefault();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.openChecklistScreen(targetEl.dataset.id, targetEl.dataset.title, targetEl.dataset.type);
        });

        window.EventDispatcher.onClick('.js-archive-checklist', (e, el) => {
            e.preventDefault();
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.archiveChecklist(parseInt(targetEl.dataset.id, 10));
        });

        window.EventDispatcher.onClick('.js-archive-todo', (e, el) => {
            e.preventDefault();
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.archiveTodo(parseInt(targetEl.dataset.id, 10));
        });

        window.EventDispatcher.onClick('.js-toggle-todo', (e, el) => {
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isDone = targetEl.dataset.status === 'true';
                window.toggleTodo(parseInt(targetEl.dataset.id, 10), isDone);
            }
        });

        window.EventDispatcher.onClick('.js-toggle-todo-urgency', (e, el) => {
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isUrgent = targetEl.dataset.urgent === 'true';
                window.toggleTodoUrgency(parseInt(targetEl.dataset.id, 10), isUrgent);
            }
        });

        window.EventDispatcher.onClick('.js-change-user', (e, el) => {
            e.stopPropagation(); 
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.openChangeUserModal(targetEl.dataset.type, targetEl.dataset.id, targetEl.dataset.username);
        });

        window.EventDispatcher.onClick('.js-delete-checklist-item', (e, el) => {
            e.preventDefault();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.deleteChecklistItem(parseInt(targetEl.dataset.id, 10), targetEl);
        });

        window.EventDispatcher.onClick('.js-toggle-checklist-item', (e, el) => {
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isCompleted = targetEl.dataset.status === 'true';
                window.toggleChecklistItem(parseInt(targetEl.dataset.id, 10), isCompleted, targetEl);
            }
        });
    } else {
        console.error("EventDispatcher nie jest załadowany!");
    }

    return { init: window.initTodoModule };
})();
