// ==========================================
// LOGIKA: AUTORYZACJA (auth.js)
// ==========================================

window.currentUser = null;

// Pobranie początkowej sesji
window.checkSession = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.currentUser = session.user;
        return true;
    }
    window.currentUser = null;
    return false;
};

// Nasłuchiwanie zmian stanu (np. nagłe wylogowanie z innej karty)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        window.currentUser = session.user;
        if (activeView === 'auth') window.switchView('dashboard');
    } else if (event === 'SIGNED_OUT') {
        window.currentUser = null;
        window.switchView('auth');
    }
});

let isLoginMode = true;

window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Witaj z powrotem' : 'Dołącz do nas';
    document.getElementById('auth-subtitle').innerText = isLoginMode ? 'Zaloguj się, aby zarządzać domem.' : 'Utwórz nowe konto domowe.';
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się';
    document.getElementById('auth-toggle-btn').innerHTML = isLoginMode ? 'Nie masz konta? <span class="text-[#a8c7fa]">Zarejestruj się</span>' : 'Masz już konto? <span class="text-[#a8c7fa]">Zaloguj się</span>';
};

window.handleAuthAction = async function() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-action-btn');

    if (!email || !password) {
        showToast("Wpisz email i hasło!");
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Przetwarzanie...";

    if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) showToast("Błąd: " + (error.message.includes('Invalid login') ? 'Błędny email lub hasło.' : error.message));
        else {
            showToast("Zalogowano pomyślnie!");
            document.getElementById('auth-password').value = '';
        }
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) showToast("Błąd rejestracji: " + error.message);
        else {
            showToast("Konto utworzone! Możesz się zalogować.");
            toggleAuthMode(); 
        }
    }

    btn.disabled = false;
    btn.innerText = originalText;
};

window.logoutUser = async function() {
    await supabaseClient.auth.signOut();
};
