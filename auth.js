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
    if (!user) return;
    try {
        const userName = user.user_metadata?.name || user.email.split('@')[0];
        
        // Czyste przekazanie delegacji do osobnego pliku:
        const hid = await window.initHousehold(user);

        window.currentUser = { id: user.id, email: user.email, name: userName, household_id: hid };
        
        // Wypełnienie pola w ustawieniach
        const nameInput = document.getElementById('settings-user-name');
        if (nameInput) nameInput.value = userName;

        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        window.switchView('dashboard');
    } catch (error) { 
        window.showToast('Błąd ładowania: ' + error.message); 
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
