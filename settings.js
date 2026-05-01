// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

let appRooms = []; let appProfiles = [];

window.initSettingsModule = function() {
    const hidLabel = document.getElementById('household-id-label');
    if (hidLabel && window.currentUser) { hidLabel.innerText = window.currentUser.household_id; }
    const nameInput = document.getElementById('settings-user-name');
    if (nameInput && window.currentUser && window.currentUser.name) { nameInput.value = window.currentUser.name; }
    window.loadAppRooms(); window.loadAppProfiles(); window.checkNotificationStatus(); 
};

window.saveUserName = async function() {
    const name = document.getElementById('settings-user-name').value.trim();
    if(!name) return;
    const { error } = await window.supabaseClient.auth.updateUser({ data: { name: name } });
    if (error) { window.showToast("Błąd: " + error.message); }
    else { window.currentUser.name = name; window.showToast("Imię zapisane! ↻"); if(typeof window.refreshCurrentView === 'function') await window.refreshCurrentView(); }
};

window.processJoinHousehold = async function() {
    const code = document.getElementById('join-hh-input').value.trim();
    if (!code) return;
    const newHouseholdId = code; const oldHouseholdId = window.currentUser.household_id;
    if (newHouseholdId === oldHouseholdId) { window.showToast("Już jesteś w tym domu!"); return; }

    const { error: joinError } = await window.supabaseClient.from('household_members').insert([{ household_id: newHouseholdId, user_id: window.currentUser.id }]);
    if (joinError) {
        console.error("Błąd łączenia domów:", joinError); window.showToast("Niepoprawny kod domu! Nic nie zmieniono.");
    } else {
        await window.supabaseClient.from('household_members').delete().eq('household_id', oldHouseholdId).eq('user_id', window.currentUser.id);
        window.closeJoinHouseholdModal(); window.showToast("Zsynchronizowano! Przeładowuję..."); setTimeout(() => window.location.reload(), 1500);
    }
};

window.openRoomsSettings = function() { window.goForward('settings-rooms-screen'); };
window.openProfilesSettings = function() { window.goForward('settings-profiles-screen'); };

window.checkNotificationStatus = function() {
    const statusText = document.getElementById('notif-status-text'); const btn = document.getElementById('notif-enable-btn');
    if (!statusText || !btn) return;
    if (!("Notification" in window)) { statusText.innerText = "Brak wsparcia dla powiadomień."; btn.classList.add('hidden'); return; }
    if (Notification.permission === "granted") { statusText.innerText = "Aktywne 🔔"; btn.innerText = "Odśwież"; btn.classList.remove('hidden'); }
    else if (Notification.permission === "denied") { statusText.innerText = "Zablokowane 🔕"; btn.classList.add('hidden'); }
    else { statusText.innerText = "Wymaga zgody"; btn.innerText = "Włącz"; btn.classList.remove('hidden'); }
};

window.requestNotificationPermission = async function() {
    if (!("Notification" in window)) return;
    try {
        const permission = await Notification.requestPermission(); window.checkNotificationStatus();
        if (permission === "granted") {
            window.showToast("Generowanie tokena...");
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: window.urlB64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY) }); }
            const subData = JSON.parse(JSON.stringify(subscription));
            const { error } = await window.supabaseClient.from('push_subscriptions').upsert({ user_id: window.currentUser.id, endpoint: subData.endpoint, p256dh: subData.keys.p256dh, auth: subData.keys.auth }, { onConflict: 'user_id, endpoint' });
            if (error) throw error; window.showToast("Powiadomienia włączone 🚀");
        }
    } catch (error) { window.showToast("Błąd: " + error.message); }
};

window.fetchRoomsFromDB = async function() {
    const { data } = await window.supabaseClient.from('rooms').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appRooms = data || []; return appRooms;
};

