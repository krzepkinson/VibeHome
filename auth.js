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
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await window.finalizeLogin(data.user);
        } else {
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
        
        // 1. Szukamy profilu po UUID (user_id)
        let { data: profiles, error: pError } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .limit(1);

        let profile = profiles && profiles.length > 0 ? profiles[0] : null;

        // 2. Obsługa Household (Domostwa) i ewentualne tworzenie profilu
        if (!profile || !profile.household_id) {
            const { data: memberData } = await window.supabaseClient
                .from('household_members')
                .select('household_id')
                .eq('user_id', user.id)
                .limit(1);

            let targetHouseholdId = memberData && memberData.length > 0 ? memberData[0].household_id : null;

            if (!targetHouseholdId) {
                targetHouseholdId = await window.initHousehold(user);
            }

            if (!profile) {
                // Tworzymy nowy profil, jeśli nie znaleźliśmy go w Kroku 1
                const { data: newProfiles } = await window.supabaseClient.from('profiles').insert([{ 
                    user_id: user.id, 
                    household_id: targetHouseholdId, 
                    name: user.email.split('@')[0] // Tymczasowe imię z maila
                }]).select();
                profile = newProfiles[0];
            } else {
                // Aktualizujemy istniejący profil o ID domostwa
                const { data: updProfiles } = await window.supabaseClient.from('profiles').update({ 
                    household_id: targetHouseholdId 
                }).eq('id', profile.id).select();
                profile = updProfiles[0];
            }
        }

        window.currentUser = { ...profile, user_id: user.id };
        
        // ZMIANA: Obsługa powrotu z linku po logowaniu
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || 'dashboard';
        window.switchView(view);
        
    } catch (error) {
        console.error("Błąd krytyczny logowania:", error);
        window.showToast("Błąd logowania: " + error.message);
        window.switchView('auth');
    }
};

window.checkSession = async function() {
    try {
        // Bezpiecznik: jeśli klient jeszcze nie istnieje, nie robimy nic
        if (!window.supabaseClient) {
            console.warn("Supabase jeszcze się ładuje...");
            return false;
        }

        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) throw error;

        if (session && session.user) { 
            await window.finalizeLogin(session.user); 
            return true; 
        } else {
            // ZMIANA KRYTYCZNA: BRAK SESJI = BEZWZGLĘDNY EKRAN LOGOWANIA
            window.switchView('auth');
            return false;
        }
    } catch (e) { 
        console.error("Błąd sesji:", e);
        // ZMIANA: Nawet przy błędzie zapytania (brak internetu itp) bezpieczniej wyrzucić na login
        window.switchView('auth');
        return false;
    }
};

window.logoutUser = async function() {
    await window.supabaseClient.auth.signOut();
    window.currentUser = null;
    
    // Czyścimy cache przeglądu przy wylogowaniu
    if (typeof window.invalidateDashboardCache === 'function') {
        window.invalidateDashboardCache();
    }
    
    window.switchView('auth');
};
