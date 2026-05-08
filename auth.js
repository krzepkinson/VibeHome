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
        // 1. Próbujemy pobrać profil użytkownika
        let { data: profile, error: profileError } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        // 2. Jeśli nie ma profilu lub domu, uruchamiamy proces tworzenia
        if (profileError || !profile || !profile.household_id) {
            window.showToast("Konfiguracja nowego domu...");
            await window.initHousehold(user.id);
            
            // Pobieramy profil ponownie, żeby upewnić się, że dom się utworzył
            const retry = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
                
            profile = retry.data;
        }

        // 3. TARCZA OBRONNA (Guard Clause)
        // Jeśli na tym etapie nadal nie ma przypisanego domu, przerywamy!
        if (!profile || !profile.household_id) {
            throw new Error("Krytyczny błąd: Nie udało się przypisać do domu.");
        }

        // 4. Sukces - przypisujemy dane i wpuszczamy do aplikacji
        window.currentUser = profile;
        window.switchView('dashboard');
        
    } catch (error) {
        console.error("Błąd podczas finalizacji logowania:", error);
        window.showToast("Błąd konfiguracji: " + error.message);
        
        // --- AWARYJNE WYLOGOWANIE ---
        // Niszczymy "pustą" sesję, żeby użytkownik nie wszedł do aplikacji bez domu
        await window.supabaseClient.auth.signOut();
        window.currentUser = null;
        
        // Wymuszamy powrót do ekranu logowania
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        const authView = document.getElementById('view-auth');
        if (authView) authView.classList.remove('hidden');
        
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) bottomNav.classList.add('hidden');
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
    
    // Czyścimy cache przy wylogowaniu dla bezpieczeństwa
    if (typeof window.invalidateDashboardCache === 'function') {
        window.invalidateDashboardCache();
    }
    
    window.switchView('auth');
};
