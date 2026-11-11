// Ten sam szczegół zadania otwierany z Przeglądu, kalendarza, wyszukiwania i listy.
window.TaskDetails = (() => {
    let selectedKey = null;
    let mode = 'detail';
    let busy = false;
    const esc = value => window.esc(String(value ?? ''));
    const icon = name => window.UX?.icon?.(name) || '';

    function ensureDialog() {
        let modal = document.getElementById('task-detail-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'task-detail-modal';
        modal.className = 'ux-modal hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'task-detail-title');
        modal.innerHTML = '<section class="ux-sheet"><div id="task-detail-content"></div></section>';
        document.body.appendChild(modal);
        return modal;
    }

    function open(key) {
        const task = window.TaskModel?.get(key);
        if (!task) { window.showToast('Nie znaleziono zadania. Odśwież widok i spróbuj ponownie.'); return; }
        selectedKey = task.key;
        mode = 'detail';
        busy = false;
        ensureDialog();
        render();
        if (window.UX?.openDialog) window.UX.openDialog('task-detail-modal');
        else document.getElementById('task-detail-modal').classList.remove('hidden');
    }

    function close() {
        if (busy) return;
        if (window.UX?.closeDialog) window.UX.closeDialog('task-detail-modal');
        else document.getElementById('task-detail-modal')?.classList.add('hidden');
    }

    function contextLabel(task) {
        const person = (window.AppStore.get()?.profiles || []).find(p => String(p.id) === String(task.profileId));
        return [task.area, task.room && task.room !== 'Inne' ? task.room : '', person?.name].filter(Boolean).join(' · ');
    }

    function history(task) {
        const state = window.AppStore.get() || {};
        if (task.source === 'todos') return task.raw.completed_at ? [{ id: `todo-${task.id}`, date: task.raw.completed_at, notes: '', person: task.raw.completer_name || '', editable: false }] : [];
        const health = task.source === 'health_tasks';
        return (state[health ? 'hLogs' : 'logs'] || []).filter(log => String(log[health ? 'health_task_id' : 'task_id']) === String(task.id)).map(log => ({
            id: log.id, date: health ? log.start_date : log.created_at,
            notes: log.notes || '', person: log.user_name || '', editable: !health && typeof window.openEditLogModal === 'function'
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function historyMarkup(task) {
        const entries = history(task);
        return `<details id="task-history-details" class="ux-section"><summary>Historia wykonań · ${entries.length}</summary>${entries.map(entry => `<div class="ux-row"><span class="ux-row-main"><span class="ux-row-title">${esc(new Date(entry.date).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span>${entry.person ? `<span class="ux-row-meta">${esc(entry.person)}</span>` : ''}${entry.notes ? `<span class="ux-description" style="white-space:pre-wrap">${esc(entry.notes)}</span>` : ''}</span>${entry.editable ? `<button type="button" class="ux-icon-btn js-task-edit-log" data-id="${esc(entry.id)}" aria-label="Edytuj wykonanie z ${esc(new Date(entry.date).toLocaleDateString('pl-PL'))}">${icon('edit')}</button>` : ''}</div>`).join('') || '<p class="ux-muted">Brak zapisanych wykonań.</p>'}</details>`;
    }

    function row(task) {
        const overdue = task.dueAt && window.TaskModel.dateInput(task.dueAt) < window.TaskModel.dateInput(new Date()) && !task.completed;
        return `<div class="ux-row ${task.completed ? 'ux-task-completed' : ''}">
            <span aria-hidden="true">${icon(task.important ? 'flag' : task.completed ? 'check' : task.area === 'Dom' ? 'home' : task.area === 'Zdrowie' ? 'heart' : 'task')}</span>
            <button type="button" class="ux-row-main js-open-task-details" data-key="${esc(task.key)}">
                <span class="ux-row-title">${esc(task.name)}</span>
                <span class="ux-row-meta">${esc(contextLabel(task))}${task.repeat.every ? ` · ${esc(window.TaskModel.repeatLabel(task.repeat))}` : ''}</span>
            </button>
            <span class="ux-row-status ${overdue ? 'ux-warn' : ''}">${esc(window.TaskModel.dueLabel(task))}</span>
            ${!task.completed ? `<button type="button" class="ux-icon-btn js-task-complete" data-key="${esc(task.key)}" aria-label="Wykonano: ${esc(task.name)}" title="Wykonano">${icon('check')}</button>` : ''}
        </div>`;
    }

    function render() {
        const task = window.TaskModel?.get(selectedKey);
        const content = document.getElementById('task-detail-content');
        if (!task || !content) return;
        const header = `<header class="ux-header"><h2 class="ux-title" id="task-detail-title">${mode === 'reschedule' ? 'Przełóż termin' : 'Zadanie'}</h2><button type="button" class="ux-icon-btn js-close-task-detail" aria-label="Zamknij">${icon('close')}</button></header>`;
        const intro = `<h3>${esc(task.name)}</h3><p class="ux-muted">${esc(contextLabel(task))}</p>`;
        if (mode === 'reschedule') {
            content.innerHTML = header + intro + `<form id="task-reschedule-form">
                <label class="ux-form-field">Nowy termin<input class="ux-input" id="task-reschedule-date" type="date" required value="${esc(window.TaskModel.dateInput(task.dueAt) || window.TaskModel.dateInput(new Date()))}"></label>
                <p class="ux-muted">Zmieniasz najbliższy termin. Reguła powtarzania pozostaje zapisana.</p>
                <p class="ux-danger" id="task-detail-error" role="alert"></p>
                <div class="ux-actions"><button type="button" class="ux-btn ghost js-task-detail-back">Anuluj</button><button type="submit" class="ux-btn primary js-task-mutation">Zapisz termin</button></div>
            </form>`;
            setTimeout(() => document.getElementById('task-reschedule-date')?.focus(), 30);
            return;
        }
        const last = task.lastCompletedAt ? new Date(task.lastCompletedAt).toLocaleDateString('pl-PL') : null;
        content.innerHTML = header + intro + `
            <dl class="ux-detail-fields">
                <div class="ux-detail-field"><dt>Najbliższy termin</dt><dd>${esc(task.dueAt ? new Date(task.dueAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Bez terminu')}</dd></div>
                <div class="ux-detail-field"><dt>Powtarzanie</dt><dd>${esc(window.TaskModel.repeatLabel(task.repeat))}</dd></div>
                ${last ? `<div class="ux-detail-field"><dt>Ostatnie wykonanie</dt><dd>${esc(last)}</dd></div>` : ''}
            </dl>
            ${task.description ? `<p>${esc(task.description)}</p>` : ''}
            ${historyMarkup(task)}
            ${task.archived ? '<p class="ux-muted">Zadanie znajduje się w archiwum. Historia wykonania pozostaje zapisana.</p>' : `<button type="button" class="ux-btn ghost small js-task-flag js-task-mutation">${icon('flag')}${task.important ? 'Usuń oznaczenie ważne' : 'Oznacz jako ważne'}</button>${!task.completed ? `<details class="ux-section"><summary>Inna data lub notatka wykonania</summary><label class="ux-form-field">Data wykonania<input id="task-completion-date" class="ux-input" type="date" value="${esc(window.TaskModel.dateInput(new Date()))}"></label><label class="ux-form-field">Notatka (opcjonalnie)<textarea id="task-completion-note" class="ux-input" rows="2" maxlength="1000"></textarea></label></details>` : '<p class="ux-muted">Zadanie jest zakończone. Historia wykonania pozostaje zapisana.</p>'}`}
            <p class="ux-danger" id="task-detail-error" role="alert"></p>
            ${task.archived ? typeof window.restoreFromArchive === 'function' ? '<button type="button" class="ux-btn primary js-task-restore js-task-mutation">Przywróć zadanie</button>' : '' : `<div class="ux-actions">
                <button type="button" class="ux-btn ghost js-task-edit">${icon('edit')}Edytuj</button>
                ${!task.completed ? `<button type="button" class="ux-btn js-task-reschedule">${icon('calendar')}Przełóż</button><button type="button" class="ux-btn primary js-task-complete js-task-mutation" data-key="${esc(task.key)}">${icon('check')}Wykonano</button>` : ''}
            </div>
            <button type="button" class="ux-btn ghost small js-task-archive js-task-mutation">${icon('archive')}Archiwizuj</button>`}`;
    }

    async function run(action) {
        if (busy) return;
        busy = true;
        document.querySelectorAll('#task-detail-modal button, #task-detail-modal input').forEach(button => { button.disabled = true; });
        try { await action(); }
        catch (error) {
            console.error('Task action failed:', error);
            const message = /^(Wpisz|Wybierz|Nie znaleziono|Nieprawidłowa)/.test(error?.message || '') ? error.message : 'Nie udało się zapisać zmiany. Spróbuj ponownie.';
            const errorEl = document.getElementById('task-detail-error');
            if (errorEl && !document.getElementById('task-detail-modal')?.classList.contains('hidden')) errorEl.textContent = message;
            else window.showToast(message);
        } finally {
            busy = false;
            document.querySelectorAll('#task-detail-modal button, #task-detail-modal input').forEach(button => { button.disabled = false; });
        }
    }

    async function complete(key) {
        await run(async () => {
            const inDialog = !document.getElementById('task-detail-modal')?.classList.contains('hidden') && key === selectedKey;
            const completedAt = inDialog ? document.getElementById('task-completion-date')?.value : null;
            const notes = inDialog ? document.getElementById('task-completion-note')?.value || '' : '';
            const result = await window.TaskModel.complete(key, { ...(completedAt ? { completedAt } : {}), notes });
            if (inDialog) {
                busy = false;
                close();
                busy = true;
            }
            window.triggerHaptic?.();
            const message = result.task?.repeat.every ? `Wykonano · kolejny termin ${window.TaskModel.dueLabel(result.task)}` : 'Zadanie wykonane';
            if (result.undo && window.UX?.actionToast) window.UX.actionToast(message, 'Cofnij', async () => {
                try { await result.undo(); window.showToast('Cofnięto wykonanie.'); }
                catch (error) { console.error(error); window.showToast('Nie udało się cofnąć wykonania.'); }
            });
            else window.showToast(message);
        });
    }

    window.openTaskDetails = open;
    window.openTaskForm = context => window.openQuickAddModal?.({ type: 'task', ...(context || {}) });
    window.openEditTodoModal = id => open(`todos:${id}`);
    window.openNewTodoModal = () => window.openTaskForm({ area: 'Ogólne' });

    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-open-task-details', (event, el) => open(el.dataset.key));
        window.EventDispatcher.onClick('.js-close-task-detail', close);
        window.EventDispatcher.onClick('.js-task-detail-back', () => { mode = 'detail'; render(); });
        window.EventDispatcher.onClick('.js-task-reschedule', () => { mode = 'reschedule'; render(); });
        window.EventDispatcher.onClick('.js-task-edit', () => {
            const task = window.TaskModel.get(selectedKey);
            close();
            window.openTaskForm({ taskKey: selectedKey, area: task.area, room: task.room, profileId: task.profileId });
        });
        window.EventDispatcher.onClick('.js-task-flag', () => run(async () => {
            const task = window.TaskModel.get(selectedKey);
            await window.TaskModel.setImportant(selectedKey, !task.important);
            render();
        }));
        window.EventDispatcher.onClick('.js-task-complete', (event, el) => { event.preventDefault(); complete(el.dataset.key || selectedKey); });
        window.EventDispatcher.onClick('.js-task-archive', () => window.customConfirm('Zarchiwizować to zadanie? Historię będzie można odnaleźć w archiwum.', () => run(async () => {
            await window.TaskModel.archive(selectedKey);
            busy = false; close(); busy = true;
            window.showToast('Zadanie zarchiwizowane.');
        })));
        window.EventDispatcher.onClick('.js-task-restore', () => run(async () => {
            const task = window.TaskModel.get(selectedKey);
            await window.restoreFromArchive(task.source, task.id);
            render();
        }));
        window.EventDispatcher.onClick('.js-task-edit-log', (event, element) => {
            const taskKey = selectedKey;
            close();
            window.openEditLogModal(element.dataset.id, { onClose: () => {
                open(taskKey);
                document.getElementById('task-history-details')?.setAttribute('open', '');
            } });
        });
        window.EventDispatcher.onClick('.js-edit-todo', (event, el) => open(`todos:${el.dataset.id}`));
    }
    document.addEventListener('submit', event => {
        if (event.target.id !== 'task-reschedule-form') return;
        event.preventDefault();
        run(async () => {
            const task = await window.TaskModel.reschedule(selectedKey, document.getElementById('task-reschedule-date').value);
            selectedKey = task.key; mode = 'detail'; render();
            window.showToast('Termin zmieniony.');
        });
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return { open, close, row, render, complete, history };
})();
