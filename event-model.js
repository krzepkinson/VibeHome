// Wspólny model wydarzeń i wizyt. Stare rekordy zachowują źródło i historię.
window.EventModel = (() => {
    const metaSupport = new Map();
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const esc = value => window.esc ? window.esc(value) : String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const icon = name => window.UX?.icon?.(name) || '';
    const state = () => window.AppStore?.get() || {};
    const dayString = value => {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const timeString = date => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const validDay = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
        const date = new Date(`${value}T12:00:00`);
        return !isNaN(date.getTime()) && dayString(date) === value;
    };
    const parseKey = key => {
        const match = String(key || '').match(/^(calendar_events|health_tasks):(.+)$/);
        return match ? { source: match[1], id: match[2] } : null;
    };
    const keyOf = (source, row) => `${source}:${row.id}`;
    const metaFor = (source, row) => {
        const remote = row.ux_meta;
        if (remote && typeof remote === 'object' && !Array.isArray(remote) && Object.keys(remote).length) return { ...remote };
        return { ...(state().uxEventMeta?.[keyOf(source, row)] || {}) };
    };
    const repeatRule = value => {
        if (!value || !Number(value.every)) return null;
        const every = Math.min(1000, Math.max(1, Number(value.every) || 1));
        return { every, unit: ['day', 'week', 'month', 'year'].includes(value.unit) ? value.unit : 'year', mode: 'calendar' };
    };
    function normalize(source, row) {
        const meta = metaFor(source, row);
        const rawDate = source === 'health_tasks' ? row.event_date : row.event_datetime;
        if (!rawDate) return null;
        const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate)) ? new Date(`${rawDate}T00:00:00`) : new Date(rawDate);
        if (isNaN(dateObj.getTime())) return null;
        const date = validDay(meta.date) ? meta.date : dayString(dateObj);
        const allDay = typeof meta.all_day === 'boolean' ? meta.all_day : /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate)) || timeString(dateObj) === '00:00';
        const time = allDay ? '' : (/^([01]\d|2[0-3]):[0-5]\d$/.test(meta.time || '') ? meta.time : timeString(dateObj));
        const startsAt = new Date(`${date}T${time || '00:00'}:00`).toISOString();
        return {
            key: keyOf(source, row), id: row.id, source,
            name: source === 'health_tasks' ? row.name : row.title,
            area: meta.area === 'Ogólne' ? 'Ogólne' : source === 'health_tasks' || meta.area === 'Zdrowie' ? 'Zdrowie' : 'Ogólne',
            profileId: source === 'health_tasks' ? row.profile_id : meta.profile_id || null,
            date, time, allDay, startsAt, repeat: repeatRule(meta.repeat),
            remindDaysBefore: Number(meta.remind_days_before ?? row.remind_days_before ?? 0),
            cancelled: Boolean(meta.cancelled), archived: Boolean(row.is_archived),
            cancelledAt: meta.cancelled_at || null, raw: row
        };
    }
    let cachedSnapshot = null, cachedEvents = null;
    function baseList() {
        const snapshot = state();
        if (snapshot === cachedSnapshot && cachedEvents) return cachedEvents;
        cachedEvents = [
            ...(state().calendarEvents || []).map(row => normalize('calendar_events', row)),
            ...(state().hTasks || []).filter(row => row.task_type === 'one_time').map(row => normalize('health_tasks', row))
        ].filter(Boolean);
        cachedSnapshot = snapshot;
        return cachedEvents;
    }
    function addRepeat(event, occurrence) {
        const rule = event.repeat;
        const base = new Date(`${event.date}T${event.time || '00:00'}:00`);
        const date = new Date(base);
        if (rule.unit === 'day' || rule.unit === 'week') date.setDate(base.getDate() + occurrence * rule.every * (rule.unit === 'week' ? 7 : 1));
        else {
            const day = base.getDate();
            date.setDate(1);
            if (rule.unit === 'month') date.setMonth(base.getMonth() + occurrence * rule.every);
            else date.setFullYear(base.getFullYear() + occurrence * rule.every);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            date.setDate(Math.min(day, lastDay));
        }
        return { ...event, date: dayString(date), startsAt: date.toISOString(), occurrence, originalStartsAt: event.startsAt };
    }
    function nextOccurrence(event, from = new Date()) {
        if (!event.repeat) return event;
        const boundary = new Date(from); boundary.setHours(0, 0, 0, 0);
        let occurrence = 0;
        if (new Date(event.startsAt) < boundary) {
            const start = new Date(event.startsAt);
            if (event.repeat.unit === 'day' || event.repeat.unit === 'week') {
                const days = Math.floor((boundary - start) / 86400000);
                occurrence = Math.max(0, Math.floor(days / (event.repeat.every * (event.repeat.unit === 'week' ? 7 : 1))) - 1);
            } else if (event.repeat.unit === 'month') {
                occurrence = Math.max(0, Math.floor(((boundary.getFullYear() - start.getFullYear()) * 12 + boundary.getMonth() - start.getMonth()) / event.repeat.every) - 1);
            } else occurrence = Math.max(0, Math.floor((boundary.getFullYear() - start.getFullYear()) / event.repeat.every) - 1);
        }
        let candidate = addRepeat(event, occurrence);
        for (let i = 0; i < 10000 && new Date(candidate.startsAt) < boundary; i++) candidate = addRepeat(event, ++occurrence);
        return candidate;
    }
    function list(options = {}) {
        const today = dayString(new Date());
        let result = baseList().filter(event => options.includeCancelled || (!event.cancelled && !event.archived));
        if (options.includePast === false) result = result.map(event => event.repeat ? nextOccurrence(event) : event).filter(event => event.date >= today);
        return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || String(a.name).localeCompare(String(b.name), 'pl'));
    }
    function occurrences({ rangeStart, rangeEnd, includeCancelled = false } = {}) {
        const start = rangeStart || dayString(new Date());
        const end = rangeEnd || `${Number(start.slice(0, 4)) + 1}${start.slice(4)}`;
        const result = [];
        for (const event of baseList().filter(item => includeCancelled || (!item.cancelled && !item.archived))) {
            if (!event.repeat) { if (event.date >= start && event.date <= end) result.push(event); continue; }
            let candidate = nextOccurrence(event, new Date(`${start}T00:00:00`));
            for (let n = candidate.occurrence || 0, count = 0; candidate.date <= end && count < 1500; n++, count++, candidate = addRepeat(event, n)) result.push(candidate);
        }
        return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    const missingMeta = error => error && (error.code === 'PGRST204' || error.code === '42703') && /ux_meta/i.test([error.message, error.details, error.hint].filter(Boolean).join(' '));
    const collection = source => source === 'health_tasks' ? 'hTasks' : 'calendarEvents';
    function updateStore(source, row, meta, localOnly) {
        const key = keyOf(source, row);
        window.AppStore.set(current => {
            const savedMeta = { ...(current.uxEventMeta || {}) };
            if (localOnly) savedMeta[key] = meta;
            else delete savedMeta[key];
            const rows = current[collection(source)] || [];
            return { ...current, [collection(source)]: rows.some(item => sameId(item.id, row.id)) ? rows.map(item => sameId(item.id, row.id) ? row : item) : [row, ...rows], uxEventMeta: savedMeta };
        });
        window.invalidateDashboardCache?.();
        window.UX?.refresh?.();
        window.CalendarModule?.refresh?.();
    }
    async function persist(source, payload, meta, id) {
        const hid = window.currentUser?.household_id;
        const uid = window.currentUser?.user_id || window.currentUser?.id;
        if (!hid || !uid) throw new Error('Zaloguj się ponownie, aby zapisać wydarzenie.');
        const isCurrentScope = () => sameId(window.currentUser?.household_id, hid) && sameId(window.currentUser?.user_id || window.currentUser?.id, uid);
        const attempt = async withMeta => {
            const body = withMeta ? { ...payload, ux_meta: meta } : payload;
            let query = id != null ? window.supabaseClient.from(source).update(body).eq('id', id).eq('household_id', hid) : window.supabaseClient.from(source).insert([{ ...body, household_id: hid, user_id: uid }]);
            return query.select().single();
        };
        let useMeta = metaSupport.get(source) !== false;
        let result = await attempt(useMeta);
        if (useMeta && missingMeta(result.error)) {
            if (!isCurrentScope()) throw new Error('Konto lub dom zmieniły się podczas zapisu. Otwórz formularz ponownie w wybranym domu.');
            useMeta = false; metaSupport.set(source, false); result = await attempt(false);
        }
        if (result.error) throw result.error;
        if (!result.data) throw new Error('Serwer nie potwierdził zapisu wydarzenia.');
        if (useMeta) metaSupport.set(source, true);
        if (isCurrentScope()) {
            updateStore(source, result.data, meta, !useMeta);
            return normalize(source, result.data);
        }
        // Odpowiedź dotyczy poprzedniego zakresu. Nie zapisuj jej w pamięci
        // nowego domu ani nie odczytuj jego lokalnych metadanych przy normalizacji.
        const remoteMeta = result.data.ux_meta;
        const savedMeta = remoteMeta && typeof remoteMeta === 'object' && Object.keys(remoteMeta).length ? remoteMeta : meta;
        return normalize(source, { ...result.data, ux_meta: savedMeta });
    }
    async function save(input, options = {}) {
        const name = String(input.name || input.title || '').trim();
        if (!name) throw new Error('Wpisz nazwę wydarzenia.');
        if (!validDay(input.date)) throw new Error('Wybierz prawidłową datę wydarzenia.');
        const time = String(input.time || '').trim();
        if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Wybierz prawidłową godzinę.');
        const parsed = parseKey(options.key || input.key);
        const existing = parsed ? baseList().find(item => item.key === `${parsed.source}:${parsed.id}`) : null;
        if (parsed && !existing) throw new Error('Nie znaleziono wydarzenia. Odśwież listę i spróbuj ponownie.');
        const area = input.area === 'Zdrowie' ? 'Zdrowie' : 'Ogólne';
        const profileId = input.profileId || null;
        if (area === 'Zdrowie' && !profileId) throw new Error('Wybierz osobę dla wizyty lub kontroli.');
        const source = existing?.source || (area === 'Zdrowie' && profileId ? 'health_tasks' : 'calendar_events');
        const startsAt = new Date(`${input.date}T${time || '00:00'}:00`).toISOString();
        const remind = Math.min(365, Math.max(0, Number(input.remindDaysBefore) || 0));
        const oldMeta = existing ? metaFor(source, existing.raw) : {};
        const meta = { ...oldMeta, all_day: !time, date: input.date, time, area, profile_id: profileId, repeat: repeatRule(input.repeat), remind_days_before: remind, cancelled: false, cancelled_at: null };
        const payload = source === 'health_tasks'
            ? { name, task_type: 'one_time', profile_id: profileId || existing?.raw.profile_id, event_date: startsAt, next_due_at: startsAt, interval_days: 0, remind_days_before: remind, category: existing?.raw.category || 'Zabieg', show_in_history: true, is_archived: false }
            : { title: name, event_datetime: startsAt };
        return persist(source, payload, meta, existing?.id);
    }
    async function setCancelled(key, cancelled) {
        const event = baseList().find(item => item.key === key);
        if (!event) throw new Error('Nie znaleziono wydarzenia.');
        const meta = { ...metaFor(event.source, event.raw), cancelled, cancelled_at: cancelled ? new Date().toISOString() : null };
        const payload = event.source === 'health_tasks' ? { is_archived: cancelled } : { title: event.name, event_datetime: event.raw.event_datetime };
        return persist(event.source, payload, meta, event.id);
    }
    async function cancel(key) {
        const event = await setCancelled(key, true);
        return { event, undo: () => setCancelled(key, false) };
    }
    function get(key, options = {}) {
        const event = baseList().find(item => item.key === key) || null;
        if (!event || !options.date) return event;
        if (!validDay(options.date)) return null;
        if (!event.repeat) return event.date === options.date ? event : null;
        const occurrence = nextOccurrence(event, new Date(`${options.date}T00:00:00`));
        return occurrence.date === options.date ? occurrence : null;
    }
    function repeatLabel(repeat) {
        if (!repeat) return 'Bez powtarzania';
        const forms = { day: ['dzień', 'dni', 'dni'], week: ['tydzień', 'tygodnie', 'tygodni'], month: ['miesiąc', 'miesiące', 'miesięcy'], year: ['rok', 'lata', 'lat'] }[repeat.unit] || ['rok', 'lata', 'lat'];
        const count = Number(repeat.every) || 1;
        const few = count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14);
        return `Co ${count === 1 ? forms[0] : `${count} ${forms[few ? 1 : 2]}`} według kalendarza`;
    }
    let detailKey = null;
    function closeDetails() { const modal = document.getElementById('event-details-modal'); if (window.UX?.closeDialog) window.UX.closeDialog(modal); else modal?.classList.add('hidden'); detailKey = null; }
    function openDetails(key, context = {}) {
        const event = get(key);
        if (!event) { window.showToast?.('Nie znaleziono wydarzenia. Odśwież dane.'); return; }
        detailKey = key;
        let modal = document.getElementById('event-details-modal');
        if (!modal) { modal = document.createElement('div'); modal.id = 'event-details-modal'; modal.className = 'ux-modal'; document.body.appendChild(modal); }
        const person = (state().profiles || []).find(profile => sameId(profile.id, event.profileId));
        const requestedDate = typeof context === 'string' ? context : context.date;
        const display = (requestedDate ? get(key, { date: requestedDate }) : null) || (event.repeat && event.date < dayString(new Date()) ? nextOccurrence(event) : event);
        const dateLabel = new Date(`${display.date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        modal.setAttribute('aria-labelledby', 'event-details-title');
        modal.innerHTML = `<section class="ux-sheet"><header class="ux-header"><h2 id="event-details-title" class="ux-title">${esc(event.name)}</h2><button type="button" class="ux-icon-btn js-close-event-details" aria-label="Zamknij">${icon('close')}</button></header><p class="ux-muted">${esc(event.area)}${person ? ` · ${esc(person.name)}` : ''}</p><div class="ux-field"><span class="ux-muted">Termin</span><strong>${esc(dateLabel)}${event.allDay ? ' · cały dzień' : ` · ${esc(event.time)}`}</strong></div><div class="ux-field"><span class="ux-muted">Powtarzanie</span><span>${esc(repeatLabel(event.repeat))}</span></div>${event.repeat ? `<p class="ux-muted">Początek cyklu: ${esc(new Date(`${event.date}T12:00:00`).toLocaleDateString('pl-PL'))}. Edycja i odwołanie dotyczą całego cyklu.</p>` : ''}${event.cancelled ? '<p class="ux-warn">Wydarzenie odwołane — wpis pozostaje w historii.</p>' : event.archived ? '<p class="ux-muted">Wpis znajduje się w archiwum.</p>' : event.date < dayString(new Date()) && !event.repeat ? '<p class="ux-muted">Termin minął. Wpis pozostaje w historii; możesz go przenieść lub uzupełnić później.</p>' : ''}<p id="event-detail-error" class="ux-danger" role="alert"></p><div class="ux-actions">${event.cancelled || event.archived ? '<button type="button" class="ux-btn js-restore-event">Przywróć</button>' : `<button type="button" class="ux-btn js-cancel-event">${event.repeat ? 'Odwołaj cykl' : 'Odwołaj'}</button>`}<button type="button" class="ux-btn ux-btn-primary js-edit-event-details">${icon('edit')} ${event.repeat ? 'Edytuj cykl' : 'Edytuj termin'}</button></div></section>`;
        if (window.UX?.openDialog) window.UX.openDialog(modal); else { modal.classList.remove('hidden'); modal.querySelector('.js-close-event-details')?.focus(); }
    }
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-close-event-details', closeDetails);
        window.EventDispatcher.onClick('.js-edit-event-details', () => { const event = get(detailKey); closeDetails(); if (event) window.openQuickAddModal?.({ kind: 'event', key: event.key, profileId: event.profileId, area: event.area, date: event.date }); });
        window.EventDispatcher.onClick('.js-cancel-event', (e, button) => {
            const key = detailKey;
            const perform = async () => {
                button.disabled = true;
                try { const result = await cancel(key); closeDetails(); if (window.UX?.actionToast) window.UX.actionToast('Wydarzenie odwołane', 'Cofnij', result.undo); else window.showToast?.('Wydarzenie odwołane. Wpis pozostaje w historii.'); }
                catch (error) { const target = document.getElementById('event-detail-error'); if (target) target.textContent = error.message || 'Nie udało się odwołać wydarzenia.'; button.disabled = false; }
            };
            const event = get(key);
            if (window.customConfirm) window.customConfirm(event?.repeat ? 'Odwołać cały cykl wydarzeń? Wpis pozostanie w historii.' : 'Odwołać to wydarzenie? Wpis pozostanie w historii.', perform); else perform();
        });
        window.EventDispatcher.onClick('.js-restore-event', async (e, button) => { button.disabled = true; try { const key = detailKey; await setCancelled(key, false); openDetails(key); window.showToast?.('Przywrócono wydarzenie.'); } catch (error) { const target = document.getElementById('event-detail-error'); if (target) target.textContent = error.message; button.disabled = false; } });
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && detailKey && !window.UX?.closeDialog) closeDetails(); });
    window.openEventDetails = openDetails;
    return { list, get, save, cancel, restore: key => setCancelled(key, false), occurrences, nextOccurrence, openDetails, closeDetails, dayString, repeatLabel, _normalize: normalize };
})();
