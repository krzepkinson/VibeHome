// Lokalne wyszukiwanie całej aplikacji; wspólna synchronizacja uzupełnia pamięć w tle.
window.SearchModule = (() => {
    const HISTORY_PREFIX = 'bento_recent_searches_v2:';
    let generation = 0, timer = null, visible = false, currentQuery = '', rendered = new Map();
    const esc = value => window.esc ? window.esc(value) : String(value || '');
    const icon = name => window.UX?.icon?.(name) || '';
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
    const store = () => window.AppStore?.get() || {};
    const historyKey = () => {
        const user = window.currentUser;
        const id = user?.user_id || user?.id;
        return id ? `${HISTORY_PREFIX}${encodeURIComponent(id)}:${encodeURIComponent(user.household_id || '')}` : null;
    };
    function history() { try { const key = historyKey(); return key ? JSON.parse(localStorage.getItem(key) || '[]') : []; } catch (error) { return []; } }
    function remember(result) {
        const key = historyKey(); if (!key) return;
        try { localStorage.setItem(key, JSON.stringify([{ key: result.key, kind: result.kind }, ...history().filter(item => item.key !== result.key)].slice(0, 5))); } catch (error) {}
    }
    function personName(id) { return (store().profiles || []).find(person => sameId(person.id, id))?.name || ''; }
    function dateLabel(value) { const date = new Date(value); return isNaN(date.getTime()) ? '' : date.toLocaleDateString('pl-PL'); }
    function highlight(value, query) {
        const source = String(value || ''), needle = normalize(query);
        if (!needle) return esc(source);
        let normalized = '', offset = 0;
        const positions = [];
        for (const char of source) {
            const folded = normalize(char);
            for (let i = 0; i < folded.length; i++) positions.push({ start: offset, end: offset + char.length });
            normalized += folded; offset += char.length;
        }
        let result = '', cursor = 0, index = normalized.indexOf(needle);
        while (index >= 0) {
            const start = positions[index]?.start, end = positions[index + needle.length - 1]?.end;
            if (start == null || end == null) break;
            result += esc(source.slice(cursor, start)) + `<mark class="ux-search-mark">${esc(source.slice(start, end))}</mark>`;
            cursor = end;
            index = normalized.indexOf(needle, index + needle.length);
        }
        return result + esc(source.slice(cursor));
    }
    function index() {
        const state = store(), results = [], lists = (state.checklists || []).filter(list => !list.is_archived);
        (window.TaskModel?.list?.({ includeCompleted: true, includeArchived: false }) || []).forEach(task => {
            results.push({ key: task.key, kind: 'task', title: task.name, subtitle: [task.area, task.room, personName(task.profileId), task.completed ? 'Wykonane' : task.dueAt ? dateLabel(task.dueAt) : 'Bez terminu'].filter(Boolean).join(' · '), icon: task.important ? 'flag' : 'task', searchText: [task.name, task.area, task.room, personName(task.profileId)].join(' '), raw: task });
        });
        (window.EventModel?.list?.({ includePast: true, includeCancelled: true }) || []).forEach(event => {
            results.push({ key: event.key, kind: 'event', title: event.name, subtitle: [event.area === 'Zdrowie' ? 'Wizyta / kontrola' : 'Wydarzenie', personName(event.profileId), dateLabel(event.startsAt), event.allDay ? 'Cały dzień' : event.time, event.cancelled ? 'Odwołane' : ''].filter(Boolean).join(' · '), icon: 'calendar', searchText: [event.name, event.area, personName(event.profileId)].join(' '), raw: event });
        });
        const episodeList = window.HealthEntries?.listEpisodes?.() || (state.hLogs || []).map(log => {
            const task = (state.hTasks || []).find(task => sameId(task.id, log.health_task_id));
            return task ? { key: `health_logs:${log.id}`, id: log.id, taskId: task.id, name: task.name, profileId: task.profile_id, startDate: log.start_date, endDate: log.end_date, notes: log.notes, raw: log, task } : null;
        }).filter(Boolean);
        episodeList.forEach(episode => results.push({ key: episode.key || `health_logs:${episode.id}`, kind: 'episode', title: episode.name, subtitle: [personName(episode.profileId), episode.task?.category === 'Suplementacja' ? 'Dawny wpis suplementacji' : episode.endDate ? 'Historia zdrowia' : 'W toku', dateLabel(episode.startDate), episode.notes].filter(Boolean).join(' · '), icon: 'activity', searchText: [episode.name, personName(episode.profileId), episode.notes].join(' '), raw: episode }));
        const loggedHealthTasks = new Set(episodeList.map(episode => String(episode.taskId)));
        (state.hTasks || []).filter(task => !loggedHealthTasks.has(String(task.id)) && (task.task_type === 'duration' || String(task.category || '').toLowerCase() === 'suplementacja')).forEach(task => results.push({ key: `health_record:${task.id}`, kind: 'health-record', title: task.name, subtitle: [personName(task.profile_id), task.category === 'Suplementacja' ? 'Dawny wpis suplementacji' : 'Dawny zapis zdrowotny', task.is_archived ? 'Archiwum' : ''].filter(Boolean).join(' · '), icon: 'history', searchText: [task.name, task.category, personName(task.profile_id)].join(' '), raw: task }));
        (state.hMeasurements || []).forEach(measurement => results.push({ key: `health_measurements:${measurement.id}`, kind: 'measurement', title: `${measurement.measurement_type || measurement.type || 'Pomiar'} · ${measurement.value}`, subtitle: [personName(measurement.profile_id), dateLabel(measurement.created_at), measurement.notes].filter(Boolean).join(' · '), icon: 'thermometer', searchText: [measurement.measurement_type || measurement.type, measurement.value, measurement.notes, personName(measurement.profile_id)].join(' '), raw: measurement }));
        const groups = window.PharmacyModel?.listGroups?.() || (state.pharmacy || []).map(item => ({ key: String(item.id), name: item.name, description: item.purpose || '', ean: item.ean, packages: [item] }));
        groups.forEach(group => results.push({ key: `pharmacy:${group.key}`, kind: 'pharmacy', title: group.name, subtitle: ['Apteczka domu', group.description || '', group.ean || ''].filter(Boolean).join(' · '), icon: 'package', searchText: [group.name, group.description, group.ean, ...(group.packages || []).map(item => item.purpose || '')].join(' '), groupKey: group.key, raw: group }));
        lists.forEach(list => results.push({ key: `checklists:${list.id}`, kind: 'list', title: list.title, subtitle: list.list_type === 'shopping' ? 'Lista zakupów' : list.list_type === 'packing' ? 'Lista do spakowania' : 'Lista', icon: 'list', searchText: list.title, listId: list.id, listType: list.list_type || 'generic', raw: list }));
        (state.checklistItems || []).forEach(item => {
            const parent = lists.find(list => sameId(list.id, item.checklist_id)); if (!parent) return;
            results.push({ key: `checklist_items:${item.id}`, kind: 'list-item', title: item.content, subtitle: `W liście „${parent.title}”${item.is_completed ? ' · Gotowe' : ''}`, icon: 'list', searchText: `${item.content} ${parent.title}`, listId: parent.id, itemId: item.id, parentTitle: parent.title, listType: parent.list_type || 'generic', raw: item });
        });
        return results;
    }
    function search(query) {
        const needle = normalize(query).trim(); if (needle.length < 2) return [];
        return index().filter(result => normalize(result.searchText).includes(needle)).sort((a, b) => Number(normalize(b.title).startsWith(needle)) - Number(normalize(a.title).startsWith(needle)) || a.title.localeCompare(b.title, 'pl')).slice(0, 100);
    }
    function renderRows(results, query = '') {
        return results.map(result => `<button type="button" class="ux-row js-search-result" data-search-key="${esc(result.key)}">${icon(result.icon)}<span class="ux-row-main"><span class="ux-row-title">${highlight(result.title, query)}</span><span class="ux-row-meta">${highlight(result.subtitle, query)}</span></span><span class="ux-row-status">${icon('forward')}</span></button>`).join('');
    }
    function renderResults(results, query, syncing = false) {
        const target = document.getElementById('search-results-list'); if (!target) return;
        rendered = new Map(results.map(result => [result.key, result]));
        target.innerHTML = results.length ? `<p class="ux-muted">${results.length === 100 ? 'Pierwsze 100 wyników' : `${results.length} wyników`}</p>${renderRows(results, query)}` : `<p class="ux-empty">Brak wyników dla „${esc(query)}”.</p><button type="button" class="ux-btn ux-btn-primary js-search-add">${icon('plus')} Dodaj „${esc(query)}”</button>`;
        if (syncing) target.insertAdjacentHTML('beforeend', '<p class="ux-muted" role="status">Uzupełniam zapisane dane…</p>');
    }
    window.renderRecentSearches = function() {
        const target = document.getElementById('search-results-list'); if (!target) return;
        const available = index(), recent = history().map(item => available.find(result => result.key === item.key)).filter(Boolean);
        rendered = new Map(recent.map(result => [result.key, result]));
        target.innerHTML = recent.length ? `<div class="ux-header"><h2 class="ux-section">Ostatnio otwierane</h2><button type="button" class="ux-btn js-clear-search-history">Wyczyść</button></div>${renderRows(recent)}` : '<p class="ux-empty">Wpisz co najmniej 2 znaki.</p><p class="ux-muted">Szukaj nazw, opisów leków i substancji, wydarzeń, osób oraz pozycji na listach.</p>';
    };
    window.clearRecentSearches = function() { try { const key = historyKey(); if (key) localStorage.removeItem(key); } catch (error) {} window.renderRecentSearches(); };
    window.openGlobalSearch = function() {
        const modal = document.getElementById('search-modal'), input = document.getElementById('global-search-input'); if (!modal) return;
        generation++; visible = true; currentQuery = ''; if (input) input.value = '';
        window.renderRecentSearches(); modal.classList.remove('-translate-y-full'); modal.classList.add('translate-y-0');
        if (window.UX?.openDialog) window.UX.openDialog(modal); else modal.classList.remove('hidden');
        setTimeout(() => input?.focus(), 20);
    };
    window.closeGlobalSearch = function() {
        visible = false; generation++; if (timer) clearTimeout(timer);
        document.getElementById('global-search-input')?.blur();
        const modal = document.getElementById('search-modal'); if (modal) { modal.classList.remove('translate-y-0'); modal.classList.add('-translate-y-full'); if (window.UX?.closeDialog) window.UX.closeDialog(modal); else modal.classList.add('hidden'); }
    };
    window.performGlobalSearch = function(query) {
        currentQuery = String(query || '').trim();
        const request = ++generation; if (timer) clearTimeout(timer);
        if (normalize(currentQuery).length < 2) { window.renderRecentSearches(); return; }
        const snapshot = currentQuery, fresh = Date.now() - Number(store().lastSyncedAt || 0) <= (window.CONFIG?.CACHE_TTL || 30000), refresh = !fresh && navigator.onLine && Boolean(window.loadDashboardOverview);
        renderResults(search(snapshot), snapshot, refresh);
        if (refresh) timer = setTimeout(async () => { try { await window.loadDashboardOverview(); } catch (error) {} if (visible && request === generation) renderResults(search(snapshot), snapshot, false); }, 250);
    };
    async function highlightListItem(id) {
        if (id == null) return;
        for (let attempt = 0; attempt < 40; attempt++) {
            const item = [...document.querySelectorAll('.js-toggle-checklist-item[data-id]')].find(element => sameId(element.dataset.id, id));
            if (item) { const row = item.closest('.swipe-front') || item; row.classList.add('ux-search-hit'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => row.classList.remove('ux-search-hit'), 5000); return; }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    function closeSearchDetail() { const modal = document.getElementById('search-record-detail'); if (window.UX?.closeDialog) window.UX.closeDialog(modal); else modal?.classList.add('hidden'); }
    function openRecord(result) {
        let modal = document.getElementById('search-record-detail');
        if (!modal) { modal = document.createElement('div'); modal.id = 'search-record-detail'; modal.className = 'ux-modal'; document.body.appendChild(modal); }
        const item = result.raw;
        const details = result.kind === 'measurement' ? `<p class="ux-row-meta">${esc(personName(item.profile_id))} · ${esc(dateLabel(item.created_at))}</p><p>${esc(item.notes || 'Brak dodatkowej notatki.')}</p><div class="ux-actions"><button type="button" class="ux-btn js-search-edit-record" data-type="measurement" data-id="${esc(item.id)}">${icon('edit')} Edytuj pomiar</button></div>` : `<p class="ux-row-meta">${esc(result.subtitle)}</p><p class="ux-muted">Wpis pozostaje w historii. Nie tworzy przypomnienia o przyjmowaniu leku.</p><div class="ux-actions"><button type="button" class="ux-btn js-search-edit-record" data-type="health-record" data-id="${esc(item.id)}">${icon('edit')} Edytuj zapis</button></div>`;
        modal.innerHTML = `<section class="ux-sheet" role="dialog" aria-modal="true" aria-labelledby="search-record-title"><header class="ux-header"><h2 id="search-record-title" class="ux-title">${esc(result.title)}</h2><button type="button" class="ux-icon-btn js-close-search-record" aria-label="Zamknij">${icon('close')}</button></header>${details}</section>`;
        if (window.UX?.openDialog) window.UX.openDialog(modal); else modal.classList.remove('hidden');
    }
    async function openResult(result) {
        remember(result); window.closeGlobalSearch();
        if (result.kind === 'task') return window.openTaskDetails?.(result.key);
        if (result.kind === 'event') return window.openEventDetails?.(result.key);
        if (result.kind === 'episode') return window.openHealthEpisode?.(result.raw.id);
        if (result.kind === 'pharmacy') return window.openPharmacyProduct?.(result.groupKey);
        if (result.kind === 'measurement') return window.openMeasurementDetails ? window.openMeasurementDetails(result.raw.id) : openRecord(result);
        if (result.kind === 'health-record') return window.openHealthDefinition ? window.openHealthDefinition(result.raw.id) : openRecord(result);
        const parent = result.kind === 'list-item' ? (store().checklists || []).find(list => sameId(list.id, result.listId)) : result.raw;
        if (parent) { await window.openChecklistScreen?.(parent.id, parent.title, parent.list_type || 'generic'); if (result.kind === 'list-item') await highlightListItem(result.itemId); }
    }
    document.addEventListener('input', event => { if (event.target?.id === 'global-search-input') window.performGlobalSearch(event.target.value); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (visible) window.closeGlobalSearch(); closeSearchDetail(); } });
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-search', event => { event.preventDefault(); window.openGlobalSearch(); });
        window.EventDispatcher.onClick('.js-close-global-search', window.closeGlobalSearch);
        window.EventDispatcher.onClick('.js-clear-search-history', window.clearRecentSearches);
        window.EventDispatcher.onClick('.js-search-result', (event, button) => { event.preventDefault(); const result = rendered.get(button.dataset.searchKey); if (result) openResult(result); });
        window.EventDispatcher.onClick('.js-search-add', () => { const text = currentQuery; window.closeGlobalSearch(); window.openQuickAddModal?.({ text }); });
        window.EventDispatcher.onClick('.js-close-search-record', closeSearchDetail);
        window.EventDispatcher.onClick('.js-search-edit-record', (event, button) => { closeSearchDetail(); if (button.dataset.type === 'measurement') window.openEditHealthBookItem?.(button.dataset.id, 'measurement'); else window.openHealthSettingsScreen?.(button.dataset.id); });
    }
    return { search, index, highlight, openResult };
})();
