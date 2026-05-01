// ==========================================
// LOGIKA: GOSPODARSTWO DOMOWE (household.js)
// ==========================================

window.initHousehold = async function(user) {
    // Sprawdzamy, czy użytkownik ma już swój dom
    let { data: members, error: memErr } = await supabaseClient
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id);
        
    if (memErr) throw memErr;

    let hid = null;
    
    if (!members || members.length === 0) {
        // Jeśli nie ma domu, tworzymy nowy dom o nazwie "Nasz Dom"
        const { data: hh, error: hhErr } = await supabaseClient
            .from('households')
            .insert([{ name: 'Nasz Dom' }])
            .select()
            .single();
            
        if (hhErr) throw hhErr;
        hid = hh.id;

        // I przypisujemy użytkownika do tego nowego domu
        const { error: insErr } = await supabaseClient
            .from('household_members')
            .insert([{ household_id: hid, user_id: user.id }]);
            
        if (insErr) throw insErr;
    } else { 
        // Jeśli ma, po prostu pobieramy jego ID
        hid = members[0].household_id; 
    }
    
    return hid;
};
