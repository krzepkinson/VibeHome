// ==========================================
// LOGIKA: USTAWIENIA GŁÓWNE (settings.js)
// ==========================================

let appRooms = [];
let appProfiles = [];

function initSettingsModule() {
    loadAppRooms();
    loadAppProfiles();
    checkNotificationStatus(); // NOWE: Sprawdzanie uprawnień
}

// --------------------------------------------------------
// SEKCJA: POWIADOMIENIA (NOWE)
// --------------------------------------------------------
function checkNotificationStatus() {
    const statusText = document.getElementById('notif-status-text');
    const btn = document.getElementById('notif-enable-btn');
    if (!statusText || !btn) return;

    if (!("Notification" in window)) {
        statusText.innerText = "Twoja przeglądarka/system nie wspiera powiadomień.";
        btn.classList.add('hidden');
        return;
    }

    if (Notification.permission === "granted") {
        statusText.innerText = "Status: Aktywne 🔔";
        statusText.classList.replace('text-neutral-400', 'text-[#c4eed0]');
        btn.classList.add('hidden');
    } else if (Notification.permission === "denied") {
        statusText.innerText = "Status: Zablokowane w systemie 🔕";
        statusText.classList.replace('text-neutral-400', 'text-[#ffb4ab]');
        btn.classList.add('hidden');
    } else {
        statusText.innerText = "Status: Wymaga zgody";
        btn.classList.remove('hidden');
    }
}

function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    
    Notification.requestPermission().then(permission => {
        checkNotificationStatus();
        if (permission === "granted") {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('HomeVibe', {
                    body: 'Powiadomienia zostały włączone pomyślnie! 🎉',
                    icon: '/icon.png',
                    vibrate: [200, 100, 200]
                });
            });
        }
    });
}

// --------------------------------------------------------
// SEKCJA: POMIESZCZENIA
// --------------------------------------------------------
async function fetchRoomsFromDB() {
    const { data } = await supabaseClient.from('rooms').select('*').order('name');
    appRooms = data || [];
    return appRooms;
}

