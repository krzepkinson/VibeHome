// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

let appRooms = []; let appProfiles = [];

window.initSettingsModule = function() {
    const hidLabel = document.getElementById('household-id-label');
    if (hidLabel && window.currentUser) { hidLabel.innerText = window.currentUser.household_id; }
    const nameInput = document.getElementById('settings-user-name');
    if (nameInput && window.currentUser && window.currentUser.name) { nameInput.value = window.currentUser.name; }
    loadAppRooms(); loadAppProfiles(); checkNotificationStatus(); 
};

window.saveUserName = async function() {
    const name = document.getElementById('settings-user-name').value.trim();
    if(!name) return;
    const { error } = await supabaseClient.auth.updateUser({ data: { name: name } });
    if (error) { window.showToast("Błąd: " + error.message); }
    else { window.currentUser.name = name; window.showToast("Imię zapisane! ↻"); await window.refreshCurrentView(); }
};

// NOWOŚĆ: Przetwarzanie dołączania z pola tekstowego (zamiast prompt)
window.processJoinHousehold = async function() {
    const code = document.getElementById('join-hh-input').value.trim();
    if (!code) return;
    
    const oldHid = window.currentUser.household_id;

    // Najpierw sprawdzamy czy taki dom istnieje
    const { data: hh, error: checkError } = await supabaseClient.from('households').select('id').eq('id', code).maybeSingle();
    
    if (checkError || !hh) {
        window.showToast("Niepoprawny kod domu!");
        return;
    }

    // Jeśli istnieje, dopisujemy nas do niego
    const { error: joinError } = await supabaseClient.from('household_members').insert([{ household_id: code, user_id: window.currentUser.id }]);

    if (joinError) {
        window.showToast("Błąd dołączania: " + joinError.message);
    } else {
        // Dopiero teraz usuwamy stary
        await supabaseClient.from('household_members').delete().eq('household_id', oldHid).eq('user_id', window.currentUser.id);
        window.closeJoinHouseholdModal();
        window.showToast("Zsynchronizowano! Przeładowuję...");
        setTimeout(() => window.location.reload(), 1500);
    }
};

window.openRoomsSettings = function() { window.goForward('settings-rooms-screen'); };
window.openProfilesSettings = function() { window.goForward('settings-profiles-screen'); };

function checkNotificationStatus() {
    const statusText = document.getElementById('notif-status-text'); const btn = document.getElementById('notif-enable-btn');
    if (!statusText || !btn) return;
    if (Notification.permission === "granted") { statusText.innerText = "Aktywne 🔔"; btn.innerText = "Odśwież"; btn.classList.remove('hidden'); }
    else { statusText.innerText = "Wymaga zgody"; btn.innerText = "Włącz"; btn.classList.remove('hidden'); }
}

window.requestNotificationPermission = async function() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: window.urlB64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY) });
        const subData = JSON.parse(JSON.stringify(sub));
        await supabaseClient.from('push_subscriptions').upsert({ user_id: window.currentUser.id, endpoint: subData.endpoint, p256dh: subData.keys.p256dh, auth: subData.keys.auth }, { onConflict: 'user_id, endpoint' });
        window.showToast("Powiadomienia włączone 🚀");
    }
    checkNotificationStatus();
};

async function fetchRoomsFromDB() {
    const { data } = await supabaseClient.from('rooms').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appRooms = data || []; return appRooms;
}

window.loadAppRooms = async function() {
    const listEl = document.getElementById('settings-rooms-list'); await fetchRoomsFromDB();
    listEl.innerHTML = appRooms.map(room => `<div class="flex justify-between items-center px-3 py-2 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5"><div class="flex items-center gap-3"><span>${window.esc(room.icon)}</span><span class="text-sm font-medium">${window.esc(room.name)}</span></div><div class="flex gap-1"><button onclick="deleteRoom('${encodeURIComponent(room.name)}')" class="text-neutral-500">🗑️</button></div></div>`).join('');
};

window.deleteRoom = function(encodedName) {
    const name = decodeURIComponent(encodedName);
    window.customConfirm(`Usunąć pomieszczenie "${name}"?`, async () => {
        await supabaseClient.from('rooms').delete().eq('name', name).eq('household_id', window.currentUser.household_id);
        loadAppRooms();
    });
};