window.loadAppRooms = async function() {
    const listEl = document.getElementById('settings-rooms-list'); await window.fetchRoomsFromDB();
    if (appRooms.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak zdefiniowanych pomieszczeń.</p>`; return; }
    listEl.innerHTML = appRooms.map(room => `<div class="flex justify-between items-center px-3 py-2 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5"><div class="flex items-center gap-3"><span class="text-xl">${window.esc(room.icon || '📦')}</span><span class="text-sm font-medium text-neutral-200">${window.esc(room.name)}</span></div><div class="flex gap-1"><button onclick="window.openEditRoomModal('${encodeURIComponent(room.name)}', '${room.icon}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">✏️</button><button onclick="window.deleteRoom('${encodeURIComponent(room.name)}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button></div></div>`).join('');
};

window.openNewRoomModal = function() { document.getElementById('new-room-name').value = ''; document.getElementById('new-room-icon').value = '🏠'; document.getElementById('new-room-modal').classList.remove('hidden'); };
window.closeNewRoomModal = function() { document.getElementById('new-room-modal').classList.add('hidden'); };

window.saveNewRoom = async function() {
    const name = document.getElementById('new-room-name').value.trim(); const icon = document.getElementById('new-room-icon').value.trim();
    if (!name) return;
    const { error } = await window.supabaseClient.from('rooms').insert([{ name: name, icon: icon || '📦', user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    if (error) { if (error.code === '23505') window.showToast('Istnieje!'); else window.showToast('Błąd zapisu: ' + error.message); } 
    else { window.closeNewRoomModal(); window.showToast('Dodano!'); window.loadAppRooms(); }
};

window.openEditRoomModal = function(encodedName, icon) {
    const name = decodeURIComponent(encodedName); document.getElementById('edit-room-old-name').value = name; document.getElementById('edit-room-name').value = name; document.getElementById('edit-room-icon').value = icon || '📦'; document.getElementById('edit-room-modal').classList.remove('hidden');
};
window.closeEditRoomModal = function() { document.getElementById('edit-room-modal').classList.add('hidden'); };

window.saveEditRoom = async function() {
    const oldName = document.getElementById('edit-room-old-name').value; const newName = document.getElementById('edit-room-name').value.trim(); const newIcon = document.getElementById('edit-room-icon').value.trim() || '📦';
    if (!newName) return;
    const { error } = await window.supabaseClient.from('rooms').update({ name: newName, icon: newIcon }).eq('name', oldName).eq('household_id', window.currentUser.household_id);
    if (error) { window.showToast('Błąd zapisu: ' + error.message); return; }
    if (oldName !== newName) { await window.supabaseClient.from('tasks').update({ room: newName }).eq('room', oldName).eq('household_id', window.currentUser.household_id); }
    window.closeEditRoomModal(); window.showToast('Zaktualizowano pomieszczenie!'); window.loadAppRooms(); if (typeof window.loadDashboard === 'function') window.loadDashboard();
};

window.deleteRoom = function(encodedName) {
    const name = decodeURIComponent(encodedName); 
    window.customConfirm(`Usunąć pomieszczenie "${name}"?`, async () => {
        const { error } = await window.supabaseClient.from('rooms').delete().eq('name', name).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast('Błąd: ' + error.message); return; }
        window.showToast('Usunięto pomieszczenie'); window.loadAppRooms(); if (typeof window.loadDashboard === 'function') window.loadDashboard();
    });
};

window.populateRoomsDropdown = async function(selectId, selectedValue = '') {
    const selectEl = document.getElementById(selectId); if (!selectEl) return;
    if (appRooms.length === 0) await window.fetchRoomsFromDB();
    selectEl.innerHTML = appRooms.map(r => `<option value="${window.esc(r.name)}">${window.esc(r.icon)} ${window.esc(r.name)}</option>`).join('');
    if (!appRooms.find(r => r.name === 'Inne')) selectEl.innerHTML += `<option value="Inne">📦 Inne</option>`;
    if (selectedValue) selectEl.value = selectedValue;
};

window.getAgeBadge = function(birthDateStr) {
    if (!birthDateStr) return ''; const birthDate = new Date(birthDateStr); const today = new Date();
    let totalMonths = (today.getFullYear() - birthDate.getFullYear()) * 12; totalMonths -= birthDate.getMonth(); totalMonths += today.getMonth();
    if (today.getDate() < birthDate.getDate()) totalMonths--; if (totalMonths < 0) totalMonths = 0;
    let ageText = "";
    if (totalMonths < 24) { if (totalMonths === 1) ageText = "1 miesiąc"; else if ([2, 3, 4, 22, 23].includes(totalMonths)) ageText = `${totalMonths} miesiące`; else ageText = `${totalMonths} miesięcy`; } 
    else { const years = Math.floor(totalMonths / 12); if (years === 1) ageText = "1 rok"; else if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100)) ageText = `${years} lata`; else ageText = `${years} lat`; }
    return `<span class="bg-[#333537] text-neutral-300 text-[9px] px-2 py-0.5 rounded-md ml-2 uppercase tracking-widest">${ageText}</span>`;
};

window.loadAppProfiles = async function() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appProfiles = data || [];
    if (appProfiles.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak domowników.</p>`; return; }
    listEl.innerHTML = appProfiles.map(p => {
        const colors = ['bg-rose-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600']; const avatarColor = colors[p.id % colors.length];
        return `<div class="flex justify-between items-center px-3 py-2 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5"><div class="flex items-center gap-3"><div class="w-8 h-8 ${avatarColor} text-white rounded-full flex items-center justify-center font-bold shadow-md border-2 border-[#131314]">${window.esc(p.name.charAt(0).toUpperCase())}</div><div><span class="text-sm font-medium text-neutral-200 flex items-center">${window.esc(p.name)} ${window.getAgeBadge(p.birth_date)}</span><span class="text-[10px] text-neutral-500 mt-0.5 block">${p.height ? window.esc(p.height) + ' cm' : '-- cm'} • ${p.weight ? window.esc(p.weight) + ' kg' : '-- kg'}</span></div></div><button onclick="window.openEditProfileScreen(${p.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">⚙️</button></div>`;
    }).join('');
};

window.openNewProfileModal = function() { document.getElementById('new-profile-name').value = ''; document.getElementById('new-profile-modal').classList.remove('hidden'); };
window.closeNewProfileModal = function() { document.getElementById('new-profile-modal').classList.add('hidden'); };

window.saveNewProfile = async function() {
    const name = document.getElementById('new-profile-name').value.trim(); if (!name) return;
    const { error } = await window.supabaseClient.from('profiles').insert([{ name: name, user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.closeNewProfileModal(); window.showToast('Dodano domownika!'); window.loadAppProfiles();
};

window.openEditProfileScreen = function(id) {
    const profile = appProfiles.find(p => p.id === id); if(!profile) return;
    document.getElementById('edit-profile-id').value = profile.id; document.getElementById('edit-profile-name').value = profile.name; document.getElementById('edit-profile-birth').value = profile.birth_date || ''; document.getElementById('edit-profile-height').value = profile.height || ''; document.getElementById('edit-profile-weight').value = profile.weight || ''; document.getElementById('edit-profile-title').innerText = `Edytuj: ${profile.name}`; window.goForward('edit-profile-screen');
};
window.closeEditProfileScreen = function() { window.goBack(); };

window.saveProfileDetails = async function() {
    const id = document.getElementById('edit-profile-id').value; const name = document.getElementById('edit-profile-name').value.trim(); const birth = document.getElementById('edit-profile-birth').value || null; const height = document.getElementById('edit-profile-height').value || null; const weight = document.getElementById('edit-profile-weight').value || null;
    if(!name) return;
    const { error } = await window.supabaseClient.from('profiles').update({ name: name, birth_date: birth, height: height, weight: weight }).eq('id', id).eq('household_id', window.currentUser.household_id);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.showToast('Zapisano profil'); window.closeEditProfileScreen(); window.loadAppProfiles(); if(typeof window.initHealthModule === 'function') window.initHealthModule();
};

window.currentEditingHomeTask = '';

window.openSettingsScreen = async function(name) {
    try {
        const currentSettingsTaskName = decodeURIComponent(name);
        const { data, error } = await window.supabaseClient.from('tasks').select('*').eq('name', currentSettingsTaskName).eq('household_id', window.currentUser.household_id).limit(1);
        if (error) throw error;
        if (!data || data.length === 0) { window.showToast('Nie znaleziono zadania w bazie.'); return; }
        
        const task = data[0];
        document.getElementById('settings-title').innerText = task.name; document.getElementById('set-task-name').value = task.name; document.getElementById('set-task-interval').value = task.interval_days || 0; document.getElementById('set-task-remind').value = task.remind_days_before || 0; document.getElementById('set-task-push').checked = task.push_enabled !== false; document.getElementById('set-task-history').checked = task.show_in_history !== false;
        
        window.currentEditingHomeTask = task.name;
        if(typeof window.populateRoomsDropdown === 'function') await window.populateRoomsDropdown('set-task-room', task.room || 'Inne');
        if(typeof window.renderHistory === 'function') window.renderHistory(); 
        window.goForward('settings-screen');
    } catch(err) { console.error("Błąd ładowania ustawień zadania:", err); window.showToast("Wystąpił błąd: " + err.message); }
};

window.closeSettingsScreen = function() { window.goBack(); };

window.saveTaskSettings = async function() {
    const n = document.getElementById('set-task-name').value.trim(); const i = parseInt(document.getElementById('set-task-interval').value) || 0; const remind = parseInt(document.getElementById('set-task-remind').value) || 0; const r = document.getElementById('set-task-room').value; const pushEnabled = document.getElementById('set-task-push').checked; const showHist = document.getElementById('set-task-history').checked; const hid = window.currentUser.household_id;

    if (window.currentEditingHomeTask !== n) {
        await window.supabaseClient.from('activity_logs').update({ activity_name: n }).eq('activity_name', window.currentEditingHomeTask).eq('household_id', hid);
        const { error } = await window.supabaseClient.from('tasks').insert([{ name: n, interval_days: i, remind_days_before: remind, push_enabled: pushEnabled, show_in_history: showHist, room: r, user_id: window.currentUser.id, household_id: hid }]);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        await window.supabaseClient.from('tasks').delete().eq('name', window.currentEditingHomeTask).eq('household_id', hid);
        window.currentEditingHomeTask = n;
    } else {
        const { error } = await window.supabaseClient.from('tasks').update({ interval_days: i, remind_days_before: remind, push_enabled: pushEnabled, show_in_history: showHist, room: r }).eq('name', window.currentEditingHomeTask).eq('household_id', hid);
        if (error) { window.showToast("Błąd: " + error.message); return; }
    }
    window.showToast("Zapisano!"); if(typeof window.loadDashboard === 'function') window.loadDashboard();
};

window.deleteCurrentTask = function() {
    window.customConfirm("Zarchiwizować czynność? Zniknie z głównych widoków.", async () => {
        const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('name', window.currentEditingHomeTask).eq('household_id', window.currentUser.household_id); 
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.closeSettingsScreen(); if(typeof window.loadDashboard === 'function') window.loadDashboard();
    });
};

window.openArchiveScreen = function() { window.goForward('archive-screen'); window.loadArchiveData(); };

window.loadArchiveData = async function() {
    const listEl = document.getElementById('archive-list'); listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Pobieranie archiwum...</p>`;
    const hid = window.currentUser.household_id;

    const [tRes, htRes, todoRes, listRes] = await Promise.all([
        window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', true),
        window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', true),
        window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', true),
        window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', true)
    ]);

    let items = [];
    if (tRes.data) tRes.data.forEach(x => items.push({ id: x.id, title: x.name, type: 'tasks', icon: '🏠', typeName: 'Dom' }));
    if (htRes.data) htRes.data.forEach(x => items.push({ id: x.id, title: x.name, type: 'health_tasks', icon: '❤️', typeName: 'Zdrowie' }));
    if (todoRes.data) todoRes.data.forEach(x => items.push({ id: x.id, title: x.title, type: 'todos', icon: '📝', typeName: 'Zadanie' }));
    if (listRes.data) listRes.data.forEach(x => items.push({ id: x.id, title: x.title, type: 'checklists', icon: '🗂️', typeName: 'Lista' }));

    if (items.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10">Archiwum jest puste.</p>`; return; }

    listEl.innerHTML = items.map(item => `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1.5 animate-fade-in">
            <div class="flex items-center gap-3"><span class="text-lg">${item.icon}</span><div><h4 class="text-sm font-medium text-neutral-200">${window.esc(item.title)}</h4><p class="text-[9px] text-neutral-500 uppercase tracking-widest">${item.typeName}</p></div></div>
            <div class="flex gap-1 shrink-0">
                <button onclick="window.restoreFromArchive('${item.type}', ${item.id})" class="px-3 py-1.5 rounded-full bg-[#0f5223]/20 text-[#c4eed0] text-[9px] font-bold uppercase tracking-wider active:scale-95 border border-[#0f5223]/50">Przywróć</button>
                <button onclick="window.permanentlyDelete('${item.type}', ${item.id})" class="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-xs border border-transparent">🗑️</button>
            </div>
        </div>
    `).join('');
};

window.restoreFromArchive = async function(table, id) {
    const { error } = await window.supabaseClient.from(table).update({ is_archived: false }).eq('id', id).eq('household_id', window.currentUser.household_id);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    window.showToast("Przywrócono!"); window.loadArchiveData();
    if(typeof window.loadDashboard === 'function') window.loadDashboard(); if(typeof window.initHealthModule === 'function') window.initHealthModule();
};

window.permanentlyDelete = function(table, id) {
    window.customConfirm("Usunąć trwale? Tej operacji nie można cofnąć, usunie również historię wpisów!", async () => {
        if (table === 'tasks') {
            const { data } = await window.supabaseClient.from('tasks').select('name').eq('id', id).single();
            if (data) await window.supabaseClient.from('activity_logs').delete().eq('activity_name', data.name).eq('household_id', window.currentUser.household_id);
        }
        const { error } = await window.supabaseClient.from(table).delete().eq('id', id).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Trwale usunięto!"); window.loadArchiveData();
    });
};
