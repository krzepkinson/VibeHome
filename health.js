// ==========================================
// LOGIKA: ZDROWIE 2.0 - LOCAL FIRST + MOBILE PRO (health.js)
// ==========================================

window.HealthModule = (() => {
    let currentProfileId = null; 
    let pharmacyScanner = null;
    let pharmacyScannerScriptPromise = null;
    let pharmacyScannerHandled = false;
    let activePharmacyScannerElementId = null;
    let healthBookVisibleLimit = 100;
    let healthTab = 'state';
    let pharmacySearchQuery = '';
    let pharmacyScannerRequestId = 0;
    let pharmacyPackageGroupKey = null;
    const healthIcon = (name) => window.UX?.icon(name) || '';
    const healthScope = () => ({ householdId: window.currentUser?.household_id, userId: window.currentUser?.user_id || window.currentUser?.id });
    const sameHealthScope = scope => scope.householdId === window.currentUser?.household_id && scope.userId === (window.currentUser?.user_id || window.currentUser?.id);

    // Bezpieczne porównywanie identyfikatorów bez względu na ich typ (String / Number)
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const activeProfileStorageKey = () => {
        const userId = window.currentUser?.user_id;
        return userId ? `bento_health_active_profile:${encodeURIComponent(String(userId))}` : null;
    };

    const loadBarcodeScannerLibrary = () => {
        if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) return Promise.resolve();
        if (pharmacyScannerScriptPromise) return pharmacyScannerScriptPromise;

        pharmacyScannerScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) resolve();
                else {
                    pharmacyScannerScriptPromise = null;
                    reject(new Error('Biblioteka skanera nie została uruchomiona.'));
                }
            };
            script.onerror = () => {
                script.remove();
                pharmacyScannerScriptPromise = null;
                reject(new Error('Nie udało się pobrać biblioteki skanera.'));
            };
            document.head.appendChild(script);
        });
        return pharmacyScannerScriptPromise;
    };

    const stopPharmacyBarcodeScanner = async () => {
        pharmacyScannerRequestId++;
        const scanner = pharmacyScanner;
        const elementId = activePharmacyScannerElementId;
        pharmacyScanner = null;
        activePharmacyScannerElementId = null;

        if (scanner) {
            try { await scanner.stop(); } catch (e) {}
            try { scanner.clear(); } catch (e) {}
        }

        const element = elementId ? document.getElementById(elementId) : null;
        if (element) {
            element.innerHTML = '';
            element.classList.add('hidden');
        }
    };

    const formatLocalDatetime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const parseLocalDatetime = (dtStr) => {
        if (!dtStr) return null;
        if (dtStr.length === 16) dtStr += ':00'; 
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return new Date(dtStr.replace('T', ' ').replace(/-/g, '/'));
        return d;
    };

    const getLocalDayStr = (dObj = new Date()) => {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Helper trendu pomiarów (Gorączka / Waga / Wzrost)
    const getMeasurementTrendHtml = (prevVal, currentMeas) => {
        if (prevVal == null) return '';
        const diff = currentMeas.value - prevVal;
        
        if (diff > 0) {
            const isFever = currentMeas.measurement_type.toLowerCase().includes('temp') || currentMeas.measurement_type.toLowerCase().includes('gorąc');
            const color = isFever ? 'text-[#ffb4ab]' : 'text-neutral-300';
            return `<span class="${color} font-bold text-xs ml-1.5" title="Poprzednio: ${window.esc(prevVal)} ${window.esc(currentMeas.unit || '')}">↑ (+${diff.toFixed(1)})</span>`;
        } else if (diff < 0) {
            const isFever = currentMeas.measurement_type.toLowerCase().includes('temp') || currentMeas.measurement_type.toLowerCase().includes('gorąc');
            const color = isFever ? 'text-[#c4eed0]' : 'text-neutral-300';
            return `<span class="${color} font-bold text-xs ml-1.5" title="Poprzednio: ${window.esc(prevVal)} ${window.esc(currentMeas.unit || '')}">↓ (${diff.toFixed(1)})</span>`;
        }
        return '<span class="text-neutral-500 font-bold text-xs ml-1.5" title="Bez zmian">=</span>';
    };

    window.initHealthModule = async function(forceRefresh = false) {
        try {
            const key = activeProfileStorageKey();
            const savedProfile = key ? localStorage.getItem(key) : null;
            localStorage.removeItem('bento_health_active_profile');
            if (savedProfile) currentProfileId = savedProfile;
        } catch (e) {}

        const state = window.AppStore.get() || {};
        const pData = state.profiles || [];
        
        if (pData.length > 0 && (!currentProfileId || !pData.some(p => sameId(p.id, currentProfileId)))) {
            currentProfileId = pData[0].id;
        }

        window.renderHealthUI();

        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview(forceRefresh); 
            window.renderHealthUI();
        }
    };

    window.refreshHealthData = async function() {
        if (!currentProfileId) return;
        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview(true);
        }
        window.renderHealthUI();
    };

    window.getCurrentHealthProfileId = function() {
        const profiles = window.AppStore.get()?.profiles || [];
        if (!profiles.some(profile => sameId(profile.id, currentProfileId))) currentProfileId = profiles[0]?.id || null;
        return currentProfileId;
    };
    window.getHealthTab = () => healthTab;
    window.selectHealthTab = function(tab) {
        healthTab = ['state', 'terms', 'pharmacy', 'history'].includes(tab) ? tab : 'state';
        window.renderHealthUI();
    };

    window.renderHealthUI = function() {
        const state = window.AppStore.get() || {};
        const profiles = state.profiles || [];
        const profileId = window.getCurrentHealthProfileId();
        const profile = profiles.find(item => sameId(item.id, profileId));
        const empty = document.getElementById('health-empty');
        const wrapper = document.getElementById('health-sections-wrapper');
        const context = document.getElementById('health-person-context');
        const select = document.getElementById('health-person-select');
        const household = healthTab === 'pharmacy';
        if (context) context.textContent = household ? 'Wspólna apteczka domu' : profile ? `Dla: ${profile.name}` : 'Profile zdrowotne';
        if (select) {
            select.innerHTML = profiles.map(item => `<option value="${window.esc(item.id)}" ${sameId(item.id, profileId) ? 'selected' : ''}>${window.esc(item.name)}</option>`).join('');
            select.classList.toggle('hidden', household || profiles.length === 0);
        }
        document.querySelectorAll('.js-health-tab').forEach(button => {
            const selected = button.dataset.tab === healthTab;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', String(selected));
        });
        if (empty) empty.classList.toggle('hidden', !!profile || household);
        if (wrapper) wrapper.classList.toggle('hidden', !profile && !household);
        if (profile || household) window.renderHealthSections();
    };

    const eventRow = (event) => {
        const date = new Date(event.startsAt || `${event.date}T12:00:00`);
        const label = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + (event.time ? ` · ${event.time}` : ' · cały dzień');
        return `<button type="button" class="ux-row js-health-event-detail" data-key="${window.esc(event.key)}" data-date="${window.esc(event.date)}">${healthIcon('calendar')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(event.name)}</span><span class="ux-row-meta">${event.area === 'Zdrowie' ? 'Wizyta lub kontrola' : 'Wydarzenie'}</span></span><span class="ux-row-end">${window.esc(label)}</span></button>`;
    };

    window.renderHealthSections = function() {
        const content = document.getElementById('health-content');
        if (!content) return;
        const state = window.AppStore.get() || {};
        const profileId = window.getCurrentHealthProfileId();
        if (healthTab === 'pharmacy') {
            content.innerHTML = `<div class="ux-between"><h2 class="ux-section-title">Leki i suplementy</h2><button type="button" class="ux-btn ghost small js-health-scan-product">${healthIcon('scan')} Skanuj kod</button></div><label class="ux-form-field" for="health-pharmacy-search">Szukaj nazwy, substancji lub opisu</label><input id="health-pharmacy-search" class="ux-input" type="search" autocomplete="off" placeholder="Np. Apap lub paracetamol" value="${window.esc(pharmacySearchQuery)}"><div id="health-pharmacy-list"></div>`;
            renderPharmacyGroups(document.getElementById('health-pharmacy-list'), pharmacySearchQuery);
            return;
        }
        const events = window.EventModel?.list({ includePast: true })?.filter(event => sameId(event.profileId, profileId) && event.area === 'Zdrowie') || [];
        const nextEvents = window.EventModel?.list({ includePast: false })?.filter(event => sameId(event.profileId, profileId) && event.area === 'Zdrowie') || events.filter(event => event.date >= getLocalDayStr());
        if (healthTab === 'history') {
            renderHealthHistory(content, profileId);
            return;
        }
        if (healthTab === 'terms') {
            const today = getLocalDayStr();
            const upcoming = nextEvents.filter(event => event.date >= today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            const past = events.filter(event => event.date < today).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
            content.innerHTML = `<h2 class="ux-section-title">Wizyty i kontrole</h2>${upcoming.map(eventRow).join('') || '<p class="ux-empty">Brak nadchodzących wizyt.</p>'}<button type="button" class="ux-btn ghost js-health-add-event">${healthIcon('plus')} Zaplanuj wizytę</button>${past.length ? `<details class="ux-disclosure"><summary>Minione terminy · ${past.length}</summary>${past.map(eventRow).join('')}</details>` : ''}`;
            return;
        }
        const active = window.HealthEntries.listEpisodes({ profileId, activeOnly: true });
        const next = nextEvents.filter(event => event.date >= getLocalDayStr()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 1);
        const careTasks = window.TaskModel?.list()?.filter(task => task.area === 'Zdrowie' && sameId(task.profileId, profileId)) || [];
        content.innerHTML = `<h2 class="ux-section-title">Aktualny stan</h2>${active.length ? active.map(episode => `<div class="ux-row"><button type="button" class="ux-row-main js-open-health-episode" data-id="${window.esc(episode.id)}"><span class="ux-row-title">${window.esc(episode.name)}</span><span class="ux-row-meta">Od ${new Date(episode.startDate).toLocaleDateString('pl-PL')}${episode.notes ? ' · są obserwacje' : ''}</span></button><div class="ux-actions"><button type="button" class="ux-btn ghost small js-open-quick-health-note" data-id="${window.esc(episode.id)}">${healthIcon('note')} Notatka</button><button type="button" class="ux-btn small js-close-health-log" data-id="${window.esc(episode.id)}">Zakończ</button></div></div>`).join('') : '<p class="ux-empty">Brak aktywnych dolegliwości.</p>'}<div class="ux-actions"><button type="button" class="ux-btn small js-health-add-episode">${healthIcon('activity')} Objaw lub choroba</button><button type="button" class="ux-btn small js-health-add-measurement">${healthIcon('thermometer')} Pomiar</button></div><h2 class="ux-section-title">Najbliższy termin</h2>${next.map(eventRow).join('') || '<p class="ux-empty">Brak zaplanowanych wizyt.</p>'}${careTasks.length ? `<h2 class="ux-section-title">Kontrole i opieka</h2>${careTasks.map(task => `<button type="button" class="ux-row js-health-task-detail" data-key="${window.esc(task.key)}">${healthIcon('task')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(task.name)}</span><span class="ux-row-meta">${task.dueAt ? `Najbliższy termin: ${new Date(task.dueAt).toLocaleDateString('pl-PL')}` : 'Bez terminu'}</span></span></button>`).join('')}` : ''}`;
    };

    const renderHealthHistory = (container, profileId) => {
        const state = window.AppStore.get() || {};
        const tasks = (state.hTasks || []).filter(task => sameId(task.profile_id, profileId));
        const taskById = new Map(tasks.map(task => [String(task.id), task]));
        const items = [];
        (window.EventModel?.list({ includePast: true, includeCancelled: true }) || []).filter(event => sameId(event.profileId, profileId) && event.area === 'Zdrowie' && (event.date < getLocalDayStr() || event.cancelled || event.archived)).forEach(event => items.push({ date: event.startsAt, html: `<button type="button" class="ux-row js-health-event-detail" data-key="${window.esc(event.key)}" data-date="${window.esc(event.date)}">${healthIcon('calendar')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(event.name)}</span><span class="ux-row-meta">${new Date(event.startsAt).toLocaleDateString('pl-PL')}${event.time ? ` · ${event.time}` : ''} · ${event.cancelled ? 'Odwołane' : event.archived ? 'Archiwum' : 'Miniony termin'}</span></span></button>` }));
        (state.hMeasurements || []).filter(item => sameId(item.profile_id, profileId)).forEach(item => items.push({ date: item.created_at, html: `<button type="button" class="ux-row js-open-measurement-details" data-id="${window.esc(item.id)}">${healthIcon('thermometer')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(item.measurement_type)} · ${window.esc(item.value)} ${window.esc(item.unit || '')}</span><span class="ux-row-meta">${new Date(item.created_at).toLocaleString('pl-PL')}${item.notes ? ` · ${window.esc(item.notes)}` : ''}</span></span></button>` }));
        (state.hLogs || []).forEach(log => {
            const task = taskById.get(String(log.health_task_id));
            if (!task) return;
            const supplement = String(task.category || '').toLowerCase() === 'suplementacja';
            const stateLabel = supplement ? 'Dawny wpis suplementacji' : task.task_type === 'duration' ? log.end_date ? 'Epizod zakończony' : 'Epizod trwa' : 'Zapis wykonania';
            items.push({ date: log.start_date, html: `<button type="button" class="ux-row js-open-health-episode" data-id="${window.esc(log.id)}">${healthIcon(supplement ? 'history' : 'activity')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(task.name)}</span><span class="ux-row-meta">${new Date(log.start_date).toLocaleDateString('pl-PL')} · ${stateLabel}</span></span></button>` });
        });
        const loggedTaskIds = new Set((state.hLogs || []).map(log => String(log.health_task_id)));
        tasks.filter(task => String(task.category || '').toLowerCase() === 'suplementacja' && !loggedTaskIds.has(String(task.id))).forEach(task => items.push({ date: task.created_at || '1970-01-01', html: `<button type="button" class="ux-row js-open-health-definition" data-id="${window.esc(task.id)}">${healthIcon('history')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(task.name)}</span><span class="ux-row-meta">Dawna definicja suplementacji · zachowana w historii</span></span></button>` }));
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = `<div class="ux-between"><h2 class="ux-section-title">Historia i pomiary</h2><button type="button" class="ux-btn ghost small js-health-add-measurement">${healthIcon('plus')} Pomiar</button></div>${items.slice(0, healthBookVisibleLimit).map(item => item.html).join('') || '<p class="ux-empty">Brak zapisów dla tej osoby.</p>'}${items.length > healthBookVisibleLimit ? '<button type="button" class="ux-btn ghost js-health-history-more">Pokaż starsze wpisy</button>' : ''}<button type="button" class="ux-btn ghost js-open-health-book">${healthIcon('history')} Szczegółowa historia</button>`;
    };

    window.getHealthStatusString = function(task, activeLog, taskLogs) {
        const today = new Date(); today.setHours(0,0,0,0);
        
        if (task.task_type === 'duration') {
            if (activeLog) {
                const start = new Date(activeLog.start_date); start.setHours(0,0,0,0);
                const diff = Math.floor((today - start) / 86400000);
                if (diff === 0) return '<span class="text-rose-400 font-medium">Dziś się zaczął</span>';
                return `<span class="text-rose-400 font-medium">Od ${diff} dni</span>`;
            }
            return 'Brak aktywnych';
        } 
        else if (task.task_type === 'one_time') {
            if (taskLogs && taskLogs.length > 0) return '<span class="text-neutral-500">Wydarzenie zakończone</span>';
            if (!task.event_date) return 'Brak określonej daty';
            const evDate = new Date(task.event_date); evDate.setHours(0,0,0,0);
            const diff = Math.floor((evDate - today) / 86400000);
            if (diff < 0) return `<span class="text-[#ffb4ab]">Zaległe (${Math.abs(diff)} dni temu)</span>`;
            if (diff === 0) return `<span class="text-[#ffb4ab] font-bold">Dzisiaj!</span>`;
            return `Zaplanowane: <span class="text-[#c4eed0]">${new Date(task.event_date).toLocaleDateString('pl-PL')}</span>`;
        } 
        else {
            if (!taskLogs || taskLogs.length === 0) return `Ostatnio: <span class="text-neutral-600">nigdy</span> • Następna: <span class="text-[#ffb4ab] font-bold">Teraz</span>`;
            const lastDate = new Date(taskLogs[0].start_date); lastDate.setHours(0,0,0,0);
            const diffLast = Math.floor((today - lastDate) / 86400000);
            let lastStr = diffLast === 0 ? 'dziś' : `${diffLast} dni temu`;
            if (!task.interval_days || task.interval_days === 0) return `Ostatnio: <span class="text-neutral-300">${lastStr}</span>`;
            const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + task.interval_days);
            const diffNext = Math.ceil((nextDate - today) / 86400000);
            let nextStr = diffNext < 0 ? `<span class="text-[#ffb4ab] font-bold">spóźnione ${Math.abs(diffNext)} dni!</span>` : (diffNext === 0 ? `<span class="text-amber-400 font-bold">dziś!</span>` : `<span class="text-neutral-300">za ${diffNext} dni</span>`);
            return `Ostatnio: <span class="text-neutral-400">${lastStr}</span> • Następna: ${nextStr}`;
        }
    };

    // SZYBKA NOTATKA DO TRWAJĄCEJ SYTUACJI
    window.openQuickHealthNoteModal = function(logId) {
        const state = window.AppStore.get() || {};
        const log = (state.hLogs || []).find(l => sameId(l.id, logId));
        if (!log) return;

        const updateNotesInStoreAndCloud = async (txt) => {
            if (!txt || !txt.trim()) return;
            const timeStr = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            const entry = `[${timeStr}] ${txt.trim()}`;
            const currentLog = (window.AppStore.get()?.hLogs || []).find(item => sameId(item.id, logId)) || log;
            const updatedNotes = currentLog.notes ? `${currentLog.notes}\n${entry}` : entry;
            const { error } = await window.supabaseClient.from('health_logs').update({ notes: updatedNotes }).eq('id', logId);
            if (error) { window.showToast('Nie udało się dopisać obserwacji. Spróbuj ponownie.'); return; }

            window.AppStore.set(prevState => ({
                ...prevState,
                hLogs: (prevState.hLogs || []).map(l => sameId(l.id, logId) ? { ...l, notes: updatedNotes } : l)
            }));
            window.renderHealthUI();
            window.invalidateDashboardCache?.();
            window.showToast('Dopisano obserwację.');
            if (document.getElementById('health-episode-dialog') && !document.getElementById('health-episode-dialog').classList.contains('hidden')) window.openHealthEpisode(logId);
        };

        if (typeof window.customPrompt === 'function') {
            window.customPrompt('Dopisz obserwację:', '', updateNotesInStoreAndCloud);
        } else {
            const txt = prompt('Dopisz obserwację samopoczucia:');
            updateNotesInStoreAndCloud(txt);
        }
    };

    // RAPORT DLA LEKARZA (7 LUB 14 DNI)
    window.openDoctorReport = function(days = 14) {
        const state = window.AppStore.get() || {};
        const profiles = state.profiles || [];
        const profile = profiles.find(p => sameId(p.id, currentProfileId));
        if (!profile) { window.showToast("Wybierz profil pacjenta!"); return; }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const allTasks = (state.hTasks || []).filter(t => sameId(t.profile_id, currentProfileId));
        const allLogs = (state.hLogs || []).filter(l => allTasks.some(t => sameId(t.id, l.health_task_id)) && new Date(l.start_date) >= cutoffDate);
        const allMeas = (state.hMeasurements || []).filter(m => sameId(m.profile_id, currentProfileId) && new Date(m.created_at) >= cutoffDate);

        let reportHtml = `
        <div id="doctor-report-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-[#18191a] border border-[#333537] rounded-[24px] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div class="p-5 border-b border-[#333537] flex justify-between items-center bg-[#1e1f20]">
                    <div>
                        <h2 class="text-base font-medium text-neutral-100">${healthIcon('note')} Raport dla lekarza (${days} dni)</h2>
                        <p class="text-xs text-[#a8c7fa] font-medium">Pacjent: ${window.esc(profile.name)}</p>
                    </div>
                    <button class="js-close-doctor-report w-8 h-8 rounded-full bg-[#333537] text-neutral-300 flex items-center justify-center active:scale-90 cursor-pointer">✕</button>
                </div>
                <div class="p-5 overflow-y-auto space-y-6 text-xs leading-relaxed">
                    
                    <div>
                        <h3 class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 border-b border-[#333537] pb-1">Pomiary i Gorączka</h3>
                        ${allMeas.length === 0 ? '<p class="text-neutral-500 italic">Brak pomiarów w podanym okresie.</p>' : `
                        <div class="space-y-1.5">
                            ${allMeas.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).map(m => `
                                <div class="flex justify-between items-center bg-[#1e1f20] p-2.5 rounded-xl border border-[#333537]">
                                    <span class="text-neutral-300 font-medium">${window.esc(m.measurement_type)}: <strong class="text-[#c2e7ff]">${window.esc(m.value)} ${window.esc(m.unit || '')}</strong></span>
                                    <span class="text-[10px] text-neutral-500">${new Date(m.created_at).toLocaleString('pl-PL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                            `).join('')}
                        </div>`}
                    </div>

                    <div>
                        <h3 class="text-xs font-medium text-neutral-400 mb-2 border-b border-[#333537] pb-1">Epizody i obserwacje</h3>
                        ${allLogs.length === 0 ? '<p class="text-neutral-500 italic">Brak zarejestrowanych epizodów.</p>' : `
                        <div class="space-y-3">
                            ${allLogs.sort((a,b)=> new Date(b.start_date) - new Date(a.start_date)).map(l => {
                                const t = allTasks.find(x => sameId(x.id, l.health_task_id));
                                return `
                                <div class="bg-[#1e1f20] p-3 rounded-xl border border-[#333537]">
                                    <div class="flex justify-between font-bold text-rose-300 mb-1">
                                        <span>${healthIcon('activity')} ${window.esc(t ? t.name : 'Zdarzenie')}</span>
                                        <span class="text-[10px] text-neutral-500 font-normal">${new Date(l.start_date).toLocaleDateString('pl-PL')} ${new Date(l.start_date).toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    ${l.notes ? `<div class="bg-[#131314] p-2 rounded-lg text-[11px] text-neutral-300 font-mono whitespace-pre-wrap border border-[#333537]/50 mt-1">${window.esc(l.notes)}</div>` : '<p class="text-[10px] text-neutral-500 italic">Brak dodatkowych notatek.</p>'}
                                </div>`;
                            }).join('')}
                        </div>`}
                    </div>

                </div>
                <div class="p-4 border-t border-[#333537] bg-[#1e1f20] flex justify-end">
                    <button class="js-close-doctor-report bg-[#e3e3e3] text-[#131314] font-bold py-2.5 px-6 rounded-full active:scale-95 transition-transform cursor-pointer">Zamknij</button>
                </div>
            </div>
        </div>`;

        const existing = document.getElementById('doctor-report-modal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', reportHtml);
    };

    window.startHealthLog = async function(taskId, type) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        if (document.activeElement) document.activeElement.blur();

        const now = new Date().toISOString();
        const tempId = Date.now();

        const newLog = {
            id: tempId,
            health_task_id: taskId,
            start_date: now,
            end_date: (type === 'cyclical' || type === 'one_time') ? now : null,
            user_id: window.currentUser ? window.currentUser.user_id : null,
            household_id: window.currentUser ? window.currentUser.household_id : null,
            user_name: window.currentUser ? window.currentUser.name : 'Ja'
        };

        window.AppStore.set(state => ({
            ...state,
            hLogs: [newLog, ...(state.hLogs || [])]
        }));
        window.renderHealthUI();
        window.showToast("Zapisano!");

        const { data, error } = await window.supabaseClient.from('health_logs').insert([{ 
            health_task_id: taskId, start_date: now, end_date: newLog.end_date, 
            user_id: newLog.user_id, household_id: newLog.household_id, user_name: newLog.user_name 
        }]).select().single();

        if (error) {
            window.showToast("Błąd zapisu w chmurze");
            window.refreshHealthData();
            return;
        }

        if (data) {
            window.AppStore.set(state => ({
                ...state,
                hLogs: (state.hLogs || []).map(l => l.id === tempId ? data : l)
            }));
        }

        const state = window.AppStore.get();
        const task = (state.hTasks || []).find(t => sameId(t.id, taskId));
        if (task && task.task_type === 'cyclical' && task.interval_days > 0) {
            const nextDate = new Date(now);
            nextDate.setDate(nextDate.getDate() + task.interval_days);
            await window.supabaseClient.from('health_tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', taskId);
        }
    };

    window.closeHealthLog = async function(logId) {
        const log = (window.AppStore.get()?.hLogs || []).find(item => sameId(item.id, logId));
        if (!log || log.end_date) return;
        const endDate = new Date().toISOString();
        const scope = healthScope();
        const { error } = await window.supabaseClient.from('health_logs').update({ end_date: endDate }).eq('id', logId);
        if (error) { window.showToast('Nie udało się zakończyć epizodu. Spróbuj ponownie.'); return; }
        if (!sameHealthScope(scope)) return;
        window.AppStore.set(state => ({ ...state, hLogs: (state.hLogs || []).map(item => sameId(item.id, logId) ? { ...item, end_date: endDate } : item) }));
        window.invalidateDashboardCache?.();
        window.UX?.closeDialog('health-episode-dialog');
        window.renderHealthUI();
        window.renderDashboardUI?.();
        const undo = async () => {
            if (!sameHealthScope(scope)) return;
            const result = await window.supabaseClient.from('health_logs').update({ end_date: null }).eq('id', logId);
            if (result.error) { window.showToast('Nie udało się cofnąć zakończenia.'); return; }
            window.AppStore.set(state => ({ ...state, hLogs: (state.hLogs || []).map(item => sameId(item.id, logId) ? { ...item, end_date: null } : item) }));
            window.invalidateDashboardCache?.(); window.UX?.refresh();
        };
        if (window.UX?.actionToast) window.UX.actionToast('Epizod zakończony', 'Cofnij', undo);
        else window.showToast('Epizod zakończony');
    };

    window.openHealthFabMenu = function() { 
        window.loadAndShowModal('health-fab-menu', '/modals/health-fab-menu.html'); 
    };
    
    window.closeHealthFabMenu = function() { 
        const menu = document.getElementById('health-fab-menu');
        if (menu) menu.classList.add('hidden'); 
    };

    window.openNewHealthTaskModal = function(defaultType = 'cyclical') { 
        window.loadAndShowModal('new-health-task-modal', '/modals/new-health-task.html', () => {
            document.getElementById('h-task-name').value = ''; 
            document.getElementById('h-task-type').value = defaultType; 
            
            const defaultCat = { 
                duration: 'Infekcja', 
                one_time: 'Zabieg', 
                cyclical: 'Inne' 
            }[defaultType] || 'Inne';
            
            const catEl = document.getElementById('h-task-category');
            if (catEl) catEl.value = defaultCat;
            const startInput = document.getElementById('h-task-start');
            if (startInput) { startInput.value = getLocalDayStr(); startInput.max = getLocalDayStr(); }
            
            window.toggleHealthInterval(); 
            
            const typeSelect = document.getElementById('h-task-type');
            if (typeSelect) {
                typeSelect.removeEventListener('change', window.toggleHealthInterval);
                typeSelect.addEventListener('change', window.toggleHealthInterval);
            }
            window.UX?.openDialog('new-health-task-modal');
        });
    };

    window.openNewDurationModal = function() { window.closeHealthFabMenu(); return window.openQuickAddModal ? window.openQuickAddModal({ type: 'episode', profileId: window.getCurrentHealthProfileId() }) : window.openNewHealthTaskModal('duration'); };
    window.openNewEventModal = function() { window.closeHealthFabMenu(); return window.openQuickAddModal ? window.openQuickAddModal({ type: 'event', area: 'Zdrowie', profileId: window.getCurrentHealthProfileId() }) : window.openNewHealthTaskModal('one_time'); };
    window.openNewRoutineModal = function() { window.closeHealthFabMenu(); return window.openQuickAddModal ? window.openQuickAddModal({ type: 'task', area: 'Zdrowie', profileId: window.getCurrentHealthProfileId() }) : window.openNewHealthTaskModal('cyclical'); };
    
    window.closeNewHealthTaskModal = function() { 
        const modal = document.getElementById('new-health-task-modal');
        if (window.UX?.closeDialog) window.UX.closeDialog('new-health-task-modal');
        else if (modal) modal.classList.add('hidden');
    };

    window.toggleHealthInterval = function() { 
        const typeEl = document.getElementById('h-task-type');
        if (!typeEl) return;
        const type = typeEl.value;
        const intContainer = document.getElementById('h-task-interval-container');
        const dateContainer = document.getElementById('h-task-date-container');
        
        if(intContainer) intContainer.classList.toggle('hidden', type !== 'cyclical'); 
        if(dateContainer) dateContainer.classList.toggle('hidden', type !== 'one_time'); 
        document.getElementById('h-task-start-container')?.classList.toggle('hidden', type !== 'duration');
    };

    window.saveNewHealthTask = async function() {
        if (document.activeElement) document.activeElement.blur();

        const n = document.getElementById('h-task-name').value.trim(); 
        const type = document.getElementById('h-task-type').value;
        const catEl = document.getElementById('h-task-category');
        const catValue = catEl ? catEl.value : 'Inne';

        let interval = 0; let remind = 0; let evDate = null;
        let initialDue = null; 

        if (type === 'cyclical') { 
            interval = parseInt(document.getElementById('h-task-interval').value) || 0; 
            remind = parseInt(document.getElementById('h-task-remind').value) || 0; 
            initialDue = new Date().toISOString(); 
        } else if (type === 'one_time') { 
            evDate = document.getElementById('h-task-date').value || null; 
            remind = parseInt(document.getElementById('h-task-remind-date').value) || 0; 
            if (evDate) {
                initialDue = new Date(evDate).toISOString(); 
            }
        }
        
        if (!n || !currentProfileId) return;
        if (type === 'one_time' && !evDate) { window.showToast('Wybierz datę wizyty.'); return; }
        if (type === 'cyclical' && interval < 1) { window.showToast('Ustaw dodatni odstęp pomiędzy wykonaniami.'); return; }
        if (type === 'duration') {
            try {
                await window.HealthEntries.saveEpisode({ name: n, profileId: currentProfileId, startDate: document.getElementById('h-task-start')?.value || getLocalDayStr() });
                window.closeNewHealthTaskModal(); window.showToast('Zapisano i rozpoczęto epizod.');
            } catch (error) { window.showToast(error.message || 'Nie udało się zapisać epizodu.'); }
            return;
        }

        const { error } = await window.supabaseClient.from('health_tasks').insert([{ 
            profile_id: currentProfileId, name: n, task_type: type, interval_days: interval, 
            remind_days_before: remind, event_date: evDate, show_in_history: true, is_archived: false, 
            user_id: window.currentUser.user_id, household_id: window.currentUser.household_id,
            next_due_at: initialDue, category: catValue
        }]);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        window.closeNewHealthTaskModal(); 
        window.showToast("Dodano zdarzenie!");
        await window.refreshHealthData(); 
    };

    window.currentHealthSettingsId = null;
    
    window.openHealthSettingsScreen = async function(taskId) {
        window.currentHealthSettingsId = taskId; 
        const state = window.AppStore.get() || {};
        const task = (state.hTasks || []).find(t => sameId(t.id, window.currentHealthSettingsId));
        if (!task) return;

        if (task.task_type === 'one_time' && window.openEventDetails) return window.openEventDetails(`health_tasks:${task.id}`);
        if (task.task_type === 'cyclical' && String(task.category || '').toLowerCase() !== 'suplementacja' && window.openTaskDetails) return window.openTaskDetails(`health_tasks:${task.id}`);

        await window.switchView('health-settings-screen');

        const titleTop = document.getElementById('health-settings-title-top');
        if (titleTop) titleTop.innerText = task.name; 
        
        const nameInput = document.getElementById('health-settings-name');
        if (nameInput) nameInput.value = task.name;
        
        const catEl = document.getElementById('health-settings-category');
        if (catEl) catEl.value = task.category || 'Inne';

        const intervalWrapper = document.getElementById('health-settings-interval-wrapper');
        const dateWrapper = document.getElementById('health-settings-date-wrapper');

        if (intervalWrapper) intervalWrapper.classList.add('hidden');
        if (dateWrapper) dateWrapper.classList.add('hidden');

        if (task.task_type === 'cyclical') {
            if (intervalWrapper) {
                intervalWrapper.classList.remove('hidden');
                const intervalInput = document.getElementById('health-settings-interval');
                if (intervalInput) intervalInput.value = task.interval_days || 0; 
                const remindInput = document.getElementById('health-settings-remind-days');
                if (remindInput) remindInput.value = task.remind_days_before || 0; 
            }
        } else if (task.task_type === 'one_time') {
            if (dateWrapper) {
                dateWrapper.classList.remove('hidden');
                const dateInput = document.getElementById('health-settings-date');
                if (dateInput) dateInput.value = task.event_date ? formatLocalDatetime(task.event_date) : '';
                const remindInput = document.getElementById('health-settings-remind-date');
                if (remindInput) remindInput.value = task.remind_days_before || 0; 
            }
        }
    };
    
    window.closeHealthSettingsScreen = function() { window.goBack(); };

    window.saveHealthSettings = async function() {
        if (document.activeElement) document.activeElement.blur();

        const state = window.AppStore.get() || {};
        const task = (state.hTasks || []).find(t => sameId(t.id, window.currentHealthSettingsId));
        
        if (!task) {
            window.showToast("Błąd: Nie znaleziono zadania.");
            return;
        }

        const n = document.getElementById('health-settings-name').value.trim(); 
        let updateData = { name: n };
        
        const catEl = document.getElementById('health-settings-category');
        if (catEl) updateData.category = catEl.value;
        
        if (task.task_type === 'cyclical') { 
            updateData.interval_days = parseInt(document.getElementById('health-settings-interval').value) || 0; 
            updateData.remind_days_before = parseInt(document.getElementById('health-settings-remind-days').value) || 0; 
        } else if (task.task_type === 'one_time') {
            const dateStr = document.getElementById('health-settings-date').value;
            updateData.event_date = dateStr ? parseLocalDatetime(dateStr).toISOString() : null;
            updateData.remind_days_before = parseInt(document.getElementById('health-settings-remind-date').value) || 0;
            if (updateData.event_date) {
                updateData.next_due_at = updateData.event_date;
            }
        }
        
        const { error } = await window.supabaseClient.from('health_tasks').update(updateData).eq('id', window.currentHealthSettingsId);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Zapisano!"); 
        
        await window.refreshHealthData(); 
        window.goBack();
    };

    window.deleteHealthTask = function() {
        window.customConfirm("Zarchiwizować to zdarzenie?", async () => {
            const { error } = await window.supabaseClient.from('health_tasks').update({ is_archived: true }).eq('id', window.currentHealthSettingsId);
            if (error) { window.showToast("Błąd: " + error.message); return; }
            
            await window.refreshHealthData(); 
            window.closeHealthSettingsScreen(); 
        });
    };

    // BEZPIECZNE DLA MOBILE SELEKCJONOWANIE PROFILI
    window.selectHealthProfile = function(id) { 
        if (id == null || id === '') return;
        currentProfileId = id; 

        try {
            const key = activeProfileStorageKey();
            if (key) localStorage.setItem(key, String(id));
        } catch (e) {}

        if (typeof window.closeProfileSwitcher === 'function') window.closeProfileSwitcher();
        window.renderHealthUI();
    };

    window.toggleProfileSwitcher = function() {
        window.loadAndShowModal('profile-switcher-modal', '/modals/profile-switcher.html', () => {
            const state = window.AppStore.get() || {};
            const profiles = state.profiles || [];
            document.getElementById('switcher-profiles-list').innerHTML = profiles.map(p => window.UI.renderProfileSwitcherItem(p, sameId(p.id, currentProfileId))).join('');
        });
    };

    window.closeProfileSwitcher = function() { 
        const modal = document.getElementById('profile-switcher-modal');
        if (modal) modal.classList.add('hidden'); 
    };

    // ==========================================
    // MODUŁ: DOMOWA APTECZKA
    // ==========================================

    window.allPharmacyItems = [];
    window.openPharmacyScreen = function() { return window.goForward('pharmacy-screen'); };
    window.closePharmacyScreen = function() { window.goBack(); };

    window.startPharmacyBarcodeScan = async function(nameInputId, eanInputId, scannerElementId, options = {}) {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            window.showToast('Skanowanie wymaga HTTPS i przeglądarki z obsługą aparatu.');
            return;
        }
        const scannerElement = document.getElementById(scannerElementId);
        if (!scannerElement) return;
        const cleanup = stopPharmacyBarcodeScanner();
        const requestId = pharmacyScannerRequestId;
        await cleanup;
        if (requestId !== pharmacyScannerRequestId) return;
        activePharmacyScannerElementId = scannerElementId;
        pharmacyScannerHandled = false;
        scannerElement.classList.remove('hidden');
        let scanner;
        try {
            await loadBarcodeScannerLibrary();
            if (requestId !== pharmacyScannerRequestId) return;
            const formats = window.Html5QrcodeSupportedFormats;
            scanner = new window.Html5Qrcode(scannerElementId, { formatsToSupport: [formats.EAN_13, formats.EAN_8, formats.UPC_A, formats.UPC_E].filter(value => value !== undefined) });
            pharmacyScanner = scanner;
            await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 120 } }, async decodedText => {
                if (pharmacyScannerHandled || requestId !== pharmacyScannerRequestId) return;
                pharmacyScannerHandled = true;
                const ean = String(decodedText || '').trim();
                await stopPharmacyBarcodeScanner();
                const resultToken = pharmacyScannerRequestId;
                if (!/^(?:\d{8}|\d{12}|\d{13})$/.test(ean)) { window.showToast('Odczytany kod nie wygląda na EAN. Spróbuj ponownie.'); return; }
                let group = window.PharmacyModel.findByEan(ean);
                if (!group) {
                    try {
                        const result = await window.supabaseClient.from('pharmacy_items').select('*').eq('household_id', window.currentUser.household_id).eq('ean', ean);
                        if (result.error) throw result.error;
                        if (result.data?.length) {
                            const known = new Set(result.data.map(item => String(item.id)));
                            window.AppStore.set(state => ({ ...state, pharmacy: [...result.data, ...(state.pharmacy || []).filter(item => !known.has(String(item.id)))] }));
                            group = window.PharmacyModel.findByEan(ean);
                        }
                    } catch (error) { console.warn('Nie udało się sprawdzić kodu w zapisanej apteczce:', error); }
                }
                if (resultToken !== pharmacyScannerRequestId) return;
                if (typeof options.onResult === 'function') { await options.onResult({ ean, group: group || null }); return; }
                const nameInput = document.getElementById(nameInputId);
                const eanInput = document.getElementById(eanInputId);
                if (eanInput) eanInput.value = ean;
                if (group && nameInput) {
                    nameInput.value = group.name;
                    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                    const descriptionId = nameInputId === 'pharmacy-item-name' ? 'pharmacy-item-purpose' : nameInputId === 'edit-pharmacy-name' ? 'edit-pharmacy-purpose' : null;
                    if (descriptionId && document.getElementById(descriptionId)) document.getElementById(descriptionId).value = group.description;
                }
                if (group && !nameInputId.startsWith('edit-')) window.openPharmacyScanChoice(group.key);
                else { window.showToast(group ? 'Rozpoznano zapisany produkt.' : 'Nowy kod. Wpisz nazwę i opis — apteczka zapamięta powiązanie.'); if (!group) nameInput?.focus(); }
            }, () => {});
            if (requestId !== pharmacyScannerRequestId) { try { await scanner.stop(); scanner.clear(); } catch (error) {} }
        } catch (error) {
            if (requestId !== pharmacyScannerRequestId) return;
            console.warn('Nie udało się uruchomić skanera:', error);
            await stopPharmacyBarcodeScanner();
            window.showToast('Nie udało się uruchomić aparatu. Sprawdź zgodę albo wpisz kod ręcznie.');
        }
    };

    window.stopPharmacyBarcodeScan = stopPharmacyBarcodeScanner;
    
    window.loadPharmacyItems = async function(forceRefresh = false) {
        const listEl = document.getElementById('pharmacy-list');
        if (!listEl) return;
        window.prefetchModalTemplate?.('new-pharmacy-item-modal', '/modals/new-pharmacy-item.html');
        window.prefetchModalTemplate?.('edit-pharmacy-item-modal', '/modals/edit-pharmacy-item.html');
        window.allPharmacyItems = window.AppStore.get()?.pharmacy || [];
        window.renderPharmacyList();
        if (typeof window.loadDashboardOverview === 'function') {
            await window.loadDashboardOverview(forceRefresh);
            window.allPharmacyItems = window.AppStore.get()?.pharmacy || [];
            window.renderPharmacyList();
        }
    };

    const normalizePharmacyText = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
    const pharmacyGroupKey = item => item.ean ? `ean:${String(item.ean).trim()}` : `name:${normalizePharmacyText(item.name)}`;
    const packageDate = value => {
        if (!value) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            const parsed = new Date(`${value}T12:00:00`);
            if (!isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day) return value;
            throw new Error('Wybierz prawidłową ważność opakowania.');
        }
        if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Wybierz prawidłową ważność opakowania.');
        const [year, month] = value.split('-').map(Number);
        if (month < 1 || month > 12) throw new Error('Wybierz prawidłową ważność opakowania.');
        return `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    };
    const refreshPharmacy = () => {
        window.allPharmacyItems = window.AppStore.get()?.pharmacy || [];
        window.invalidateDashboardCache?.(); window.renderPharmacyList();
        if (healthTab === 'pharmacy' && window.activeView === 'health') window.renderHealthUI();
    };

    window.PharmacyModel = {
        listGroups(query = '') {
            const items = window.AppStore.get()?.pharmacy || [];
            const groups = new Map();
            items.forEach(item => {
                const key = pharmacyGroupKey(item);
                if (!groups.has(key)) groups.set(key, { key, name: item.name || '', description: '', ean: item.ean || null, packages: [] });
                groups.get(key).packages.push(item);
            });
            const value = normalizePharmacyText(query);
            return [...groups.values()].map(group => {
                group.packages.sort((a, b) => String(a.expiration_date || '9999').localeCompare(String(b.expiration_date || '9999')));
                group.description = [...new Set(group.packages.map(item => item.purpose?.trim()).filter(Boolean))].join('\n');
                return group;
            }).filter(group => !value || normalizePharmacyText(`${group.name} ${group.description} ${group.ean || ''}`).includes(value)).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        },
        findByEan(ean) { return this.listGroups().find(group => String(group.ean || '') === String(ean)); },
        async save(input) {
            const scope = healthScope();
            if (!scope.householdId || !scope.userId) throw new Error('Zaloguj się ponownie, aby zapisać produkt.');
            const group = input.groupKey ? this.listGroups().find(item => item.key === input.groupKey) : null;
            const name = String(input.name ?? group?.name ?? '').trim();
            const description = String(input.description ?? group?.description ?? '').trim();
            const ean = String(input.ean ?? group?.ean ?? '').trim() || null;
            if (!name) throw new Error('Wpisz nazwę leku lub suplementu.');
            if (ean && !/^(?:\d{8}|\d{12}|\d{13})$/.test(ean)) throw new Error('Kod powinien mieć 8, 12 lub 13 cyfr.');
            if (group && (group.name !== name || group.description !== description || (group.ean || null) !== ean)) await this.updateGroup(group.key, { name, description, ean });
            if (!sameHealthScope(scope)) throw new Error('Zmieniono aktywne gospodarstwo. Otwórz ponownie formularz.');
            const payload = { household_id: scope.householdId, user_id: scope.userId, name, purpose: description || null, ean, expiration_date: packageDate(input.expirationDate || '') };
            const { data, error } = await window.supabaseClient.from('pharmacy_items').insert([payload]).select().single();
            if (error) throw new Error(group ? 'Nie dodano opakowania. Jeśli zmieniono opis produktu, został on zachowany. Spróbuj ponownie.' : error.message || 'Nie udało się dodać produktu.');
            if (!sameHealthScope(scope)) throw new Error('Produkt zapisano w poprzednim gospodarstwie. Bieżący widok nie został zmieniony.');
            window.AppStore.set(state => ({ ...state, pharmacy: [data, ...(state.pharmacy || [])] }));
            refreshPharmacy();
            return data;
        },
        async updateGroup(key, input) {
            const scope = healthScope();
            const group = this.listGroups().find(item => item.key === key);
            if (!group) throw new Error('Nie znaleziono produktu.');
            const name = String(input.name ?? group.name).trim();
            const description = String(input.description ?? group.description).trim();
            const ean = String(input.ean ?? group.ean ?? '').trim() || null;
            if (!name) throw new Error('Wpisz nazwę produktu.');
            if (ean && !/^(?:\d{8}|\d{12}|\d{13})$/.test(ean)) throw new Error('Kod powinien mieć 8, 12 lub 13 cyfr.');
            const ids = group.packages.map(item => item.id);
            const { data, error } = await window.supabaseClient.from('pharmacy_items').update({ name, purpose: description || null, ean }).in('id', ids).select();
            if (error) throw error;
            if (!sameHealthScope(scope)) throw new Error('Zmieniono aktywne gospodarstwo. Otwórz ponownie produkt.');
            const changed = new Map((data || []).map(item => [String(item.id), item]));
            window.AppStore.set(state => ({ ...state, pharmacy: (state.pharmacy || []).map(item => changed.get(String(item.id)) || item) }));
            refreshPharmacy();
            return this.listGroups().find(item => item.key === (ean ? `ean:${ean}` : `name:${normalizePharmacyText(name)}`));
        }
    };

    const renderPharmacyGroups = (container, query) => {
        if (!container) return;
        const groups = window.PharmacyModel.listGroups(query);
        if (!groups.length) { container.innerHTML = `<p class="ux-empty">${query ? 'Brak wyników dla tej nazwy, substancji lub opisu.' : 'Apteczka jest pusta. Dodaj produkt lub zeskanuj kod.'}</p>`; return; }
        const today = getLocalDayStr();
        container.innerHTML = groups.map(group => {
            const dated = group.packages.filter(item => item.expiration_date);
            const expired = dated.filter(item => item.expiration_date < today).length;
            const nearest = dated[0]?.expiration_date;
            const expiry = nearest ? `${nearest.slice(5, 7)}.${nearest.slice(0, 4)}` : 'Nie podano ważności';
            return `<button type="button" class="ux-row js-open-pharmacy-product" data-key="${window.esc(group.key)}">${healthIcon('package')}<span class="ux-row-main"><span class="ux-row-title">${window.esc(group.name)}</span><span class="ux-row-meta">${window.esc(group.description || 'Dodaj opis, np. substancję czynną i zastosowanie.')}</span><span class="ux-row-meta">${group.packages.length} opak. · ${expired ? `${expired} po terminie` : `ważność ${expiry}`}</span></span><span class="ux-row-end">${healthIcon('chevron-right')}</span></button>`;
        }).join('');
    };

    window.renderPharmacyList = function() {
        window.allPharmacyItems = window.AppStore.get()?.pharmacy || [];
        renderPharmacyGroups(document.getElementById('pharmacy-list'), document.getElementById('pharmacy-search-input')?.value || '');
    };

    const showHealthDialog = (id, title, html) => {
        let element = document.getElementById(id);
        if (!element) { element = document.createElement('div'); element.id = id; element.className = 'ux-dialog hidden'; document.body.appendChild(element); }
        element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.setAttribute('aria-label', title);
        element.innerHTML = `<div class="ux-dialog-panel"><div class="ux-between"><h2 class="ux-title">${window.esc(title)}</h2><button type="button" class="ux-icon-btn js-close-health-dialog" data-dialog="${id}" aria-label="Zamknij">${healthIcon('close')}</button></div>${html}</div>`;
        if (window.UX?.openDialog) window.UX.openDialog(id); else element.classList.remove('hidden');
    };

    window.openPharmacyProduct = function(key) {
        const group = window.PharmacyModel.listGroups().find(item => item.key === key);
        if (!group) { window.showToast('Nie znaleziono produktu.'); return; }
        showHealthDialog('pharmacy-product-dialog', group.name, `<p class="ux-row-meta">Wspólna apteczka domu${group.ean ? ` · kod ${window.esc(group.ean)}` : ''}</p><h3 class="ux-section-title">Opis / substancja czynna / zastosowanie</h3><p class="ux-pharmacy-description">${window.esc(group.description || 'Nie dodano opisu.')}</p><h3 class="ux-section-title">Opakowania · ${group.packages.length}</h3>${group.packages.map(item => `<div class="ux-row"><span class="ux-row-main"><span class="ux-row-title">${item.expiration_date ? `Ważność ${item.expiration_date.slice(5, 7)}.${item.expiration_date.slice(0, 4)}` : 'Ważność niepodana'}</span><span class="ux-row-meta">${item.expiration_date && item.expiration_date < getLocalDayStr() ? 'Po terminie' : 'Opakowanie w apteczce'}</span></span><button type="button" class="ux-btn ghost small js-edit-pharmacy-package" data-id="${window.esc(item.id)}">Edytuj</button></div>`).join('')}<div class="ux-actions"><button type="button" class="ux-btn js-edit-pharmacy-product" data-key="${window.esc(group.key)}">${healthIcon('edit')} Edytuj opis produktu</button><button type="button" class="ux-btn primary js-add-pharmacy-package" data-key="${window.esc(group.key)}">${healthIcon('plus')} Dodaj opakowanie</button></div>`);
    };

    window.openEditPharmacyProduct = function(key) {
        const group = window.PharmacyModel.listGroups().find(item => item.key === key);
        if (!group) return;
        showHealthDialog('pharmacy-edit-product-dialog', 'Edytuj produkt', `<input type="hidden" id="pharmacy-product-key" value="${window.esc(key)}"><label class="ux-form-field" for="pharmacy-product-name">Nazwa</label><input class="ux-input" id="pharmacy-product-name" maxlength="150" value="${window.esc(group.name)}"><label class="ux-form-field" for="pharmacy-product-description">Opis / substancja czynna / zastosowanie</label><textarea class="ux-input" id="pharmacy-product-description" rows="4" maxlength="4000" placeholder="Np. Paracetamol — lek przeciwbólowy i przeciwgorączkowy">${window.esc(group.description)}</textarea><label class="ux-form-field" for="pharmacy-product-ean">Kod (opcjonalnie)</label><input class="ux-input" id="pharmacy-product-ean" inputmode="numeric" maxlength="13" value="${window.esc(group.ean || '')}"><p id="pharmacy-product-error" role="alert" class="ux-error"></p><div class="ux-actions"><button type="button" class="ux-btn primary js-save-pharmacy-product">Zapisz produkt</button></div>`);
    };
    window.openPharmacyScanChoice = function(key) {
        const group = window.PharmacyModel.listGroups().find(item => item.key === key);
        if (!group) return;
        showHealthDialog('pharmacy-scan-choice-dialog', 'Znaleziono w apteczce', `<h3 class="ux-section-title">${window.esc(group.name)}</h3><p class="ux-row-meta">${window.esc(group.description)} · ${group.packages.length} opak.</p><div class="ux-actions"><button type="button" class="ux-btn js-pharmacy-scan-open" data-key="${window.esc(key)}">Otwórz produkt</button><button type="button" class="ux-btn primary js-pharmacy-scan-package" data-key="${window.esc(key)}">Dodaj opakowanie</button></div>`);
    };

    window.openNewPharmacyItemModal = function(groupKey = null) {
        pharmacyPackageGroupKey = typeof groupKey === 'string' ? groupKey : null;
        const group = window.PharmacyModel.listGroups().find(item => item.key === pharmacyPackageGroupKey);
        return window.loadAndShowModal('new-pharmacy-item-modal', '/modals/new-pharmacy-item.html', () => {
            document.getElementById('pharmacy-item-name').value = group?.name || '';
            document.getElementById('pharmacy-item-ean').value = group?.ean || '';
            document.getElementById('pharmacy-item-exp').value = '';
            document.getElementById('pharmacy-item-purpose').value = group?.description || '';
            const title = document.getElementById('new-pharmacy-title');
            if (title) title.textContent = group ? `Dodaj opakowanie: ${group.name}` : 'Dodaj do apteczki';
        });
    };
    window.closeNewPharmacyItemModal = function() {
        stopPharmacyBarcodeScanner();
        if (window.UX?.closeDialog) window.UX.closeDialog('new-pharmacy-item-modal');
        else document.getElementById('new-pharmacy-item-modal')?.classList.add('hidden');
    };
    window.saveNewPharmacyItem = async function() {
        const button = document.querySelector('.js-save-new-pharmacy-item');
        if (button?.disabled) return;
        if (button) button.disabled = true;
        try {
            await stopPharmacyBarcodeScanner();
            await window.PharmacyModel.save({ name: document.getElementById('pharmacy-item-name').value, ean: document.getElementById('pharmacy-item-ean').value, description: document.getElementById('pharmacy-item-purpose').value, expirationDate: document.getElementById('pharmacy-item-exp').value, groupKey: pharmacyPackageGroupKey });
            window.closeNewPharmacyItemModal(); window.showToast('Dodano opakowanie do apteczki.');
        } catch (error) { window.showToast(error.message || 'Nie udało się zapisać produktu.'); }
        finally { if (button) button.disabled = false; }
    };

    window.openEditPharmacyModal = function(id) {
        const item = window.allPharmacyItems.find(p => sameId(p.id, id));
        if (!item) return;

        return window.loadAndShowModal('edit-pharmacy-item-modal', '/modals/edit-pharmacy-item.html', () => {
            document.getElementById('edit-pharmacy-id').value = item.id;
            document.getElementById('edit-pharmacy-name').value = item.name;
            document.getElementById('edit-pharmacy-ean').value = item.ean || '';
            document.getElementById('edit-pharmacy-purpose').value = item.purpose || '';
            if (item.expiration_date) {
                document.getElementById('edit-pharmacy-exp').value = item.expiration_date.substring(0, 7); 
            } else {
                document.getElementById('edit-pharmacy-exp').value = '';
            }
        });
    };

    window.closeEditPharmacyModal = function() { 
        stopPharmacyBarcodeScanner();
        const modal = document.getElementById('edit-pharmacy-item-modal');
        if (window.UX?.closeDialog) window.UX.closeDialog('edit-pharmacy-item-modal');
        else if (modal) modal.classList.add('hidden');
    };

    window.saveEditedPharmacyItem = async function() {
        const id = document.getElementById('edit-pharmacy-id').value;
        const item = (window.AppStore.get()?.pharmacy || []).find(entry => sameId(entry.id, id));
        if (!item) return;
        const button = document.querySelector('.js-save-edit-pharmacy-item');
        if (button?.disabled) return;
        if (button) button.disabled = true;
        try {
            await stopPharmacyBarcodeScanner();
            const expirationDate = packageDate(document.getElementById('edit-pharmacy-exp').value);
            const group = window.PharmacyModel.listGroups().find(entry => entry.packages.some(pack => sameId(pack.id, id)));
            await window.PharmacyModel.updateGroup(group.key, { name: document.getElementById('edit-pharmacy-name').value, ean: document.getElementById('edit-pharmacy-ean').value, description: document.getElementById('edit-pharmacy-purpose').value });
            const { data, error } = await window.supabaseClient.from('pharmacy_items').update({ expiration_date: expirationDate }).eq('id', id).select().single();
            if (error) throw new Error('Opis produktu zapisany. Nie udało się zapisać ważności opakowania — spróbuj ponownie.');
            window.AppStore.set(state => ({ ...state, pharmacy: (state.pharmacy || []).map(entry => sameId(entry.id, id) ? data : entry) }));
            window.closeEditPharmacyModal(); refreshPharmacy(); window.showToast('Zapisano produkt i opakowanie.');
        } catch (error) { window.showToast(error.message || 'Nie udało się zapisać zmian.'); }
        finally { if (button) button.disabled = false; }
    };

    window.deletePharmacyItem = function(id) {
        window.customConfirm("Usunąć to opakowanie z apteczki?", async () => {
            const { error } = await window.supabaseClient.from('pharmacy_items').delete().eq('id', id);
            if (error) { window.showToast("Błąd usuwania: " + error.message); return; }
            window.AppStore.set(state => ({ ...state, pharmacy: (state.pharmacy || []).filter(item => !sameId(item.id, id)) }));
            window.showToast("Usunięto opakowanie."); 
            window.closeEditPharmacyModal();
            window.invalidateDashboardCache?.();
            window.loadPharmacyItems();
        });
    };

    window.HealthEntries = {
        listEpisodes({ profileId = null, activeOnly = false } = {}) {
            const state = window.AppStore.get() || {};
            const tasks = new Map((state.hTasks || []).filter(task => task.task_type === 'duration' && String(task.category || '').toLowerCase() !== 'suplementacja').map(task => [String(task.id), task]));
            return (state.hLogs || []).map(log => {
                const task = tasks.get(String(log.health_task_id));
                return task ? { key: `health_logs:${log.id}`, id: log.id, taskId: task.id, name: task.name, profileId: task.profile_id, startDate: log.start_date, endDate: log.end_date || null, notes: log.notes || '', raw: log, task } : null;
            }).filter(item => item && (!profileId || sameId(item.profileId, profileId)) && (!activeOnly || !item.endDate && !item.task.is_archived)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        },
        async saveEpisode({ name, profileId, startDate, notes = '' }) {
            const scope = healthScope();
            if (!scope.householdId || !scope.userId) throw new Error('Zaloguj się ponownie, aby zapisać epizod.');
            name = String(name || '').trim();
            profileId = profileId || window.getCurrentHealthProfileId();
            if (!name) throw new Error('Wpisz nazwę objawu lub choroby.');
            if (!(window.AppStore.get()?.profiles || []).some(profile => sameId(profile.id, profileId))) throw new Error('Wybierz osobę dla tego wpisu.');
            const start = startDate ? new Date(startDate.length === 10 ? `${startDate}T00:00:00` : startDate) : new Date();
            if (isNaN(start.getTime())) throw new Error('Wybierz prawidłową datę początku.');
            if (start.getTime() > Date.now()) throw new Error('Początek epizodu nie może przypadać w przyszłości.');
            const state = window.AppStore.get() || {};
            let task = (state.hTasks || []).find(item => sameId(item.profile_id, profileId) && item.task_type === 'duration' && !item.is_archived && String(item.name).toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl') && String(item.category || '').toLowerCase() !== 'suplementacja');
            if (task && (state.hLogs || []).some(log => sameId(log.health_task_id, task.id) && !log.end_date)) throw new Error('Taki epizod już trwa. Otwórz go, aby dopisać obserwację.');
            let created = false;
            if (!task) {
                const result = await window.supabaseClient.from('health_tasks').insert([{ profile_id: profileId, name, task_type: 'duration', interval_days: 0, remind_days_before: 0, event_date: null, show_in_history: true, is_archived: false, user_id: scope.userId, household_id: scope.householdId, next_due_at: null, category: 'Infekcja' }]).select().single();
                if (result.error) throw result.error;
                task = result.data; created = true;
            }
            if (!sameHealthScope(scope)) {
                if (created) await window.supabaseClient.from('health_tasks').delete().eq('id', task.id);
                throw new Error('Zmieniono aktywne gospodarstwo. Otwórz ponownie formularz.');
            }
            const result = await window.supabaseClient.from('health_logs').insert([{ health_task_id: task.id, start_date: start.toISOString(), end_date: null, notes: String(notes || '').trim() || null, user_id: scope.userId, household_id: scope.householdId, user_name: window.currentUser.name || 'Domownik' }]).select().single();
            if (result.error) {
                if (created) {
                    const cleanup = await window.supabaseClient.from('health_tasks').delete().eq('id', task.id);
                    if (cleanup.error) await window.supabaseClient.from('health_tasks').update({ is_archived: true }).eq('id', task.id);
                }
                throw new Error('Nie udało się zapisać epizodu. Spróbuj ponownie.');
            }
            if (!sameHealthScope(scope)) throw new Error('Epizod zapisano w poprzednim gospodarstwie. Bieżący widok nie został zmieniony.');
            window.AppStore.set(current => ({ ...current, hTasks: created ? [task, ...(current.hTasks || [])] : current.hTasks, hLogs: [result.data, ...(current.hLogs || [])] }));
            window.selectHealthProfile(profileId); healthTab = 'state';
            window.invalidateDashboardCache?.(); window.renderHealthUI(); window.renderDashboardUI?.();
            return result.data;
        },
        async saveMeasurement({ profileId, type, value, date, notes = '' }) {
            const scope = healthScope();
            if (!scope.householdId || !scope.userId) throw new Error('Zaloguj się ponownie, aby zapisać pomiar.');
            profileId = profileId || window.getCurrentHealthProfileId();
            if (!(window.AppStore.get()?.profiles || []).some(profile => sameId(profile.id, profileId))) throw new Error('Wybierz osobę dla pomiaru.');
            const units = { Waga: 'kg', Wzrost: 'cm', Temperatura: '°C' };
            if (!units[type]) throw new Error('Wybierz rodzaj pomiaru.');
            const numeric = Number(String(value).trim().replace(',', '.'));
            if (!String(value).trim() || !Number.isFinite(numeric)) throw new Error('Wpisz prawidłową wartość pomiaru.');
            const when = date ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : new Date();
            if (isNaN(when.getTime())) throw new Error('Wybierz prawidłową datę pomiaru.');
            const result = await window.supabaseClient.from('health_measurements').insert([{ household_id: scope.householdId, profile_id: profileId, user_id: scope.userId, measurement_type: type, value: numeric, unit: units[type], notes: String(notes || '').trim() || null, created_at: when.toISOString() }]).select().single();
            if (result.error) throw result.error;
            if (!sameHealthScope(scope)) throw new Error('Pomiar zapisano w poprzednim gospodarstwie. Bieżący widok nie został zmieniony.');
            window.AppStore.set(state => ({ ...state, hMeasurements: [result.data, ...(state.hMeasurements || [])] }));
            window.selectHealthProfile(profileId); healthTab = 'history';
            window.invalidateDashboardCache?.(); window.renderHealthUI(); window.loadHealthBook?.();
            return result.data;
        }
    };

    window.openHealthEpisode = function(logId) {
        const state = window.AppStore.get() || {};
        const log = (state.hLogs || []).find(item => sameId(item.id, logId));
        const task = (state.hTasks || []).find(item => sameId(item.id, log?.health_task_id));
        if (!log || !task) return;
        const profile = (state.profiles || []).find(item => sameId(item.id, task.profile_id));
        const supplement = String(task.category || '').toLowerCase() === 'suplementacja';
        showHealthDialog('health-episode-dialog', task.name, `<p class="ux-row-meta">${window.esc(profile?.name || '')} · ${supplement ? 'Dawny wpis suplementacji' : task.task_type === 'duration' ? 'Objaw lub choroba' : 'Zapis zdrowotny'}</p><p class="ux-section-title">Od ${new Date(log.start_date).toLocaleString('pl-PL')}${log.end_date ? ` do ${new Date(log.end_date).toLocaleString('pl-PL')}` : ' · trwa'}</p><p class="ux-pharmacy-description">${window.esc(log.notes || 'Brak dodatkowych obserwacji.')}</p><div class="ux-actions"><button type="button" class="ux-btn js-edit-health-book-item" data-type="log" data-id="${window.esc(log.id)}">${healthIcon('edit')} Edytuj wpis</button>${task.task_type === 'duration' && !log.end_date && !supplement ? `<button type="button" class="ux-btn js-open-quick-health-note" data-id="${window.esc(log.id)}">${healthIcon('note')} Dopisz obserwację</button><button type="button" class="ux-btn primary js-close-health-log" data-id="${window.esc(log.id)}">Zakończ epizod</button>` : ''}</div>`);
    };

    window.openMeasurementDetails = function(id) {
        const state = window.AppStore.get() || {};
        const item = (state.hMeasurements || []).find(entry => sameId(entry.id, id));
        if (!item) return;
        const profile = (state.profiles || []).find(entry => sameId(entry.id, item.profile_id));
        showHealthDialog('health-measurement-dialog', item.measurement_type, `<p class="ux-row-meta">${window.esc(profile?.name || '')} · ${new Date(item.created_at).toLocaleString('pl-PL')}</p><p class="ux-section-title">${window.esc(item.value)} ${window.esc(item.unit || '')}</p><p class="ux-pharmacy-description">${window.esc(item.notes || 'Brak dodatkowej notatki.')}</p><div class="ux-actions"><button type="button" class="ux-btn js-edit-health-book-item" data-type="measurement" data-id="${window.esc(item.id)}">${healthIcon('edit')} Edytuj pomiar</button><button type="button" class="ux-btn ghost js-delete-health-book-item" data-type="measurement" data-id="${window.esc(item.id)}">${healthIcon('trash')} Usuń pomiar</button></div>`);
    };

    window.openHealthDefinition = function(taskId) {
        const state = window.AppStore.get() || {};
        const task = (state.hTasks || []).find(item => sameId(item.id, taskId));
        if (!task) return;
        const profile = (state.profiles || []).find(item => sameId(item.id, task.profile_id));
        const historical = String(task.category || '').toLowerCase() === 'suplementacja';
        showHealthDialog('health-definition-dialog', task.name, `<p class="ux-row-meta">${window.esc(profile?.name || '')}</p><p class="ux-empty">${historical ? 'Dawny wpis suplementacji. Definicja i wcześniejsze zapisy pozostają w historii; nowe leki i suplementy dodawaj do apteczki.' : 'Zachowana definicja zdarzenia zdrowotnego.'}</p><div class="ux-actions"><button type="button" class="ux-btn js-edit-health-definition" data-id="${window.esc(task.id)}">${healthIcon('edit')} Edytuj definicję</button></div>`);
    };

    // --- KSIĄŻECZKA ZDROWIA I POMIARY ---
    window.openNewMeasurementModal = function() { 
        window.closeHealthFabMenu(); 
        if (window.openQuickAddModal) return window.openQuickAddModal({ type: 'measurement', profileId: window.getCurrentHealthProfileId() });
        window.loadAndShowModal('new-measurement-modal', '/modals/new-measurement.html', () => { 
            document.getElementById('measurement-value').value = ''; 
            document.getElementById('measurement-date').value = formatLocalDatetime(new Date().toISOString()); 
            document.getElementById('measurement-notes').value = ''; 
            const profile = (window.AppStore.get()?.profiles || []).find(item => sameId(item.id, currentProfileId));
            const label = document.getElementById('measurement-profile-context');
            if (label) label.textContent = `Dla: ${profile?.name || ''}`;
            window.UX?.openDialog('new-measurement-modal');
        }); 
    };
    
    window.closeNewMeasurementModal = function() { 
        const modal = document.getElementById('new-measurement-modal');
        if (window.UX?.closeDialog) window.UX.closeDialog('new-measurement-modal');
        else if (modal) modal.classList.add('hidden');
    };

    window.saveNewMeasurement = async function() {
        const button = document.querySelector('.js-save-new-measurement');
        if (button?.disabled) return;
        if (button) button.disabled = true;
        try {
            await window.HealthEntries.saveMeasurement({ profileId: window.getCurrentHealthProfileId(), type: document.getElementById('measurement-type').value, value: document.getElementById('measurement-value').value, date: document.getElementById('measurement-date').value, notes: document.getElementById('measurement-notes').value });
            window.closeNewMeasurementModal(); window.showToast('Pomiar zapisany w historii osoby.');
        } catch (error) { window.showToast(error.message || 'Nie udało się zapisać pomiaru.'); }
        finally { if (button) button.disabled = false; }
    };

    window.openHealthBook = function() {
        healthBookVisibleLimit = 100;
        return window.goForward('health-book-screen');
    };
    window.closeHealthBook = function() { window.goBack(); };

    window.deleteHealthBookItem = function(id, type) {
        window.customConfirm("Czy na pewno usunąć ten wpis z historii?", async () => {
            const table = type === 'measurement' ? 'health_measurements' : 'health_logs';
            const { error } = await window.supabaseClient.from(table).delete().eq('id', id);
            
            if (error) { window.showToast("Błąd: " + error.message); return; }
            window.AppStore.set(state => ({ ...state, [type === 'measurement' ? 'hMeasurements' : 'hLogs']: (state[type === 'measurement' ? 'hMeasurements' : 'hLogs'] || []).filter(item => !sameId(item.id, id)) }));
            window.invalidateDashboardCache?.();
            window.UX?.closeDialog('health-measurement-dialog');
            window.UX?.closeDialog('health-episode-dialog');
            window.showToast("Usunięto wpis!");
            window.renderHealthUI(); window.renderDashboardUI?.();
            window.loadHealthBook();
        });
    };

    window.openEditHealthBookItem = function(id, type) {
        const state = window.AppStore.get() || {};
        if (type === 'log') {
            const log = (state.hLogs || []).find(l => sameId(l.id, id));
            if (!log) return;
            const task = (state.hTasks || []).find(t => sameId(t.id, log.health_task_id));

            window.loadAndShowModal('edit-health-log-modal', '/modals/edit-health-log.html', () => {
                document.getElementById('edit-hlog-id').value = log.id;
                const startInput = document.getElementById('edit-hlog-start');
                if (startInput) startInput.value = formatLocalDatetime(log.start_date);
                
                const endContainer = document.getElementById('edit-hlog-end-container');
                const endInput = document.getElementById('edit-hlog-end');
                
                if (task && task.task_type === 'duration') {
                    if (endContainer) endContainer.classList.remove('hidden');
                    if (endInput) endInput.value = log.end_date ? formatLocalDatetime(log.end_date) : '';
                } else {
                    if (endContainer) endContainer.classList.add('hidden');
                    if (endInput) endInput.value = '';
                }
            });
        } else if (type === 'measurement') {
            const meas = (state.hMeasurements || []).find(m => sameId(m.id, id));
            if (!meas) return;
            window.loadAndShowModal('edit-measurement-modal', '/modals/edit-measurement.html', () => {
                document.getElementById('edit-meas-id').value = meas.id;
                document.getElementById('edit-meas-value').value = meas.value;
                document.getElementById('edit-meas-date').value = formatLocalDatetime(meas.created_at);
                document.getElementById('edit-meas-notes').value = meas.notes || '';
                const profile = (state.profiles || []).find(item => sameId(item.id, meas.profile_id));
                document.getElementById('edit-measurement-profile').textContent = `Dla: ${profile?.name || ''} · ${meas.measurement_type}`;
                document.getElementById('edit-measurement-value-label').textContent = `Wartość (${meas.unit || ''})`;
                window.UX?.openDialog('edit-measurement-modal');
            });
        }
    };

    window.closeEditHealthLogModal = function() {
        const modal = document.getElementById('edit-health-log-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.closeEditMeasurementModal = function() {
        const modal = document.getElementById('edit-measurement-modal');
        if (window.UX?.closeDialog) window.UX.closeDialog('edit-measurement-modal');
        else if (modal) modal.classList.add('hidden');
    };

    window.saveEditHealthLog = async function() {
        if (document.activeElement) document.activeElement.blur();

        const state = window.AppStore.get() || {};
        const id = document.getElementById('edit-hlog-id').value;
        const startStr = document.getElementById('edit-hlog-start').value;
        const endStr = document.getElementById('edit-hlog-end').value;
        
        if (!id || !startStr) return;

        const log = (state.hLogs || []).find(l => sameId(l.id, id));
        if (!log) return;
        const task = (state.hTasks || []).find(t => sameId(t.id, log.health_task_id));

        const startDateIso = parseLocalDatetime(startStr).toISOString();
        let endDateIso = log.end_date; 
        
        if (task && task.task_type === 'duration') {
            endDateIso = endStr ? parseLocalDatetime(endStr).toISOString() : null;
            if (endDateIso && new Date(endDateIso) < new Date(startDateIso)) { window.showToast('Koniec epizodu nie może poprzedzać jego początku.'); return; }
        } else {
            endDateIso = startDateIso;
        }

        const { error } = await window.supabaseClient.from('health_logs')
            .update({ start_date: startDateIso, end_date: endDateIso })
            .eq('id', id);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.AppStore.set(state => ({ ...state, hLogs: (state.hLogs || []).map(item => sameId(item.id, id) ? { ...item, start_date: startDateIso, end_date: endDateIso } : item) }));
        window.invalidateDashboardCache?.();
        window.closeEditHealthLogModal();
        window.showToast("Zaktualizowano wpis!");
        window.renderHealthUI(); window.renderDashboardUI?.(); window.loadHealthBook();
    };

    window.saveEditMeasurement = async function() {
        if (document.activeElement) document.activeElement.blur();

        const id = document.getElementById('edit-meas-id').value;
        const valRaw = document.getElementById('edit-meas-value').value.trim();
        const dateStr = document.getElementById('edit-meas-date').value;
        const notes = document.getElementById('edit-meas-notes').value.trim();
        if (!id || !valRaw || !dateStr) return;

        const numericVal = Number(valRaw.replace(',', '.'));
        if (!Number.isFinite(numericVal)) { window.showToast("Podaj poprawną liczbę!"); return; }

        const finalDate = parseLocalDatetime(dateStr).toISOString();

        const { error } = await window.supabaseClient.from('health_measurements')
            .update({ value: numericVal, created_at: finalDate, notes: notes })
            .eq('id', id);

        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.AppStore.set(state => ({ ...state, hMeasurements: (state.hMeasurements || []).map(item => sameId(item.id, id) ? { ...item, value: numericVal, created_at: finalDate, notes } : item) }));
        window.invalidateDashboardCache?.();
        window.closeEditMeasurementModal();
        window.showToast("Zaktualizowano pomiar!");
        window.renderHealthUI(); window.renderDashboardUI?.(); window.loadHealthBook();
    };

    window.loadHealthBook = async function() {
        const tl = document.getElementById('health-book-timeline');
        if (!tl) return;
        tl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Analizowanie danych...</p>`;
        
        try {
            const state = window.AppStore.get() || {};
            const profiles = state.profiles || [];
            const profile = profiles.find(p => sameId(p.id, currentProfileId));
            
            if (profile) {
                const subtitle = document.getElementById('health-book-subtitle');
                if (subtitle) subtitle.innerText = `Pacjent: ${profile.name}`;
            }

            const allMeas = state.hMeasurements || [];
            const allTasks = state.hTasks || [];
            const allLogs = state.hLogs || [];

            const measurements = allMeas.filter(m => sameId(m.profile_id, currentProfileId));
            const tasks = allTasks.filter(t => sameId(t.profile_id, currentProfileId));
            const taskById = new Map(tasks.map(task => [String(task.id), task]));
            const profileLogs = allLogs.filter(log => taskById.has(String(log.health_task_id)));
            const measurementGroups = new Map();
            allMeas.forEach(measurement => {
                const key = `${measurement.profile_id}::${measurement.measurement_type}`;
                if (!measurementGroups.has(key)) measurementGroups.set(key, []);
                measurementGroups.get(key).push(measurement);
            });
            const previousMeasurementById = new Map();
            measurementGroups.forEach(group => {
                group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                for (let i = 0; i < group.length - 1; i++) {
                    previousMeasurementById.set(String(group[i].id), group[i + 1].value);
                }
            });
            
            let timelineItems = [];

            measurements.forEach(m => {
                const trendHtml = getMeasurementTrendHtml(previousMeasurementById.get(String(m.id)), m);
                timelineItems.push({
                    id: m.id,
                    type: 'measurement',
                    date: new Date(m.created_at),
                    title: `Pomiar: ${m.measurement_type}`,
                    desc: `Wynik: <span class="text-[#c2e7ff] font-bold">${window.esc(m.value)} ${window.esc(m.unit || '')}</span>${trendHtml}${m.notes ? `<br><span class="text-[10px] opacity-70">${window.esc(m.notes)}</span>` : ''}`,
                    icon: healthIcon('thermometer'),
                    color: 'text-[#c2e7ff]',
                    bg: 'bg-[#004a77]/10 border-[#004a77]/30'
                });
            });

            profileLogs.forEach(l => {
                const task = taskById.get(String(l.health_task_id));
                if (!task) return;

                const wykonawca = l.user_name || 'Domownik';
                let szczegoly = task.task_type === 'duration' 
                    ? (l.end_date ? `Zdarzenie trwało do ${new Date(l.end_date).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}` : 'Zdarzenie nadal trwa')
                    : `Zarejestrowano wykonanie zadania`;

                timelineItems.push({
                    id: l.id,
                    type: 'log',
                    date: new Date(l.start_date),
                    title: String(task.category || '').toLowerCase() === 'suplementacja' ? `${task.name} · dawny wpis suplementacji` : task.name,
                    desc: `<span class="text-neutral-400">Pacjent:</span> ${window.esc(profile ? profile.name : 'Nieznany')}<br><span class="text-neutral-400">Wpisał(a):</span> ${window.esc(wykonawca)}<br><span class="text-[10px] text-neutral-500">${szczegoly}</span>${l.notes ? `<div class="mt-1 bg-[#131314]/60 p-2 rounded text-[11px] text-neutral-300 font-mono whitespace-pre-wrap">${window.esc(l.notes)}</div>` : ''}`,
                    icon: healthIcon(task.task_type === 'duration' ? 'activity' : 'history'),
                    color: task.task_type === 'duration' ? 'text-[#ffb4ab]' : 'text-[#c4eed0]',
                    bg: task.task_type === 'duration' ? 'bg-[#3c1414]/30 border-[#8c1d18]/40' : 'bg-[#0f5223]/10 border-[#0f5223]/30'
                });
            });

            timelineItems.sort((a, b) => b.date - a.date);

            if (timelineItems.length === 0) {
                tl.innerHTML = `<div class="py-10 text-neutral-500 text-xs text-center">Brak wpisów w książeczce dla: ${window.esc(profile ? profile.name : 'tego profilu')}</div>`;
                return;
            }

            let html = `
            <div class="flex justify-end mb-2">
                <button class="js-open-doctor-report bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] text-xs px-3 py-1.5 rounded-full font-medium active:scale-95 transition-transform flex items-center gap-1.5 cursor-pointer touch-manipulation">
                    ${healthIcon('note')} Raport dla lekarza
                </button>
            </div>`;
            
            let lastMonthYear = '';
            const visibleItems = timelineItems.slice(0, healthBookVisibleLimit);
            
            visibleItems.forEach(item => {
                const monthYear = item.date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
                if (monthYear !== lastMonthYear) {
                    html += `<div class="sticky top-0 bg-[#131314]/90 backdrop-blur-md z-10 py-2 border-b border-[#333537] mb-4 mt-6"><h3 class="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-2">${monthYear}</h3></div>`;
                    lastMonthYear = monthYear;
                }
                
                html += `
                <div class="relative pl-6 sm:pl-8 py-3 group border-l-2 border-[#333537] ml-4 sm:ml-6 animate-fade-in">
                    <div class="absolute -left-[17px] top-3 w-8 h-8 rounded-full ${item.bg} border flex items-center justify-center text-sm shadow-sm">${item.icon}</div>
                    <div class="bg-[#1e1f20] rounded-[16px] p-4 border border-[#333537] shadow-sm relative overflow-hidden flex justify-between items-start gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] text-neutral-500 font-medium mb-1">${item.date.toLocaleDateString('pl-PL')} • ${item.date.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}</p>
                            <h4 class="text-sm font-bold ${item.color} mb-1 truncate">${window.esc(item.title)}</h4>
                            <p class="text-xs text-neutral-400 leading-relaxed">${item.desc}</p>
                        </div>
                        <div class="flex flex-col gap-2 shrink-0">
                            <button class="js-edit-health-book-item w-8 h-8 flex items-center justify-center rounded-full bg-[#004a77]/20 text-[#a8c7fa] border border-[#004a77]/30 active:scale-90 transition-transform cursor-pointer touch-manipulation" data-id="${item.id}" data-type="${item.type}" title="Edytuj wpis">${healthIcon('edit')}</button>
                            <button class="js-delete-health-book-item w-8 h-8 flex items-center justify-center rounded-full bg-[#3c1414]/40 text-[#ffb4ab] border border-[#8c1d18]/50 active:scale-90 transition-transform cursor-pointer touch-manipulation" data-id="${item.id}" data-type="${item.type}" title="Usuń wpis">${healthIcon('trash')}</button>
                        </div>
                    </div>
                </div>`;
            });

            if (timelineItems.length > visibleItems.length) {
                const remaining = timelineItems.length - visibleItems.length;
                html += `<button class="js-health-book-more w-full min-h-11 mt-3 rounded-full border border-[#333537] text-neutral-300 text-xs font-medium active:opacity-70">Pokaż ${Math.min(100, remaining)} starszych wpisów (${remaining} pozostało)</button>`;
            }
            tl.innerHTML = html;

        } catch (err) {
            console.error("Błąd ładowania Książeczki:", err);
            tl.innerHTML = `<p class="text-center text-rose-400 text-xs py-10">Błąd: ${window.esc(err.message)}</p>`;
        }
    };

    window.openDayDetails = function(dateStr) {
        window.loadAndShowModal('day-details-modal', '/modals/day-details.html', () => {
            const list = document.getElementById('day-details-list');
            document.getElementById('day-details-title').innerText = "Szczegóły Zdrowia";
            document.getElementById('day-details-date').innerText = new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const state = window.AppStore.get() || {};
            const hTasks = (state.hTasks || []).filter(t => sameId(t.profile_id, currentProfileId) && !t.is_archived);
            const hLogs = state.hLogs || [];

            const dayLogs = hLogs.filter(l => { 
                const task = hTasks.find(t => sameId(t.id, l.health_task_id));
                if (!task) return false;
                const start = l.start_date.split('T')[0]; 
                const end = l.end_date ? l.end_date.split('T')[0] : getLocalDayStr(); 
                return dateStr >= start && dateStr <= end; 
            });
            
            const oneTimeEvents = hTasks.filter(t => t.task_type === 'one_time' && t.event_date === dateStr);
            
            if (dayLogs.length === 0 && oneTimeEvents.length === 0) { 
                list.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Brak zdarzeń.</p>`; 
            } else {
                let itemsHtml = '';
                oneTimeEvents.forEach(t => { 
                    const isDone = hLogs.some(l => sameId(l.health_task_id, t.id)); 
                    itemsHtml += window.UI.renderHealthDayEvent(t, isDone); 
                });
                dayLogs.forEach(l => { 
                    const task = hTasks.find(t => sameId(t.id, l.health_task_id)); 
                    if (task) itemsHtml += window.UI.renderHealthDayLog(task, l); 
                });
                list.innerHTML = itemsHtml;
            }
        });
    };

    window.closeDayDetailsModal = function() { 
        const modal = document.getElementById('day-details-modal');
        if(modal) modal.classList.add('hidden');
    };

    // ==========================================
    // DELEGACJA ZDARZEŃ (VIA DISPATCHER)
    // ==========================================
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-health-tab', (event, element) => window.selectHealthTab(element.dataset.tab));
        window.EventDispatcher.onClick('.js-health-add-episode', () => window.openQuickAddModal?.({ type: 'episode', profileId: window.getCurrentHealthProfileId() }));
        window.EventDispatcher.onClick('.js-health-add-measurement', () => window.openQuickAddModal?.({ type: 'measurement', profileId: window.getCurrentHealthProfileId() }));
        window.EventDispatcher.onClick('.js-health-add-event', () => window.openQuickAddModal?.({ type: 'event', profileId: window.getCurrentHealthProfileId(), area: 'Zdrowie' }));
        window.EventDispatcher.onClick('.js-health-scan-product', () => window.openQuickAddModal?.({ type: 'pharmacy', scan: true }));
        window.EventDispatcher.onClick('.js-open-health-episode', (event, element) => window.openHealthEpisode(element.dataset.id));
        window.EventDispatcher.onClick('.js-open-measurement-details', (event, element) => window.openMeasurementDetails(element.dataset.id));
        window.EventDispatcher.onClick('.js-open-health-definition', (event, element) => window.openHealthDefinition(element.dataset.id));
        window.EventDispatcher.onClick('.js-edit-health-definition', (event, element) => { window.UX?.closeDialog('health-definition-dialog'); window.openHealthSettingsScreen(element.dataset.id); });
        window.EventDispatcher.onClick('.js-health-event-detail', (event, element) => window.openEventDetails?.(element.dataset.key, { date: element.dataset.date }));
        window.EventDispatcher.onClick('.js-health-task-detail', (event, element) => window.openTaskDetails?.(element.dataset.key));
        window.EventDispatcher.onClick('.js-health-history-more', () => { healthBookVisibleLimit += 100; window.renderHealthUI(); });
        window.EventDispatcher.onClick('.js-open-pharmacy-product', (event, element) => window.openPharmacyProduct(element.dataset.key));
        window.EventDispatcher.onClick('.js-edit-pharmacy-product', (event, element) => { window.UX?.closeDialog('pharmacy-product-dialog'); window.openEditPharmacyProduct(element.dataset.key); });
        window.EventDispatcher.onClick('.js-edit-pharmacy-package', (event, element) => { window.UX?.closeDialog('pharmacy-product-dialog'); window.openEditPharmacyModal(element.dataset.id); });
        window.EventDispatcher.onClick('.js-add-pharmacy-package', (event, element) => { window.UX?.closeDialog('pharmacy-product-dialog'); window.openQuickAddModal?.({ type: 'pharmacy', pharmacyKey: element.dataset.key }); });
        window.EventDispatcher.onClick('.js-pharmacy-scan-open', (event, element) => { window.UX?.closeDialog('pharmacy-scan-choice-dialog'); window.closeNewPharmacyItemModal(); window.openPharmacyProduct(element.dataset.key); });
        window.EventDispatcher.onClick('.js-pharmacy-scan-package', (event, element) => { window.UX?.closeDialog('pharmacy-scan-choice-dialog'); window.openNewPharmacyItemModal(element.dataset.key); });
        window.EventDispatcher.onClick('.js-close-health-dialog', (event, element) => { if (window.UX?.closeDialog) window.UX.closeDialog(element.dataset.dialog); else document.getElementById(element.dataset.dialog)?.classList.add('hidden'); });
        window.EventDispatcher.onClick('.js-save-pharmacy-product', async (event, element) => {
            if (element.disabled) return;
            element.disabled = true;
            try {
                const group = await window.PharmacyModel.updateGroup(document.getElementById('pharmacy-product-key').value, { name: document.getElementById('pharmacy-product-name').value, description: document.getElementById('pharmacy-product-description').value, ean: document.getElementById('pharmacy-product-ean').value });
                window.UX?.closeDialog('pharmacy-edit-product-dialog'); window.openPharmacyProduct(group.key); window.showToast('Zapisano opis produktu.');
            } catch (error) { document.getElementById('pharmacy-product-error').textContent = error.message || 'Nie udało się zapisać.'; }
            finally { element.disabled = false; }
        });
        window.EventDispatcher.onClick('.js-save-edit-pharmacy-item', () => window.saveEditedPharmacyItem());
        window.EventDispatcher.onClick('.js-close-edit-pharmacy-item', () => window.closeEditPharmacyModal());
        window.EventDispatcher.onClick('.js-delete-current-pharmacy-package', () => window.deletePharmacyItem(document.getElementById('edit-pharmacy-id')?.value));
        window.EventDispatcher.onClick('.js-close-pharmacy-screen', () => window.closePharmacyScreen());
        window.EventDispatcher.onClick('.js-close-health-book', () => window.closeHealthBook());
        window.EventDispatcher.onClick('.js-toggle-health-view', async () => {
            await window.switchView('calendar');
            if (typeof window.CalendarModule?.setFilter === 'function') window.CalendarModule.setFilter('Zdrowie');
            if (typeof window.CalendarModule?.setProfileFilter === 'function') window.CalendarModule.setProfileFilter(currentProfileId);
        });
        
        window.EventDispatcher.onClick('.js-open-health-book', () => window.openHealthBook());
        window.EventDispatcher.onClick('.js-open-pharmacy', () => window.openPharmacyScreen());
        window.EventDispatcher.onClick('.js-toggle-profile-switcher', () => window.toggleProfileSwitcher());
        window.EventDispatcher.onClick('.js-open-health-fab-menu', () => window.openHealthFabMenu());

        window.EventDispatcher.onClick('.js-open-quick-health-note', (e, el) => window.openQuickHealthNoteModal(el.dataset.id));
        window.EventDispatcher.onClick('.js-open-doctor-report', () => window.openDoctorReport(14));
        window.EventDispatcher.onClick('.js-close-doctor-report', () => {
            const reportModal = document.getElementById('doctor-report-modal');
            if (reportModal) reportModal.remove();
        });

        // BEZPIECZNE PRZEŁĄCZANIE PROFILU Z DELEGACJĄ DLA TOUCH
        window.EventDispatcher.onClick('.js-select-health-profile', (e, el) => {
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.selectHealthProfile(targetEl.dataset.id);
        });

        window.EventDispatcher.onClick('.js-select-profile', (e, el) => {
            const targetEl = el.dataset.id ? el : el.closest('[data-id]');
            if (targetEl) window.selectHealthProfile(targetEl.dataset.id);
        });

        window.EventDispatcher.onClick('.js-close-health-log', (e, el) => window.closeHealthLog(el.dataset.id));
        window.EventDispatcher.onClick('.js-start-health-log', (e, el) => window.startHealthLog(el.dataset.id, el.dataset.type));
        window.EventDispatcher.onClick('.js-open-health-settings', (e, el) => window.openHealthSettingsScreen(el.dataset.id));
        
        window.EventDispatcher.onClick('.js-open-day-details', (e, el) => window.openDayDetails(el.dataset.date));
        window.EventDispatcher.onClick('.js-close-day-details-modal', () => window.closeDayDetailsModal());

        window.EventDispatcher.onClick('.js-delete-pharmacy-item', (e, el) => window.deletePharmacyItem(el.dataset.id));
        
        window.EventDispatcher.onClick('.js-open-edit-pharmacy', (e, el) => {
            if (e.target.closest('.js-delete-pharmacy-item')) return;
            return window.openEditPharmacyModal(el.dataset.id);
        });
        
        window.EventDispatcher.onClick('.js-delete-health-book-item', (e, el) => {
            window.deleteHealthBookItem(el.dataset.id, el.dataset.type);
        });

        window.EventDispatcher.onClick('.js-health-book-more', () => {
            healthBookVisibleLimit += 100;
            window.loadHealthBook();
        });

        window.EventDispatcher.onClick('.js-edit-health-book-item', (e, el) => {
            window.UX?.closeDialog('health-episode-dialog');
            window.UX?.closeDialog('health-measurement-dialog');
            window.openEditHealthBookItem(el.dataset.id, el.dataset.type);
        });
        window.EventDispatcher.onClick('.js-close-edit-hlog', () => window.closeEditHealthLogModal());
        window.EventDispatcher.onClick('.js-save-edit-hlog', () => window.saveEditHealthLog());

        window.EventDispatcher.onClick('.js-close-edit-measurement', () => window.closeEditMeasurementModal());
        window.EventDispatcher.onClick('.js-save-edit-measurement', () => window.saveEditMeasurement());

        window.EventDispatcher.onClick('.js-close-health-fab-menu', () => window.closeHealthFabMenu());
        window.EventDispatcher.onClick('.js-open-new-duration', () => window.openNewDurationModal());
        window.EventDispatcher.onClick('.js-open-new-event', () => window.openNewEventModal());
        window.EventDispatcher.onClick('.js-open-new-routine', () => window.openNewRoutineModal());
        window.EventDispatcher.onClick('.js-open-new-measurement', () => window.openNewMeasurementModal());
        
        window.EventDispatcher.onClick('.js-close-new-pharmacy-item', () => window.closeNewPharmacyItemModal());
        window.EventDispatcher.onClick('.js-save-new-pharmacy-item', () => window.saveNewPharmacyItem());
        window.EventDispatcher.onClick('.js-scan-pharmacy-barcode', (e, el) => {
            e.preventDefault();
            window.startPharmacyBarcodeScan(el.dataset.nameInput, el.dataset.eanInput, el.dataset.scannerElement);
        });

        window.EventDispatcher.onClick('.js-close-new-measurement', () => window.closeNewMeasurementModal());
        window.EventDispatcher.onClick('.js-save-new-measurement', () => window.saveNewMeasurement());

        window.EventDispatcher.onClick('.js-close-new-health-task', () => window.closeNewHealthTaskModal());
        window.EventDispatcher.onClick('.js-save-new-health-task', () => window.saveNewHealthTask());

        window.EventDispatcher.onClick('.js-close-health-settings', () => window.closeHealthSettingsScreen());
        window.EventDispatcher.onClick('.js-save-health-settings', () => window.saveHealthSettings());
        window.EventDispatcher.onClick('.js-delete-health-task', () => window.deleteHealthTask());
        
        window.EventDispatcher.onClick('.js-close-edit-profile', () => window.closeEditProfileModal?.());
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    document.addEventListener('change', event => {
        if (event.target?.id === 'health-person-select') window.selectHealthProfile(event.target.value);
        if (event.target?.id === 'measurement-type') {
            const unit = { Waga: 'kg', Wzrost: 'cm', Temperatura: '°C' }[event.target.value] || '';
            const label = document.getElementById('measurement-value-label');
            if (label) label.textContent = `Wartość (${unit})`;
        }
    });
    document.addEventListener('input', event => {
        if (event.target?.id === 'health-pharmacy-search') { pharmacySearchQuery = event.target.value; renderPharmacyGroups(document.getElementById('health-pharmacy-list'), pharmacySearchQuery); }
    });

    return { init: window.initHealthModule };
})();
