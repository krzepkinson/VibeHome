// Przegląd grupuje sprawy według działania i ważności, a dopiero potem daty.
window.Overview = (() => {
    const expanded = new Set();
    const esc = value => window.esc(String(value ?? ''));
    const same = (a, b) => String(a) === String(b);
    let horizon = 30, activeScope = '', backlogArea = 'all';

    function date(value) {
        if (!value) return null;
        const text = String(value);
        const result = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(value);
        return isNaN(result.getTime()) ? null : result;
    }
    function day(value) {
        const result = date(value);
        if (result) result.setHours(0, 0, 0, 0);
        return result;
    }
    const formatDate = (value, reference) => {
        const parsed = date(value);
        return parsed?.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', ...(reference && parsed.getFullYear() !== date(reference)?.getFullYear() ? { year: 'numeric' } : {}) }) || '';
    };
    const orderByDate = (a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || String(a.name || '').localeCompare(String(b.name || ''), 'pl');
    function when(value, reference, time = '') {
        const days = Math.round((day(value) - day(reference)) / 86400000);
        const label = days === 0 ? 'Dziś' : days === 1 ? 'Jutro' : days < 0 ? `${-days} ${days === -1 ? 'dzień' : 'dni'} po terminie` : days < 8 ? `Za ${days} dni` : formatDate(value, reference);
        return label + (time ? ` · ${time}` : '');
    }

    function getSections({ reference = new Date(), days = horizon } = {}) {
        const state = window.AppStore.get(), today = day(reference), tomorrow = new Date(today), until = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        until.setDate(until.getDate() + days);
        const people = new Map((state.profiles || []).map(person => [String(person.id), person.name]));
        const personName = id => people.get(String(id));
        const tasks = (window.TaskModel?.list() || []).map(task => {
            const due = date(task.dueAt);
            return {
                kind: 'task', key: task.key, name: task.name, area: task.area,
                meta: [task.room || task.area, personName(task.profileId)].filter(Boolean).join(' · '),
                status: due ? when(due, today) : 'Bez terminu', late: due && day(due) < today,
                icon: task.important ? 'flag' : task.area === 'Dom' ? 'home' : task.area === 'Zdrowie' ? 'heart' : 'task',
                date: due, important: Boolean(task.important)
            };
        });
        const events = (window.EventModel?.list({ includePast: false }) || []).map(event => ({
            kind: 'event', key: event.key, name: event.name, area: event.area,
            meta: [event.area === 'Zdrowie' ? 'Wizyta / kontrola' : 'Wydarzenie', personName(event.profileId)].filter(Boolean).join(' · '),
            status: when(event.startsAt, today, event.allDay ? '' : event.time), icon: 'calendar',
            date: date(event.startsAt), occurrenceDate: event.date
        })).filter(event => event.date && day(event.date) >= today);
        const listCounts = new Map();
        (state.checklistItems || []).forEach(item => {
            const key = String(item.checklist_id), count = listCounts.get(key) || { total: 0, done: 0 };
            count.total++; if (item.is_completed) count.done++;
            listCounts.set(key, count);
        });
        const lists = (state.checklists || []).filter(list => !list.is_archived && list.list_type === 'packing').flatMap(list => {
            const start = date(list.start_date), count = listCounts.get(String(list.id)) || { total: 0, done: 0 };
            if (!start || day(start) < today || count.total && count.total === count.done) return [];
            return [{ kind: 'list', key: String(list.id), name: list.title, area: 'Listy', meta: `Pakowanie · ${count.done}/${count.total} gotowe`, status: when(start, today), icon: 'list', date: start }];
        });

        const important = tasks.filter(task => task.important).sort(orderByDate);
        const overdue = tasks.filter(task => !task.important && task.late).sort(orderByDate);
        const todayTasks = [...tasks.filter(task => !task.important && task.date && day(task.date).getTime() === today.getTime()), ...lists.filter(list => day(list.date).getTime() === today.getTime())].sort(orderByDate);
        const appointments = events.filter(event => day(event.date) <= tomorrow).sort(orderByDate);
        const future = [
            ...tasks.filter(task => !task.important && task.date && day(task.date) > today),
            ...events.filter(event => day(event.date) > tomorrow),
            ...lists.filter(list => day(list.date) > today)
        ].filter(entry => day(entry.date) <= until).sort(orderByDate);
        const grouped = new Map();
        future.forEach(entry => {
            const area = entry.area || 'Ogólne';
            if (!grouped.has(area)) grouped.set(area, { id: `area-${area}`, name: area, icon: area === 'Dom' ? 'home' : area === 'Zdrowie' ? 'heart' : area === 'Listy' ? 'list' : 'task', entries: [] });
            grouped.get(area).entries.push(entry);
        });
        const undated = tasks.filter(task => !task.important && !task.date).sort(orderByDate);
        const active = (window.HealthEntries?.listEpisodes({ activeOnly: true }) || []).map(episode => ({
            kind: 'episode', key: String(episode.id), name: episode.name,
            meta: [personName(episode.profileId), episode.startDate ? `od ${formatDate(episode.startDate, reference)}` : ''].filter(Boolean).join(' · '), status: 'Trwa', icon: 'activity'
        }));
        return { important, overdue, todayTasks, appointments, future, groups: [...grouped.values()], undated, active };
    }

    function row(entry) {
        return `<button type="button" class="ux-row js-overview-open" data-kind="${entry.kind}" data-key="${esc(entry.key)}" ${entry.occurrenceDate ? `data-date="${esc(entry.occurrenceDate)}"` : ''}>
            ${window.UX.icon(entry.icon)}<span class="ux-row-main"><span class="ux-row-title">${esc(entry.name)}</span><span class="ux-row-meta">${esc(entry.meta)}</span></span><span class="ux-row-end ${entry.late ? 'ux-warn' : ''}">${esc(entry.status)}</span>
        </button>`;
    }
    const heading = (title, count) => `<h2 class="ux-section-title"><span>${title}</span><span>${count}</span></h2>`;
    function section(id, title, entries, limit = Infinity) {
        if (!entries.length) return '';
        const open = expanded.has(id);
        return `<section class="ux-section" data-overview-section="${id}">${heading(title, entries.length)}${(open ? entries : entries.slice(0, limit)).map(row).join('')}${entries.length > limit ? `<button type="button" class="ux-btn ghost small js-overview-more" data-section="${id}" data-overview-control="${id}" aria-expanded="${open}">${open ? 'Zwiń' : `Pokaż pozostałe (${entries.length - limit})`}</button>` : ''}</section>`;
    }
    function group(group, index) {
        const open = expanded.has(group.id), first = group.entries[0], contentId = `overview-group-${index}`;
        return `<section class="ux-overview-group" data-overview-area="${esc(group.name)}"><button type="button" class="ux-overview-group-toggle js-overview-more" data-section="${esc(group.id)}" data-overview-control="${esc(group.id)}" aria-expanded="${open}" aria-controls="${contentId}">
            ${window.UX.icon(group.icon)}<span class="ux-row-main"><span class="ux-row-title">${esc(group.name)} <span class="ux-overview-count">${group.entries.length}</span></span>${!open ? `<span class="ux-row-meta">${esc(first.name)} · ${esc(first.status)}</span>` : ''}</span><span class="ux-overview-caret">${window.UX.icon('chevron-down')}</span>
        </button><div id="${contentId}" class="ux-overview-group-items" ${open ? '' : 'hidden'}>${open ? group.entries.map(row).join('') : ''}</div></section>`;
    }
    function renderBacklog(model) {
        const modal = document.getElementById('overview-backlog-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        const focusedArea = modal.contains(document.activeElement) ? document.activeElement?.dataset.area : null;
        const areas = [...new Set(model.overdue.map(entry => entry.area || 'Ogólne'))];
        if (backlogArea !== 'all' && !areas.includes(backlogArea)) backlogArea = 'all';
        const entries = model.overdue.filter(entry => backlogArea === 'all' || entry.area === backlogArea);
        const controls = areas.length > 1 ? `<div class="ux-chips" role="group" aria-label="Obszar zaległych spraw">${['all', ...areas].map(area => `<button type="button" class="ux-chip js-overview-backlog-filter" data-area="${esc(area)}" aria-pressed="${area === backlogArea}">${esc(area === 'all' ? 'Wszystko' : area)}</button>`).join('')}</div>` : '';
        modal.querySelector('#overview-backlog-content').innerHTML = controls + entries.map(row).join('') + (!entries.length ? '<p class="ux-empty">Nie ma zaległych spraw.</p>' : '');
        const count = modal.querySelector('#overview-backlog-count'); if (count) count.textContent = entries.length;
        window.UX.decorate(modal);
        if (focusedArea) [...modal.querySelectorAll('.js-overview-backlog-filter')].find(button => button.dataset.area === backlogArea)?.focus({ preventScroll: true });
    }
    function openBacklog() {
        let modal = document.getElementById('overview-backlog-modal');
        if (!modal) {
            modal = document.createElement('div'); modal.id = 'overview-backlog-modal'; modal.className = 'ux-modal hidden';
            modal.setAttribute('aria-labelledby', 'overview-backlog-title');
            modal.innerHTML = `<section class="ux-sheet"><header class="ux-header"><h2 class="ux-title" id="overview-backlog-title">Po terminie <span class="ux-overview-count" id="overview-backlog-count"></span></h2><button type="button" class="ux-icon-btn js-close-overview-backlog" aria-label="Zamknij">${window.UX.icon('close')}</button></header><p class="ux-hint">Najstarsze terminy są na początku.</p><div id="overview-backlog-content"></div></section>`;
            document.body.appendChild(modal);
        }
        backlogArea = 'all'; modal.classList.remove('hidden'); renderBacklog(getSections()); window.UX.openDialog(modal);
    }
    function render() {
        const el = document.getElementById('overview-content'); if (!el) return;
        const scope = `${window.currentUser?.user_id || window.currentUser?.id || ''}:${window.currentUser?.household_id || ''}`;
        const scopeChanged = scope !== activeScope;
        if (scopeChanged) { activeScope = scope; expanded.clear(); horizon = 30; backlogArea = 'all'; window.UX.closeDialog('overview-backlog-modal'); }
        const requested = Number((!scopeChanged && document.getElementById('dashboard-horizon')?.value) || horizon);
        horizon = [30, 90, 365].includes(requested) ? requested : 30;
        const control = el.contains(document.activeElement) ? document.activeElement?.dataset.overviewControl : null;
        const model = getSections();
        const top = section('appointments', 'Umówione na dziś i jutro', model.appointments) + section('important', 'Ważne do załatwienia', model.important) + section('today', 'Na dziś', model.todayTasks);
        const overdue = model.overdue.length ? `<section class="ux-section" data-overview-section="overdue">${heading('Po terminie', model.overdue.length)}${model.overdue.slice(0, 3).map(row).join('')}${model.overdue.length > 3 ? `<button type="button" class="ux-btn ghost small js-overview-backlog" data-overview-control="backlog">Pozostałe zaległe (${model.overdue.length - 3}) ${window.UX.icon('chevron')}</button>` : ''}</section>` : '';
        const future = `<section class="ux-section" data-overview-section="future"><div class="ux-overview-future-heading">${heading('Nadchodzące', model.future.length)}<label class="ux-overview-horizon"><span class="sr-only">Horyzont nadchodzących spraw</span><select id="dashboard-horizon" class="ux-profile-select" data-overview-control="horizon" aria-label="Horyzont nadchodzących spraw"><option value="30" ${horizon === 30 ? 'selected' : ''}>30 dni</option><option value="90" ${horizon === 90 ? 'selected' : ''}>90 dni</option><option value="365" ${horizon === 365 ? 'selected' : ''}>Rok</option></select></label></div>${model.groups.map(group).join('') || '<p class="ux-empty">Brak nadchodzących spraw.</p>'}</section>`;
        const undated = model.undated.length ? group({ id: 'undated', name: 'Bez terminu', icon: 'task', entries: model.undated }, model.groups.length) : '';
        el.innerHTML = `${top ? `<div class="ux-overview-top">${top}</div>` : ''}<div class="ux-overview-columns ${model.overdue.length ? '' : 'ux-overview-one-column'}">${overdue ? `<div>${overdue}</div>` : ''}<div class="ux-overview-secondary">${future}${undated}${section('active', 'W toku', model.active, 2)}</div></div>`;
        const summary = document.getElementById('overview-summary');
        if (summary) {
            const n = model.important.length, form = n === 1 ? 'ważna sprawa' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'ważne sprawy' : 'ważnych spraw';
            summary.textContent = `${n} ${form} · ${model.overdue.length} po terminie`;
        }
        window.UX.decorate(el); renderBacklog(model);
        if (control) [...el.querySelectorAll('[data-overview-control]')].find(node => node.dataset.overviewControl === control)?.focus({ preventScroll: true });
    }

    const previous = window.renderDashboardUI;
    window.renderDashboardUI = () => { previous?.(); render(); };
    window.EventDispatcher.onClick('.js-overview-more', (event, button) => { const id = button.dataset.section; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); });
    window.EventDispatcher.onClick('.js-overview-backlog', openBacklog);
    window.EventDispatcher.onClick('.js-close-overview-backlog', () => window.UX.closeDialog('overview-backlog-modal'));
    window.EventDispatcher.onClick('.js-overview-backlog-filter', (event, button) => { backlogArea = button.dataset.area; renderBacklog(getSections()); });
    window.EventDispatcher.onClick('.js-overview-open', (event, button) => {
        const { kind, key, date } = button.dataset;
        if (button.closest('#overview-backlog-modal')) window.UX.closeDialog('overview-backlog-modal');
        if (kind === 'task') window.openTaskDetails(key);
        if (kind === 'event') window.openEventDetails(key, date ? { date } : {});
        if (kind === 'episode') window.openHealthEpisode(key);
        if (kind === 'list') { const list = (window.AppStore.get().checklists || []).find(item => same(item.id, key)); if (list) window.openChecklistScreen(list.id, list.title, list.list_type); }
    });
    document.addEventListener('app:view-changed', () => { if (window.activeView !== 'dashboard') window.UX.closeDialog('overview-backlog-modal'); });
    return { render, getSections };
})();
