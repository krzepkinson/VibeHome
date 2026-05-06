// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

let appRooms = []; 
let appProfiles = [];
window.currentEditingTaskId = null;

window.initSettingsModule = function() {
    const hidLabel = document.getElementById('household-id-label');
    if (hidLabel && window.currentUser) hidLabel.innerText = window.currentUser.household_id; 
    
    const nameInput = document.getElementById('settings-user-name');
    if (nameInput && window.currentUser?.name) nameInput.value = window.currentUser.name; 
    
    window.loadAppRooms(); 
    window.loadAppProfiles(); 
    window.checkNotificationStatus(); 
};

window.saveUserName = async function() {
    const name = document.getElementById('settings-user-name').value.trim();
    if(!name) return;
    const { error } = await window.supabaseClient.auth.updateUser({ data: { name: name } });
    if (error) {
        window.showToast("Błąd: " + error.message); 
    } else { 
        window.currentUser.name = name; 
        window.showToast("Imię zapisane!"); 
    }
};

window.openRoomsSettings = function() { window.goForward('settings-rooms-screen'); };
window.openProfilesSettings = function() { window.goForward('settings-profiles-screen'); };

window.checkNotificationStatus = function() {
    const statusText = document.getElementById('notif-status-text'); 
    const btn = document.getElementById('notif-enable-btn');
    if (!statusText || !btn) return;
    if (!("Notification" in window)) { statusText.innerText = "Brak wsparcia."; btn.classList.add('hidden'); return; }
    if (Notification.permission === "granted") { statusText.innerText = "Aktywne 🔔"; btn.classList.add('hidden'); }
    else { statusText.innerText = "Wymaga zgody"; btn.classList.remove('hidden'); }
};

window.requestNotificationPermission = async function() {
    const permission = await Notification.requestPermission();
    window.checkNotificationStatus();
    if (permission === "granted") window.showToast("Powiadomienia włączone!");
};

// --- ZARZĄDZANIE POMIESZCZENIAMI ---

window.fetchRoomsFromDB = async function() {
    const { data } = await window.supabaseClient.from('rooms').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appRooms = data || []; return appRooms;
};

window.loadAppRooms = async function() {
    const listEl = document.getElementById('settings-rooms-list'); 
    await window.fetchRoomsFromDB();
    if (appRooms.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak pomieszczeń.</p>`; return; }
    listEl.innerHTML = appRooms.map(room => `
        <div class="flex justify-between items-center px-3 py-2 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5">
            <div class="flex items-center gap-3"><span class="text-xl">${window.esc(room.icon || '📦')}</span><span class="text-sm font-medium text-neutral-200">${window.esc(room.name)}</span></div>
            <div class="flex gap-1">
                <button onclick="window.openEditRoomModal('${encodeURIComponent(room.name)}', '${room.icon}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] text-sm">✏️</button>
                <button onclick="window.deleteRoom('${encodeURIComponent(room.name)}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] text-sm">🗑️</button>
            </div>
        </div>`).join('');
};

window.openNewRoomModal = function() { 
    document.getElementById('new-room-name').value = ''; 
    document.getElementById('new-room-icon').value = '🏠'; 
    document.getElementById('new-room-modal').classList.remove('hidden'); 
};

window.closeNewRoomModal = function() { document.getElementById('new-room-modal').classList.add('hidden'); };

window.saveNewRoom = async function() {
    const name = document.getElementById('new-room-name').value.trim(); 
    const icon = document.getElementById('new-room-icon').value.trim();
    if (!name) return;
    const { error } = await window.supabaseClient.from('rooms').insert([{ name: name, icon: icon || '📦', user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    if (error) window.showToast('Błąd zapisu');
    else { window.closeNewRoomModal(); window.showToast('Dodano!'); window.loadAppRooms(); }
};

window.openEditRoomModal = function(encodedName, icon) {
    const name = decodeURIComponent(encodedName); 
    document.getElementById('edit-room-old-name').value = name; 
    document.getElementById('edit-room-name').value = name; 
    document.getElementById('edit-room-icon').value = icon || '📦'; 
    document.getElementById('edit-room-modal').classList.remove('hidden');
};

window.closeEditRoomModal = function() { document.getElementById('edit-room-modal').classList.add('hidden'); };

window.saveEditRoom = async function() {
    const oldName = document.getElementById('edit-room-old-name').value; 
    const newName = document.getElementById('edit-room-name').value.trim(); 
    const newIcon = document.getElementById('edit-room-icon').value.trim() || '📦';
    if (!newName) return;
    const { error } = await window.supabaseClient.from('rooms').update({ name: newName, icon: newIcon }).eq('name', oldName).eq('household_id', window.currentUser.household_id);
    if (error) window.showToast('Błąd zapisu');
    else {
        await window.supabaseClient.from('tasks').update({ room: newName }).eq('room', oldName).eq('household_id', window.currentUser.household_id);
        window.closeEditRoomModal(); window.showToast('Zaktualizowano!'); window.loadAppRooms();
        setTimeout(() => window.refreshCurrentView(), 150);
    }
};

window.deleteRoom = function(encodedName) {
    const name = decodeURIComponent(encodedName); 
    window.customConfirm(`Usunąć pomieszczenie "${name}"?`, async () => {
        const { error } = await window.supabaseClient.from('rooms').delete().eq('name', name).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast('Błąd: ' + error.message); return; }
        window.showToast('Usunięto pomieszczenie'); 
        window.loadAppRooms(); 
        setTimeout(() => window.refreshCurrentView(), 150);
    });
};

window.populateRoomsDropdown = async function(selectId, selectedValue = '') {
    const selectEl = document.getElementById(selectId); if (!selectEl) return;
    if (appRooms.length === 0) await window.fetchRoomsFromDB();
    selectEl.innerHTML = appRooms.map(r => `<option value="${window.esc(r.name)}">${window.esc(r.icon)} ${window.esc(r.name)}</option>`).join('') + `<option value="Inne">📦 Inne</option>`;
    if (selectedValue) selectEl.value = selectedValue;
};

// --- ZARZĄDZANIE DOMOWNIKAMI ---

window.loadAppProfiles = async function() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('household_id', window.currentUser.household_id).order('name');
    appProfiles = data || [];
    if (appProfiles.length === 0) { listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak domowników.</p>`; return; }
    listEl.innerHTML = appProfiles.map(p => `
        <div class="flex justify-between items-center px-3 py-2 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold shadow-md border-2 border-[#131314]">${window.esc(p.name.charAt(0).toUpperCase())}</div>
                <span class="text-sm font-medium text-neutral-200">${window.esc(p.name)}</span>
            </div>
            <button onclick="window.openEditProfileScreen(${p.id})" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] text-sm">⚙️</button>
        </div>`).join('');
};

