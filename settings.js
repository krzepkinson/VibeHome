// ==========================================
// LOGIKA: USTAWIENIA GŁÓWNE (settings.js)
// ==========================================

let appRooms = [];

// Główna funkcja pobierająca pokoje dla całej aplikacji
async function fetchRoomsFromDB() {
    const { data } = await supabaseClient.from('rooms').select('*').order('name');
    appRooms = data || [];
    return appRooms;
}

// Renderowanie listy w zakładce Ustawienia
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

function closeNewRoomModal() {
    document.getElementById('new-room-modal').classList.add('hidden');
}

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

// Funkcja eksportowana do home.js, aby wypełnić `<select>` opcjami z bazy
async function populateRoomsDropdown(selectId, selectedValue = '') {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    
    // Upewniamy się, że mamy świeżą listę
    if (appRooms.length === 0) await fetchRoomsFromDB();

    // Generujemy dynamicznie <option>
    selectEl.innerHTML = appRooms.map(r => `
        <option value="${r.name}">${r.icon} ${r.name}</option>
    `).join('');

    // Dodajemy fallback dla "Inne" (gdyby ktoś usunął wszystkie)
    if (!appRooms.find(r => r.name === 'Inne')) {
        selectEl.innerHTML += `<option value="Inne">📦 Inne</option>`;
    }

    if (selectedValue) {
        selectEl.value = selectedValue;
    }
}
