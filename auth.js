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
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await window.finalizeLogin(data.user);
        } else {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
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

        // 1. Sprawdzamy profil
        let { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        // 2. Jeśli profilu nie ma lub nie ma domu, szukamy głębiej
        if (!profile || !profile.household_id) {
            
            // Sprawdzamy czy użytkownik jest już członkiem jakiegoś domu (naprawa dla istniejących kont)
            const { data: memberData } = await window.supabaseClient
                .from('household_members')
                .select('household_id')
                .eq('user_id', user.id)
                .maybeSingle();

            let targetHouseholdId = memberData?.household_id;

            // Jeśli nadal nie mamy ID domu, to TYLKO WTEDY konfigurujemy nowy
            if (!targetHouseholdId) {
                window.showToast("Konfiguracja nowego domu...");
                targetHouseholdId = await window.initHousehold(user);
            }

            // Teraz, gdy mamy już ID domu (stary lub nowy), upewniamy się, że profil istnieje
            if (!profile) {
                const { data: newProfile, error: insError } = await window.supabaseClient.from('profiles').insert([{ 
                    user_id: user.id, 
                    household_id: targetHouseholdId, 
                    name: 'Ja' 
                }]).select().single();
                
                if (insError) throw insError;
                profile = newProfile;
            } else {
                const { data: updProfile, error: updError } = await window.supabaseClient.from('profiles').update({ 
                    household_id: targetHouseholdId 
                }).eq('user_id', user.id).select().single();
                
                if (updError) throw updError;
                profile = updProfile;
            }
        }

        // 3. Ostateczna Tarcza Obronna
        if (!profile || !profile.household_id) {
            throw new Error("Nie udało się uzyskać identyfikatora domu.");
        }

        // 4. Sukces
        window.currentUser = profile;
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
        const { data: { session } } = await supabaseClient.auth.getSession();
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
    await supabaseClient.auth.signOut();
    window.currentUser = null;
    if (typeof window.invalidateDashboardCache === 'function') window.invalidateDashboardCache();
    window.switchView('auth');
};
