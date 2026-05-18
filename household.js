// ==========================================
// LOGIKA: GOSPODARSTWO DOMOWE (household.js)
// ==========================================

window.initHousehold = async function(user) {
    let { data: members, error: memErr } = await window.supabaseClient
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id);
        
    if (memErr) throw memErr;

    let hid = null;
    
    if (!members || members.length === 0) {
        const { data: hh, error: hhErr } = await window.supabaseClient
            .from('households')
            .insert([{ name: 'Nasz Dom' }])
            .select()
            .single();
            
        if (hhErr) throw hhErr;
        hid = hh.id;

        const { error: insErr } = await window.supabaseClient
            .from('household_members')
            .insert([{ household_id: hid, user_id: user.id }]);
            
        if (insErr) throw insErr;
    } else { 
        hid = members[0].household_id; 
    }
    
    return hid;
};

window.openJoinHouseholdModal = function() {
    document.getElementById('join-hh-input').value = '';
    document.getElementById('join-household-modal').classList.remove('hidden');
    setTimeout(() => {
        const input = document.getElementById('join-hh-input');
        if (input) input.focus();
    }, 100);
};

window.closeJoinHouseholdModal = function() {
    document.getElementById('join-household-modal').classList.add('hidden');
};

window.processJoinHousehold = async function() {
    const code = document.getElementById('join-hh-input').value.trim();
    if (!code) return;
    
    const newHouseholdId = code; 
    const oldHouseholdId = window.currentUser.household_id;
    
    if (newHouseholdId === oldHouseholdId) { 
        window.showToast("Już jesteś w tym domu!"); 
        return; 
    }

    const { data: hh, error: checkError } = await window.supabaseClient
        .from('households')
        .select('id')
        .eq('id', newHouseholdId)
        .maybeSingle();

    if (checkError || !hh) {
        window.showToast("Niepoprawny kod! Taki dom nie istnieje.");
        return; 
    }

    const { error: joinError } = await window.supabaseClient
        .from('household_members')
        .insert([{ household_id: hh.id, user_id: window.currentUser.user_id }]);

    if (joinError) {
        window.showToast("Wystąpił błąd podczas dołączania.");
    } else {
        await window.supabaseClient
            .from('household_members')
            .delete()
            .eq('household_id', oldHouseholdId)
            .eq('user_id', window.currentUser.user_id);
            
        window.currentUser.household_id = hh.id;
        
        if (typeof window.clearRoomFilter === 'function') window.clearRoomFilter();
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        
        window.closeJoinHouseholdModal(); 
        window.showToast("Pomyślnie dołączono do domu! 🏠"); 
        window.switchView('dashboard');
        
        setTimeout(() => {
            if (typeof window.initSettingsModule === 'function') window.initSettingsModule();
            if (typeof window.loadTodosAndLists === 'function') window.loadTodosAndLists();
        }, 500);
    }
};

// --- PODPIĘCIE EVENT DISPATCHERA ---
if (window.EventDispatcher) {
    window.EventDispatcher.onClick('.js-close-join-household', () => window.closeJoinHouseholdModal());
    window.EventDispatcher.onClick('.js-process-join-household', () => window.processJoinHousehold());
}