window.openNewProfileModal = function() { 
    document.getElementById('new-profile-name').value = ''; 
    document.getElementById('new-profile-modal').classList.remove('hidden'); 
};

window.closeNewProfileModal = function() { document.getElementById('new-profile-modal').classList.add('hidden'); };

window.saveNewProfile = async function() {
    const name = document.getElementById('new-profile-name').value.trim(); 
    if (!name) return;
    const { error } = await window.supabaseClient.from('profiles').insert([{ name: name, user_id: window.currentUser.id, household_id: window.currentUser.household_id }]);
    if (error) window.showToast("Błąd: " + error.message); 
    else { window.closeNewProfileModal(); window.showToast('Dodano!'); window.loadAppProfiles(); }
};

window.openEditProfileScreen = function(id) {
    const profile = appProfiles.find(p => p.id === id); if(!profile) return;
    document.getElementById('edit-profile-id').value = profile.id; 
    document.getElementById('edit-profile-name').value = profile.name; 
    document.getElementById('edit-profile-birth').value = profile.birth_date || ''; 
    document.getElementById('edit-profile-height').value = profile.height || ''; 
    document.getElementById('edit-profile-weight').value = profile.weight || ''; 
    document.getElementById('edit-profile-title').innerText = `Edytuj: ${profile.name}`; 
    window.goForward('edit-profile-screen');
};

window.saveProfileDetails = async function() {
    const id = document.getElementById('edit-profile-id').value; 
    const name = document.getElementById('edit-profile-name').value.trim(); 
    if(!name) return;
    const { error } = await window.supabaseClient.from('profiles').update({ 
        name: name, 
        birth_date: document.getElementById('edit-profile-birth').value || null, 
        height: document.getElementById('edit-profile-height').value || null, 
        weight: document.getElementById('edit-profile-weight').value || null 
    }).eq('id', id);
    if (error) window.showToast("Błąd zapisu"); 
    else { window.showToast('Zapisano profil'); window.goBack(); window.loadAppProfiles(); setTimeout(() => window.refreshCurrentView(), 150); }
};

// --- USTAWIENIA KONKRETNEJ CZYNNOŚCI (ZADANIA) ---

window.openSettingsScreen = async function(taskId) {
    try {
        const { data, error } = await window.supabaseClient.from('tasks').select('*').eq('id', taskId).single();
        if (error || !data) { window.showToast('Nie znaleziono zadania.'); return; }
        const task = data;
        document.getElementById('settings-title').innerText = task.name; 
        document.getElementById('set-task-name').value = task.name; 
        document.getElementById('set-task-interval').value = task.interval_days || 0; 
        document.getElementById('set-task-remind').value = task.remind_days_before || 0; 
        document.getElementById('set-task-push').checked = task.push_enabled !== false; 
        document.getElementById('set-task-history').checked = task.show_in_history !== false;
        window.currentEditingTaskId = task.id;
        await window.populateRoomsDropdown('set-task-room', task.room || 'Inne');
        window.renderHistory(); 
        window.goForward('settings-screen');
    } catch(err) { window.showToast("Wystąpił błąd."); }
};

