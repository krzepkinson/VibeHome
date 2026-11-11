// Wspólne, krótkie dodawanie spraw niezależnie od miejsca w aplikacji.
window.QuickAdd = (() => {
    const typeLabels = {
        task: 'zadanie',
        event: 'wydarzenie',
        pharmacy: 'produkt do apteczki'
    };
    const monthNames = {
        stycznia: 0, styczen: 0,
        lutego: 1, luty: 1,
        marca: 2, marzec: 2,
        kwietnia: 3, kwiecien: 3,
        maja: 4, maj: 4,
        czerwca: 5, czerwiec: 5,
        lipca: 6, lipiec: 6,
        sierpnia: 7, sierpien: 7,
        wrzesnia: 8, wrzesien: 8,
        pazdziernika: 9, pazdziernik: 9,
        listopada: 10, listopad: 10,
        grudnia: 11, grudzien: 11
    };

    let currentType = 'task';
    let manualType = false;
    let detailsOpen = false;
    let dateEdited = false;
    let intervalEdited = false;
    let isSaving = false;

    const byId = id => document.getElementById(id);
    const normalize = text => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    function inferType(text) {
        const value = normalize(text);
        if (/\b(apteczk|suplement\w*|witamin\w*|syrop\w*|tablet\w*|kapsulk\w*|lek(?:i|u|ow)?|ibuprofen|paracetamol|apap|ibum)\b/.test(value)) return 'pharmacy';
        if (/dentyst|lekarz|lekarsk|wizyta|spotkan|urodzin|szczep|badani|wydarzen|wyjazd|rezerwac|koncert|kino|teatr|wycieczk/.test(value)) return 'event';
        return 'task';
    }

    function parseDate(text) {
        const value = normalize(text);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (/\bpojutrze\b/.test(value)) {
            const date = new Date(today);
            date.setDate(date.getDate() + 2);
            return date;
        }
        if (/\bjutro\b/.test(value)) {
            const date = new Date(today);
            date.setDate(date.getDate() + 1);
            return date;
        }
        if (/\bdzis(?:iaj)?\b/.test(value)) return today;

        const relative = value.match(/\bza\s+(\d+)\s+(dni?|dzien|dnia|tygodni|tygodnie|tydzien|miesiecy|miesiac|miesiace|lat|lata|rok)\b/);
        if (relative) {
            const date = new Date(today);
            const amount = Number(relative[1]);
            const unit = relative[2];
            if (unit.startsWith('d')) date.setDate(date.getDate() + amount);
            else if (unit.startsWith('ty')) date.setDate(date.getDate() + amount * 7);
            else {
                const day = date.getDate();
                const isMonth = unit.startsWith('mies');
                date.setDate(1);
                if (isMonth) date.setMonth(date.getMonth() + amount);
                else date.setFullYear(date.getFullYear() + amount);
                const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                date.setDate(Math.min(day, lastDay));
            }
            return date;
        }

        const isoDate = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
        if (isoDate) {
            const year = Number(isoDate[1]);
            const month = Number(isoDate[2]) - 1;
            const day = Number(isoDate[3]);
            const date = new Date(year, month, day);
            if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
            return date;
        }

        const numericDate = value.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
        if (numericDate) {
            const day = Number(numericDate[1]);
            const month = Number(numericDate[2]) - 1;
            let year = numericDate[3] ? Number(numericDate[3]) : today.getFullYear();
            if (year < 100) year += 2000;
            const date = new Date(year, month, day);
            if (date.getMonth() !== month || date.getDate() !== day) return null;
            if (!numericDate[3] && date < today) date.setFullYear(year + 1);
            return date;
        }

        const namedDate = value.match(/\b(\d{1,2})\s+(stycznia|styczen|lutego|luty|marca|marzec|kwietnia|kwiecien|maja|maj|czerwca|czerwiec|lipca|lipiec|sierpnia|sierpien|wrzesnia|wrzesien|pazdziernika|pazdziernik|listopada|listopad|grudnia|grudzien)(?:\s+(\d{4}))?\b/);
        if (namedDate) {
            const day = Number(namedDate[1]);
            const month = monthNames[namedDate[2]];
            let year = namedDate[3] ? Number(namedDate[3]) : today.getFullYear();
            const date = new Date(year, month, day);
            if (date.getMonth() !== month || date.getDate() !== day) return null;
            if (!namedDate[3] && date < today) date.setFullYear(year + 1);
            return date;
        }
        return null;
    }

    function parseIntervalDays(text) {
        const match = normalize(text).match(/\bco\s+(\d+)\s+(dni?|dzien|dnia|tygodni|tygodnie|tydzien|miesiecy|miesiace|miesiac|lat|lata|rok)\b/);
        if (!match) return '';
        const amount = Number(match[1]);
        const unit = match[2];
        if (unit.startsWith('d')) return amount;
        if (unit.startsWith('ty')) return amount * 7;
        if (unit.startsWith('mies')) return amount * 30;
        return amount * 365;
    }

    function cleanTitle(text) {
        const relativeUnits = '(?:dni?|dzien|dzień|dnia|tygodni|tygodnie|tydzien|tydzień|miesiecy|miesięcy|miesiace|miesiące|miesiac|miesiąc|lat|lata|rok)';
        const monthNames = '(?:stycznia|styczen|styczeń|lutego|luty|marca|marzec|kwietnia|kwiecien|kwiecień|maja|maj|czerwca|czerwiec|lipca|lipiec|sierpnia|sierpien|sierpień|wrzesnia|września|wrzesien|wrzesień|pazdziernika|października|pazdziernik|październik|listopada|listopad|grudnia|grudzien|grudzień)';
        return String(text || '')
            .replace(new RegExp(`\\bza\\s+\\d+\\s+${relativeUnits}\\b`, 'ig'), '')
            .replace(new RegExp(`\\bco\\s+\\d+\\s+${relativeUnits}\\b`, 'ig'), '')
            .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, '')
            .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, '')
            .replace(new RegExp(`\\b\\d{1,2}\\s+${monthNames}(?:\\s+\\d{4})?\\b`, 'ig'), '')
            .replace(/\b(?:dziś|dzisiaj|jutro|pojutrze)\b/ig, '')
            .replace(/\b(?:godz(?:ina)?\s*)?\d{1,2}:\d{2}\b/ig, '')
            .replace(/[,.–-]+\s*$/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function toDateInput(date) {
        if (!date || isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function toDateTimeInput(date, text) {
        if (!date || isNaN(date.getTime())) return '';
        const match = normalize(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        const hour = match ? Number(match[1]) : 9;
        const minute = match ? Number(match[2]) : 0;
        const value = new Date(date);
        value.setHours(hour, minute, 0, 0);
        const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }

    function showError(message) {
        const error = byId('quick-add-error');
        if (!error) return;
        error.textContent = message;
        error.classList.toggle('hidden', !message);
    }

    function setType(type, { manual = false, parsedDate = null, text = '' } = {}) {
        currentType = ['task', 'event', 'pharmacy'].includes(type) ? type : 'task';
        manualType = manual;

        const description = byId('quick-add-description');
        const typeRow = byId('quick-add-kind-row');
        const typeLabel = byId('quick-add-kind-label');
        const typeSelect = byId('quick-add-type');
        const taskFields = byId('quick-add-task-fields');
        const taskDetails = byId('quick-add-task-details');
        const eventFields = byId('quick-add-event-fields');
        const pharmacyFields = byId('quick-add-pharmacy-fields');
        const hint = byId('quick-add-hint');
        const save = document.querySelector('.js-save-quick-add');

        if (description) {
            description.placeholder = currentType === 'pharmacy' ? 'Nazwa leku lub suplementu' : 'np. wymienić filtr za 6 miesięcy';
        }
        if (typeRow) {
            typeRow.classList.toggle('hidden', !String(text || description?.value || '').trim());
            typeRow.classList.toggle('flex', !typeRow.classList.contains('hidden'));
        }
        if (typeLabel) typeLabel.textContent = `Proponuję: ${typeLabels[currentType]}`;
        if (typeSelect) {
            typeSelect.value = currentType;
            typeSelect.classList.toggle('hidden', !manual);
        }
        if (taskFields) taskFields.classList.toggle('hidden', currentType !== 'task');
        if (taskDetails) taskDetails.classList.toggle('hidden', currentType !== 'task' || !detailsOpen);
        if (eventFields) eventFields.classList.toggle('hidden', currentType !== 'event');
        if (pharmacyFields) pharmacyFields.classList.toggle('hidden', currentType !== 'pharmacy');
        if (hint) {
            const messages = {
                task: 'Termin i powtarzalność są opcjonalne.',
                event: 'Wpis trafi do kalendarza. Jeśli opis nie zawiera terminu, wybierz go poniżej.',
                pharmacy: 'Produkt trafi do apteczki. Możesz zapisać kod i termin ważności.'
            };
            hint.textContent = messages[currentType];
            hint.classList.toggle('hidden', !String(text || description?.value || '').trim() && currentType !== 'pharmacy');
        }
        if (save) {
            save.textContent = currentType === 'event' ? 'Dodaj wydarzenie' : currentType === 'pharmacy' ? 'Dodaj do apteczki' : 'Dodaj zadanie';
            save.disabled = !String(description?.value || '').trim() || isSaving;
        }

        if (parsedDate && !dateEdited) {
            if (currentType === 'event') {
                const field = byId('quick-add-event-datetime');
                if (field) field.value = toDateTimeInput(parsedDate, text || description?.value || '');
            } else if (currentType === 'task') {
                const field = byId('quick-add-task-date');
                if (field) field.value = toDateInput(parsedDate);
                detailsOpen = true;
                if (taskDetails) taskDetails.classList.remove('hidden');
                const detailsButton = document.querySelector('.js-toggle-quick-add-details');
                detailsButton?.setAttribute('aria-expanded', 'true');
                const chevron = byId('quick-add-details-chevron');
                if (chevron) chevron.textContent = '−';
            }
        }
    }

    function updateFromText() {
        const description = byId('quick-add-description');
        if (!description) return;
        const text = description.value.trim();
        showError('');
        if (!manualType && text) currentType = inferType(text);
        const detectedDate = parseDate(text);
        const interval = parseIntervalDays(text);
        if (!dateEdited) {
            const taskDate = byId('quick-add-task-date');
            const eventDate = byId('quick-add-event-datetime');
            if (taskDate) taskDate.value = '';
            if (eventDate) eventDate.value = '';
        }
        if (!intervalEdited) {
            const field = byId('quick-add-task-interval');
            if (field) field.value = interval ? String(interval) : '';
        }
        if (interval && !manualType && currentType === 'task') {
            detailsOpen = true;
        }
        if (detectedDate && currentType === 'task' && !dateEdited) detailsOpen = true;
        setType(currentType, { manual: manualType, parsedDate: detectedDate, text });
    }

    function resetForm() {
        currentType = 'task';
        manualType = false;
        detailsOpen = false;
        dateEdited = false;
        intervalEdited = false;
        isSaving = false;
        const form = byId('quick-add-form');
        form?.reset();
        if (byId('quick-add-task-details')) byId('quick-add-task-details').classList.add('hidden');
        if (byId('quick-add-details-chevron')) byId('quick-add-details-chevron').textContent = '＋';
        document.querySelector('.js-toggle-quick-add-details')?.setAttribute('aria-expanded', 'false');
        showError('');
        setType('task', { text: '' });
        if (typeof window.populateRoomsDropdown === 'function') window.populateRoomsDropdown('quick-add-room');
        setTimeout(() => byId('quick-add-description')?.focus(), 40);
    }

    window.openQuickAddModal = function() {
        document.getElementById('health-fab-menu')?.classList.add('hidden');
        window.loadAndShowModal('quick-add-modal', '/modals/quick-add.html', resetForm);
    };

    window.closeQuickAddModal = async function() {
        await window.stopPharmacyBarcodeScan?.();
        byId('quick-add-modal')?.classList.add('hidden');
    };

    function setSaving(value) {
        isSaving = value;
        const button = document.querySelector('.js-save-quick-add');
        if (button) {
            button.disabled = value || !String(byId('quick-add-description')?.value || '').trim();
            button.textContent = value ? 'Zapisywanie…' : currentType === 'event' ? 'Dodaj wydarzenie' : currentType === 'pharmacy' ? 'Dodaj do apteczki' : 'Dodaj zadanie';
        }
    }

    function monthToSqlDate(value) {
        if (!value) return null;
        const [year, month] = value.split('-').map(Number);
        if (!year || !month) return null;
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    async function save() {
        if (isSaving) return;
        const rawTitle = byId('quick-add-description')?.value.trim() || '';
        if (!rawTitle) {
            showError('Wpisz krótką nazwę.');
            byId('quick-add-description')?.focus();
            return;
        }

        if (!window.currentUser?.household_id || !window.currentUser?.user_id) {
            showError('Nie udało się ustalić gospodarstwa domowego. Zaloguj się ponownie.');
            return;
        }

        const title = currentType === 'pharmacy' ? rawTitle : (cleanTitle(rawTitle) || rawTitle);

        if (currentType === 'event' && !byId('quick-add-event-datetime')?.value) {
            showError('Dodaj datę wydarzenia.');
            byId('quick-add-event-datetime')?.focus();
            return;
        }

        const ean = byId('quick-add-ean')?.value.trim() || null;
        if (currentType === 'pharmacy' && ean && !/^(?:\d{8}|\d{12}|\d{13})$/.test(ean)) {
            showError('Kod EAN powinien mieć 8, 12 lub 13 cyfr.');
            byId('quick-add-ean')?.focus();
            return;
        }

        setSaving(true);
        showError('');
        let savedTaskAsRoutine = false;
        try {
            await window.stopPharmacyBarcodeScan?.();
            if (currentType === 'task') {
                const interval = Math.min(3650, Math.max(0, parseInt(byId('quick-add-task-interval')?.value || '0', 10) || 0));
                const dueInput = byId('quick-add-task-date')?.value;
                savedTaskAsRoutine = Boolean(interval || dueInput);
                if (interval || dueInput) {
                    const dueDate = dueInput ? new Date(`${dueInput}T12:00:00`) : new Date();
                    const payload = {
                        name: title,
                        interval_days: interval,
                        remind_days_before: 0,
                        push_enabled: true,
                        show_in_history: true,
                        room: byId('quick-add-room')?.value || 'Inne',
                        user_id: window.currentUser.user_id,
                        household_id: window.currentUser.household_id,
                        next_due_at: dueDate.toISOString(),
                        is_archived: false
                    };
                    const { data, error } = await window.supabaseClient.from('tasks').insert([payload]).select().single();
                    if (error) throw error;
                    window.AppStore.set(state => ({ ...state, tasks: [data, ...(state.tasks || [])] }));
                } else {
                    const payload = {
                        title,
                        user_id: window.currentUser.user_id,
                        household_id: window.currentUser.household_id,
                        is_completed: false,
                        is_archived: false,
                        is_urgent: false,
                        creator_name: window.currentUser.name || 'Domownik'
                    };
                    const { data, error } = await window.supabaseClient.from('todos').insert([payload]).select().single();
                    if (error) throw error;
                    window.AppStore.set(state => ({ ...state, todos: [data, ...(state.todos || [])] }));
                }
            } else if (currentType === 'event') {
                const eventDate = new Date(byId('quick-add-event-datetime').value);
                if (isNaN(eventDate.getTime())) throw new Error('Wybierz prawidłową datę wydarzenia.');
                const payload = {
                    title,
                    event_datetime: eventDate.toISOString(),
                    household_id: window.currentUser.household_id,
                    user_id: window.currentUser.user_id
                };
                const { data, error } = await window.supabaseClient.from('calendar_events').insert([payload]).select().single();
                if (error) throw error;
                window.AppStore.set(state => ({ ...state, calendarEvents: [data, ...(state.calendarEvents || [])] }));
            } else {
                const payload = {
                    household_id: window.currentUser.household_id,
                    user_id: window.currentUser.user_id,
                    name: title,
                    expiration_date: monthToSqlDate(byId('quick-add-expiry')?.value),
                    purpose: byId('quick-add-purpose')?.value.trim() || null,
                    ean
                };
                const { data, error } = await window.supabaseClient.from('pharmacy_items').insert([payload]).select().single();
                if (error) throw error;
                window.allPharmacyItems = [data, ...(window.allPharmacyItems || [])];
                window.AppStore.set(state => ({ ...state, pharmacy: [data, ...(state.pharmacy || [])] }));
            }

            const successMessage = currentType === 'event' ? 'Dodano wydarzenie.' : currentType === 'pharmacy' ? 'Dodano produkt do apteczki.' : savedTaskAsRoutine ? 'Dodano do planu domu.' : 'Dodano do listy zadań.';
            await window.closeQuickAddModal();
            window.showToast(successMessage);
            window.invalidateDashboardCache?.();
            window.renderDashboardUI?.();
            if (window.activeView === 'home') window.renderHomeUI?.();
            if (window.activeView === 'health') window.renderHealthUI?.();
            if (window.activeView === 'pharmacy-screen') window.loadPharmacyItems?.();
            if (window.activeView === 'todo') window.renderTodoUI?.();
            if (window.activeView === 'calendar') window.CalendarModule?.refresh?.();
        } catch (error) {
            console.error('Quick add error:', error);
            showError(error?.message || 'Nie udało się zapisać. Spróbuj ponownie.');
            setSaving(false);
        }
    }

    function startScan() {
        manualType = true;
        setType('pharmacy', { manual: true, text: byId('quick-add-description')?.value || '' });
        if (typeof window.startPharmacyBarcodeScan !== 'function') {
            window.showToast('Skaner nie jest dostępny. Wpisz nazwę lub kod ręcznie.');
            return;
        }
        window.startPharmacyBarcodeScan('quick-add-description', 'quick-add-ean', 'quick-add-scanner');
    }

    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-quick-add', () => window.openQuickAddModal());
        window.EventDispatcher.onClick('.js-close-quick-add', () => window.closeQuickAddModal());
        window.EventDispatcher.onClick('.js-change-quick-add-type', () => {
            const select = byId('quick-add-type');
            if (!select) return;
            const isOpen = !select.classList.contains('hidden');
            select.classList.toggle('hidden', isOpen);
            document.querySelector('.js-change-quick-add-type')?.setAttribute('aria-expanded', String(!isOpen));
        });
        window.EventDispatcher.onClick('.js-toggle-quick-add-details', () => {
            detailsOpen = !detailsOpen;
            byId('quick-add-task-details')?.classList.toggle('hidden', !detailsOpen);
            byId('quick-add-details-chevron').textContent = detailsOpen ? '−' : '＋';
            document.querySelector('.js-toggle-quick-add-details')?.setAttribute('aria-expanded', String(detailsOpen));
        });
        window.EventDispatcher.onClick('.js-quick-add-scan', startScan);
        window.EventDispatcher.onClick('.js-save-quick-add', (event) => {
            event.preventDefault();
            save();
        });
    }

    document.addEventListener('input', event => {
        if (event.target?.id === 'quick-add-description') updateFromText();
    });
    document.addEventListener('change', event => {
        if (event.target?.id === 'quick-add-type') {
            dateEdited = false;
            if (event.target.value !== 'pharmacy') window.stopPharmacyBarcodeScan?.();
            setType(event.target.value, { manual: true, parsedDate: parseDate(byId('quick-add-description')?.value || ''), text: byId('quick-add-description')?.value || '' });
            event.target.classList.add('hidden');
            document.querySelector('.js-change-quick-add-type')?.setAttribute('aria-expanded', 'false');
        }
        if (event.target?.id === 'quick-add-task-date' || event.target?.id === 'quick-add-event-datetime') dateEdited = true;
        if (event.target?.id === 'quick-add-task-interval') intervalEdited = true;
    });
    document.addEventListener('submit', event => {
        if (event.target?.id === 'quick-add-form') {
            event.preventDefault();
            save();
        }
    });

    return { open: window.openQuickAddModal, close: window.closeQuickAddModal };
})();
