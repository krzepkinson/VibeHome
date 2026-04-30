// ==========================================
// SYSTEM LOGOWANIA (auth.js)
// ==========================================

let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Witaj z powrotem' : 'Dołącz do nas';
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się';
    document.getElementById('auth-toggle-btn').innerHTML = isLoginMode ? 'Nie masz konta? <span class="text-[#a8c7fa]">Zarejestruj się</span>' : 'Masz już konto? <span class="text-[#a8c7fa]">Zaloguj się</span>';
}

async function handleAuthAction() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) { window.showToast('Wypełnij wszystkie pola!'); return; }
    
    document.getElementById('auth-action-btn').innerText = 'Przetwarzanie...';

    try {
        if (isLoginMode) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await finalizeLogin(data.user);
        } else {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            window.showToast('Konto utworzone! Logowanie...');
            await finalizeLogin(data.user);
        }
    } catch (error) {
        console.error("Błąd autoryzacji:", error);
        window.showToast('Błąd: ' + error.message);
    } finally {
        // Zawsze przywracamy tekst przycisku na wypadek błędu
        document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się';
    }
}

async function finalizeLogin(user) {
    if (!user) return;
    
    try {
        const userName = user.user_metadata?.name || user.email.split('@')[0];

        let { data: members, error: memErr } = await supabaseClient.from('household_members').select('household_id').eq('user_id', user.id);
        if (memErr) throw memErr;

        let hid = null;
        if (!members || members.length === 0) {
            // Tworzymy nowy dom i odczytujemy wygenerowane ID
            const { data: hh, error: hhErr } = await supabaseClient.from('households').insert([{ name: 'Nasz Dom' }]).select().single();
            if (hhErr) throw hhErr;
            
            hid = hh.id;
            
            // Dopiero teraz przypisujemy użytkownika do nowo utworzonego domu
            const { error: insertErr } = await supabaseClient.from('household_members').insert([{ household_id: hid, user_id: user.id }]);
            if (insertErr) throw insertErr;
        } else {
            hid = members[0].household_id;
        }

        window.currentUser = { id: user.id, email: user.email, name: userName, household_id: hid };
        
        const nameInput = document.getElementById('settings-user-name');
        if (nameInput) nameInput.value = userName;

        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        window.switchView('dashboard');
        
    } catch (error) {
        console.error("Błąd podczas konfiguracji domu:", error);
        window.showToast('Błąd ładowania konta: ' + error.message);
        throw error; // Zrzucamy błąd wyżej, żeby przycisk się odblokował
    }
}

window.checkSession = async function() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await finalizeLogin(session.user);
            return true;
        }
    } catch (e) {
        console.error("Sesja wygasła lub błąd pobierania:", e);
    }
    return false;
};

window.logoutUser = async function() {
    await supabaseClient.auth.signOut();
    window.currentUser = null;
    window.switchView('auth');
};
