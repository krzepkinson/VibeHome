// Wspólna agenda terminów. Lokalny stan jest rysowany przed synchronizacją.
window.CalendarModule = (() => {
    let currentTab = 'agenda', kindFilter = 'all', areaFilter = 'all', profileFilter = null, showHistory = false;
    let month = new Date().getMonth(), year = new Date().getFullYear(), selectedDate = day(new Date());
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const esc = value => window.esc ? window.esc(value) : String(value || '');
    const icon = name => window.UX?.icon?.(name) || '';
    const state = () => window.AppStore?.get() || {};
    let cachedState = null, cachedDay = '', cachedBase = null;
    function day(value) {
        const d = value instanceof Date ? value : new Date(value);
        return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function label(date, weekday = false) {
        return new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', { ...(weekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', year: date.slice(0, 4) !== String(new Date().getFullYear()) ? 'numeric' : undefined });
    }
    const personName = id => (state().profiles || []).find(person => sameId(person.id, id))?.name || '';
    function getContext() { return { kind: 'event', date: selectedDate || day(new Date()), profileId: profileFilter, area: areaFilter === 'Zdrowie' || profileFilter ? 'Zdrowie' : 'Ogólne' }; }
    function baseData() {
        const snapshot = state(), today = day(new Date());
        if (snapshot === cachedState && today === cachedDay && cachedBase) return cachedBase;
        const healthTasks = new Map((snapshot.hTasks || []).map(task => [String(task.id), task]));
        const episodes = (snapshot.hLogs || []).map(log => {
            const task = healthTasks.get(String(log.health_task_id));
            if (!task || task.task_type !== 'duration' || String(task.category || '').toLowerCase() === 'suplementacja' || !day(log.start_date)) return null;
            return { key: `health_logs:${log.id}`, id: log.id, kind: 'episode', name: task.name, date: day(log.start_date), time: '', startsAt: log.start_date, endDate: log.end_date ? day(log.end_date) : null, ongoing: !log.end_date, profileId: task.profile_id, area: 'Zdrowie', raw: log };
        }).filter(Boolean);
        const tasks = (window.TaskModel?.list?.({ includeCompleted: false, includeArchived: false }) || []).filter(task => task.dueAt && !task.completed).map(task => ({ ...task, kind: 'task', date: day(task.dueAt), time: '', startsAt: task.dueAt }));
        const lists = (snapshot.checklists || []).filter(list => !list.is_archived && list.start_date).map(list => ({ key: `checklists:${list.id}`, id: list.id, kind: 'list', name: list.title, date: day(list.start_date), time: '', startsAt: `${day(list.start_date)}T12:00:00`, area: 'Ogólne', profileId: null, raw: list }));
        cachedState = snapshot; cachedDay = today; cachedBase = { episodes, tasks, lists };
        return cachedBase;
    }
    const episodes = () => baseData().episodes;
    function matches(entry) {
        if (kindFilter === 'task' && !['task', 'list'].includes(entry.kind)) return false;
        if (kindFilter === 'event' && entry.kind !== 'event') return false;
        if (kindFilter === 'episode' && entry.kind !== 'episode') return false;
        if (areaFilter !== 'all' && entry.area !== areaFilter) return false;
        return !profileFilter || sameId(entry.profileId, profileFilter);
    }
    function entries({ start, end, history = false } = {}) {
        const today = day(new Date()), startDay = start || today, endDay = end || `${new Date().getFullYear() + 1}-12-31`;
        const events = window.EventModel?.occurrences?.({ rangeStart: startDay, rangeEnd: endDay, includeCancelled: history }).map(event => ({ ...event, kind: 'event' })) || [];
        const { tasks, lists } = baseData();
        const unique = new Map();
        [...events, ...tasks, ...lists, ...episodes()].forEach(entry => {
            const inRange = entry.kind === 'episode' ? entry.date <= endDay && (entry.endDate || today) >= startDay : entry.date >= startDay && entry.date <= endDay;
            if (inRange && matches(entry)) unique.set(`${entry.key}:${entry.date}`, entry);
        });
        return [...unique.values()].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)) || String(a.name).localeCompare(String(b.name), 'pl'));
    }
    function meta(entry) {
        const person = personName(entry.profileId);
        if (entry.kind === 'episode') return [person, entry.ongoing ? `Trwa od ${label(entry.date)}` : `${label(entry.date)} – ${label(entry.endDate)}`].filter(Boolean).join(' · ');
        if (entry.kind === 'task') return [entry.area || 'Zadanie', entry.room, person].filter(Boolean).join(' · ');
        if (entry.kind === 'list') return 'Lista · termin przygotowania';
        return [entry.area === 'Zdrowie' ? 'Wizyta / kontrola' : 'Wydarzenie', person, entry.cancelled ? 'Odwołane' : entry.archived ? 'Archiwum' : ''].filter(Boolean).join(' · ');
    }
    function row(entry) {
        const symbol = entry.kind === 'event' ? 'calendar' : entry.kind === 'episode' ? 'activity' : entry.kind === 'list' ? 'list' : entry.important ? 'flag' : entry.area === 'Dom' ? 'home' : 'task';
        const status = entry.kind === 'event' ? entry.allDay ? 'Cały dzień' : entry.time : entry.kind === 'episode' ? entry.ongoing ? 'W toku' : 'Historia' : 'Do zrobienia';
        return `<button type="button" class="ux-row js-cal-entry" data-kind="${entry.kind}" data-key="${esc(entry.key)}" data-date="${entry.date}"${entry.cancelled ? ' style="opacity:.65"' : ''}>${icon(symbol)}<span class="ux-row-main"><span class="ux-row-title">${esc(entry.name)}</span><span class="ux-row-meta">${esc(meta(entry))}</span></span><span class="ux-row-status">${esc(status)}</span></button>`;
    }
    function grouped(items) {
        let previous = '';
        return items.map(entry => {
            let heading = '';
            if (entry.date !== previous) { heading = `<h2 class="ux-section">${entry.date === day(new Date()) ? 'Dzisiaj' : esc(label(entry.date, true))}</h2>`; previous = entry.date; }
            return heading + row(entry);
        }).join('');
    }
    function renderFilters() {
        const kind = document.getElementById('calendar-kind-filter'); if (kind) kind.value = kindFilter;
        const area = document.getElementById('calendar-area-filter'); if (area) area.value = areaFilter;
        const history = document.getElementById('calendar-history-filter'); if (history) history.checked = showHistory;
        const person = document.getElementById('calendar-person-filter');
        if (person) { person.innerHTML = '<option value="">Wszyscy</option>' + (state().profiles || []).map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''); person.value = profileFilter || ''; }
        const active = document.getElementById('calendar-active-filters');
        if (active) {
            const labels = [kindFilter === 'task' ? 'Zadania i listy' : kindFilter === 'event' ? 'Wydarzenia' : kindFilter === 'episode' ? 'Przebieg zdrowia' : '', areaFilter === 'all' ? '' : areaFilter, personName(profileFilter), showHistory ? 'Historia' : ''].filter(Boolean);
            active.innerHTML = labels.length ? `<span class="ux-muted">${esc(labels.join(' · '))}</span><button type="button" class="ux-btn js-cal-clear-filters">${icon('close')} Wyczyść filtry</button>` : '';
        }
    }
    function renderAgenda() {
        const container = document.getElementById('cal-view-agenda'); if (!container) return;
        const today = day(new Date());
        if (showHistory) {
            const history = [...(window.EventModel?.list?.({ includePast: true, includeCancelled: true }) || []).map(entry => ({ ...entry, kind: 'event' })), ...episodes()].filter(entry => (entry.date < today || entry.cancelled || entry.archived) && matches(entry)).sort((a, b) => b.date.localeCompare(a.date));
            container.innerHTML = history.length ? grouped(history) : '<p class="ux-empty">Brak wcześniejszych wpisów dla tych filtrów.</p>';
            return;
        }
        const active = episodes().filter(entry => entry.ongoing && matches(entry));
        const overdue = baseData().tasks.filter(task => task.date < today).filter(matches);
        const future = entries({ start: today }).filter(entry => entry.kind !== 'episode' && !entry.cancelled);
        let html = active.length ? `<h2 class="ux-section">W toku</h2>${active.map(row).join('')}` : '';
        if (overdue.length) html += `<details class="ux-section"><summary>Do nadrobienia · ${overdue.length}</summary>${overdue.map(row).join('')}</details>`;
        html += future.length ? grouped(future) : '<p class="ux-empty">Brak nadchodzących terminów dla tych filtrów.</p>';
        container.innerHTML = html;
    }
    function monthMarkup(m, y, compact = false) {
        const first = (new Date(y, m, 1).getDay() + 6) % 7, count = new Date(y, m + 1, 0).getDate();
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`, end = `${y}-${String(m + 1).padStart(2, '0')}-${count}`;
        const items = entries({ start, end, history: showHistory });
        let html = '<div class="ux-calendar-weekdays">' + ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(d => `<span>${d}</span>`).join('') + '</div><div class="ux-calendar-grid">' + '<span></span>'.repeat(first);
        for (let d = 1; d <= count; d++) {
            const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const onDay = items.filter(entry => entry.kind === 'episode' ? date >= entry.date && date <= (entry.endDate || day(new Date())) : entry.date === date);
            html += `<button type="button" class="${compact ? 'ux-calendar-year-cell' : 'ux-calendar-day'} js-cal-day-details${date === day(new Date()) ? ' is-today' : ''}${date === selectedDate ? ' is-selected' : ''}" data-date="${date}" aria-label="${esc(label(date))}: ${onDay.length} wpisów" aria-pressed="${date === selectedDate}"><span>${d}</span>${onDay.length ? `<span class="ux-calendar-dots" aria-hidden="true">${[...new Set(onDay.map(entry => entry.kind))].slice(0, 3).map(kind => `<i class="kind-${kind}"></i>`).join('')}</span>` : ''}</button>`;
        }
        return html + '</div>';
    }
    function renderMonth() {
        const title = document.getElementById('cal-month-title'); if (title) title.textContent = new Date(year, month, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
        const grid = document.getElementById('cal-month-grid'); if (grid) grid.innerHTML = monthMarkup(month, year);
    }
    function renderYear() {
        const title = document.getElementById('cal-year-title'); if (title) title.textContent = String(year);
        const grid = document.getElementById('cal-year-grid');
        if (grid) grid.innerHTML = Array.from({ length: 12 }, (_, m) => `<section><h3 class="ux-section">${esc(new Date(year, m, 1).toLocaleDateString('pl-PL', { month: 'long' }))}</h3>${monthMarkup(m, year, true)}</section>`).join('');
    }
    function renderDay() {
        const target = document.getElementById('calendar-day-details'); if (!target) return;
        target.classList.toggle('hidden', currentTab === 'agenda'); if (currentTab === 'agenda') return;
        const items = entries({ start: selectedDate, end: selectedDate, history: showHistory });
        target.innerHTML = `<header class="ux-header"><h2 class="ux-section">${esc(label(selectedDate, true))}</h2><button type="button" class="ux-btn js-cal-add-selected">${icon('plus')} Dodaj termin</button></header>${items.length ? items.map(row).join('') : '<p class="ux-muted">Brak wpisów w tym dniu.</p>'}`;
    }
    function refresh() {
        if (!document.getElementById('cal-view-agenda')) return;
        document.querySelectorAll('.js-cal-tab').forEach(button => { const active = button.dataset.tab === currentTab; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
        ['agenda', 'month', 'year'].forEach(tab => document.getElementById(`cal-view-${tab}`)?.classList.toggle('hidden', currentTab !== tab));
        const subtitle = document.getElementById('calendar-subtitle'); if (subtitle) subtitle.textContent = showHistory ? 'Historia terminów i zapisów' : 'Wydarzenia i zadania z terminem';
        renderFilters();
        if (currentTab === 'agenda') renderAgenda(); else if (currentTab === 'month') renderMonth(); else renderYear();
        renderDay();
    }
    async function init(forceRefresh = false) { refresh(); await window.loadDashboardOverview?.(forceRefresh); refresh(); }
    function setFilter(value) {
        kindFilter = 'all'; areaFilter = 'all';
        if (['Zdrowie', 'Dom', 'Ogólne'].includes(value)) areaFilter = value;
        else if (['Wydarzenie', 'event'].includes(value)) kindFilter = 'event';
        else if (['Zadanie', 'task'].includes(value)) kindFilter = 'task';
        refresh();
    }
    function setProfileFilter(id) { profileFilter = id && id !== 'null' ? id : null; refresh(); }
    function openEntry(kind, key, date) {
        if (kind === 'task') return window.openTaskDetails?.(key);
        if (kind === 'event') return window.openEventDetails?.(key, { date });
        if (kind === 'episode') { const id = key.slice('health_logs:'.length); return window.openHealthEpisode ? window.openHealthEpisode(id) : window.openEditHealthLogModal?.(id); }
        const list = (state().checklists || []).find(item => `checklists:${item.id}` === key);
        if (list) window.openChecklistScreen?.(list.id, list.title, list.list_type || 'generic');
    }
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-cal-tab', (e, button) => { currentTab = button.dataset.tab; refresh(); });
        window.EventDispatcher.onClick('.js-cal-change-month', (e, button) => { const selectedDay = Number(selectedDate.slice(8)) || 1; const d = new Date(year, month + Number(button.dataset.offset), 1); month = d.getMonth(); year = d.getFullYear(); selectedDate = day(new Date(year, month, Math.min(selectedDay, new Date(year, month + 1, 0).getDate()))); refresh(); });
        window.EventDispatcher.onClick('.js-cal-change-year', (e, button) => { year += Number(button.dataset.offset); const selectedMonth = Number(selectedDate.slice(5, 7)) - 1; const selectedDay = Number(selectedDate.slice(8)); selectedDate = day(new Date(year, selectedMonth, Math.min(selectedDay, new Date(year, selectedMonth + 1, 0).getDate()))); refresh(); });
        window.EventDispatcher.onClick('.js-cal-day-details', (e, button) => { selectedDate = button.dataset.date; refresh(); document.getElementById('calendar-day-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        window.EventDispatcher.onClick('.js-cal-entry', (e, button) => openEntry(button.dataset.kind, button.dataset.key, button.dataset.date));
        window.EventDispatcher.onClick('.js-cal-add-selected', () => window.openQuickAddModal?.(getContext()));
        window.EventDispatcher.onClick('.js-cal-clear-filters', () => { kindFilter = 'all'; areaFilter = 'all'; profileFilter = null; showHistory = false; refresh(); });
        window.EventDispatcher.onClick('.js-open-calendar-filter', async (e, button) => { setFilter(button.dataset.filter || 'all'); await window.switchView('calendar'); refresh(); });
        window.EventDispatcher.onClick('.js-cal-go-back', () => window.goBack?.());
    }
    document.addEventListener('change', event => {
        if (event.target?.id === 'calendar-kind-filter') kindFilter = event.target.value;
        else if (event.target?.id === 'calendar-area-filter') areaFilter = event.target.value;
        else if (event.target?.id === 'calendar-person-filter') profileFilter = event.target.value || null;
        else if (event.target?.id === 'calendar-history-filter') showHistory = event.target.checked;
        else return;
        refresh();
    });
    return { init, refresh, setFilter, setProfileFilter, getContext, getSelectedDate: () => selectedDate, openEntry, entries };
})();
