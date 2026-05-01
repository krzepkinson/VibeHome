let allHomeLogs = []; let allHomeTasks = []; let currentRoomFilter = null; 
window.filterHomeByRoom = function(room) { currentRoomFilter = room; if (activeView !== 'home') window.switchView('home'); else loadDashboard(); };
window.clearRoomFilter = function() { currentRoomFilter = null; loadDashboard(); };
window.loadDashboard = async function() {
    const list = document.getElementById('dashboard-list'); const hid = window.currentUser.household_id;
    const [tRes, lRes, rRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
        supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }),
        supabaseClient.from('rooms').select('*').eq('household_id', hid).order('name')
    ]);
    allHomeTasks = tRes.data || []; allHomeLogs = lRes.data || []; const dbRooms = rRes.data || [];
    if (!currentRoomFilter) {
        let roomStats = {}; dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
        allHomeTasks.forEach(task => { 
            const rName = task.room || 'Inne'; if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 }; roomStats[rName].total++;
        });
        list.innerHTML = `<div class="grid grid-cols-2 gap-3">` + Object.entries(roomStats).map(([n, s]) => `<div onclick="filterHomeByRoom('${window.esc(n)}')" class="bg-[#1e1f20] p-4 rounded-[20px] text-center"><div class="text-2xl mb-1">${window.esc(s.icon)}</div><h3 class="text-xs font-medium">${window.esc(n)}</h3></div>`).join('') + `</div>`;
    } else {
        let filtered = currentRoomFilter === 'Wszystkie' ? allHomeTasks : allHomeTasks.filter(t => (t.room || 'Inne') === currentRoomFilter);
        list.innerHTML = filtered.map(t => `<div class="p-3 bg-[#1e1f20] rounded-xl mb-1.5 flex justify-between items-center"><h3 class="text-sm font-medium">${window.esc(t.name)}</h3><div class="flex gap-2"><button onclick="window.openAddLogModal('${encodeURIComponent(t.name)}')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 text-[#c4eed0] font-bold">+</button><button onclick="window.openSettingsScreen('${encodeURIComponent(t.name)}')" class="text-neutral-500">⚙️</button></div></div>`).join('');
    }
};

window.openAddLogModal = function(n) { const name = decodeURIComponent(n); document.getElementById('add-log-name').value = name; document.getElementById('add-log-subtitle').innerText = name; document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0]; document.getElementById('add-log-modal').classList.remove('hidden'); };
window.closeAddLogModal = function() { document.getElementById('add-log-modal').classList.add('hidden'); };
window.saveNewLog = async function() {
    const n = document.getElementById('add-log-name').value; const d = document.getElementById('add-log-date').value;
    await supabaseClient.from('activity_logs').insert([{ activity_name: n, created_at: `${d}T12:00:00.000Z`, user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name }]);
    window.closeAddLogModal(); loadDashboard();
};

window.renderHistory = function() {
    const logs = allHomeLogs.filter(l => l.activity_name === window.currentEditingHomeTask);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `<div class="p-2 bg-[#131314] rounded-lg mb-1 flex justify-between items-center text-xs"><span>${new Date(l.created_at).toLocaleDateString('pl-PL')}</span><button onclick="deleteLog(${l.id})">🗑️</button></div>`).join('') || 'Brak.';
};

// ZMIANA: Użycie customConfirm
window.deleteLog = function(id) {
    window.customConfirm("Usunąć ten wpis z historii?", async () => {
        await supabaseClient.from('activity_logs').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
        const res = await supabaseClient.from('activity_logs').select('*').eq('activity_name', window.currentEditingHomeTask).eq('household_id', window.currentUser.household_id).order('created_at', { ascending: false });
        allHomeLogs = res.data || []; renderHistory(); loadDashboard();
    });
};