window.saveTaskSettings = async function() {
    const n = document.getElementById('set-task-name').value.trim(); 
    const i = parseInt(document.getElementById('set-task-interval').value) || 0; 
    const r = document.getElementById('set-task-room').value; 
    const pushEnabled = document.getElementById('set-task-push').checked; 
    const showHist = document.getElementById('set-task-history').checked; 
    
    const { error } = await window.supabaseClient.from('tasks').update({ name: n, interval_days: i, room: r, push_enabled: pushEnabled, show_in_history: showHist }).eq('id', window.currentEditingTaskId);
    if (error) { window.showToast("Błąd: " + error.message); return; }
    
    // Aktualizujemy nazwę w logach (dla czytelności w DB), task_id i tak trzyma relację
    await window.supabaseClient.from('activity_logs').update({ activity_name: n }).eq('task_id', window.currentEditingTaskId);
    
    window.showToast("Zapisano!"); 
    window.goBack();
    setTimeout(() => window.refreshCurrentView(), 150);
};

window.renderHistory = function() {
    const logs = allHomeLogs.filter(l => l.task_id === window.currentEditingTaskId);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5">
            <p class="text-xs text-neutral-200">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
            <button onclick="window.deleteLog(${l.id})" class="text-neutral-500 text-xs">🗑️</button>
        </div>`).join('') || '<p class="text-neutral-500 text-xs py-4 text-center">Brak historii.</p>';
};

window.deleteLog = function(id) {
    window.customConfirm("Usunąć ten wpis z historii?", async () => {
        
        // KROK 1: Usunięcie wpisu z bazy (czekamy na zakończenie)
        const { error } = await window.supabaseClient.from('activity_logs')
            .delete()
            .eq('id', id)
            .eq('household_id', window.currentUser.household_id);
            
        if (error) { 
            window.showToast("Błąd: " + error.message); 
            return; 
        }

        // KROK 2: Pobranie absolutnie świeżych danych (czekamy na odpowiedź)
        const { data } = await window.supabaseClient.from('activity_logs')
            .select('*')
            .eq('household_id', window.currentUser.household_id)
            .order('created_at', { ascending: false });

        // KROK 3: Aktualizacja zmiennej w pamięci
        allHomeLogs = data || [];

        // KROK 4: Renderowanie historii w otwartym okienku ustawień
        window.renderHistory(); 
        
        // KROK 5: Informacja dla użytkownika i wyczyszczenie cache'u Dashboardu
        window.showToast("Usunięto wpis!");
        if (typeof window.invalidateDashboardCache === 'function') {
            window.invalidateDashboardCache();
        }

        // KROK 6: Odświeżenie głównego widoku pod spodem
        if (typeof window.refreshCurrentView === 'function') {
            await window.refreshCurrentView();
        }
    });
};

window.deleteCurrentTask = function() {
    window.customConfirm("Zarchiwizować czynność? Zniknie z głównych widoków.", async () => {
        const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', window.currentEditingTaskId); 
        if (error) { window.showToast("Błąd: " + error.message); return; }
        
        window.showToast("Zarchiwizowano!"); // UX Fix: Powiadomienie
        window.goBack(); // UX Fix: Zamknięcie okna
        setTimeout(() => window.refreshCurrentView(), 150); // UX Fix: Opóźnione odświeżenie
    });
};

// --- ARCHIWUM ---

window.openArchiveScreen = function() { window.goForward('archive-screen'); window.loadArchiveData(); };

window.loadArchiveData = async function() {
    const listEl = document.getElementById('archive-list'); 
    listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-10 animate-pulse">Pobieranie...</p>`;
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
            <div class="flex items-center gap-3">
                <span class="text-lg">${item.icon}</span>
                <div><h4 class="text-sm font-medium text-neutral-200">${window.esc(item.title)}</h4><p class="text-[9px] text-neutral-500 uppercase tracking-widest">${item.typeName}</p></div>
            </div>
            <div class="flex gap-1">
                <button onclick="window.restoreFromArchive('${item.type}', ${item.id})" class="px-3 py-1.5 rounded-full bg-[#0f5223]/20 text-[#c4eed0] text-[9px] font-bold uppercase border border-[#0f5223]/50">Przywróć</button>
                <button onclick="window.permanentlyDelete('${item.type}', ${item.id})" class="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-[#ffb4ab] text-xs">🗑️</button>
            </div>
        </div>`).join('');
};

window.restoreFromArchive = async function(table, id) {
    const { error } = await window.supabaseClient.from(table).update({ is_archived: false }).eq('id', id);
    if (error) window.showToast("Błąd"); 
    else { window.showToast("Przywrócono!"); window.loadArchiveData(); setTimeout(() => window.refreshCurrentView(), 150); }
};

window.permanentlyDelete = function(table, id) {
    window.customConfirm("Usunąć trwale? Operacji nie można cofnąć!", async () => {
        const { error } = await window.supabaseClient.from(table).delete().eq('id', id);
        if (error) window.showToast("Błąd"); 
        else { window.showToast("Usunięto trwale!"); window.loadArchiveData(); }
    });
};

window.logoutUser = async function() {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) window.showToast("Błąd wylogowania");
    else window.location.reload();
};
window.closeSettingsScreen = function() { 
    window.goBack(); 
};

window.closeEditProfileScreen = function() { 
    window.goBack(); 
};
