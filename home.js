// ==========================================
// LOGIKA: DOM (home.js)
// ==========================================

let allHomeLogs = []; let allHomeTasks = []; let currentRoomFilter = null; 

window.filterHomeByRoom = function(room) { currentRoomFilter = room; if (activeView !== 'home') window.switchView('home'); else loadDashboard(); };
window.clearRoomFilter = function() { currentRoomFilter = null; loadDashboard(); };

window.loadDashboard = async function() {
    const list = document.getElementById('dashboard-list'); const backBtn = document.getElementById('home-back-btn'); const hid = window.currentUser.household_id;
    
    if (currentRoomFilter) {
        if (backBtn) { backBtn.classList.remove('hidden'); backBtn.innerHTML = '←'; }
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = currentRoomFilter; if (p) p.innerText = 'Lista zadań';
    } else {
        if (backBtn) backBtn.classList.add('hidden');
        const h1 = document.querySelector('#view-home h1'); const p = document.querySelector('#view-home p');
        if (h1) h1.innerText = 'Dom'; if (p) p.innerText = 'Wybierz pomieszczenie';
    }

    const [tRes, lRes, rRes] = await Promise.all([
        supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
        supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }),
        supabaseClient.from('rooms').select('*').eq('household_id', hid).order('name')
    ]);
    
    allHomeTasks = tRes.data || []; allHomeLogs = lRes.data || []; const dbRooms = rRes.data || []; const today = new Date(); today.setHours(0,0,0,0);

    if (!currentRoomFilter) {
        let roomStats = {}; dbRooms.forEach(r => roomStats[r.name] = { icon: r.icon, total: 0, overdue: 0 });
        if (!roomStats['Inne']) roomStats['Inne'] = { icon: '📦', total: 0, overdue: 0 };
        
        let totalOverdueAll = 0;
        allHomeTasks.forEach(task => {
            const rName = task.room || 'Inne'; if (!roomStats[rName]) roomStats[rName] = { icon: '📦', total: 0, overdue: 0 }; roomStats[rName].total++;
            if (task.interval_days > 0) {
                const lastLog = allHomeLogs.find(l => l.activity_name === task.name); let isOverdue = false;
                if (lastLog) { const last = new Date(lastLog.created_at); last.setHours(0,0,0,0); const next = new Date(last); next.setDate(last.getDate() + task.interval_days); if (next <= today) isOverdue = true; } else { isOverdue = true; }
                if (isOverdue) { roomStats[rName].overdue++; totalOverdueAll++; }
            }
        });

        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">`;
        const allBadge = totalOverdueAll > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${totalOverdueAll}</div>` : '';
        html += `<div onclick="filterHomeByRoom('Wszystkie')" class="relative bg-[#004a77]/20 p-4 rounded-[20px] border border-[#004a77]/50 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24">${allBadge}<div class="text-2xl mb-1 opacity-80">🗂️</div><h3 class="text-xs font-medium text-[#c2e7ff]">Wszystkie</h3><p class="text-[9px] text-[#c2e7ff]/70 mt-0.5 uppercase tracking-widest">${allHomeTasks.length} zadań</p></div>`;

        Object.entries(roomStats).sort((a,b) => (a[0] === 'Inne' ? 1 : b[0] === 'Inne' ? -1 : a[0].localeCompare(b[0]))).forEach(([roomName, stats]) => {
            const badge = stats.overdue > 0 ? `<div class="absolute top-2 right-2 bg-[#ffb4ab] text-[#3c1414] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">${stats.overdue}</div>` : '';
            html += `<div onclick="filterHomeByRoom('${window.esc(roomName)}')" class="relative bg-[#1e1f20] p-4 rounded-[20px] border border-[#333537] cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center text-center h-24">${badge}<div class="text-2xl mb-1 opacity-80">${window.esc(stats.icon)}</div><h3 class="text-xs font-medium text-neutral-200">${window.esc(roomName)}</h3><p class="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-widest">${stats.total} zadań</p></div>`;
        });
        list.innerHTML = html + `</div>`; return;
    }

    let tasksToDisplay = currentRoomFilter === 'Wszystkie' ? allHomeTasks : allHomeTasks.filter(t => (t.room || 'Inne') === currentRoomFilter);
    let scored = tasksToDisplay.map(t => ({ t, last: allHomeLogs.find(l => l.activity_name === t.name), score: calculatePriority(t, allHomeLogs.find(l => l.activity_name === t.name)?.created_at) })).sort((a,b) => b.score - a.score || a.t.name.localeCompare(b.t.name));

    list.innerHTML = scored.length ? scored.map(item => {
        const status = getCompactStatus(item.last?.created_at, item.t.interval_days);
        const roomBadge = currentRoomFilter === 'Wszystkie' ? `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${window.esc(item.t.room || 'Inne')}</span>` : '';
        const muteIcon = item.t.push_enabled === false ? `<span title="Wyciszone" class="ml-2 text-neutral-600 text-xs">🔕</span>` : '';

        return `<div class="flex items-center justify-between p-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1 shadow-sm"><div class="flex-1 cursor-pointer pr-2" onclick="window.showToast('${window.esc(status.tooltip)}')"><h3 class="font-medium text-neutral-100 text-sm flex items-center">${window.esc(item.t.name)} ${roomBadge} ${muteIcon}</h3><p class="text-[10px] ${status.color} mt-0.5">${status.label}</p></div><div class="flex items-center gap-1.5 shrink-0"><button onclick="window.openAddLogModal('${encodeURIComponent(item.t.name)}')" class="w-8 h-8 rounded-full bg-[#0f5223]/20 text-[#c4eed0] flex items-center justify-center active:scale-90 pb-0.5 text-base border border-[#0f5223]/50">+</button><button onclick="window.openSettingsScreen('${encodeURIComponent(item.t.name)}')" class="w-8 h-8 rounded-full bg-[#333537]/50 text-neutral-400 flex items-center justify-center active:scale-90 text-xs">⚙️</button></div></div>`;
    }).join('') : `<p class="text-center text-neutral-500 text-xs py-10">Brak zadań.</p>`;
};

function getRelativeTime(d) {
    const diff = Math.floor((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
    return diff === 0 ? "dzisiaj" : diff === 1 ? "wczoraj" : diff < 7 ? `${diff} dni temu` : new Date(d).toLocaleDateString('pl-PL');
}

function getCompactStatus(lastDate, interval) {
    if (!lastDate) return { color: 'text-neutral-500', label: 'Jeszcze nie było robione', tooltip: 'Brak wpisów.' }; const relText = `Ostatnio ${getRelativeTime(lastDate)}`;
    if (!interval || interval <= 0) return { color: 'text-neutral-500', label: relText, tooltip: 'Brak harmonogramu.' };
    const next = new Date(lastDate); next.setDate(next.getDate() + interval); const diff = Math.ceil((next - new Date().setHours(0,0,0,0)) / 86400000);
    return diff < 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: `Przeterminowane o ${Math.abs(diff)} dni.` } : diff === 0 ? { color: 'text-[#ffb4ab]', label: relText, tooltip: 'Dzisiaj!' } : { color: 'text-[#c4eed0]', label: relText, tooltip: `Za ${diff} dni.` };
}

function calculatePriority(task, lastDate) { if (!task.interval_days || task.interval_days <= 0) return -1; if (!lastDate) return 999; return Math.floor((new Date() - new Date(lastDate)) / 86400000) / task.interval_days; }

window.openAddLogModal = function(n) { const name = decodeURIComponent(n); document.getElementById('add-log-subtitle').innerText = name; document.getElementById('add-log-name').value = name; document.getElementById('add-log-date').value = new Date().toISOString().split('T')[0]; document.getElementById('add-log-notes').value = ''; document.getElementById('add-log-modal').classList.remove('hidden'); };
window.closeAddLogModal = function() { document.getElementById('add-log-modal').classList.add('hidden'); };

window.saveNewLog = async function() {
    const n = document.getElementById('add-log-name').value; const d = document.getElementById('add-log-date').value; const nt = document.getElementById('add-log-notes').value;
    await supabaseClient.from('activity_logs').insert([{ activity_name: n, created_at: `${d}T12:00:00.000Z`, notes: nt, user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name }]);
    window.closeAddLogModal(); loadDashboard();
};

window.renderHistory = function() {
    const logs = allHomeLogs.filter(l => l.activity_name === window.currentEditingHomeTask);
    document.getElementById('settings-history-list').innerHTML = logs.map(l => `<div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5"><p class="text-xs text-neutral-200">${new Date(l.created_at).toLocaleDateString('pl-PL')}</p><div class="flex gap-1"><button onclick="window.openEditLogModal(${l.id}, '${l.created_at.split('T')[0]}', '${encodeURIComponent(l.notes||'')}')" class="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#333537] hover:text-neutral-200 transition-colors text-xs">✏️</button><button onclick="window.deleteLog(${l.id})" class="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-[#3c1414] hover:text-[#ffb4ab] transition-colors text-xs">🗑️</button></div></div>`).join('') || '<p class="text-neutral-500 text-xs py-4 text-center">Brak historii.</p>';
};