window.openNewRoomModal = function() { document.getElementById('new-room-modal').classList.remove('hidden'); };
window.closeNewRoomModal = function() { document.getElementById('new-room-modal').classList.add('hidden'); };
window.saveNewRoom = async function() {
    const name = document.getElementById('new-room-name').value.trim(); const icon = document.getElementById('new-room-icon').value.trim() || '🏠';
    if(!name) return;
    await supabaseClient.from('rooms').insert([{ name, icon, user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    closeNewRoomModal(); loadAppRooms();
};

window.loadAppProfiles = async function() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await supabaseClient.from('profiles').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appProfiles = data || [];
    listEl.innerHTML = appProfiles.map(p => `<div class="p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 flex justify-between items-center"><span>${window.esc(p.name)}</span><button onclick="openEditProfileScreen(${p.id})">⚙️</button></div>`).join('');
};

window.openNewProfileModal = function() { document.getElementById('new-profile-name').value = ''; document.getElementById('new-profile-modal').classList.remove('hidden'); };
window.closeNewProfileModal = function() { document.getElementById('new-profile-modal').classList.add('hidden'); };
window.saveNewProfile = async function() {
    const name = document.getElementById('new-profile-name').value.trim();
    if(!name) return;
    await supabaseClient.from('profiles').insert([{ name, user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    closeNewProfileModal(); loadAppProfiles();
};

window.openEditProfileScreen = function(id) {
    const p = appProfiles.find(x => x.id === id);
    document.getElementById('edit-profile-id').value = p.id;
    document.getElementById('edit-profile-name').value = p.name;
    window.goForward('edit-profile-screen');
};

window.saveProfileDetails = async function() {
    const id = document.getElementById('edit-profile-id').value;
    const name = document.getElementById('edit-profile-name').value.trim();
    await supabaseClient.from('profiles').update({ name }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.goBack(); loadAppProfiles();
};

window.openSettingsScreen = async function(name) {
    const taskName = decodeURIComponent(name);
    const { data } = await supabaseClient.from('tasks').select('*').eq('name', taskName).eq('household_id', window.currentUser.household_id).limit(1);
    const task = data[0];
    document.getElementById('settings-title').innerText = task.name;
    document.getElementById('set-task-name').value = task.name;
    document.getElementById('set-task-interval').value = task.interval_days || 0;
    document.getElementById('set-task-remind').value = task.remind_days_before || 0;
    document.getElementById('set-task-push').checked = task.push_enabled !== false;
    document.getElementById('set-task-history').checked = task.show_in_history !== false;
    window.currentEditingHomeTask = task.name;
    if(typeof populateRoomsDropdown === 'function') await populateRoomsDropdown('set-task-room', task.room || 'Inne');
    if(typeof renderHistory === 'function') renderHistory();
    window.goForward('settings-screen');
};

window.saveTaskSettings = async function() {
    const n = document.getElementById('set-task-name').value.trim(); const i = parseInt(document.getElementById('set-task-interval').value) || 0; const remind = parseInt(document.getElementById('set-task-remind').value) || 0; const r = document.getElementById('set-task-room').value; const push = document.getElementById('set-task-push').checked; const hist = document.getElementById('set-task-history').checked; const hid = window.currentUser.household_id;
    if (window.currentEditingHomeTask !== n) {
        await supabaseClient.from('activity_logs').update({ activity_name: n }).eq('activity_name', window.currentEditingHomeTask).eq('household_id', hid);
        await supabaseClient.from('tasks').insert([{ name: n, interval_days: i, remind_days_before: remind, push_enabled: push, show_in_history: hist, room: r, user_id: window.currentUser.id, household_id: hid }]);
        await supabaseClient.from('tasks').delete().eq('name', window.currentEditingHomeTask).eq('household_id', hid);
        window.currentEditingHomeTask = n;
    } else {
        await supabaseClient.from('tasks').update({ interval_days: i, remind_days_before: remind, push_enabled: push, show_in_history: hist, room: r }).eq('name', window.currentEditingHomeTask).eq('household_id', hid);
    }
    window.showToast("Zapisano!"); loadDashboard();
};

window.deleteCurrentTask = function() {
    window.customConfirm("Zarchiwizować czynność? Zniknie z listy.", async () => {
        await supabaseClient.from('tasks').update({ is_archived: true }).eq('name', window.currentEditingHomeTask).eq('household_id', window.currentUser.household_id);
        window.goBack(); loadDashboard();
    });
};

window.openArchiveScreen = function() { window.goForward('archive-screen'); window.loadArchiveData(); };
window.loadArchiveData = async function() {
    const hid = window.currentUser.household_id;
    const [t, ht, td, l] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', true),
        supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', true),
        supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', true),
        supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', true)
    ]);
    let items = [];
    if(t.data) t.data.forEach(x => items.push({id: x.id, title: x.name, table: 'tasks'}));
    if(ht.data) ht.data.forEach(x => items.push({id: x.id, title: x.name, table: 'health_tasks'}));
    if(td.data) td.data.forEach(x => items.push({id: x.id, title: x.title, table: 'todos'}));
    if(l.data) l.data.forEach(x => items.push({id: x.id, title: x.title, table: 'checklists'}));
    document.getElementById('archive-list').innerHTML = items.map(i => `<div class="p-3 bg-[#1e1f20] rounded-xl mb-1.5 flex justify-between items-center"><span class="text-sm">${window.esc(i.title)}</span><button onclick="window.restoreFromArchive('${i.table}', ${i.id})" class="text-[#c4eed0] font-bold">Przywróć</button></div>`).join('') || '<p class="text-center py-10 text-neutral-500">Pusto.</p>';
};

window.restoreFromArchive = async function(table, id) {
    await supabaseClient.from(table).update({ is_archived: false }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.loadArchiveData(); window.refreshCurrentView();
};
