// ==========================================
// LOGIKA: USTAWIENIA (settings.js)
// ==========================================

async function fetchRoomsFromDB() {
    const { data } = await supabaseClient.from('rooms').select('*').eq('user_id', window.currentUser.id).order('name');
    appRooms = data || []; return appRooms;
}

async function loadAppProfiles() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await supabaseClient.from('profiles').select('*').eq('user_id', window.currentUser.id).order('name');
    appProfiles = data || [];
    // ... renderowanie listy
}

async function saveNewRoom() {
    const name = document.getElementById('new-room-name').value.trim();
    const icon = document.getElementById('new-room-icon').value.trim();
    if (!name) return;
    await supabaseClient.from('rooms').insert([{ name, icon: icon || '📦', user_id: window.currentUser.id }]);
    closeNewRoomModal(); loadAppRooms();
}

async function saveNewProfile() {
    const name = document.getElementById('new-profile-name').value.trim();
    if (!name) return;
    await supabaseClient.from('profiles').insert([{ name, user_id: window.currentUser.id }]);
    closeNewProfileModal(); loadAppProfiles();
}

async function saveProfileDetails() {
    const id = document.getElementById('edit-profile-id').value;
    const name = document.getElementById('edit-profile-name').value.trim();
    const uid = window.currentUser.id;
    await supabaseClient.from('profiles').update({ name, ... }).eq('id', id).eq('user_id', uid);
    closeEditProfileScreen(); loadAppProfiles();
}
