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

    if (isLoginMode) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { window.showToast('Błąd logowania: ' + error.message); }
        else { await finalizeLogin(data.user); }
    } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) { window.showToast('Błąd rejestracji: ' + error.message); }
        else { 
            window.showToast('Konto utworzone! Logowanie...');
            await finalizeLogin(data.user);
        }
    }
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Zaloguj się' : 'Zarejestruj się';
}

async function finalizeLogin(user) {
    if (!user) return;
    const userName = user.email.split('@')[0]; // Pobieramy np. "adam" z "adam@mail.com"

    // Sprawdzamy, czy użytkownik ma już przypisany dom
    let { data: members } = await supabaseClient.from('household_members').select('household_id').eq('user_id', user.id);
    
    let hid = null;
    if (!members || members.length === 0) {
        // Jeśli nowy użytkownik - tworzymy dla niego nowy, pusty Dom
        const { data: hh } = await supabaseClient.from('households').insert([{ name: 'Nasz Dom' }]).select().single();
        hid = hh.id;
        await supabaseClient.from('household_members').insert([{ household_id: hid, user_id: user.id }]);
    } else {
        hid = members[0].household_id;
    }

    window.currentUser = { id: user.id, email: user.email, name: userName, household_id: hid };
    
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    window.switchView('dashboard');
}

window.checkSession = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await finalizeLogin(session.user);
        return true;
    }
    return false;
};

window.logoutUser = async function() {
    await supabaseClient.auth.signOut();
    window.currentUser = null;
    window.switchView('auth');
};
