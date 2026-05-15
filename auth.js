// ==========================================
// SYSTEM LOGOWANIA (auth.js)
// ==========================================

let isLoginMode = true;

// Funkcja wyłączająca ekran ładowania
window.hideSplashScreen = function() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500); // Czas musi zgadzać się z duration-500 w klasach Tailwind
    }
};

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
        
        let { data: profiles, error: pError } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .limit(1);

        let profile = profiles && profiles.length > 0 ? profiles[0] : null;

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
                const { data: newProfiles } = await window.supabaseClient.from('profiles').insert([{ 
                    user_id: user.id, 
                    household_id: targetHouseholdId, 
                    name: user.email.split('@')[0]
                }]).select();
                profile = newProfiles[0];
            } else {
                const { data: updProfiles } = await window.supabaseClient.from('profiles').update({ 
                    household_id: targetHouseholdId 
                }).eq('id', profile.id).select();
                profile = updProfiles[0];
            }
        }

        window.currentUser = { ...profile, user_id: user.id };
        
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
        if (!window.supabaseClient) {
            console.warn("Supabase jeszcze się ładuje...");
            return false;
        }

        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) throw error;

        if (session && session.user) { 
            await window.finalizeLogin(session.user); 
            window.hideSplashScreen(); // Zdejmujemy ekran ładowania
            return true; 
        } else {
            window.switchView('auth');
            window.hideSplashScreen(); // Zdejmujemy ekran ładowania i pokazujemy login
            return false;
        }
    } catch (e) { 
        console.error("Błąd sesji:", e);
        window.switchView('auth');
        window.hideSplashScreen();
        return false;
    }
};

window.logoutUser = async function() {
    await window.supabaseClient.auth.signOut();
    window.currentUser = null;
    
    if (typeof window.invalidateDashboardCache === 'function') {
        window.invalidateDashboardCache();
    }
    
    window.switchView('auth');
};
