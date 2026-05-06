// ==========================================
// LOGIKA: GOSPODARSTWO DOMOWE (household.js)
// ==========================================

window.initHousehold = async function(user) {
    // Sprawdzamy, czy użytkownik ma już swój dom
    let { data: members, error: memErr } = await window.supabaseClient
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id);
        
    if (memErr) throw memErr;

    let hid = null;
    
    if (!members || members.length === 0) {
        // Jeśli nie ma domu, tworzymy nowy dom o nazwie "Nasz Dom"
        const { data: hh, error: hhErr } = await window.supabaseClient
            .from('households')
            .insert([{ name: 'Nasz Dom' }])
            .select()
            .single();
            
        if (hhErr) throw hhErr;
        hid = hh.id;

        // I przypisujemy użytkownika do tego nowego domu
        const { error: insErr } = await window.supabaseClient
            .from('household_members')
            .insert([{ household_id: hid, user_id: user.id }]);
            
        if (insErr) throw insErr;
    } else { 
        // Jeśli ma, po prostu pobieramy jego ID
        hid = members[0].household_id; 
    }
    
    return hid;
};

window.openJoinHouseholdModal = function() {
    document.getElementById('join-hh-input').value = '';
    document.getElementById('join-household-modal').classList.remove('hidden');
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

    // KROK 1: Weryfikacja, czy dom w ogóle istnieje w bazie (ZALECENIE CLAUDEAI)
    const { data: hh, error: checkError } = await window.supabaseClient
        .from('households')
        .select('id')
        .eq('id', newHouseholdId)
        .maybeSingle();

    // Jeśli zapytanie zwróci błąd, albo nie znajdzie domu (hh jest puste)
    if (checkError || !hh) {
        console.warn("Próba dołączenia do nieistniejącego domu:", code);
        window.showToast("Niepoprawny kod! Taki dom nie istnieje.");
        return; 
    }

    // KROK 2: Bezpieczne dołączenie do zweryfikowanego domu
    const { error: joinError } = await window.supabaseClient
        .from('household_members')
        .insert([{ household_id: hh.id, user_id: window.currentUser.id }]);

    if (joinError) {
        console.error("Błąd łączenia domów:", joinError); 
        window.showToast("Wystąpił błąd podczas dołączania.");
    } else {
        // KROK 3: Usunięcie starego przypisania dopiero po sukcesie
        await window.supabaseClient
            .from('household_members')
            .delete()
            .eq('household_id', oldHouseholdId)
            .eq('user_id', window.currentUser.id);
            
        window.closeJoinHouseholdModal(); 
        window.showToast("Zsynchronizowano! Przeładowuję..."); 
        setTimeout(() => window.location.reload(), 1500);
    }
};
