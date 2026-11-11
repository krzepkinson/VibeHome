// ==========================================
// LOGIKA: TO-DO I CHECKLISTY 2.2 - PANCERNY MOBILE & CLOUD SYNC (todo.js)
// ==========================================

window.TodoModule = (() => {
    let currentChecklistId = null;
    let currentChecklistTitle = '';
    let currentChecklistType = 'generic';
    let activeTodoTab = 'tasks';
    let taskAreaFilter = 'all';
    let taskRoomFilter = '';
    let inlineTaskDraft = '';
    let inlineTaskSaving = false;
    let inlineDraftScope = null;
    let inlineSaveToken = 0;

    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const normalizeId = id => /^\d+$/.test(String(id ?? '')) ? Number(id) : String(id ?? '');

    // PANCERNE HELPERY POBIERANIA ID UŻYTKOWNIKA I DOMU (BEZPIECZEŃSTWO SYNCU)
    const getUserId = () => {
        if (window.currentUser && (window.currentUser.user_id || window.currentUser.id)) {
            return window.currentUser.user_id || window.currentUser.id;
        }
        const state = window.AppStore.get() || {};
        if (state.currentUser && (state.currentUser.user_id || state.currentUser.id)) {
            return state.currentUser.user_id || state.currentUser.id;
        }
        try {
            const saved = JSON.parse(localStorage.getItem('bento_user_session'));
            if (saved && (saved.user_id || saved.id)) return saved.user_id || saved.id;
        } catch (e) {}
        return null;
    };

    const getHouseholdId = () => {
        if (window.currentUser && window.currentUser.household_id) {
            return window.currentUser.household_id;
        }
        const state = window.AppStore.get() || {};
        if (state.currentUser && state.currentUser.household_id) {
            return state.currentUser.household_id;
        }
        try {
            const saved = JSON.parse(localStorage.getItem('bento_user_session'));
            if (saved && saved.household_id) return saved.household_id;
        } catch (e) {}
        return null;
    };

    const getUserName = () => {
        return window.currentUser?.name || window.AppStore.get()?.currentUser?.name || 'Domownik';
    };
    const draftScope = () => JSON.stringify([getUserId(), getHouseholdId()]);

    // KONFIGURACJA TYPÓW LIST I SZABLONÓW
    window.LIST_TYPES = {
        generic:  { label: 'Lista',         icon: '', clearLabel: 'Usuń wykonane pozycje',  colorHex: '#a8c7fa' },
        shopping: { label: 'Zakupy',        icon: '', clearLabel: 'Usuń kupione pozycje',   colorHex: '#6ee7b7' },
        packing:  { label: 'Do spakowania', icon: '', clearLabel: 'Usuń spakowane pozycje', colorHex: '#fcd34d' }
    };

    window.PACKING_TEMPLATES = {
        'weekend': ['Ubrania na 2 dni', 'Kosmetyczka (szczoteczka, pasta, żel)', 'Ładowarka do telefonu', 'Dokumenty i portfel', 'Bielizna na zmianę', 'Piżama'],
        'week': ['Ubrania na 7 dni', 'Kosmetyczka pełna', 'Ładowarka i powerbank', 'Dokumenty, portfel, bilety', 'Bielizna x8', 'Ręcznik', 'Apteczka', 'Klapki']
    };

    // SŁOWNIK INTELIGENTNYCH KATEGORII ZAKUPÓW
    const SHOPPING_CATEGORIES = [
        { name: 'Warzywa i owoce', keys: ['jabłk', 'banan', 'ziemniak', 'pomidor', 'cebul', 'marchew', 'owoc', 'warzyw', 'cytryn', 'czosnek', 'ogór', 'papryk', 'sałat', 'malin', 'truskaw'] },
        { name: 'Nabiał i jaja', keys: ['mlek', 'ser', 'jogurt', 'masł', 'śmietan', 'jaj', 'twaróg', 'kefir'] },
        { name: 'Pieczywo', keys: ['chleb', 'bułk', 'bagiet', 'rogal', 'drożdżówk', 'pieczyw'] },
        { name: 'Mięso i wędliny', keys: ['kurczak', 'schab', 'kiełbas', 'parówk', 'wędlin', 'szynk', 'boczek', 'mięs', 'wołow'] },
        { name: 'Chemia i dom', keys: ['mydł', 'papier', 'płyn', 'proszek', 'szampon', 'pasta', 'żel', 'gąbk', 'mop', 'ścier', 'work'] }
    ];

    window.initTodoModule = async function(forceRefresh = false) {
        await window.loadTodosAndLists(forceRefresh);
    };

    window.initChecklistUI = function(forceRefresh = false) {
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
            resetBtn.innerHTML = `${window.UX?.icon?.('repeat') || ''} Odznacz wszystkie`;
            actionsContainer.appendChild(resetBtn);
        }
        
        window.loadChecklistItems(forceRefresh);
    };

    // Ładowanie zadań i list (Local First: RAM + Supabase Sync)
    window.loadTodosAndLists = async function(forceRefresh = false) {
        window.renderTodoUI();
        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview(forceRefresh);
            window.renderTodoUI();
        }
    };

    // Szybkie dodawanie zadania To-Do (0 ms + Pewna chmura)
    window.saveInlineTodo = async function() {
        const input = document.getElementById('inline-todo-input');
        const name = input?.value.trim();
        if (!name || input.disabled || inlineTaskSaving) return;
        const saveToken = ++inlineSaveToken;
        inlineTaskDraft = input.value;
        inlineTaskSaving = true;
        input.disabled = true;
        try {
            await window.TaskModel.save({ name, area: taskAreaFilter === 'home' ? 'Dom' : taskAreaFilter === 'health' ? 'Zdrowie' : 'Ogólne', room: taskRoomFilter, dueAt: null });
            if (saveToken !== inlineSaveToken) return;
            inlineTaskDraft = '';
            const currentInput = document.getElementById('inline-todo-input');
            if (currentInput) currentInput.value = '';
            window.showToast('Dodano zadanie.');
        } catch (error) {
            if (saveToken !== inlineSaveToken) return;
            console.error('Task capture failed:', error);
            window.showToast('Nie udało się zapisać zadania. Spróbuj ponownie.');
        } finally {
            if (saveToken === inlineSaveToken) {
                inlineTaskSaving = false;
                window.renderTodoUI();
                document.getElementById('inline-todo-input')?.focus({ preventScroll: true });
            }
        }
    };

    window.getTaskAddContext = function() {
        if (window.activeView === 'checklist-screen') return { type: 'list-item', checklistId: currentChecklistId };
        if (window.activeView === 'home') {
            const room = window.HomeModule?.getRoomFilter?.();
            return { type: 'task', area: 'Dom', room: room && room !== 'Wszystkie' ? room : '' };
        }
        if (activeTodoTab === 'lists') return { type: 'list' };
        return { type: 'task', area: taskAreaFilter === 'home' ? 'Dom' : taskAreaFilter === 'health' ? 'Zdrowie' : 'Ogólne', room: taskRoomFilter };
    };
    window.getChecklistContext = () => ({ id: currentChecklistId, title: currentChecklistTitle, type: currentChecklistType });
    window.showTasksArea = async function(area = 'all', room = '') {
        activeTodoTab = 'tasks';
        taskAreaFilter = area === 'Dom' || area === 'home' ? 'home' : area === 'Zdrowie' || area === 'health' ? 'health' : 'all';
        taskRoomFilter = room;
        await window.switchView('todo');
        window.renderTodoUI();
    };

    window.renderTodoUI = function() {
        const listEl = document.getElementById('todo-list');
        if (!listEl) return;
        const nextScope = draftScope();
        const sameScope = inlineDraftScope === nextScope;
        if (!sameScope) {
            inlineDraftScope = nextScope;
            inlineTaskDraft = '';
            inlineTaskSaving = false;
            inlineSaveToken++;
        }
        const previousInput = document.getElementById('inline-todo-input');
        if (sameScope && previousInput) inlineTaskDraft = previousInput.value;
        const wasTyping = sameScope && previousInput && document.activeElement === previousInput;
        const selection = wasTyping ? [previousInput.selectionStart, previousInput.selectionEnd] : null;
        const state = window.AppStore.get() || {};
        const icon = name => window.UX?.icon?.(name) || '';
        const esc = value => window.esc(String(value ?? ''));
        let html = `<div class="ux-tabs" role="group" aria-label="Rodzaj listy"><button type="button" class="ux-tab js-task-tab ${activeTodoTab === 'tasks' ? 'active' : ''}" data-tab="tasks" aria-pressed="${activeTodoTab === 'tasks'}">Zadania</button><button type="button" class="ux-tab js-task-tab ${activeTodoTab === 'lists' ? 'active' : ''}" data-tab="lists" aria-pressed="${activeTodoTab === 'lists'}">Listy</button></div>`;
        if (activeTodoTab === 'lists') {
            const lists = (state.checklists || []).filter(list => !list.is_archived);
            const itemCounts = new Map();
            (state.checklistItems || []).forEach(item => {
                const key = String(item.checklist_id);
                const counts = itemCounts.get(key) || { total: 0, done: 0 };
                counts.total++; if (item.is_completed) counts.done++;
                itemCounts.set(key, counts);
            });
            html += lists.map(list => {
                const counts = itemCounts.get(String(list.id)) || { total: 0, done: 0 };
                const type = window.LIST_TYPES[list.list_type] || window.LIST_TYPES.generic;
                return `<div class="ux-row"><span aria-hidden="true">${icon(list.list_type === 'shopping' ? 'shopping' : list.list_type === 'packing' ? 'package' : 'list')}</span><button type="button" class="ux-row-main js-open-checklist" data-id="${esc(list.id)}" data-title="${esc(list.title)}" data-type="${esc(list.list_type || 'generic')}"><span class="ux-row-title">${esc(list.title)}</span><span class="ux-row-meta">${esc(type.label)}${list.start_date ? ` · ${new Date(`${list.start_date}T12:00:00`).toLocaleDateString('pl-PL')}` : ''}</span></button><span class="ux-row-status">${counts.done}/${counts.total} gotowe</span><button type="button" class="ux-icon-btn js-archive-checklist" data-id="${esc(list.id)}" aria-label="Archiwizuj listę ${esc(list.title)}" title="Archiwizuj">${icon('archive')}</button></div>`;
            }).join('') || '<p class="ux-empty">Brak list. Dodaj listę i wybierz szablon, jeśli go potrzebujesz.</p>';
            listEl.innerHTML = html;
            return;
        }
        html += `<div class="ux-actions ux-task-filters" role="group" aria-label="Filtr zadań">${[['all','Wszystkie'],['home','Dom'],['health','Zdrowie'],['undated','Bez terminu']].map(([key, label]) => `<button type="button" class="ux-chip js-task-area ${taskAreaFilter === key ? 'active' : ''}" data-area="${key}" aria-pressed="${taskAreaFilter === key}">${label}</button>`).join('')}${taskAreaFilter === 'home' ? `<label class="ux-muted">Pomieszczenie<select class="ux-input" id="task-room-filter" aria-label="Filtr pomieszczenia"><option value="">Wszystkie pomieszczenia</option>${(state.rooms || []).map(room => `<option value="${esc(room.name)}" ${taskRoomFilter === room.name ? 'selected' : ''}>${esc(room.name)}</option>`).join('')}</select></label>` : ''}</div>`;
        html += `<form id="inline-task-form" class="ux-actions"><input type="text" id="inline-todo-input" maxlength="150" class="ux-input" aria-label="Nazwa nowego zadania" placeholder="Co trzeba zrobić?" value="${esc(inlineTaskDraft)}" ${inlineTaskSaving ? 'disabled' : ''}><button type="submit" class="ux-btn js-save-inline-task" ${inlineTaskSaving ? 'disabled' : ''}>${icon('plus')}Dodaj</button></form>`;
        if (!window.TaskModel || !window.TaskDetails) { listEl.innerHTML = html + '<p class="ux-muted">Ładowanie zadań…</p>'; return; }
        const matches = task => (taskAreaFilter === 'all' || taskAreaFilter === 'home' && task.area === 'Dom' || taskAreaFilter === 'health' && task.area === 'Zdrowie' || taskAreaFilter === 'undated' && !task.dueAt) && (!taskRoomFilter || taskAreaFilter !== 'home' || task.room === taskRoomFilter);
        const tasks = window.TaskModel.list({ includeCompleted: true }).filter(matches);
        const active = tasks.filter(task => !task.completed).sort((a, b) => Number(b.important) - Number(a.important) || (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity) || a.name.localeCompare(b.name, 'pl'));
        const completed = tasks.filter(task => task.completed).sort((a, b) => new Date(b.lastCompletedAt || 0) - new Date(a.lastCompletedAt || 0));
        html += `<section class="ux-section" aria-label="Aktywne zadania">${active.map(window.TaskDetails.row).join('') || '<p class="ux-empty">Brak aktywnych zadań w tym widoku.</p>'}</section>`;
        html += `<details class="ux-section"><summary>Ukończone · ${completed.length}</summary>${completed.map(window.TaskDetails.row).join('')}</details>`;
        listEl.innerHTML = html;
        if (wasTyping && !inlineTaskSaving) {
            const replacement = document.getElementById('inline-todo-input');
            replacement?.focus({ preventScroll: true });
            if (selection) replacement?.setSelectionRange(...selection);
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
        const hid = getHouseholdId();
        const uid = getUserId();
        const uname = getUserName();

        const newTodoObj = {
            id: tempId, title, user_id: uid, household_id: hid, 
            is_completed: false, is_archived: false, is_urgent: isUrgent,
            creator_name: uname, created_at: new Date().toISOString()
        };

        window.AppStore.set(state => ({ ...state, todos: [newTodoObj, ...(state.todos || [])] }));
        window.renderTodoUI();
        window.closeNewTodoModal(); 

        const { data, error } = await window.supabaseClient.from('todos').insert([{
            title: newTodoObj.title, user_id: uid, household_id: hid,
            is_completed: false, is_archived: false, is_urgent: isUrgent, creator_name: uname
        }]).select().single();

        if (error) {
            console.error("Supabase error:", error);
            window.showToast("Błąd zapisu w chmurze: " + error.message);
            window.loadTodosAndLists(true);
        } else if (data) {
            window.AppStore.set(state => ({
                ...state,
                todos: (state.todos || []).map(t => sameId(t.id, tempId) ? data : t)
            }));
            window.showToast("Zapisano w chmurze ☁️");
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
        const hid = getHouseholdId();
        const uid = getUserId();

        if (!title || !hid) {
            window.showToast("Uzupełnij nazwę listy");
            return;
        }

        const { data, error } = await window.supabaseClient.from('checklists').insert([{
            title, list_type: type, start_date: start, end_date: end,
            user_id: uid, household_id: hid
        }]).select().single();

        if (error) { 
            console.error("Supabase error (checklist):", error);
            window.showToast("Błąd zapisu w chmurze: " + error.message); 
            return; 
        }
        
        if (type === 'packing') {
            const template = window.PACKING_TEMPLATES['weekend'];
            if (template && data && data.id) {
                const templateItems = template.map(content => ({
                    checklist_id: data.id, user_id: uid,
                    household_id: hid, content: content, is_completed: false
                }));
                await window.supabaseClient.from('checklist_items').insert(templateItems);
            }
        }

        window.closeNewChecklistModal();
        window.showToast("Lista utworzona w chmurze ☁️");
        await window.loadTodosAndLists(true);
    };

    window.openChecklistScreen = async function(id, title, type) {
        const alreadyOpen = window.activeView === 'checklist-screen';
        currentChecklistId = normalizeId(id);
        const list = (window.AppStore.get()?.checklists || []).find(item => sameId(item.id, id));
        currentChecklistTitle = list?.title || title;
        currentChecklistType = list?.list_type || type || 'generic';
        await window.switchView('checklist-screen');
        if (alreadyOpen) window.initChecklistUI();
    };

    function renderChecklistRows(items) {
        const icon = name => window.UX?.icon?.(name) || '';
        return items.map(item => `<div class="ux-row group" data-item-id="${window.esc(item.id)}">
            <label class="ux-row-main" style="display:flex;gap:11px;align-items:center">
                <input type="checkbox" class="ux-checkbox js-toggle-checklist-item" data-id="${window.esc(item.id)}" data-status="${Boolean(item.is_completed)}" ${item.is_completed ? 'checked' : ''}>
                <span class="ux-row-title ${item.is_completed ? 'line-through ux-muted' : ''}">${window.esc(item.content)}</span>
            </label>
            <button type="button" class="ux-icon-btn js-delete-checklist-item" data-id="${window.esc(item.id)}" aria-label="Usuń pozycję: ${window.esc(item.content)}" title="Usuń pozycję">${icon('trash')}</button>
        </div>`).join('');
    }

    window.loadChecklistItems = async function(forceRefresh = false) {
        window.renderChecklistFromStore();
        await window.loadDashboardOverview?.(forceRefresh);
        window.renderChecklistFromStore();
    };

    window.renderChecklistFromStore = function() {
        const listEl = document.getElementById('checklist-items-list');
        if (!listEl || !currentChecklistId) return;
        const state = window.AppStore.get() || {};
        const items = (state.checklistItems || [])
            .filter(i => sameId(i.checklist_id, currentChecklistId))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const clearBtn = document.getElementById('checklist-clear-btn');
        if (clearBtn) clearBtn.classList.toggle('hidden', !items.some(i => i.is_completed));
        
        if (items.length === 0) {
            listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Lista jest pusta. Wpisz lub wklej elementy poniżej.</p>`;
            return;
        }

        let html = '';
        
        if (currentChecklistType === 'shopping') {
            const categorized = { 'Pozostałe': [] };
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
                if (!matched) categorized['Pozostałe'].push(item);
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

    };

    // Zapis pozycji na liście (Wklejanie wielowierszowe + Baza Supabase)
    window.addChecklistItems = async function({ checklistId, content }) {
        const list = (window.AppStore.get()?.checklists || []).find(item => sameId(item.id, checklistId) && !item.is_archived);
        if (!list) throw new Error('Nie znaleziono aktywnej listy.');
        const lines = String(content || '').split('\n').map(line => line.trim()).filter(Boolean);
        if (!lines.length) throw new Error('Wpisz przynajmniej jedną pozycję.');
        const hid = getHouseholdId(), uid = getUserId();
        if (!hid || !uid) throw new Error('Zaloguj się ponownie, aby zapisać listę.');
        window.invalidateDashboardCache?.();
        const payload = lines.map(line => ({ checklist_id: list.id, household_id: hid, user_id: uid, content: line, is_completed: false }));
        const { data, error } = await window.supabaseClient.from('checklist_items').insert(payload).select();
        if (error) throw error;
        window.AppStore.set(state => ({ ...state, checklistItems: [...(state.checklistItems || []), ...(data || [])] }));
        window.renderChecklistFromStore(); window.renderTodoUI(); window.UX?.refresh?.();
        return data || [];
    };

    window.saveChecklistItem = async function() {
        const input = document.getElementById('new-checklist-item-input');
        const content = input?.value.trim();
        if (!content || !currentChecklistId || input.disabled) return;
        input.disabled = true;
        try {
            await window.addChecklistItems({ checklistId: currentChecklistId, content });
            input.value = ''; window.showToast('Dodano do listy.'); window.triggerHaptic?.();
        } catch (error) {
            console.error('Checklist save failed:', error); window.showToast('Nie udało się zapisać pozycji. Tekst pozostaje w polu.');
        } finally { input.disabled = false; input.focus(); }
    };

    window.toggleTodo = async function(id, currentStatus) {
        if (!currentStatus && typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const newStatus = !currentStatus;

        window.AppStore.set(state => {
            const updatedTodos = (state.todos || []).map(t => sameId(t.id, id) ? { 
                ...t, 
                is_completed: newStatus,
                completed_at: newStatus ? new Date().toISOString() : null,
                completer_name: newStatus ? getUserName() : null
            } : t);
            return { ...state, todos: updatedTodos };
        });
        
        window.renderTodoUI();

        const { error } = await window.supabaseClient.from('todos').update({ 
            is_completed: newStatus, 
            completed_at: newStatus ? new Date().toISOString() : null, 
            completer_name: newStatus ? getUserName() : null 
        }).eq('id', id);

        if (error) {
            console.error("Supabase toggle error:", error);
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

    window.deleteChecklistItem = function(id) {
        window.customConfirm('Trwale usunąć tę pozycję z listy?', async () => {
            const { error } = await window.supabaseClient.from('checklist_items').delete().eq('id', id).eq('household_id', getHouseholdId());
            if (error) { window.showToast('Nie udało się usunąć pozycji.'); return; }
            window.AppStore.set(state => ({ ...state, checklistItems: (state.checklistItems || []).filter(item => !sameId(item.id, id)) }));
            window.renderChecklistFromStore(); window.invalidateDashboardCache?.();
        });
    };

    window.clearCompletedItems = function() {
        window.customConfirm('Trwale usunąć zaznaczone pozycje z tej listy?', async () => {
            const { error } = await window.supabaseClient.from('checklist_items').delete().eq('checklist_id', currentChecklistId).eq('household_id', getHouseholdId()).eq('is_completed', true);
            if (error) { window.showToast('Nie udało się usunąć wykonanych pozycji.'); return; }
            window.AppStore.set(state => ({ ...state, checklistItems: (state.checklistItems || []).filter(item => !(sameId(item.checklist_id, currentChecklistId) && item.is_completed)) }));
            window.renderChecklistFromStore(); window.invalidateDashboardCache?.();
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
        window.customConfirm('Zarchiwizować tę listę? Pozycje zostaną zachowane.', async () => {
            const { error } = await window.supabaseClient.from('checklists').update({ is_archived: true }).eq('id', id).eq('household_id', getHouseholdId());
            if (error) { window.showToast('Nie udało się zarchiwizować listy.'); return; }
            window.AppStore.set(state => ({ ...state, checklists: (state.checklists || []).map(list => sameId(list.id, id) ? { ...list, is_archived: true } : list) }));
            window.renderTodoUI(); window.invalidateDashboardCache?.();
            window.showToast('Lista zarchiwizowana.');
        });
    };

    // --- DELEGACJA ZDARZEŃ (VIA DISPATCHER) ---
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-task-tab', (event, el) => { activeTodoTab = el.dataset.tab; window.renderTodoUI(); });
        window.EventDispatcher.onClick('.js-task-area', (event, el) => { taskAreaFilter = el.dataset.area; taskRoomFilter = ''; window.renderTodoUI(); });
        window.EventDispatcher.onClick('.js-refresh-todo-view', () => window.loadTodosAndLists(true));
        window.EventDispatcher.onClick('.js-open-new-todo-modal', () => window.openNewTodoModal());
        window.EventDispatcher.onClick('.js-open-new-checklist', () => window.openNewChecklistModal());

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
            if (targetEl) window.archiveChecklist(normalizeId(targetEl.dataset.id));
        });

        window.EventDispatcher.onClick('.js-archive-todo', (e, el) => {
            e.preventDefault();
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.archiveTodo(normalizeId(targetEl.dataset.id));
        });

        window.EventDispatcher.onClick('.js-toggle-todo', (e, el) => {
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isDone = targetEl.dataset.status === 'true';
                window.toggleTodo(normalizeId(targetEl.dataset.id), isDone);
            }
        });

        window.EventDispatcher.onClick('.js-toggle-todo-urgency', (e, el) => {
            e.stopPropagation();
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isUrgent = targetEl.dataset.urgent === 'true';
                window.toggleTodoUrgency(normalizeId(targetEl.dataset.id), isUrgent);
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
            if (targetEl) window.deleteChecklistItem(normalizeId(targetEl.dataset.id), targetEl);
        });

        window.EventDispatcher.onClick('.js-toggle-checklist-item', (e, el) => {
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) {
                const isCompleted = targetEl.dataset.status === 'true';
                window.toggleChecklistItem(normalizeId(targetEl.dataset.id), isCompleted, targetEl);
            }
        });
    } else {
        console.error("EventDispatcher nie jest załadowany!");
    }

    document.addEventListener('keydown', event => {
        if (event.target.id === 'new-checklist-item-input' && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.saveChecklistItem(); }
    });
    document.addEventListener('submit', event => {
        if (event.target.id === 'inline-task-form') { event.preventDefault(); window.saveInlineTodo(); }
    });
    document.addEventListener('change', event => {
        if (event.target.id === 'task-room-filter') { taskRoomFilter = event.target.value; window.renderTodoUI(); }
    });
    return { init: window.initTodoModule, currentTab: () => activeTodoTab };

})();
