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
    window.loadAppRooms(); window.loadAppProfiles(); window.checkNotificationStatus(); 
};

window.saveUserName = async function() {
    const name = document.getElementById('settings-user-name').value.trim();
    if(!name) return;
    const { error } = await window.supabaseClient.auth.updateUser({ data: { name: name } });
    if (error) window.showToast("Błąd: " + error.message); 
    else { window.currentUser.name = name; window.showToast("Imię zapisane!"); }
};

window.openRoomsSettings = function() { window.goForward('settings-rooms-screen'); };
window.openProfilesSettings = function() { window.goForward('settings-profiles-screen'); };

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

window.populateRoomsDropdown = async function(selectId, selectedValue = '') {
    const selectEl = document.getElementById(selectId); if (!selectEl) return;
    if (appRooms.length === 0) await window.fetchRoomsFromDB();
    selectEl.innerHTML = appRooms.map(r => `<option value="${window.esc(r.name)}">${window.esc(r.icon)} ${window.esc(r.name)}</option>`).join('') + `<option value="Inne">📦 Inne</option>`;
    if (selectedValue) selectEl.value = selectedValue;
};

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
        window.renderHistory(); window.goForward('settings-screen');
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
    await window.supabaseClient.from('activity_logs').update({ activity_name: n }).eq('task_id', window.currentEditingTaskId);
    window.showToast("Zapisano!"); window.loadDashboard();
};

window.renderHistory = function() {
    const logs = allHomeLogs.filter(l => l.task_id === window.currentEditingTaskId);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `
        <div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5">
            <p class="text-xs text-neutral-200">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p>
            <button onclick="window.deleteLog(${l.id})" class="text-neutral-500 text-xs">🗑️</button>
        </div>`).join('') || '<p class="text-neutral-500 text-xs py-4 text-center">Brak historii.</p>';
};

window.deleteCurrentTask = function() {
    window.customConfirm("Zarchiwizować czynność?", async () => {
        const { error } = await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', window.currentEditingTaskId); 
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.closeSettingsScreen(); window.loadDashboard();
    });
};