window.deleteLog = async function(id) {
    if(confirm("Usunąć ten wpis?")) { 
        await supabaseClient.from('activity_logs').delete().eq('id', id).eq('household_id', window.currentUser.household_id); 
        loadDashboard(); 
        const res = await supabaseClient.from('activity_logs').select('*').eq('activity_name', window.currentEditingHomeTask).eq('household_id', window.currentUser.household_id).order('created_at', { ascending: false });
        allHomeLogs = res.data || []; renderHistory(); 
    }
};

window.openEditLogModal = function(id, date, notes) { document.getElementById('edit-log-id').value = id; document.getElementById('edit-log-date').value = date; document.getElementById('edit-log-notes').value = decodeURIComponent(notes); document.getElementById('edit-log-modal').classList.remove('hidden'); };
window.closeEditLogModal = function() { document.getElementById('edit-log-modal').classList.add('hidden'); };

window.saveEditLog = async function() {
    const id = document.getElementById('edit-log-id').value; const d = document.getElementById('edit-log-date').value; const n = document.getElementById('edit-log-notes').value;
    await supabaseClient.from('activity_logs').update({ created_at: `${d}T12:00:00.000Z`, notes: n }).eq('id', id).eq('household_id', window.currentUser.household_id);
    closeEditLogModal(); loadDashboard();
    const res = await supabaseClient.from('activity_logs').select('*').eq('activity_name', window.currentEditingHomeTask).eq('household_id', window.currentUser.household_id).order('created_at', { ascending: false });
    allHomeLogs = res.data || []; renderHistory();
};