async function loadAppRooms() {
    const listEl = document.getElementById('settings-rooms-list');
    await fetchRoomsFromDB();

    if (appRooms.length === 0) {
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak zdefiniowanych pomieszczeń.</p>`;
        return;
    }

    listEl.innerHTML = appRooms.map(room => `
        <div class="flex justify-between items-center p-3 bg-[#131314] rounded-[16px] border border-[#333537]">
            <div class="flex items-center gap-3">
                <span class="text-xl">${room.icon || '📦'}</span>
                <span class="text-sm font-medium text-neutral-200">${room.name}</span>
            </div>
            <button onclick="deleteRoom('${encodeURIComponent(room.name)}')" class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-sm">🗑️</button>
        </div>
    `).join('');
}

function openNewRoomModal() {
    document.getElementById('new-room-name').value = '';
    document.getElementById('new-room-icon').value = '🏠';
    document.getElementById('new-room-modal').classList.remove('hidden');
}

function closeNewRoomModal() { document.getElementById('new-room-modal').classList.add('hidden'); }

async function saveNewRoom() {
    const name = document.getElementById('new-room-name').value.trim();
    const icon = document.getElementById('new-room-icon').value.trim();
    if (!name) return;

    const { error } = await supabaseClient.from('rooms').insert([{ name: name, icon: icon || '📦' }]);
    
    if (error) {
        if (error.code === '23505') alert('Pomieszczenie o tej nazwie już istnieje!');
        else alert('Błąd zapisu: ' + error.message);
    } else {
        closeNewRoomModal();
        showToast('Dodano pomieszczenie!');
        loadAppRooms();
    }
}

async function deleteRoom(encodedName) {
    const name = decodeURIComponent(encodedName);
    if (!confirm(`Trwale usunąć pomieszczenie "${name}" z bazy? Czynności do niego przypisane otrzymają status "Inne".`)) return;
    
    await supabaseClient.from('rooms').delete().eq('name', name);
    showToast('Usunięto pomieszczenie');
    loadAppRooms();
}

async function populateRoomsDropdown(selectId, selectedValue = '') {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    if (appRooms.length === 0) await fetchRoomsFromDB();

    selectEl.innerHTML = appRooms.map(r => `<option value="${r.name}">${r.icon} ${r.name}</option>`).join('');

    if (!appRooms.find(r => r.name === 'Inne')) {
        selectEl.innerHTML += `<option value="Inne">📦 Inne</option>`;
    }

    if (selectedValue) selectEl.value = selectedValue;
}

// --------------------------------------------------------
// SEKCJA: DOMOWNICY
// --------------------------------------------------------
function getAgeBadge(birthDateStr) {
    if (!birthDateStr) return '';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    
    let totalMonths = (today.getFullYear() - birthDate.getFullYear()) * 12;
    totalMonths -= birthDate.getMonth();
    totalMonths += today.getMonth();
    
    if (today.getDate() < birthDate.getDate()) {
        totalMonths--;
    }
    if (totalMonths < 0) totalMonths = 0;

    let ageText = "";
    if (totalMonths < 24) {
        if (totalMonths === 1) ageText = "1 miesiąc";
        else if ([2, 3, 4, 22, 23].includes(totalMonths)) ageText = `${totalMonths} miesiące`;
        else ageText = `${totalMonths} miesięcy`;
    } else {
        const years = Math.floor(totalMonths / 12);
        if (years === 1) ageText = "1 rok";
        else if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100)) ageText = `${years} lata`;
        else ageText = `${years} lat`;
    }

    return `<span class="bg-[#333537] text-neutral-300 text-[9px] px-2 py-0.5 rounded-md ml-2 uppercase tracking-widest">${ageText}</span>`;
}

async function loadAppProfiles() {
    const listEl = document.getElementById('settings-profiles-list');
    const { data } = await supabaseClient.from('profiles').select('*').order('name');
    appProfiles = data || [];

    if (appProfiles.length === 0) {
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-4">Brak domowników.</p>`;
        return;
    }

    listEl.innerHTML = appProfiles.map(p => {
        return `
        <div class="flex justify-between items-center p-3 bg-[#131314] rounded-[20px] border border-[#333537]">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-[#444746] text-neutral-200 rounded-full flex items-center justify-center font-bold">${p.name.charAt(0).toUpperCase()}</div>
                <div>
                    <span class="text-sm font-medium text-neutral-200 flex items-center">${p.name} ${getAgeBadge(p.birth_date)}</span>
                    <span class="text-[10px] text-neutral-500 mt-0.5 block">${p.height ? p.height + ' cm' : '-- cm'} • ${p.weight ? p.weight + ' kg' : '-- kg'}</span>
                </div>
            </div>
            <button onclick="openEditProfileScreen(${p.id})" class="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-sm">⚙️</button>
        </div>
        `;
    }).join('');
}

function openEditProfileScreen(id) {
    const profile = appProfiles.find(p => p.id === id);
    if(!profile) return;
    
    document.getElementById('edit-profile-id').value = profile.id;
    document.getElementById('edit-profile-name').value = profile.name;
    document.getElementById('edit-profile-birth').value = profile.birth_date || '';
    document.getElementById('edit-profile-height').value = profile.height || '';
    document.getElementById('edit-profile-weight').value = profile.weight || '';
    
    document.getElementById('edit-profile-title').innerText = `Edytuj: ${profile.name}`;
    goForward('edit-profile-screen');
}

function closeEditProfileScreen() { goBack(); }

async function saveProfileDetails() {
    const id = document.getElementById('edit-profile-id').value;
    const name = document.getElementById('edit-profile-name').value.trim();
    const birth = document.getElementById('edit-profile-birth').value || null;
    const height = document.getElementById('edit-profile-height').value || null;
    const weight = document.getElementById('edit-profile-weight').value || null;

    if(!name) return;

    await supabaseClient.from('profiles').update({ name, birth_date: birth, height, weight }).eq('id', id);
    
    showToast('Zapisano profil');
    closeEditProfileScreen();
    
    loadAppProfiles(); 
    if(typeof initHealthModule === 'function') initHealthModule();
}
