// ==========================================
// SYSTEM LOGOWANIA (auth.js)
// ==========================================

let isLoginMode = true;

window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Witaj z powrotem' : 'Dołącz do nas';
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się';
    document.getElementById('auth-toggle-btn').innerHTML = isLoginMode ? 'Nie masz konta? <span class="text-[#a8c7fa]">Zarejestruj się</span>' : 'Masz już konto? <span class="text-[#a8c7fa]">Zaloguj się</span>';
};

window.handleAuthAction = async function() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) { 
        window.showToast('Wypełnij wszystkie pola!'); 
        return; 
    }
    
    document.getElementById('auth-action-btn').innerText = 'Przetwarzanie...';
    
    try {
        if (isLoginMode) {
            // POPRAWKA: Dodano window.
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await window.finalizeLogin(data.user);
        } else {
            // POPRAWKA: Dodano window.
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            window.showToast('Konto utworzone!');
            await window.finalizeLogin(data.user);
        }
    } catch (error) { 
        window.showToast('Błąd: ' + error.message); 
    } finally { 
        document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się'; 
    }
};

window.finalizeLogin = async function(user) {
    try {
        if (!user) throw new Error("Brak danych użytkownika.");
        window.currentUser = { id: user.id };

        // 1. Sprawdzamy profil BEZPIECZNIE
        let { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .limit(1);
            
        let profile = profiles && profiles.length > 0 ? profiles[0] : null;

        // 2. Jeśli profilu nie ma lub nie ma domu, szukamy głębiej
        if (!profile || !profile.household_id) {
            
            const { data: memberData } = await window.supabaseClient
                .from('household_members')
                .select('household_id')
                .eq('user_id', user.id)
                .limit(1);

            let targetHouseholdId = memberData && memberData.length > 0 ? memberData[0].household_id : null;

            if (!targetHouseholdId) {
                window.showToast("Konfiguracja nowego domu...");
                targetHouseholdId = await window.initHousehold(user);
            }

            if (!profile) {
                const { data: newProfiles, error: insError } = await window.supabaseClient.from('profiles').insert([{ 
                    user_id: user.id, 
                    household_id: targetHouseholdId, 
                    name: 'Ja' 
                }]).select();
                
                if (insError) throw insError;
                profile = newProfiles[0];
            } else {
                const { data: updProfiles, error: updError } = await window.supabaseClient.from('profiles').update({ 
                    household_id: targetHouseholdId 
                }).eq('id', profile.id).select();
                
                if (updError) throw updError;
                profile = updProfiles[0];
            }
        }

        if (!profile || !profile.household_id) {
            throw new Error("Nie udało się uzyskać identyfikatora domu.");
        }

        // 4. Sukces
        window.currentUser = {
            ...profile,
            user_id: user.id
        };
        window.switchView('dashboard');
        
    } catch (error) {
        console.error("Błąd logowania:", error);
        window.showToast("Błąd: " + error.message);
        
        await window.supabaseClient.auth.signOut();
        window.currentUser = null;
        
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-auth')?.classList.remove('hidden');
        document.getElementById('bottom-nav')?.classList.add('hidden');
    }
};

window.checkSession = async function() {
    try {
        // POPRAWKA: Dodano window.
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) { 
            await window.finalizeLogin(session.user); 
            return true; 
        }
    } catch (e) { 
        console.error("Sesja wygasła:", e); 
    }
    return false;
};

window.logoutUser = async function() {
    // POPRAWKA: Dodano window.
    await window.supabaseClient.auth.signOut();
    window.currentUser = null;
    if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    window.switchView('auth');
};
