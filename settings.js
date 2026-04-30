// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

let appRooms = []; let appProfiles = [];

window.initSettingsModule = function() {
    const hidLabel = document.getElementById('household-id-label');
    if (hidLabel && window.currentUser) { hidLabel.innerText = window.currentUser.household_id; }
    
    // Uzupełniamy imię w polu tekstowym
    const nameInput = document.getElementById('settings-user-name');
    if (nameInput && window.currentUser.name) {
        nameInput.value = window.currentUser.name;
    }

    loadAppRooms(); loadAppProfiles(); checkNotificationStatus(); 
};

window.saveUserName = async function() {
    const name = document.getElementById('settings-user-name').value.trim();
    if(!name) return;
    
    // Zapisujemy w Supabase Auth (metadane)
    const { error } = await supabaseClient.auth.updateUser({ data: { name: name } });
    
    if (error) { window.showToast("Błąd: " + error.message); }
    else {
        window.currentUser.name = name;
        window.showToast("Imię zapisane! ↻");
        // Odświeżamy widoki, aby inicjały się zaktualizowały
        await window.refreshCurrentView();
    }
};

window.joinHousehold = async function() {
    const code = prompt("ID domu Partnera:");
    if (!code) return;
    if (confirm("Stracisz dostęp do obecnych danych. Dołączyć?")) {
        await supabaseClient.from('household_members').delete().eq('user_id', window.currentUser.id);
        const { error } = await supabaseClient.from('household_members').insert([{ household_id: code.trim(), user_id: window.currentUser.id }]);
        if (error) { window.showToast("Niepoprawny kod!"); }
        else { window.location.reload(); }
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
        const registration = await navigator.serviceWorker.ready;
        let sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: window.urlB64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY) });
        const subData = JSON.parse(JSON.stringify(sub));
        await supabaseClient.from('push_subscriptions').upsert({ user_id: window.currentUser.id, endpoint: subData.endpoint, p256dh: subData.keys.p256dh, auth: subData.keys.auth }, { onConflict: 'user_id, endpoint' });
        window.showToast("Powiadomienia włączone!");
    }
    checkNotificationStatus();
};

async function fetchRoomsFromDB() {
    const { data } = await supabaseClient.from('rooms').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appRooms = data || []; return appRooms;
}

window.loadAppRooms = async function() {
    const listEl = document.getElementById('settings-rooms-list'); await fetchRoomsFromDB();
    listEl.innerHTML = appRooms.map(room => `<div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5"><div class="flex items-center gap-3"><span>${window.esc(room.icon)}</span><span class="text-sm font-medium">${window.esc(room.name)}</span></div><div class="flex gap-1"><button onclick="deleteRoom('${encodeURIComponent(room.name)}')" class="text-neutral-500">🗑️</button></div></div>`).join('');
};

window.openNewRoomModal = function() { document.getElementById('new-room-modal').classList.remove('hidden'); };
window.closeNewRoomModal = function() { document.getElementById('new-room-modal').classList.add('hidden'); };
window.saveNewRoom = async function() {
    const name = document.getElementById('new-room-name').value.trim(); const icon = document.getElementById('new-room-icon').value.trim() || '🏠';
    await supabaseClient.from('rooms').insert([{ name, icon, user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    closeNewRoomModal(); loadAppRooms();
};

window.loadAppProfiles = async function() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await supabaseClient.from('profiles').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appProfiles = data || [];
    listEl.innerHTML = appProfiles.map(p => `<div class="p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 flex justify-between items-center"><span>${window.esc(p.name)}</span><button onclick="openEditProfileScreen(${p.id})">⚙️</button></div>`).join('');
};

window.saveNewProfile = async function() {
    const name = document.getElementById('new-profile-name').value.trim();
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
    
    document.getElementById('archive-list').innerHTML = items.map(i => `
        <div class="p-3 bg-[#1e1f20] rounded-xl mb-1.5 flex justify-between items-center">
            <span class="text-sm">${window.esc(i.title)}</span>
            <button onclick="window.restoreFromArchive('${i.table}', ${i.id})" class="text-[#c4eed0] text-xs font-bold">Przywróć</button>
        </div>`).join('');
};

window.restoreFromArchive = async function(table, id) {
    await supabaseClient.from(table).update({ is_archived: false }).eq('id', id).eq('household_id', window.currentUser.household_id);
    window.loadArchiveData(); window.refreshCurrentView();
};
