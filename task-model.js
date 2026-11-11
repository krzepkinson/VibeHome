// Jedna reprezentacja zadania dla listy, Domu, Przeglądu i kalendarza.
// Zachowuje istniejące tabele i historie. ux_meta jest opcjonalnym rozszerzeniem schematu.
window.TaskModel = (() => {
    const collections = { tasks: 'tasks', todos: 'todos', health_tasks: 'hTasks' };
    const metadataAvailable = {};
    const indexedSnapshots = new WeakMap();
    let cachedSnapshot = null, cachedDay = '', cachedItems = [], cachedByKey = new Map();
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const keyFor = (source, id) => `${source}:${id}`;
    const splitKey = key => {
        const value = String(key || '');
        const split = value.indexOf(':');
        return { source: value.slice(0, split), id: value.slice(split + 1) };
    };
    const state = () => window.AppStore.get() || {};
    const user = () => window.currentUser || {};
    const scope = () => ({ householdId: user().household_id, userId: user().user_id || user().id });
    const assertScope = expected => {
        const current = scope();
        if (current.householdId !== expected.householdId || current.userId !== expected.userId) throw new Error('Zaloguj się ponownie. Konto lub dom zmieniły się podczas zapisywania.');
    };

    function date(value) {
        if (!value) return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : new Date(value);
        const text = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            const [year, month, day] = text.split('-').map(Number);
            const result = new Date(year, month - 1, day, 12);
            return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
        }
        const result = new Date(value);
        return isNaN(result.getTime()) ? null : result;
    }

    function dateInput(value) {
        const d = date(value);
        return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
    }

    function repeatValue(value, legacyDays = 0) {
        const unit = ['day', 'week', 'month', 'year'].includes(value?.unit) ? value.unit : 'day';
        const count = value?.every ?? legacyDays;
        return {
            every: Math.min(3650, Math.max(0, parseInt(count, 10) || 0)), unit,
            mode: value?.mode === 'calendar' ? 'calendar' : 'completion'
        };
    }

    function addRepeat(value, repeat, steps = 1) {
        const input = date(value);
        const r = repeatValue(repeat);
        if (!input || !r.every) return input;
        const result = new Date(input);
        const amount = r.every * steps;
        if (r.unit === 'day' || r.unit === 'week') {
            result.setDate(result.getDate() + amount * (r.unit === 'week' ? 7 : 1));
        } else {
            const originalDay = result.getDate();
            result.setDate(1);
            if (r.unit === 'month') result.setMonth(result.getMonth() + amount);
            else result.setFullYear(result.getFullYear() + amount);
            result.setDate(Math.min(originalDay, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
        }
        return result;
    }

    function nextOccurrence(dueAt, repeat, completedAt = new Date()) {
        const r = repeatValue(repeat);
        const completed = date(completedAt);
        if (!r.every || !completed) return null;
        if (r.mode !== 'calendar' || !date(dueAt)) return addRepeat(completed, r);
        const start = date(dueAt);
        let steps = 1;
        let next = addRepeat(start, r, steps);
        const completedDay = dateInput(completed);
        while (dateInput(next) <= completedDay && steps < 10000) next = addRepeat(start, r, ++steps);
        return next;
    }

    const metadata = (source, raw, s = state()) => {
        if (raw.ux_meta && typeof raw.ux_meta === 'object' && !Array.isArray(raw.ux_meta) && Object.keys(raw.ux_meta).length) return raw.ux_meta;
        return s.uxTaskMeta?.[keyFor(source, raw.id)] || {};
    };

    function logIndexes(s) {
        const existing = indexedSnapshots.get(s);
        if (existing) return existing;
        const indexes = { tasks: new Map(), health_tasks: new Map() };
        for (const [source, entries, idField, dateField] of [['tasks', s.logs || [], 'task_id', 'created_at'], ['health_tasks', s.hLogs || [], 'health_task_id', 'start_date']]) {
            const index = indexes[source];
            for (const log of entries) {
                if (log[idField] == null) continue;
                const key = String(log[idField]);
                const current = index.get(key) || { count: 0, lastDate: null, lastTime: -Infinity };
                current.count++;
                const when = new Date(log[dateField]).getTime();
                if (Number.isFinite(when) && when >= current.lastTime) { current.lastDate = log[dateField]; current.lastTime = when; }
                index.set(key, current);
            }
        }
        indexedSnapshots.set(s, indexes);
        return indexes;
    }

    function normalize(source, raw, s = state()) {
        const meta = metadata(source, raw, s);
        const repeat = repeatValue(meta.repeat, source === 'todos' ? 0 : raw.interval_days);
        const related = source === 'todos' ? null : logIndexes(s)[source]?.get(String(raw.id));
        const lastDate = related?.lastDate;
        let due = meta.undated ? null : date(source === 'todos' ? meta.dueAt : raw.next_due_at);
        if (!due && !meta.undated && repeat.every && lastDate) due = addRepeat(lastDate, repeat);
        if (!due && !meta.undated && repeat.every) due = date(raw.created_at);
        const completed = source === 'todos' ? Boolean(raw.is_completed) : !repeat.every && Boolean(related?.count);
        return {
            key: keyFor(source, raw.id), id: raw.id, source,
            name: source === 'todos' ? raw.title : raw.name,
            area: meta.area || (source === 'health_tasks' ? 'Zdrowie' : source === 'tasks' ? 'Dom' : 'Ogólne'),
            room: source === 'tasks' ? (raw.room === 'Inne' ? '' : raw.room ?? meta.room ?? '') : meta.room || '',
            profileId: meta.profileId || raw.profile_id || null,
            dueAt: due ? due.toISOString() : null, repeat, completed,
            important: source === 'todos' ? Boolean(raw.is_urgent) : Boolean(meta.important),
            archived: Boolean(raw.is_archived), raw,
            lastCompletedAt: lastDate || raw.completed_at || null,
            description: meta.description || ''
        };
    }

    function buildCache() {
        const s = state();
        const today = dateInput(new Date());
        if (cachedSnapshot === s && cachedDay === today) return;
        const items = [];
        for (const source of Object.keys(collections)) {
            for (const raw of s[collections[source]] || []) {
                if (source === 'health_tasks' && raw.task_type !== 'cyclical') continue;
                const legacySupplement = source === 'health_tasks' && String(raw.category || '').toLowerCase() === 'suplementacja';
                const item = normalize(source, raw, s);
                if (legacySupplement) item.archived = true;
                items.push(item);
            }
        }
        cachedSnapshot = s; cachedDay = today; cachedItems = items;
        cachedByKey = new Map(items.map(item => [item.key, item]));
    }

    function list({ includeCompleted = false, includeArchived = false } = {}) {
        buildCache();
        return cachedItems.filter(item => (includeCompleted || !item.completed) && (includeArchived || !item.archived));
    }

    const get = key => { buildCache(); return cachedByKey.get(String(key)) || null; };

    function setRaw(source, raw, replacingId = raw.id) {
        const collection = collections[source];
        window.AppStore.set(s => {
            const found = (s[collection] || []).some(item => sameId(item.id, replacingId));
            return { ...s, [collection]: found ? s[collection].map(item => sameId(item.id, replacingId) ? raw : item) : [raw, ...(s[collection] || [])] };
        });
    }

    function localMeta(source, id, meta) {
        window.AppStore.set(s => ({ ...s, uxTaskMeta: { ...(s.uxTaskMeta || {}), [keyFor(source, id)]: meta } }));
    }

    function refresh() {
        if (window.UX?.refresh) window.UX.refresh();
        else if (window.activeView === 'todo') window.renderTodoUI?.();
        else if (window.activeView === 'home') window.renderHomeUI?.();
    }

    const invalidate = () => window.invalidateDashboardCache?.();
    const missingMeta = error => ['PGRST204', '42703'].includes(error?.code) && /ux_meta/i.test(error?.message || error?.details || '');

    async function persist(source, payload, id = null) {
        const activeScope = scope();
        const write = async data => {
            let query = id == null ? window.supabaseClient.from(source).insert([data]) : window.supabaseClient.from(source).update(data).eq('id', id).eq('household_id', activeScope.householdId);
            return query.select().single();
        };
        let record = { ...payload };
        if (metadataAvailable[source] === false) delete record.ux_meta;
        let result = await write(record);
        assertScope(activeScope);
        if (result.error && record.ux_meta && missingMeta(result.error)) {
            metadataAvailable[source] = false;
            delete record.ux_meta;
            result = await write(record);
            assertScope(activeScope);
        } else if (!result.error && record.ux_meta) metadataAvailable[source] = true;
        if (result.error) throw result.error;
        return result.data;
    }

    function ensureUser() {
        if (!user().household_id || !(user().user_id || user().id)) throw new Error('Nie udało się ustalić konta i domu. Zaloguj się ponownie.');
    }

    async function save(input, { key = input.key || input.taskKey } = {}) {
        ensureUser();
        const activeScope = scope();
        const existing = key && get(key);
        const name = String(input.name ?? input.title ?? existing?.name ?? '').trim();
        if (!name) throw new Error('Wpisz nazwę zadania.');
        const repeat = repeatValue(input.repeat ?? existing?.repeat);
        const hasDue = Object.prototype.hasOwnProperty.call(input, 'dueAt') || Object.prototype.hasOwnProperty.call(input, 'date');
        let due = hasDue ? date(input.dueAt ?? input.date) : date(existing?.dueAt);
        if (hasDue && (input.dueAt || input.date) && !due) throw new Error('Wybierz prawidłowy termin.');
        if (!due && repeat.every) due = addRepeat(new Date(), repeat);
        const area = ['Dom', 'Zdrowie', 'Ogólne'].includes(input.area) ? input.area : existing?.area || 'Ogólne';
        const room = area === 'Dom' ? String(input.room ?? existing?.room ?? '') : '';
        const important = input.important ?? existing?.important ?? false;
        const meta = {
            ...metadata(existing?.source, existing?.raw || { id: '' }),
            area, room, important, repeat, undated: !due,
            profileId: input.profileId ?? existing?.profileId ?? null,
            description: String(input.description ?? existing?.description ?? '')
        };
        let source = existing?.source || (!due && !repeat.every && area === 'Ogólne' ? 'todos' : 'tasks');
        const converting = source === 'todos' && Boolean(due || repeat.every || area !== 'Ogólne');
        if (converting) { source = 'tasks'; meta.legacyTodoId = existing.id; }
        const approxDays = repeat.every * ({ day: 1, week: 7, month: 30, year: 365 }[repeat.unit]);
        let payload = source === 'todos' ? {
            title: name, is_urgent: Boolean(important), ux_meta: meta
        } : {
            name, interval_days: approxDays,
            next_due_at: due ? due.toISOString() : null,
            ux_meta: meta
        };
        if (source === 'tasks') {
            payload.room = room || 'Inne';
            if (!due) payload.push_enabled = false;
        }
        if (source === 'health_tasks') payload.profile_id = meta.profileId;
        if (!existing || converting) Object.assign(payload, {
            household_id: user().household_id, user_id: user().user_id || user().id,
            is_archived: false,
            ...(source === 'todos' ? { is_completed: false, creator_name: user().name || 'Domownik' } : { show_in_history: true, remind_days_before: 0 }),
            ...(source === 'tasks' ? { push_enabled: Boolean(due) } : {})
        });
        invalidate();
        const saved = await persist(source, payload, existing && !converting ? existing.id : null);
        if (converting) {
            const result = await window.supabaseClient.from('todos').update({ is_archived: true }).eq('id', existing.id).eq('household_id', activeScope.householdId);
            assertScope(activeScope);
            if (result.error) {
                await window.supabaseClient.from('tasks').delete().eq('id', saved.id).eq('household_id', activeScope.householdId);
                invalidate();
                throw result.error;
            }
            setRaw('todos', { ...existing.raw, is_archived: true });
        }
        invalidate();
        localMeta(source, saved.id, meta);
        setRaw(source, saved);
        refresh();
        return normalize(source, saved);
    }

    async function updateMeta(key, patch, rawPatch = {}) {
        ensureUser();
        const item = get(key);
        if (!item) throw new Error('Nie znaleziono zadania.');
        const meta = { ...metadata(item.source, item.raw), ...patch };
        invalidate();
        const saved = await persist(item.source, { ...rawPatch, ux_meta: meta }, item.id);
        invalidate();
        localMeta(item.source, item.id, meta);
        setRaw(item.source, saved);
        refresh();
        return get(key);
    }

    async function reschedule(key, value) {
        const due = date(value);
        if (!due) throw new Error('Wybierz prawidłowy termin.');
        const item = get(key);
        if (!item) throw new Error('Nie znaleziono zadania.');
        if (item.source === 'todos') return save({ ...item, dueAt: due.toISOString() }, { key });
        return updateMeta(key, { undated: false }, { next_due_at: due.toISOString() });
    }

    async function setImportant(key, value) {
        const item = get(key);
        if (!item) throw new Error('Nie znaleziono zadania.');
        return updateMeta(key, { important: Boolean(value) }, item.source === 'todos' ? { is_urgent: Boolean(value) } : {});
    }

    async function archive(key) {
        const item = get(key);
        if (!item) return;
        ensureUser();
        invalidate();
        const saved = await persist(item.source, { is_archived: true }, item.id);
        invalidate();
        setRaw(item.source, saved);
        refresh();
    }

    async function complete(key, { completedAt = new Date(), notes = '' } = {}) {
        ensureUser();
        const activeScope = scope();
        const item = get(key);
        if (!item) throw new Error('Nie znaleziono zadania.');
        if (item.completed) return { task: item, undo: null };
        const finished = date(completedAt);
        if (!finished) throw new Error('Nieprawidłowa data wykonania.');
        invalidate();
        if (item.source === 'todos') {
            const before = item.raw;
            const saved = await persist('todos', { is_completed: true, completed_at: finished.toISOString(), completer_name: user().name || 'Domownik' }, item.id);
            invalidate();
            setRaw('todos', saved); refresh();
            return { task: get(key), undo: async () => {
                assertScope(activeScope);
                invalidate();
                const restored = await persist('todos', { is_completed: Boolean(before.is_completed), completed_at: before.completed_at || null, completer_name: before.completer_name || null }, item.id);
                invalidate();
                setRaw('todos', restored); refresh();
            } };
        }
        const health = item.source === 'health_tasks';
        const table = health ? 'health_logs' : 'activity_logs';
        const collection = health ? 'hLogs' : 'logs';
        const payload = {
            household_id: user().household_id, user_id: user().user_id || user().id,
            user_name: user().name || 'Domownik', notes: String(notes || ''),
            ...(health ? { health_task_id: item.id, start_date: finished.toISOString(), end_date: finished.toISOString() } : { task_id: item.id, activity_name: item.name, created_at: finished.toISOString() })
        };
        const result = await window.supabaseClient.from(table).insert([payload]).select().single();
        if (result.error) throw result.error;
        try { assertScope(activeScope); }
        catch (error) {
            await window.supabaseClient.from(table).delete().eq('id', result.data.id).eq('household_id', activeScope.householdId);
            throw error;
        }
        const next = nextOccurrence(item.dueAt, item.repeat, finished);
        const completionPatch = next ? { next_due_at: next.toISOString() } : !health ? { push_enabled: false } : null;
        let saved = item.raw;
        if (completionPatch) {
            try { saved = await persist(item.source, completionPatch, item.id); }
            catch (error) {
                await window.supabaseClient.from(table).delete().eq('id', result.data.id).eq('household_id', activeScope.householdId);
                assertScope(activeScope);
                invalidate();
                throw error;
            }
        }
        invalidate();
        window.AppStore.set(s => ({ ...s, [collection]: [result.data, ...(s[collection] || [])] }));
        setRaw(item.source, saved); refresh();
        return { task: get(key), undo: async () => {
            assertScope(activeScope);
            invalidate();
            const deleted = await window.supabaseClient.from(table).delete().eq('id', result.data.id).eq('household_id', user().household_id);
            if (deleted.error) throw deleted.error;
            assertScope(activeScope);
            if (completionPatch) {
                const restore = next ? { next_due_at: item.raw.next_due_at || null } : { push_enabled: Boolean(item.raw.push_enabled) };
                const restored = await persist(item.source, restore, item.id);
                setRaw(item.source, restored);
            }
            invalidate();
            window.AppStore.set(s => ({ ...s, [collection]: (s[collection] || []).filter(log => !sameId(log.id, result.data.id)) }));
            refresh();
        } };
    }

    function repeatLabel(value) {
        const r = repeatValue(value);
        if (!r.every) return 'Bez powtarzania';
        const units = { day: ['dzień', 'dni', 'dni'], week: ['tydzień', 'tygodnie', 'tygodni'], month: ['miesiąc', 'miesiące', 'miesięcy'], year: ['rok', 'lata', 'lat'] };
        const forms = units[r.unit];
        const form = r.every === 1 ? forms[0] : r.every % 10 >= 2 && r.every % 10 <= 4 && !(r.every % 100 >= 12 && r.every % 100 <= 14) ? forms[1] : forms[2];
        return `Co ${r.every === 1 ? '' : `${r.every} `}${form} · ${r.mode === 'calendar' ? 'według kalendarza' : 'od wykonania'}`;
    }

    function dueLabel(item, reference = new Date()) {
        if (item.completed) return 'Wykonano';
        const due = date(item.dueAt);
        if (!due) return 'Bez terminu';
        const a = new Date(due); a.setHours(0, 0, 0, 0);
        const b = date(reference); b.setHours(0, 0, 0, 0);
        const days = Math.round((a - b) / 86400000);
        if (days < 0) return `${Math.abs(days)} dni po terminie`;
        if (days === 0) return 'Termin dziś';
        if (days === 1) return 'Jutro';
        if (days < 7) return `Za ${days} dni`;
        return due.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', ...(due.getFullYear() !== b.getFullYear() ? { year: 'numeric' } : {}) });
    }

    return { list, get, save, complete, reschedule, archive, setImportant, dateInput, date, addRepeat, nextOccurrence, repeatLabel, dueLabel, refresh, normalize, splitKey };
})();
