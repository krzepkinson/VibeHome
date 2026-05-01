let healthProfiles = []; let healthTasks = []; let healthLogs = []; let currentProfileId = null;
window.initHealthModule = async function() {
    const hid = window.currentUser.household_id;
    const { data: pData } = await supabaseClient.from('profiles').select('*').eq('household_id', hid).order('name');
    healthProfiles = pData || []; if (healthProfiles.length > 0 && !currentProfileId) currentProfileId = healthProfiles[0].id;
    if (currentProfileId) {
        const [t, l] = await Promise.all([supabaseClient.from('health_tasks').select('*').eq('profile_id', currentProfileId).eq('household_id', hid).eq('is_archived', false), supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false })]);
        healthTasks = t.data || []; healthLogs = l.data || [];
    }
    const nameTitle = document.getElementById('profile-name-title'); if(nameTitle) nameTitle.innerText = healthProfiles.find(x => x.id === currentProfileId)?.name || 'Brak';
    renderHealthTasks();
};

function renderHealthTasks() {
    const list = document.getElementById('health-tasks-list');
    list.innerHTML = healthTasks.map(t => `<div class="p-3 bg-[#1e1f20] rounded-xl mb-1.5 flex justify-between items-center"><div onclick="openHealthSettingsScreen(${t.id})" class="flex-1"><span>${window.esc(t.name)}</span></div><button onclick="startHealthLog(${t.id}, '${t.task_type}')" class="w-8 h-8 rounded-full bg-[#3c1414] text-[#ffb4ab] font-bold">+</button></div>`).join('');
}

window.startHealthLog = async function(taskId, type) {
    await supabaseClient.from('health_logs').insert([{ health_task_id: taskId, start_date: new Date().toISOString(), end_date: type === 'duration' ? null : new Date().toISOString(), user_id: window.currentUser.id, household_id: window.currentUser.household_id, user_name: window.currentUser.name }]);
    window.initHealthModule();
};

window.openHealthSettingsScreen = async function(id) {
    const task = healthTasks.find(x => x.id === id); window.currentHealthSettingsId = id;
    document.getElementById('h-settings-title').innerText = task.name;
    document.getElementById('set-h-task-name').value = task.name;
    document.getElementById('h-settings-history-list').innerHTML = healthLogs.filter(l => l.health_task_id === id).map(l => `<div class="p-2 flex justify-between items-center text-xs"><span>${new Date(l.start_date).toLocaleDateString()}</span><button onclick="deleteHealthLog(${l.id})">🗑️</button></div>`).join('');
    window.goForward('health-settings-screen');
};

// ZMIANA: Użycie customConfirm
window.deleteHealthLog = function(id) {
    window.customConfirm("Usunąć wpis zdrowotny?", async () => {
        await supabaseClient.from('health_logs').delete().eq('id', id).eq('household_id', window.currentUser.household_id);
        window.goBack(); window.initHealthModule();
    });
};

window.deleteHealthTask = function() {
    window.customConfirm("Zarchiwizować to zdarzenie?", async () => {
        await supabaseClient.from('health_tasks').update({ is_archived: true }).eq('id', window.currentHealthSettingsId).eq('household_id', window.currentUser.household_id);
        window.goBack(); window.initHealthModule();
    });
};
