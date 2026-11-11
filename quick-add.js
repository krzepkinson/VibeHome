// Kontekstowy zapis: jawny wybór > aktualny ekran > podpowiedź z opisu.
window.QuickAdd = (() => {
    const labels = { task: 'Zadanie', event: 'Wydarzenie', episode: 'Objaw lub choroba', measurement: 'Pomiar', pharmacy: 'Lek lub suplement', 'list-item': 'Pozycja listy' };
    const aliases = { measure: 'measurement', product: 'pharmacy', illness: 'episode', 'health-event': 'event' };
    const months = { stycznia: 0, styczen: 0, lutego: 1, luty: 1, marca: 2, marzec: 2, kwietnia: 3, kwiecien: 3, maja: 4, maj: 4, czerwca: 5, czerwiec: 5, lipca: 6, lipiec: 6, sierpnia: 7, sierpien: 7, wrzesnia: 8, wrzesien: 8, pazdziernika: 9, pazdziernik: 9, listopada: 10, listopad: 10, grudnia: 11, grudzien: 11 };
    const byId = id => document.getElementById(id);
    const esc = value => window.esc(String(value ?? ''));
    const icon = name => window.UX?.icon?.(name) || '';
    const normalize = value => String(value || '').normalize('NFC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
    const day = value => window.TaskModel?.dateInput(value) || (() => { const d = new Date(value); return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    let current = null;
    let waitingForProfile = false;

    function inferType(text) {
        const value = normalize(text);
        if (/\b(kupic|kup|kupie|kupno|zamowic|zamow|zamowie|odebrac|umowic|umow|umowie|zapisac sie|zadzwonic|zadzwon|zarezerwowac|przelozyc|sprawdzic|wymienic)\b/.test(value)) return 'task';
        if (/\b(temperatura|waga|wzrost)\s*[:=-]?\s*\d/.test(value)) return 'measurement';
        if (/\b(apap|ibum|ibuprofen|paracetamol|lek|leki|leku|lekow|suplement\w*|witamin\w*|syrop\w*|tablet\w*|kapsulk\w*)\b/.test(value)) return 'pharmacy';
        if (/\b(katar|kaszel|goraczka|biegunka|infekcja|bol\w*|nudnosci)\b/.test(value)) return 'episode';
        if (/dentyst|lekarz|lekarsk|okulist|wizyta|spotkan|urodzin|szczep|badani|wydarzen|wyjazd|rezerwac|koncert|kino|teatr/.test(value)) return 'event';
        return 'task';
    }

    function parseHints(rawText, kind = 'task', reference = new Date()) {
        const raw = String(rawText || '').normalize('NFC');
        const value = normalize(raw);
        const today = new Date(reference); today.setHours(12, 0, 0, 0);
        const result = { date: '', time: '', repeat: null, ranges: [] };
        const strict = (year, month, date) => {
            const d = new Date(year, month, date, 12);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date ? d : null;
        };
        const mark = (match, field) => { if (match) result.ranges.push({ start: match.index, end: match.index + match[0].length, field }); };
        const unitOf = word => word.startsWith('ty') ? 'week' : word.startsWith('mies') ? 'month' : /^(rok|lat)/.test(word) ? 'year' : 'day';
        const units = '(dni?|dzien|dnia|tygodni|tygodnie|tydzien|tyg|miesiecy|miesiace|miesiac|mies|lat|lata|roku|rok)';
        const repeated = value.match(new RegExp(`\\bco\\s*(?:(\\d+)\\s*)?${units}\\.?(?:\\s+(od\\s+wykonania|wedlug\\s+kalendarza))?(?!\\w)`));
        if (repeated && Number(repeated[1] || 1) > 0) {
            result.repeat = { every: Number(repeated[1] || 1), unit: unitOf(repeated[2]), mode: kind === 'event' || repeated[3]?.startsWith('wedlug') ? 'calendar' : 'completion' };
            mark(repeated, 'repeat');
        } else {
            const half = value.match(/\bco\s+pol\s+roku\b/);
            if (half) { result.repeat = { every: 6, unit: 'month', mode: kind === 'event' ? 'calendar' : 'completion' }; mark(half, 'repeat'); }
        }
        let match = value.match(/\b(?:od\s+)?(pojutrze|jutro|dzisiaj|dzis|wczoraj)\b/);
        let parsed = null;
        if (match) {
            parsed = new Date(today);
            parsed.setDate(parsed.getDate() + ({ pojutrze: 2, jutro: 1, dzisiaj: 0, dzis: 0, wczoraj: -1 })[match[1]]);
        } else {
            match = value.match(new RegExp(`\\b(za|od)\\s+(\\d+)\\s+${units}\\b`));
            if (match) {
                parsed = window.TaskModel?.addRepeat(today, { every: Number(match[2]), unit: unitOf(match[3]), mode: 'completion' });
                if (match[1] === 'od') {
                    const count = Number(match[2]); parsed = new Date(today);
                    const u = unitOf(match[3]);
                    if (u === 'day' || u === 'week') parsed.setDate(parsed.getDate() - count * (u === 'week' ? 7 : 1));
                    else {
                        const originalDay = parsed.getDate(); parsed.setDate(1);
                        if (u === 'month') parsed.setMonth(parsed.getMonth() - count); else parsed.setFullYear(parsed.getFullYear() - count);
                        parsed.setDate(Math.min(originalDay, new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate()));
                    }
                }
            } else {
                match = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
                if (match) parsed = strict(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
                else {
                    match = value.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
                    if (match) {
                        let year = match[3] ? Number(match[3]) : today.getFullYear(); if (year < 100) year += 2000;
                        parsed = strict(year, Number(match[2]) - 1, Number(match[1]));
                        if (parsed && !match[3] && ['task', 'event'].includes(kind) && day(parsed) < day(today)) parsed = strict(year + 1, Number(match[2]) - 1, Number(match[1]));
                    } else {
                        match = value.match(new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(months).join('|')})(?:\\s+(\\d{4}))?\\b`));
                        if (match) {
                            const year = match[3] ? Number(match[3]) : today.getFullYear();
                            parsed = strict(year, months[match[2]], Number(match[1]));
                            if (parsed && !match[3] && ['task', 'event'].includes(kind) && day(parsed) < day(today)) parsed = strict(year + 1, months[match[2]], Number(match[1]));
                        }
                    }
                }
            }
        }
        if (parsed && !isNaN(parsed.getTime())) { result.date = day(parsed); mark(match, 'date'); }
        const time = value.match(/\b(?:(?:o|godz\.?)\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (time && kind === 'event') { result.time = `${time[1].padStart(2, '0')}:${time[2]}`; mark(time, 'time'); }
        return result;
    }

    function cleanName(text, hints, consumed = ['date', 'time', 'repeat']) {
        let value = String(text || '').normalize('NFC');
        for (const range of [...(hints?.ranges || [])].filter(item => consumed.includes(item.field)).sort((a, b) => b.start - a.start)) value = value.slice(0, range.start) + value.slice(range.end);
        return value.replace(/\s{2,}/g, ' ').replace(/^[\s,;–-]+|[\s,;–-]+$/g, '').trim() || String(text || '').trim();
    }

    function inferContext(explicit = {}) {
        const view = window.activeView || 'dashboard';
        let inferred = { type: 'task', area: 'Ogólne', neutral: view === 'dashboard', origin: view };
        if (['todo', 'home', 'checklist-screen'].includes(view)) inferred = { ...inferred, ...(window.getTaskAddContext?.() || {}), neutral: false };
        else if (view === 'calendar') inferred = { ...inferred, ...(window.CalendarModule?.getContext?.() || { type: 'event' }), type: 'event', neutral: false };
        else if (view === 'pharmacy-screen') inferred = { ...inferred, type: 'pharmacy', neutral: false };
        else if (view === 'health' || view === 'health-book-screen') {
            const tab = view === 'health-book-screen' ? 'history' : window.getHealthTab?.() || 'state';
            inferred = { ...inferred, type: ({ state: 'episode', terms: 'event', pharmacy: 'pharmacy', history: 'measurement' })[tab], profileId: window.getCurrentHealthProfileId?.(), area: 'Zdrowie', healthOrigin: true, neutral: false };
        }
        const explicitType = aliases[explicit.type || explicit.kind] || explicit.type || explicit.kind;
        const result = { ...inferred, ...explicit, type: explicitType || inferred.type };
        if (explicitType) result.neutral = false;
        if (result.taskKey) result.type = 'task';
        if (/^(tasks|todos):/.test(result.key || '') || result.type === 'task' && /^health_tasks:/.test(result.key || '')) { result.type = 'task'; result.taskKey ||= result.key; }
        if (result.eventKey || /^(calendar_events|health_tasks):/.test(result.key || '') && result.type === 'event') { result.type = 'event'; result.eventKey ||= result.key; }
        if (result.area === 'Zdrowie' && result.type === 'event') result.profileId ||= window.getCurrentHealthProfileId?.();
        if (['episode', 'measurement'].includes(result.type)) result.profileId ||= window.getCurrentHealthProfileId?.();
        return result;
    }

    function initial(context) {
        const task = context.taskKey ? window.TaskModel?.get(context.taskKey) : null;
        const event = context.eventKey ? window.EventModel?.get(context.eventKey) : null;
        const group = context.pharmacyKey ? window.PharmacyModel?.listGroups().find(item => item.key === context.pharmacyKey) : null;
        const repeat = task?.repeat || event?.repeat || { every: 0, unit: 'month', mode: 'completion' };
        const type = context.type;
        return {
            context, type, taskKey: task?.key || null, eventKey: event?.key || null,
            manualType: Boolean(context.typeChosen || task || event || group), neutralResolved: false, typePicker: false,
            saving: false, scanning: false, open: true, knownGroup: null, package: Boolean(group), edited: new Set(task || event ? ['date', 'time', 'repeat'] : []), hints: null,
            values: {
                name: task?.name || event?.name || group?.name || context.name || context.text || '',
                description: group?.description || task?.description || context.description || '',
                date: task ? day(task.dueAt) : event?.date || context.date || (['episode', 'measurement'].includes(type) ? day(new Date()) : ''),
                time: event?.time || context.time || '', repeatEvery: repeat.every || 0, repeatUnit: repeat.unit || 'month', repeatMode: repeat.mode || (type === 'event' ? 'calendar' : 'completion'),
                area: task?.area || event?.area || (type === 'event' && context.origin !== 'health' && !context.profileId ? 'Ogólne' : context.area) || 'Ogólne',
                room: task?.room || context.room || '', important: task?.important || false,
                profileId: task?.profileId || event?.profileId || context.profileId || '',
                ean: group?.ean || context.ean || '', expiry: '', groupKey: group?.key || null,
                notes: '', measurementType: 'Temperatura', measurementValue: '', content: '', remindDaysBefore: event?.remindDaysBefore || 0
            }
        };
    }

    const input = (id, label, value = '', type = 'text', extra = '') => `<label class="ux-form-field" for="${id}">${label}</label><input class="ux-input" id="${id}" type="${type}" value="${esc(value)}" ${extra}>`;
    const option = (value, label, selected) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;
    const select = (id, label, items, value) => `<label class="ux-form-field" for="${id}">${label}</label><select class="ux-input" id="${id}">${items.map(item => option(item[0], item[1], value)).join('')}</select>`;
    const textArea = (id, label, value = '', placeholder = '') => `<label class="ux-form-field" for="${id}">${label}</label><textarea class="ux-input" id="${id}" rows="3" maxlength="4000" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;

    function profileField(optional = false) {
        const profiles = window.AppStore.get()?.profiles || [];
        return select('quick-add-profile', optional ? 'Osoba (opcjonalnie)' : 'Dla kogo?', [['', optional ? 'Wspólne / bez osoby' : 'Wybierz osobę'], ...profiles.map(profile => [profile.id, profile.name])], current.values.profileId) + `<button type="button" class="ux-btn ghost small js-quick-add-profile">${icon('person')}Dodaj osobę</button>`;
    }

    function repeatFields(event = false) {
        const v = current.values;
        const enabled = Number(v.repeatEvery) > 0;
        const mode = enabled ? event ? 'calendar' : v.repeatMode : 'none';
        return select('quick-add-repeat-mode', 'Powtarzanie', [['none', 'Bez powtarzania'], ...(!event ? [['completion', 'Cykl od wykonania']] : []), ['calendar', 'Według kalendarza']], mode) + `<div id="quick-add-repeat-config" class="${enabled ? '' : 'hidden'}"><div class="ux-grid-2">${input('quick-add-repeat-every', 'Co ile?', enabled ? v.repeatEvery : 1, 'number', 'min="1" max="3650" inputmode="numeric"')}${select('quick-add-repeat-unit', 'Jednostka', [['day','Dni'],['week','Tygodnie'],['month','Miesiące'],['year','Lata']], v.repeatUnit)}</div></div>`;
    }

    function contextText() {
        const v = current.values;
        if (current.type === 'pharmacy') return 'Wspólna apteczka domu';
        if (current.type === 'list-item') return `Lista: ${(window.AppStore.get()?.checklists || []).find(list => String(list.id) === String(current.context.checklistId))?.title || window.getChecklistContext?.()?.title || ''}`;
        if (['episode', 'measurement'].includes(current.type) || current.type === 'event' && v.area === 'Zdrowie') {
            const person = (window.AppStore.get()?.profiles || []).find(profile => String(profile.id) === String(v.profileId));
            return person ? `Dla: ${person.name}` : 'Wpis zdrowotny';
        }
        if (current.type === 'event') return 'Kalendarz';
        return v.area === 'Dom' ? `Dom${v.room ? ` · ${v.room}` : ''}` : v.area === 'Zdrowie' ? 'Zadanie · Zdrowie' : 'Zadania';
    }

    function render() {
        if (!current) return;
        const v = current.values, type = current.type;
        const editing = Boolean(current.taskKey || current.eventKey);
        byId('quick-add-title').textContent = current.package ? 'Dodaj opakowanie' : editing ? `Edytuj ${type === 'event' ? 'wydarzenie' : 'zadanie'}` : ({ task:'Dodaj zadanie', event:'Zaplanuj wydarzenie', episode:'Zapisz objaw lub chorobę', measurement:'Zapisz pomiar', pharmacy:'Dodaj lek lub suplement', 'list-item':'Dodaj do listy' })[type];
        let html = `<p class="ux-row-meta">${icon(type === 'pharmacy' ? 'home' : 'person')} ${esc(contextText())}</p>`;
        if (!editing && type !== 'list-item') {
            if (current.context.healthOrigin || ['episode', 'measurement'].includes(type) || type === 'event' && v.area === 'Zdrowie') html += `<div class="ux-chips" role="group" aria-label="Rodzaj wpisu zdrowotnego">${[['episode','Objaw'],['event','Wizyta'],['measurement','Pomiar'],['pharmacy','Lek']].map(([kind, label]) => `<button type="button" class="ux-chip js-quick-add-kind ${type === kind ? 'active' : ''}" data-kind="${kind}" aria-pressed="${type === kind}">${label}</button>`).join('')}</div>`;
            html += `<div class="ux-actions" style="justify-content:space-between;margin-top:8px"><span class="ux-row-meta">${esc(labels[type])}</span><button type="button" class="ux-btn ghost small js-quick-add-type-picker" aria-expanded="${current.typePicker}">Zmień rodzaj</button></div>`;
            if (current.typePicker) html += select('quick-add-type', 'Rodzaj wpisu', Object.entries(labels).filter(([key]) => key !== 'list-item'), type);
        }
        if (current.knownGroup) {
            const group = current.knownGroup;
            html += `<div class="ux-panel ux-section"><h3>Znaleziono w apteczce</h3><p class="ux-row-title">${esc(group.name)}</p><p class="ux-description">${esc(group.description || '')}</p><p class="ux-row-meta">${group.packages.length} opak. · kod ${esc(group.ean || v.ean)}</p><div class="ux-actions"><button type="button" class="ux-btn js-quick-add-open-product">Otwórz produkt</button><button type="button" class="ux-btn primary js-quick-add-package">Dodaj opakowanie</button></div></div>`;
        } else if (type === 'list-item') {
            html += textArea('quick-add-content', 'Co dodać?', v.content, 'Każda pozycja w osobnym wierszu');
        } else if (type === 'measurement') {
            html += profileField() + select('quick-add-measurement-type', 'Rodzaj pomiaru', [['Temperatura','Temperatura'],['Waga','Waga'],['Wzrost','Wzrost']], v.measurementType);
            html += input('quick-add-measurement-value', `Wartość (${({ Temperatura:'°C', Waga:'kg', Wzrost:'cm' })[v.measurementType]})`, v.measurementValue, 'text', 'inputmode="decimal" autocomplete="off"');
            html += input('quick-add-date', 'Data pomiaru', v.date, 'date', 'required') + textArea('quick-add-notes', 'Notatka (opcjonalnie)', v.notes);
        } else {
            if (type === 'pharmacy') html += `<div class="ux-actions"><button type="button" class="ux-btn js-quick-add-scan">${icon('scan')}Skanuj kod</button><button type="button" class="ux-btn ghost ${current.scanning ? '' : 'hidden'} js-quick-add-stop-scan" id="quick-add-stop-scan">Zatrzymaj aparat</button></div><div id="quick-add-scanner" class="hidden ux-section"></div>`;
            html += input('quick-add-name', type === 'task' ? 'Co trzeba zrobić?' : type === 'event' ? 'Co jest zaplanowane?' : type === 'episode' ? 'Co się dzieje?' : 'Nazwa leku lub suplementu', v.name, 'text', `maxlength="150" autocomplete="off" required ${current.package ? 'readonly' : ''}`);
            html += '<div id="quick-add-recognized" class="ux-chips"></div><div id="quick-add-suggestion"></div>';
            if (type === 'task') {
                html += input('quick-add-date', 'Termin (opcjonalnie)', v.date, 'date');
                const roomNames = (window.AppStore.get()?.rooms || []).map(room => room.name);
                if (v.room && !roomNames.includes(v.room)) roomNames.push(v.room);
                html += `<details class="ux-section" ${v.repeatEvery || editing ? 'open' : ''}><summary>Powtarzanie, obszar i szczegóły</summary>${repeatFields()}${select('quick-add-area', 'Obszar', [['Ogólne','Ogólne'],['Dom','Dom'],['Zdrowie','Zdrowie']], v.area)}${v.area === 'Dom' ? select('quick-add-room', 'Pomieszczenie (opcjonalnie)', [['','Bez pomieszczenia'], ...roomNames.map(name => [name, name])], v.room) : ''}${v.area === 'Zdrowie' ? profileField(true) : ''}<label class="ux-check-label"><input class="ux-checkbox" id="quick-add-important" type="checkbox" ${v.important ? 'checked' : ''}>${icon('flag')}Ważne</label>${textArea('quick-add-task-description', 'Notatka (opcjonalnie)', v.description)}</details>`;
            } else if (type === 'event') {
                html += `<div class="ux-grid-2">${input('quick-add-date', 'Data', v.date, 'date', 'required')}${input('quick-add-time', 'Godzina (opcjonalnie)', v.time, 'time')}</div>`;
                html += select('quick-add-area', 'Obszar', [['Ogólne','Ogólne'],['Zdrowie','Zdrowie']], v.area === 'Dom' ? 'Ogólne' : v.area);
                html += profileField(v.area !== 'Zdrowie');
                html += `<details class="ux-section" ${v.repeatEvery ? 'open' : ''}><summary>Powtarzanie i przypomnienie</summary>${repeatFields(true)}${input('quick-add-remind', 'Przypomnij dni przed terminem', v.remindDaysBefore, 'number', 'min="0" max="365" inputmode="numeric"')}</details>`;
            } else if (type === 'episode') {
                html += profileField() + input('quick-add-date', 'Od kiedy?', v.date, 'date', `required max="${day(new Date())}"`) + textArea('quick-add-notes', 'Obserwacje (opcjonalnie)', v.notes);
                html += '<p class="ux-hint">Zapis rozpoczyna epizod od wybranej daty. Kolejne obserwacje możesz dopisać później.</p>';
            } else if (type === 'pharmacy') {
                html += textArea('quick-add-description', 'Opis / substancja czynna / zastosowanie', v.description, 'Np. Paracetamol — lek przeciwbólowy i przeciwgorączkowy');
                html += `<p class="ux-hint">Opis jest widoczny przy produkcie i uwzględniany w wyszukiwaniu.</p><div class="ux-grid-2">${input('quick-add-ean', 'Kod kreskowy (opcjonalnie)', v.ean, 'text', `inputmode="numeric" maxlength="13" ${current.package ? 'readonly' : ''}`)}${input('quick-add-expiry', 'Ważność opakowania (opcjonalnie)', v.expiry, 'month')}</div>`;
            }
        }
        byId('quick-add-body').innerHTML = html;
        const save = byId('quick-add-save');
        save.textContent = current.package ? 'Dodaj opakowanie' : editing ? 'Zapisz zmiany' : type === 'episode' ? 'Zapisz i rozpocznij' : type === 'pharmacy' ? 'Dodaj do apteczki' : 'Zapisz';
        save.disabled = current.saving || Boolean(current.knownGroup);
        byId('quick-add-actions').classList.toggle('hidden', Boolean(current.knownGroup));
        showError(''); updateHints(false); window.UX?.decorate?.(byId('quick-add-modal'));
    }

    function capture() {
        if (!current) return;
        const ids = { 'quick-add-name':'name', 'quick-add-description':'description', 'quick-add-task-description':'description', 'quick-add-date':'date', 'quick-add-time':'time', 'quick-add-area':'area', 'quick-add-room':'room', 'quick-add-profile':'profileId', 'quick-add-ean':'ean', 'quick-add-expiry':'expiry', 'quick-add-notes':'notes', 'quick-add-measurement-type':'measurementType', 'quick-add-measurement-value':'measurementValue', 'quick-add-content':'content', 'quick-add-remind':'remindDaysBefore' };
        for (const [id, key] of Object.entries(ids)) if (byId(id)) current.values[key] = byId(id).value;
        if (byId('quick-add-important')) current.values.important = byId('quick-add-important').checked;
        const mode = byId('quick-add-repeat-mode')?.value;
        if (mode) {
            current.values.repeatEvery = mode === 'none' ? 0 : Math.min(3650, Math.max(1, parseInt(byId('quick-add-repeat-every')?.value || '1', 10) || 1));
            current.values.repeatMode = mode === 'calendar' ? 'calendar' : 'completion';
            current.values.repeatUnit = byId('quick-add-repeat-unit')?.value || 'month';
        }
    }

    function updateHints(apply = true) {
        if (!current || !['task','event','episode'].includes(current.type) || current.knownGroup) return;
        if (byId('quick-add-name')) current.values.name = byId('quick-add-name').value;
        const hints = parseHints(current.values.name, current.type);
        current.hints = hints;
        const v = current.values;
        if (apply) {
            if (!current.edited.has('date')) {
                if (hints.date) v.date = hints.date;
                else if (hints.repeat && !current.edited.has('repeat') && current.type === 'task') v.date = day(window.TaskModel.addRepeat(new Date(), hints.repeat));
                else if (current.autoDate && current.type === 'task') v.date = current.context.date || '';
                current.autoDate = Boolean(hints.date || hints.repeat);
                if (byId('quick-add-date')) byId('quick-add-date').value = v.date;
            }
            if (current.type === 'event' && !current.edited.has('time')) { v.time = hints.time; if (byId('quick-add-time')) byId('quick-add-time').value = v.time; }
            if (!current.edited.has('repeat') && current.type !== 'episode') {
                v.repeatEvery = hints.repeat?.every || 0;
                v.repeatUnit = hints.repeat?.unit || v.repeatUnit;
                v.repeatMode = current.type === 'event' ? 'calendar' : hints.repeat?.mode || 'completion';
                const mode = byId('quick-add-repeat-mode');
                if (mode) mode.value = v.repeatEvery ? v.repeatMode : 'none';
                byId('quick-add-repeat-config')?.classList.toggle('hidden', !v.repeatEvery);
                if (byId('quick-add-repeat-every')) byId('quick-add-repeat-every').value = v.repeatEvery || 1;
                if (byId('quick-add-repeat-unit')) byId('quick-add-repeat-unit').value = v.repeatUnit;
                if (v.repeatEvery) byId('quick-add-repeat-mode')?.closest('details')?.setAttribute('open', '');
            }
        }
        const recognized = byId('quick-add-recognized');
        if (recognized) recognized.innerHTML = [hints.date && `<span class="ux-tag">${current.type === 'episode' ? 'Początek' : 'Termin'}: ${esc(v.date)}</span>`, hints.time && current.type === 'event' && `<span class="ux-tag">${esc(v.time)}</span>`, hints.repeat && current.type !== 'episode' && `<span class="ux-tag">${esc(window.TaskModel.repeatLabel({every:v.repeatEvery,unit:v.repeatUnit,mode:v.repeatMode}))}</span>`].filter(Boolean).join('');
        const suggestion = inferType(v.name);
        const suggestionEl = byId('quick-add-suggestion');
        if (suggestionEl) suggestionEl.innerHTML = !current.manualType && suggestion !== current.type && v.name.trim() ? `<button type="button" class="ux-btn ghost small js-quick-add-suggest" data-kind="${suggestion}">Zapisz jako: ${esc(labels[suggestion])} ${icon('chevron')}</button>` : '';
    }

    async function setType(kind, manual = true) {
        kind = aliases[kind] || kind;
        if (!labels[kind]) return;
        const draft = current;
        capture(); await stopScan();
        if (current !== draft || !draft.open) return;
        const previous = current.type;
        current.type = kind; current.manualType = manual; current.typePicker = false; current.knownGroup = null; current.package = false;
        current.values.groupKey = null;
        if (kind === 'event' && previous !== 'event') current.values.area = current.context.healthOrigin ? 'Zdrowie' : 'Ogólne';
        if (['episode','measurement'].includes(kind)) { current.values.profileId ||= window.getCurrentHealthProfileId?.() || ''; current.values.date = day(new Date()); }
        if (kind === 'measurement') {
            const match = normalize(current.values.name).match(/\b(temperatura|waga|wzrost)\s*[:=-]?\s*(\d+(?:[,.]\d+)?)/);
            if (match) { current.values.measurementType = ({ temperatura:'Temperatura', waga:'Waga', wzrost:'Wzrost' })[match[1]]; current.values.measurementValue = match[2]; }
        }
        render(); updateHints(true);
    }

    function showError(message) { const error = byId('quick-add-error'); if (error) error.textContent = message; }
    function setSaving(value) {
        if (!current) return;
        current.saving = value;
        byId('quick-add-modal')?.querySelectorAll('button,input,select,textarea').forEach(element => { element.disabled = value; });
        if (byId('quick-add-save')) byId('quick-add-save').textContent = value ? 'Zapisywanie…' : current.package ? 'Dodaj opakowanie' : current.taskKey || current.eventKey ? 'Zapisz zmiany' : current.type === 'episode' ? 'Zapisz i rozpocznij' : 'Zapisz';
    }
    async function stopScan() {
        await window.stopPharmacyBarcodeScan?.();
        if (current) current.scanning = false;
    }
    async function close() {
        if (current?.saving) return;
        if (current) current.open = false;
        await stopScan();
        if (window.UX?.closeDialog) window.UX.closeDialog('quick-add-modal'); else byId('quick-add-modal')?.classList.add('hidden');
    }

    async function startScan() {
        if (!current || current.saving) return;
        const draft = current;
        capture();
        if (current.type !== 'pharmacy') await setType('pharmacy');
        else await stopScan();
        if (current !== draft || !draft.open) return;
        if (current.package) { showError('Kod istniejącego produktu jest już zapisany. Dodaj ważność nowego opakowania.'); return; }
        if (typeof window.startPharmacyBarcodeScan !== 'function') { showError('Skaner nie jest dostępny. Wpisz nazwę i kod ręcznie.'); return; }
        current.scanning = true;
        byId('quick-add-stop-scan')?.classList.remove('hidden');
        const active = current;
        await window.startPharmacyBarcodeScan('quick-add-name', 'quick-add-ean', 'quick-add-scanner', { onResult: ({ ean, group }) => {
            if (current !== active || !current.open) return;
            current.scanning = false; current.values.ean = ean;
            if (group) current.knownGroup = group;
            render();
            if (!group) { showError('Kod odczytany. Uzupełnij nazwę i opis produktu.'); byId('quick-add-name')?.focus(); }
        } });
    }

    async function addProfile() {
        capture();
        if (!current || current.saving) return;
        waitingForProfile = true;
        const draft = current;
        await close();
        const resume = profile => {
            if (current !== draft) return;
            waitingForProfile = false; current.open = true;
            if (profile?.id) current.values.profileId = profile.id;
            render(); window.UX?.openDialog('quick-add-modal');
        };
        window._afterHealthProfileCreated = resume;
        window._afterHealthProfileCancelled = () => resume(null);
        window.openNewProfileModal?.();
    }

    function requireProfile() {
        const profile = (window.AppStore.get()?.profiles || []).find(item => String(item.id) === String(current.values.profileId));
        if (profile) return profile.id;
        return null;
    }

    async function save() {
        if (!current || current.saving || current.knownGroup) return;
        capture(); showError('');
        const v = current.values, type = current.type;
        if (['episode','measurement'].includes(type) || type === 'event' && v.area === 'Zdrowie') {
            if (!requireProfile()) {
                if (!(window.AppStore.get()?.profiles || []).length) { await addProfile(); return; }
                showError('Wybierz osobę dla tego wpisu.'); byId('quick-add-profile')?.focus(); return;
            }
        }
        if (type !== 'measurement' && type !== 'list-item' && !v.name.trim()) { showError('Wpisz krótką nazwę.'); byId('quick-add-name')?.focus(); return; }
        if (['episode','measurement'].includes(type) && v.date > day(new Date())) { showError('Data zapisu zdrowotnego nie może być w przyszłości.'); return; }
        if (type === 'pharmacy' && !v.groupKey && v.ean) {
            const known = window.PharmacyModel.findByEan(v.ean);
            if (known) { current.knownGroup = known; render(); return; }
        }
        setSaving(true);
        try {
            await stopScan();
            const hints = current.hints || parseHints(v.name, type);
            const consumed = type === 'episode' ? ['date'] : type === 'event' ? ['date','time','repeat'] : ['date','repeat'];
            const name = ['task','event','episode'].includes(type) ? cleanName(v.name, hints, consumed) : v.name.trim();
            let result, message, openRecord;
            if (type === 'task') {
                result = await window.TaskModel.save({ name, dueAt: v.date || null, repeat: { every: Number(v.repeatEvery), unit: v.repeatUnit, mode: v.repeatMode }, area: v.area, room: v.room, profileId: v.profileId || null, important: v.important, description: v.description }, { key: current.taskKey });
                message = current.taskKey ? 'Zapisano zmiany zadania.' : 'Dodano zadanie.'; openRecord = () => window.openTaskDetails(result.key);
            } else if (type === 'event') {
                result = await window.EventModel.save({ name, date: v.date, time: v.time, profileId: v.profileId || null, area: v.area, repeat: Number(v.repeatEvery) ? { every: Number(v.repeatEvery), unit: v.repeatUnit, mode: 'calendar' } : null, remindDaysBefore: Number(v.remindDaysBefore) || 0 }, { key: current.eventKey });
                message = current.eventKey ? 'Zapisano zmiany wydarzenia.' : 'Dodano wydarzenie.'; openRecord = () => window.openEventDetails(result.key);
            } else if (type === 'episode') {
                result = await window.HealthEntries.saveEpisode({ name, profileId: v.profileId, startDate: v.date, notes: v.notes });
                message = 'Zapisano objaw i rozpoczęto epizod.'; openRecord = () => window.openHealthEpisode(result.id);
            } else if (type === 'measurement') {
                result = await window.HealthEntries.saveMeasurement({ profileId: v.profileId, type: v.measurementType, value: v.measurementValue, date: v.date, notes: v.notes });
                message = 'Pomiar zapisany w historii osoby.'; openRecord = async () => { await window.switchView('health'); window.selectHealthProfile?.(v.profileId); window.selectHealthTab?.('history'); };
            } else if (type === 'pharmacy') {
                result = await window.PharmacyModel.save({ name, description: v.description, ean: v.ean, expirationDate: v.expiry, groupKey: v.groupKey });
                message = current.package ? 'Dodano opakowanie do produktu.' : 'Dodano produkt do apteczki.';
                const group = window.PharmacyModel.listGroups().find(group => group.packages.some(pack => String(pack.id) === String(result.id)));
                if (group) openRecord = () => window.openPharmacyProduct(group.key);
            } else if (type === 'list-item') {
                result = await window.addChecklistItems({ checklistId: current.context.checklistId, content: v.content });
                message = result.length === 1 ? 'Dodano pozycję do listy.' : `Dodano ${result.length} pozycji do listy.`;
            }
            setSaving(false); waitingForProfile = false; await close();
            window.UX?.refresh?.();
            if (openRecord && window.UX?.actionToast) window.UX.actionToast(message, 'Otwórz', openRecord); else window.showToast(message);
        } catch (error) {
            console.error('Contextual capture failed:', error);
            setSaving(false);
            const message = /^(Wpisz|Wybierz|Nie znaleziono|Taki epizod|Kod |Nie dodano|Uzupełnij|Zaloguj)/.test(error?.message || '') ? error.message : 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.';
            showError(message);
        }
    }

    function open(explicit = {}) {
        if (current?.saving) return;
        const explicitType = explicit.type || explicit.kind;
        if (explicitType === 'room') return window.openNewRoomModal?.();
        if (['person', 'profile'].includes(explicitType)) return window.openNewProfileModal?.();
        if (waitingForProfile && current && !Object.keys(explicit || {}).length) {
            current.open = true; render(); window.UX?.openDialog('quick-add-modal'); return;
        }
        if (window.activeView === 'settings-rooms-screen' && !explicit.type && !explicit.kind) return window.openNewRoomModal?.();
        if (window.activeView === 'settings-profiles-screen' && !explicit.type && !explicit.kind) return window.openNewProfileModal?.();
        const context = inferContext(explicit || {});
        if (context.type === 'list') return window.openNewChecklistModal?.();
        if (!labels[context.type]) context.type = 'task';
        waitingForProfile = false;
        current = initial(context);
        const draft = current;
        byId('health-fab-menu')?.classList.add('hidden');
        window.loadAndShowModal('quick-add-modal', '/modals/quick-add.html', () => {
            if (current !== draft || !draft.open) return;
            render();
            if (current.values.name && !current.taskKey && !current.eventKey) updateHints(true);
            if (context.scan) startScan();
        });
    }

    window.openQuickAddModal = open;
    window.closeQuickAddModal = close;
    window.openListItemComposer = context => open({ ...(context || {}), type: 'list-item' });
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-quick-add', (event, element) => {
            const context = {};
            for (const key of ['type','kind','area','room','profileId','checklistId','pharmacyKey']) if (element.dataset[key]) context[key] = element.dataset[key];
            open(context);
        });
        window.EventDispatcher.onClick('.js-close-quick-add', close);
        window.EventDispatcher.onClick('.js-quick-add-profile', addProfile);
        window.EventDispatcher.onClick('.js-quick-add-kind', (event, element) => setType(element.dataset.kind));
        window.EventDispatcher.onClick('.js-quick-add-suggest', (event, element) => setType(element.dataset.kind));
        window.EventDispatcher.onClick('.js-quick-add-type-picker', () => { capture(); current.typePicker = !current.typePicker; render(); });
        window.EventDispatcher.onClick('.js-quick-add-scan', startScan);
        window.EventDispatcher.onClick('.js-quick-add-stop-scan', async () => { capture(); await stopScan(); render(); });
        window.EventDispatcher.onClick('.js-quick-add-open-product', async () => { const key = current.knownGroup.key; await close(); window.openPharmacyProduct(key); });
        window.EventDispatcher.onClick('.js-quick-add-package', () => {
            const group = current.knownGroup; current.values.name = group.name; current.values.description = group.description; current.values.ean = group.ean || current.values.ean; current.values.groupKey = group.key; current.knownGroup = null; current.package = true; render();
        });
    }
    document.addEventListener('submit', event => { if (event.target.id === 'quick-add-form') { event.preventDefault(); save(); } });
    document.addEventListener('input', event => {
        if (!current?.open || !event.target.closest('#quick-add-modal')) return;
        if (event.target.id === 'quick-add-name') { current.values.name = event.target.value; updateHints(true); }
        else {
            if (event.target.id === 'quick-add-date') current.edited.add('date');
            if (event.target.id === 'quick-add-time') current.edited.add('time');
            if (event.target.id.startsWith('quick-add-repeat')) current.edited.add('repeat');
        }
        showError('');
    });
    document.addEventListener('change', event => {
        if (!current?.open || !event.target.closest('#quick-add-modal')) return;
        const id = event.target.id;
        if (id === 'quick-add-type') { setType(event.target.value); return; }
        if (id === 'quick-add-name' && current.context.neutral && !current.manualType && !current.neutralResolved) {
            const proposed = inferType(event.target.value);
            current.neutralResolved = true;
            if (proposed !== current.type) { setType(proposed, false); return; }
        }
        if (['quick-add-date','quick-add-time'].includes(id)) current.edited.add(id === 'quick-add-date' ? 'date' : 'time');
        if (id.startsWith('quick-add-repeat')) current.edited.add('repeat');
        capture();
        if (['quick-add-area','quick-add-measurement-type'].includes(id)) render();
        if (id === 'quick-add-repeat-mode') {
            byId('quick-add-repeat-config')?.classList.toggle('hidden', event.target.value === 'none');
            if (current.values.repeatEvery && !current.values.date && current.type === 'task') {
                current.values.date = day(window.TaskModel.addRepeat(new Date(), { every: current.values.repeatEvery, unit: current.values.repeatUnit }));
                byId('quick-add-date').value = current.values.date;
            }
        }
    });
    return { open, close, parseHints, inferType, inferContext, cleanName };
})();
