// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

window.SettingsModule = (() => {
    let appRooms = []; 
    let appProfiles = [];
    let currentEditingTaskId = null;

    window.cascadeNameChange = async function(oldName, newName) {
        if (!oldName || !newName || oldName === newName) return;
        const hid = window.currentUser.household_id;
        
        try {
            await Promise.all([
                window.supabaseClient.from('activity_logs').update({ user_name: newName }).eq('household_id', hid).eq('user_name', oldName),
                window.supabaseClient.from('health_logs').update({ user_name: newName }).eq('household_id', hid).eq('user_name', oldName),
                window.supabaseClient.from('todos').update({ creator_name: newName }).eq('household_id', hid).eq('creator_name', oldName),
                window.supabaseClient.from('todos').update({ completer_name: newName }).eq('household_id', hid).eq('completer_name', oldName)
            ]);
            
            if (window.AppStore && typeof window.AppStore.get === 'function') {
                const state = window.AppStore.get() || {};
                let modified = false;
                
                if (state.logs) { state.logs.forEach(l => { if(l.user_name === oldName) { l.user_name = newName; modified = true; } }); }
                if (state.hLogs) { state.hLogs.forEach(l => { if(l.user_name === oldName) { l.user_name = newName; modified = true; } }); }
                if (state.todos) { 
                    state.todos.forEach(t => { 
                        if(t.creator_name === oldName) { t.creator_name = newName; modified = true; }
                        if(t.completer_name === oldName) { t.completer_name = newName; modified = true; }
                    }); 
                }
                if (modified) window.AppStore.set(state);
            }
        } catch (err) {
            console.error("Błąd kaskadowej zmiany imienia:", err);
        }
    };

    window.initSettingsModule = async function(forceRefresh = false) {
        const hidLabel = document.getElementById('household-id-label');
        if (hidLabel && window.currentUser) hidLabel.innerText = window.currentUser.household_id; 
        
        const nameInput = document.getElementById('settings-user-name');
        if (nameInput && window.currentUser?.name) nameInput.value = window.currentUser.name; 
        
        await Promise.all([window.loadAppRooms(forceRefresh), window.loadAppProfiles(forceRefresh)]);
        window.checkNotificationStatus(); 
    };

    window.saveUserName = async function() {
        const name = document.getElementById('settings-user-name').value.trim();
        if(!name) return;
        
        const oldName = window.currentUser.name;

        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ name: name })
            .eq('id', window.currentUser.id);

        if (error) {
            window.showToast("Błąd: " + error.message); 
        } else { 
            if (oldName !== name) {
                window.showToast("Zmieniam we wszystkich zadaniach...");
                await window.cascadeNameChange(oldName, name);
            }
            
            window.currentUser.name = name; 
            window.showToast("Imię zaktualizowane w pełni!"); 
            
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            if (typeof window.loadAppProfiles === 'function') window.loadAppProfiles();
        }
    };

    window.openRoomsSettings = function() { window.goForward('settings-rooms-screen'); };
    window.openProfilesSettings = function() { window.goForward('settings-profiles-screen'); };

    window.checkNotificationStatus = async function() {
        const statusText = document.getElementById('notif-status-text'); 
        const btn = document.getElementById('notif-enable-btn');
        if (!statusText || !btn) return;
        if (!("Notification" in window)) { statusText.innerText = "Brak wsparcia."; btn.classList.add('hidden'); return; }
        if (Notification.permission !== 'granted') {
            statusText.innerText = Notification.permission === 'denied' ? 'Zablokowane w ustawieniach przeglądarki' : 'Wymaga zgody';
            btn.textContent = 'Włącz'; btn.classList.toggle('hidden', Notification.permission === 'denied'); return;
        }
        statusText.innerText = 'Zgoda udzielona — sprawdzam konfigurację';
        btn.classList.remove('hidden'); btn.textContent = 'Skonfiguruj';
        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            const subscription = await registration?.pushManager?.getSubscription();
            if (!subscription) { statusText.innerText = 'Zgoda udzielona — dokończ konfigurację'; return; }
            const { data, error } = await window.supabaseClient.from('push_subscriptions').select('endpoint').eq('endpoint', subscription.endpoint).eq('user_id', window.currentUser.user_id).limit(1);
            if (!error && data?.length) { statusText.innerText = 'Powiadomienia skonfigurowane'; btn.classList.add('hidden'); }
            else statusText.innerText = 'Zgoda udzielona — konfiguracja wymaga sprawdzenia';
        } catch (error) { statusText.innerText = 'Zgoda udzielona — konfiguracja wymaga sprawdzenia'; }
    };

    window.requestNotificationPermission = async function() {
        try {
            const permission = await Notification.requestPermission();
            window.checkNotificationStatus();
            if (permission !== "granted") { window.showToast("Brak zgody."); return; }
            window.showToast("Konfiguruję powiadomienia...");

            const registration = await navigator.serviceWorker.ready;
            const publicVapidKey = window.CONFIG.VAPID_PUBLIC_KEY;
            if (!publicVapidKey) { window.showToast("Błąd klucza VAPID."); return; }

            const applicationServerKey = window.urlB64ToUint8Array(publicVapidKey);
            const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey });
            const subJSON = subscription.toJSON();

            await window.supabaseClient.from('push_subscriptions').delete().eq('endpoint', subJSON.endpoint);

            const { error } = await window.supabaseClient.from('push_subscriptions').insert([{
                user_id: window.currentUser.user_id,
                endpoint: subJSON.endpoint,
                auth: subJSON.keys.auth,
                p256dh: subJSON.keys.p256dh
            }]);

            if (error) window.showToast("Błąd bazy!");
            else { window.showToast("Powiadomienia skonfigurowane."); await window.checkNotificationStatus(); }
        } catch (err) { window.showToast("Błąd: " + err.message); }
    };

    // --- ZARZĄDZANIE POMIESZCZENIAMI ---
    window.fetchRoomsFromDB = async function(forceRefresh = false) {
        await window.loadDashboardOverview?.(forceRefresh);
        appRooms = (window.AppStore.get()?.rooms || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        return appRooms;
    };

    window.loadAppRooms = async function(forceRefresh = false) {
        const listEl = document.getElementById('settings-rooms-list'); 
        if(!listEl) return;
        const render = () => {
        appRooms = (window.AppStore.get()?.rooms || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        if (appRooms.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak pomieszczeń.</p>`; return; }
        listEl.innerHTML = appRooms.map(room => `
            <div class="ux-row">
                ${window.UX.icon('room')}<span class="ux-row-main ux-row-title">${window.esc(room.name)}</span>
                <div class="ux-row-actions">
                    <button type="button" class="js-edit-room ux-icon-btn" aria-label="Edytuj pomieszczenie" data-name="${window.esc(room.name)}" data-room-icon="${window.esc(room.icon || 'room')}">${window.UX.icon('edit')}</button>
                    <button type="button" class="js-delete-room ux-icon-btn" aria-label="Usuń pomieszczenie" data-name="${window.esc(room.name)}">${window.UX.icon('trash')}</button>
                </div>
            </div>`).join('');
        };
        render();
        await window.loadDashboardOverview?.(forceRefresh);
        render();
    };

    window.openNewRoomModal = function() { 
        // ZMIANA KRYTYCZNA: Korzystamy z nowej architektury
        window.loadAndShowModal('new-room-modal', '/modals/new-room.html', () => {
            document.getElementById('new-room-name').value = ''; 
            document.getElementById('new-room-icon').value = 'room';
        });
    };

    window.closeNewRoomModal = function() { 
        const modal = document.getElementById('new-room-modal');
        if (modal) { setTimeout(() => { modal.classList.add('hidden'); }, 10); }
    };

    window.saveNewRoom = async function() {
        const name = document.getElementById('new-room-name').value.trim(); const icon = document.getElementById('new-room-icon').value.trim();
        if (!name) return;
        if(window._savingRoom)return;window._savingRoom=true;
        const { data, error } = await window.supabaseClient.from('rooms').insert([{ name: name, icon: icon || 'room', user_id: window.currentUser.user_id, household_id: window.currentUser.household_id }]).select().single();
        window._savingRoom=false;
        if (error) window.showToast('Błąd zapisu'); else { 
            window.AppStore.set(state=>({...state,rooms:[...(state.rooms||[]),data]}));appRooms=window.AppStore.get().rooms.slice();
            window.closeNewRoomModal(); 
            window.showToast('Dodano!'); 
            window.invalidateDashboardCache(); 
            window.loadAppRooms(); 
        }
    };

    window.openEditRoomModal = function(name, icon) {
        // ZMIANA KRYTYCZNA: Korzystamy z nowej architektury
        window.loadAndShowModal('edit-room-modal', '/modals/edit-room.html', () => {
            document.getElementById('edit-room-old-name').value = name; 
            document.getElementById('edit-room-name').value = name; 
            document.getElementById('edit-room-icon').value = icon || '📦'; 
        });
    };

    window.closeEditRoomModal = function() { 
        const modal = document.getElementById('edit-room-modal');
        if (modal) { setTimeout(() => { modal.classList.add('hidden'); }, 10); }
    };

    window.saveEditRoom = async function() {
        const oldName = document.getElementById('edit-room-old-name').value; const newName = document.getElementById('edit-room-name').value.trim(); const newIcon = document.getElementById('edit-room-icon').value.trim() || '📦';
        if (!newName) return;
        const { error } = await window.supabaseClient.from('rooms').update({ name: newName, icon: newIcon }).eq('name', oldName).eq('household_id', window.currentUser.household_id);
        if (error) window.showToast('Błąd zapisu');
        else {
            const changedTasks=await window.supabaseClient.from('tasks').update({ room: newName }).eq('room', oldName).eq('household_id', window.currentUser.household_id);
            if(changedTasks.error){window.showToast('Nazwa pokoju została zmieniona, ale nie udało się zaktualizować części zadań. Odśwież i spróbuj ponownie.');return;}
            window.AppStore.set(state=>({...state,rooms:(state.rooms||[]).map(r=>r.name===oldName?{...r,name:newName,icon:newIcon}:r),tasks:(state.tasks||[]).map(t=>t.room===oldName?{...t,room:newName}:t)}));appRooms=window.AppStore.get().rooms.slice();
            window.closeEditRoomModal(); 
            window.showToast('Zaktualizowano!'); 
            window.invalidateDashboardCache(); 
            window.loadAppRooms(); 
            setTimeout(() => window.refreshCurrentView(), 150);
        }
    };

    window.deleteRoom = function(name) {
        window.customConfirm(`Usunąć pomieszczenie "${name}"?`, async () => {
            const { error } = await window.supabaseClient.from('rooms').delete().eq('name', name).eq('household_id', window.currentUser.household_id);
            if (error) { window.showToast('Błąd: ' + error.message); return; }
            
            await window.supabaseClient.from('tasks').update({ room: null }).eq('room', name).eq('household_id', window.currentUser.household_id);
            window.AppStore.set(state=>({...state,rooms:(state.rooms||[]).filter(r=>r.name!==name),tasks:(state.tasks||[]).map(t=>t.room===name?{...t,room:null}:t)}));appRooms=window.AppStore.get().rooms.slice();

            window.showToast('Usunięto'); 
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache(); 
            window.loadAppRooms(); 
            setTimeout(() => window.refreshCurrentView(), 150);
        });
    };

    window.populateRoomsDropdown = async function(selectId, selectedValue = '') {
        const selectEl = document.getElementById(selectId); if (!selectEl) return;
        if (appRooms.length === 0) await window.fetchRoomsFromDB();
        selectEl.innerHTML = appRooms.map(r => `<option value="${window.esc(r.name)}">${window.esc(r.name)}</option>`).join('') + `<option value="Inne">Inne</option>`;
        if (selectedValue) selectEl.value = selectedValue;
    };

    // --- ZARZĄDZANIE DOMOWNIKAMI ---
    window.loadAppProfiles = async function(forceRefresh = false) {
        const listEl = document.getElementById('settings-profiles-list');
        if (!listEl) return;
        const render = () => {
        appProfiles = (window.AppStore.get()?.profiles || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        if (appProfiles.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak domowników.</p>`; return; }
        listEl.innerHTML = appProfiles.map(p => `
            <button type="button" class="ux-row js-edit-profile" data-id="${window.esc(String(p.id))}">
                ${window.UX.icon('person')}<span class="ux-row-main ux-row-title">${window.esc(p.name)}</span>${window.UX.icon('chevron')}
            </button>`).join('');
        };
        render();
        await window.loadDashboardOverview?.(forceRefresh);
        render();
    };

    window.openNewProfileModal = function() { 
        // ZMIANA KRYTYCZNA: Korzystamy z nowej architektury
        window.loadAndShowModal('new-profile-modal', '/modals/new-profile.html', () => {
            document.getElementById('new-profile-name').value = ''; 
        });
    };

    window.closeNewProfileModal = function(created = false) {
        window.UX?.closeDialog('new-profile-modal');
        const modal = document.getElementById('new-profile-modal');
        if (modal) modal.classList.add('hidden');
        if (!created && typeof window._afterHealthProfileCancelled === 'function') {
            const resume = window._afterHealthProfileCancelled;
            window._afterHealthProfileCancelled = null; window._afterHealthProfileCreated = null; resume();
        }
    };

    window.saveNewProfile = async function() {
        const name = document.getElementById('new-profile-name').value.trim(); 
        if (!name) return;
        if (window._savingHealthProfile) return;
        window._savingHealthProfile = true;
        const { data, error } = await window.supabaseClient.from('profiles').insert([{ name: name, user_id: window.currentUser.user_id, household_id: window.currentUser.household_id }]).select().single();
        window._savingHealthProfile = false;
        if (error) window.showToast("Błąd: " + error.message); 
        else { 
            window.AppStore.set(state => ({ ...state, profiles: [...(state.profiles || []), data] }));
            appProfiles = window.AppStore.get().profiles.slice();
            window.closeNewProfileModal(true);
            window.selectHealthProfile?.(data.id);
            window.showToast('Dodano osobę.');
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            window.loadAppProfiles(); window.UX?.refresh();
            const resume = window._afterHealthProfileCreated;
            window._afterHealthProfileCreated = null; window._afterHealthProfileCancelled = null;
            if (typeof resume === 'function') resume(data);
        }
    };

    window.openEditProfileScreen = async function(id) {
        const profile = (window.AppStore.get().profiles || []).find(p => String(p.id) === String(id));
        if(!profile) return;
        await window.switchView('edit-profile-screen');
        
        document.getElementById('edit-profile-id').value = profile.id; 
        document.getElementById('edit-profile-name').value = profile.name; 
        document.getElementById('edit-profile-birth').value = profile.birth_date || ''; 
        document.getElementById('edit-profile-height').value = profile.height || ''; 
        document.getElementById('edit-profile-weight').value = profile.weight || ''; 
        document.getElementById('edit-profile-title').innerText = `Profil: ${profile.name}`;
    };

    window.closeEditProfileModal = function() {
        window.goBack();
    }

    window.saveProfileDetails = async function() {
        const id = document.getElementById('edit-profile-id').value; 
        const name = document.getElementById('edit-profile-name').value.trim(); 
        if(!name) return;
        
        const oldProfile = appProfiles.find(p => p.id == id);
        const oldName = oldProfile ? oldProfile.name : null;

        const { error } = await window.supabaseClient.from('profiles').update({ 
            name: name, 
            birth_date: document.getElementById('edit-profile-birth').value || null, 
            height: document.getElementById('edit-profile-height').value || null, 
            weight: document.getElementById('edit-profile-weight').value || null 
        }).eq('id', id);
        
        if (error) { 
            window.showToast("Błąd zapisu: " + error.message); 
        } else { 
            if (oldName && oldName !== name) {
                window.showToast("Aktualizuję historię...");
                await window.cascadeNameChange(oldName, name);
            }

            if (window.currentUser && window.currentUser.id == id) {
                window.currentUser.name = name;
                const nameInput = document.getElementById('settings-user-name');
                if (nameInput) nameInput.value = name;
            }

            window.showToast('Zapisano profil'); 
            window.AppStore.set(state => ({...state, profiles:(state.profiles||[]).map(p=>String(p.id)===String(id)?{...p,name,birth_date:document.getElementById('edit-profile-birth').value||null,height:document.getElementById('edit-profile-height').value||null,weight:document.getElementById('edit-profile-weight').value||null}:p)}));
            window.closeEditProfileModal(); 
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            window.loadAppProfiles();
        }
    };

    window.deleteProfile = function() {
        const id = document.getElementById('edit-profile-id').value; 
        const name = document.getElementById('edit-profile-name').value.trim();

        window.customConfirm(`Usunąć profil ${name}? Uwaga: Usunie to całą książeczkę zdrowia tej osoby.`, async () => {
            const { error } = await window.supabaseClient.from('profiles').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
            if (error) { 
                window.showToast('Błąd: ' + error.message); 
            } else { 
                window.AppStore.set(state=>({...state,profiles:(state.profiles||[]).filter(p=>String(p.id)!==String(id))}));
                window.showToast('Profil usunięto');
                window.closeEditProfileModal(); 
                if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
                window.loadAppProfiles();
            }
        });
    }

    // --- EDYCJA ZADAŃ I LOGÓW Z USTAWIEN ---
    window.openSettingsScreen = async function(taskId) {
        if (window.TaskModel?.get(`tasks:${taskId}`)) { window.openTaskDetails(`tasks:${taskId}`); return; }
        try {
            const { data, error } = await window.supabaseClient.from('tasks').select('*').eq('id', taskId).single();
            if (error || !data) { window.showToast('Nie znaleziono zadania.'); return; }
            const task = data;
            
            currentEditingTaskId = task.id; 
            
            await window.switchView('settings-screen');
            const titleTop = document.getElementById('settings-task-name-top'); if (titleTop) titleTop.innerText = task.name;
            const inputName = document.getElementById('settings-task-name'); if (inputName) inputName.value = task.name;
            const inputInterval = document.getElementById('settings-task-interval'); if (inputInterval) inputInterval.value = task.interval_days || 0;
            await window.populateRoomsDropdown('settings-task-room', task.room || 'Inne');
            setTimeout(() => { if (document.getElementById('settings-history-list')) window.renderHistory?.(); }, 50);
        } catch(err) { console.warn("Błąd podczas otwierania ustawień:", err); }
    };

    window.saveTaskSettings = async function() {
        const n = document.getElementById('settings-task-name').value.trim(); 
        const i = parseInt(document.getElementById('settings-task-interval').value) || 0; 
        const r = document.getElementById('settings-task-room').value; 
        const { error } = await window.supabaseClient.from('tasks').update({ name: n, interval_days: i, room: r }).eq('id', currentEditingTaskId);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        await window.supabaseClient.from('activity_logs').update({ activity_name: n }).eq('task_id', currentEditingTaskId);
        
        window.invalidateDashboardCache(); 
        
        window.showToast("Zapisano!"); window.goBack(); setTimeout(() => window.refreshCurrentView(), 150);
    };

    window.renderHistory = function() {
        const logs = window.HomeModule.getLogs().filter(l => l.task_id === currentEditingTaskId);
        document.getElementById('settings-history-list').innerHTML = logs.map(l => `
            <div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5">
                <div class="js-edit-log flex-1 min-w-0 pr-3 cursor-pointer" data-id="${l.id}">
                    <p class="text-xs text-neutral-200">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
                    ${l.notes ? `<p class="text-[9px] text-neutral-500 truncate mt-0.5">${window.esc(l.notes)}</p>` : ''}
                </div>
                <div class="flex gap-3 shrink-0">
                    <button class="js-edit-log text-neutral-400 hover:text-[#a8c7fa] text-sm active:scale-90 transition-transform cursor-pointer" data-id="${l.id}">✏️</button>
                    <button class="js-delete-log text-neutral-500 hover:text-[#ffb4ab] text-sm active:scale-90 transition-transform cursor-pointer" data-id="${l.id}">🗑️</button>
                </div>
            </div>`).join('') || '<p class="text-neutral-500 text-xs py-4 text-center">Brak historii.</p>';
    };

    window.deleteLog = function(id) {
        window.customConfirm("Usunąć ten wpis z historii?", async () => {
            const { error } = await window.supabaseClient.from('activity_logs').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
            if (error) { window.showToast("Błąd: " + error.message); return; }
            const { data } = await window.supabaseClient.from('activity_logs').select('*').eq('household_id', window.currentUser.household_id).order('created_at', { ascending: false });
            window.HomeModule.setLogs(data || []); window.renderHistory(); window.showToast("Usunięto wpis!");
            if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
            if (typeof window.refreshCurrentView === 'function') await window.refreshCurrentView();
        });
    };

    window.deleteTaskFromSettings = function() {
        window.customConfirm("Zarchiwizować czynność? Zniknie z głównych widoków.", async () => {
            const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', currentEditingTaskId); 
            if (error) { window.showToast("Błąd: " + error.message); return; }
            
            window.invalidateDashboardCache(); 
            
            window.showToast("Zarchiwizowano!"); window.goBack(); setTimeout(() => window.refreshCurrentView(), 150);
        });
    };

    // --- ARCHIWUM ---
    window.openArchiveScreen = function() { return window.goForward('archive-screen'); };

    window.loadArchiveData = async function(forceRefresh = false) {
        const listEl = document.getElementById('archive-list');
        if (!listEl) return;
        const render = () => {
        const state = window.AppStore.get() || {};
        const items = [], tasks=window.TaskModel.list({includeCompleted:true,includeArchived:true});
        const convertedTodos=new Set(tasks.map(t=>t.raw.ux_meta?.legacyTodoId||state.uxTaskMeta?.[t.key]?.legacyTodoId).filter(Boolean).map(String));
        tasks.filter(t=>t.archived&&t.raw.is_archived&&!(t.source==='todos'&&convertedTodos.has(String(t.id)))).forEach(t=>items.push({id:t.id,title:t.name,type:t.source,taskKey:t.key,icon:'task',typeName:`Zadanie · ${t.area}`}));
        (state.hTasks||[]).filter(t=>t.is_archived&&t.task_type==='duration').forEach(t=>items.push({id:t.id,title:t.name,type:'health_tasks',icon:'activity',typeName:'Historia zdrowia'}));
        window.EventModel.list({includePast:true,includeCancelled:true}).filter(e=>e.cancelled||e.archived).forEach(e=>items.push({id:e.id,title:e.name,type:e.source,eventKey:e.key,icon:'calendar',typeName:e.cancelled?'Odwołane wydarzenie':'Wydarzenie'}));
        (state.checklists||[]).filter(l=>l.is_archived).forEach(l=>items.push({id:l.id,title:l.title,type:'checklists',icon:'list',typeName:'Lista'}));
        if (items.length === 0) { listEl.innerHTML = '<p class="ux-empty">Archiwum jest puste.</p>'; return; }
        
        listEl.innerHTML = items.map(item => `
            <div class="ux-row">
                ${window.UX.icon(item.icon)}${item.taskKey?`<button type="button" class="ux-row-main js-open-task-details" data-key="${window.esc(item.taskKey)}"><span class="ux-row-title">${window.esc(item.title)}</span><span class="ux-row-meta">${window.esc(item.typeName)}</span></button>`:`<div class="ux-row-main"><h3 class="ux-row-title">${window.esc(item.title)}</h3><p class="ux-row-meta">${window.esc(item.typeName)}</p></div>`}
                <div class="ux-row-actions">
                    <button type="button" class="js-restore-archive ux-btn small" data-table="${item.type}" data-id="${window.esc(String(item.id))}" data-event-key="${window.esc(item.eventKey||'')}">Przywróć</button>
                    <button type="button" class="js-delete-archive ux-icon-btn" aria-label="Usuń trwale" data-table="${item.type}" data-id="${window.esc(String(item.id))}">${window.UX.icon('trash')}</button>
                </div>
            </div>`).join('');
        };
        render();
        await window.loadDashboardOverview?.(forceRefresh);
        render();
    };

    window.restoreFromArchive = async function(table, id, eventKey) {
        const collections={tasks:'tasks',todos:'todos',health_tasks:'hTasks',checklists:'checklists',calendar_events:'calendarEvents'};
        if(!collections[table])return;
        try {
            if(eventKey) await window.EventModel.restore(eventKey);
            else {
                const { error } = await window.supabaseClient.from(table).update({ is_archived: false }).eq('id', id).eq('household_id',window.currentUser.household_id);
                if(error)throw error;
                window.AppStore.set(s=>({...s,[collections[table]]:(s[collections[table]]||[]).map(row=>String(row.id)===String(id)?{...row,is_archived:false}:row)}));
            }
            window.showToast("Przywrócono!"); 
            window.invalidateDashboardCache(); 
            window.loadArchiveData(); 
        }catch(error){window.showToast('Nie udało się przywrócić wpisu. Spróbuj ponownie.');}
    };

    window.permanentlyDelete = function(table, id) {
        const collections={tasks:'tasks',todos:'todos',health_tasks:'hTasks',checklists:'checklists',calendar_events:'calendarEvents'};
        if(!collections[table])return;
        window.customConfirm("Usunąć trwale? Operacji nie można cofnąć!", async () => {
            const { error } = await window.supabaseClient.from(table).delete().eq('id', id).eq('household_id',window.currentUser.household_id);
            if (error) window.showToast("Błąd"); else {
                window.AppStore.set(s=>({...s,[collections[table]]:(s[collections[table]]||[]).filter(row=>String(row.id)!==String(id))}));
                window.showToast("Usunięto trwale!");
                window.invalidateDashboardCache?.();
                window.loadArchiveData();
            }
        });
    };

    window.logoutUser = async function() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) {
            window.showToast("Błąd wylogowania");
            return;
        }
        window.currentUser = null;
        window.AppStore?.setScope(null, null);
        window.location.reload();
    };
    
    window.closeSettingsScreen = function() { window.goBack(); };

    // ==========================================
    // DELEGACJA ZDARZEŃ (VIA DISPATCHER)
    // ==========================================
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-edit-room', (e, el) => window.openEditRoomModal(el.dataset.name, el.dataset.roomIcon));
        window.EventDispatcher.onClick('.js-delete-room', (e, el) => window.deleteRoom(el.dataset.name));
        
        window.EventDispatcher.onClick('.js-edit-profile', (e, el) => window.openEditProfileScreen(el.dataset.id));
        
        window.EventDispatcher.onClick('.js-edit-log', (e, el) => window.openEditLogModal(el.dataset.id));
        window.EventDispatcher.onClick('.js-delete-log', (e, el) => window.deleteLog(el.dataset.id));
        
        window.EventDispatcher.onClick('.js-restore-archive', (e, el) => window.restoreFromArchive(el.dataset.table, el.dataset.id, el.dataset.eventKey));
        window.EventDispatcher.onClick('.js-delete-archive', (e, el) => window.permanentlyDelete(el.dataset.table, el.dataset.id));

        // NOWE: Dynamiczne Modale z plikow
        window.EventDispatcher.onClick('.js-close-new-room', () => window.closeNewRoomModal());
        window.EventDispatcher.onClick('.js-save-new-room', e => { e.preventDefault();window.saveNewRoom(); });
        
        window.EventDispatcher.onClick('.js-close-edit-room', () => window.closeEditRoomModal());
        window.EventDispatcher.onClick('.js-save-edit-room', e => { e.preventDefault();window.saveEditRoom(); });

        window.EventDispatcher.onClick('.js-close-new-profile', () => window.closeNewProfileModal());
        window.EventDispatcher.onClick('.js-save-new-profile', e => { e.preventDefault();window.saveNewProfile(); });

        window.EventDispatcher.onClick('.js-close-profile-switcher', () => window.closeProfileSwitcher?.());
        window.EventDispatcher.onClick('.js-open-new-profile-from-switcher', () => {
            if(typeof window.closeProfileSwitcher === 'function') window.closeProfileSwitcher();
            window.openNewProfileModal();
        });

    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    document.addEventListener('submit',event=>{const actions={'new-profile-form':window.saveNewProfile,'new-room-form':window.saveNewRoom,'edit-room-form':window.saveEditRoom};if(actions[event.target.id]){event.preventDefault();actions[event.target.id]();}});
    return { init: window.initSettingsModule };
})();
