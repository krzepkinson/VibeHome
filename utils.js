// ==========================================
// FUNKCJE POMOCNICZE (utils.js)
// ==========================================

window.esc = function(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag] || tag));
};

window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.remove('opacity-0', 'translate-y-10');
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-10'); }, 3000);
};

window.urlB64ToUint8Array = function(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
};

// NIEZAWODNE ODŚWIEŻANIE AKTYWNEGO WIDOKU
window.refreshCurrentView = async function() {
    const btn = document.activeElement; 
    if (btn && btn.tagName === 'BUTTON' && btn.innerText.includes('↻')) {
        btn.style.transform = 'rotate(180deg)';
        btn.classList.add('opacity-50');
    }
    
    try {
        if (document.getElementById('checklist-screen') && !document.getElementById('checklist-screen').classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') await window.loadChecklistItems();
        } else if (document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('hidden')) {
            if (typeof window.loadDashboardOverview === 'function') await window.loadDashboardOverview();
        } else if (document.getElementById('view-home') && !document.getElementById('view-home').classList.contains('hidden')) {
            if (typeof window.loadDashboard === 'function') await window.loadDashboard();
        } else if (document.getElementById('view-todo') && !document.getElementById('view-todo').classList.contains('hidden')) {
            if (typeof window.loadTodosAndLists === 'function') await window.loadTodosAndLists();
        } else if (document.getElementById('view-profile') && !document.getElementById('view-profile').classList.contains('hidden')) {
            if (typeof window.initHealthModule === 'function') await window.initHealthModule();
        }
    } catch(e) { 
        console.error("Błąd odświeżania:", e); 
    } finally {
        if (btn && btn.tagName === 'BUTTON' && btn.innerText.includes('↻')) {
            setTimeout(() => { btn.style.transform = ''; btn.classList.remove('opacity-50'); }, 300);
        }
    }
};

window.openChangeUserModal = function(type, id, currentName) {
    document.getElementById('change-user-type').value = type;
    document.getElementById('change-user-id').value = id;

    let names = new Set();
    if (window.currentUser && window.currentUser.name) names.add(window.currentUser.name);

    document.querySelectorAll('[data-user-name]').forEach(el => {
        const n = el.getAttribute('data-user-name');
        if (n && n !== '?' && n !== 'Ja') names.add(n);
    });
    
    if (currentName && currentName !== 'Ja') names.add(currentName);

    const listEl = document.getElementById('change-user-list');
    listEl.innerHTML = Array.from(names).map(name => `
        <button onclick="window.saveChangedUser('${window.esc(name)}')" class="w-full text-left px-4 py-3 bg-[#1e1f20] hover:bg-[#333537] border border-[#333537] rounded-[16px] mb-2 text-neutral-200 active:scale-95 transition-colors">
            <span class="font-medium">${window.esc(name)}</span>
        </button>`).join('');

    document.getElementById('change-user-custom').value = '';
    document.getElementById('change-user-modal').classList.remove('hidden');
};

window.saveChangedUser = async function(newName) {
    // 1. Zabezpieczenie przed brakiem kontekstu użytkownika
    if (!window.currentUser || !window.currentUser.household_id) {
        window.showToast("Błąd krytyczny: Brak przypisanego domu!");
        return;
    }

    if (!newName) newName = document.getElementById('change-user-custom').value.trim();
    if (!newName) return;

    const type = document.getElementById('change-user-type').value;
    const idStr = document.getElementById('change-user-id').value;
    const id = parseInt(idStr); 

    let table = type;
    let col = 'user_name';

    if (type === 'todos') { table = 'todos'; col = 'completer_name'; }
    else if (type === 'todos_creator') { table = 'todos'; col = 'creator_name'; }
    else if (type === 'activity_logs') { table = 'activity_logs'; col = 'user_name'; }
    else if (type === 'health_logs') { table = 'health_logs'; col = 'user_name'; }

    // 2. Zapytanie z dodatkowym filtrowaniem
    const { error } = await supabaseClient.from(table)
        .update({ [col]: newName })
        .eq('id', id)
        .eq('household_id', window.currentUser.household_id);

    if (error) { 
        window.showToast("Błąd bazy: " + error.message); 
    } else {
        document.getElementById('change-user-modal').classList.add('hidden');
        window.showToast("Zmieniono osobę! ✔️");
        await window.refreshCurrentView();
    }
};

window.closeChangeUserModal = function() { document.getElementById('change-user-modal').classList.add('hidden'); };
