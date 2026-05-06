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

    // Weryfikacja czy dom istnieje
    const { data: hh, error: checkError } = await window.supabaseClient
        .from('households')
        .select('id')
        .eq('id', newHouseholdId)
        .maybeSingle();

    if (checkError || !hh) {
        window.showToast("Niepoprawny kod! Taki dom nie istnieje.");
        return; 
    }

    // Dołączenie do domu
    const { error: joinError } = await window.supabaseClient
        .from('household_members')
        .insert([{ household_id: hh.id, user_id: window.currentUser.id }]);

    if (joinError) {
        window.showToast("Wystąpił błąd podczas dołączania.");
    } else {
        // Usunięcie starego powiązania
        await window.supabaseClient
            .from('household_members')
            .delete()
            .eq('household_id', oldHouseholdId)
            .eq('user_id', window.currentUser.id);
            
        // PŁYNNE PRZEJŚCIE ZAMIAST RELOADU
        // 1. Aktualizujemy stan użytkownika
        window.currentUser.household_id = hh.id;
        
        // 2. Czyścimy wszystkie zapamiętane filtry i cache Przeglądu
        if (typeof window.clearRoomFilter === 'function') window.clearRoomFilter();
        if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
        
        // 3. Zamykamy modal i informujemy użytkownika
        window.closeJoinHouseholdModal(); 
        window.showToast("Pomyślnie dołączono do domu! 🏠"); 
        
        // 4. Przerzucamy go gładko do Przeglądu (który sam pociągnie nowe dane)
        window.switchView('dashboard');
        
        // 5. Cicho odświeżamy resztę modułów w tle, by po wejściu w inną zakładkę miały świeże dane
        setTimeout(() => {
            if (typeof window.initSettingsModule === 'function') window.initSettingsModule();
            if (typeof window.loadTodosAndLists === 'function') window.loadTodosAndLists();
        }, 500);
    }
};
