// ==========================================
// FUNKCJE POMOCNICZE (utils.js)
// ==========================================

window.esc = function(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
};

window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.remove('opacity-0', 'translate-y-10');
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
};

window.urlB64ToUint8Array = function(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

window.refreshCurrentView = async function() {
    const btn = document.activeElement; 
    if (btn && btn.tagName === 'BUTTON') {
        btn.style.transform = 'rotate(180deg)';
        btn.classList.add('opacity-50');
    }
    try {
        const checklistScreen = document.getElementById('checklist-screen');
        if (checklistScreen && !checklistScreen.classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') await window.loadChecklistItems();
        } else {
            if (window.activeView === 'dashboard' && typeof window.loadDashboardOverview === 'function') {
                await window.loadDashboardOverview();
            } else if (window.activeView === 'home' && typeof window.loadDashboard === 'function') {
                await window.loadDashboard();
            } else if (window.activeView === 'todo' && typeof window.loadTodosAndLists === 'function') {
                await window.loadTodosAndLists();
            } else if (window.activeView === 'health' && typeof window.refreshHealthData === 'function') {
                await window.refreshHealthData();
                if(typeof window.renderHealthUI === 'function') window.renderHealthUI();
            }
        }
        window.showToast("Zsynchronizowano ↻");
    } catch(e) {
        console.error("Błąd synchronizacji:", e);
        window.showToast("Błąd synchronizacji");
    } finally {
        if (btn && btn.tagName === 'BUTTON') {
            setTimeout(() => {
                btn.style.transform = '';
                btn.classList.remove('opacity-50');
            }, 300);
        }
    }
};

// NOWOŚĆ: Logika zmiany wykonawcy/autora
window.openChangeUserModal = function(type, id, currentName) {
    document.getElementById('change-user-type').value = type;
    document.getElementById('change-user-id').value = id;

    let names = new Set();
    if (window.currentUser && window.currentUser.name) names.add(window.currentUser.name);

    // Skanujemy ekran w poszukiwaniu wszystkich użytych imion
    document.querySelectorAll('[data-user-name]').forEach(el => {
        const n = el.getAttribute('data-user-name');
        if (n && n !== '?' && n !== 'null' && n !== 'undefined') names.add(n);
    });
    
    if (currentName && currentName !== '?' && currentName !== 'null' && currentName !== 'undefined') {
        names.add(currentName);
    }

    const listEl = document.getElementById('change-user-list');
    listEl.innerHTML = Array.from(names).map(name => `
        <button onclick="window.saveChangedUser('${window.esc(name)}')" class="w-full text-left px-4 py-3 bg-[#1e1f20] hover:bg-[#333537] border border-[#333537] rounded-[16px] mb-2 text-neutral-200 active:scale-95 transition-colors">
            <span class="font-medium">${window.esc(name)}</span>
        </button>
    `).join('');

    document.getElementById('change-user-custom').value = '';
    document.getElementById('change-user-modal').classList.remove('hidden');
};

window.saveChangedUser = async function(newName) {
    if (!newName) newName = document.getElementById('change-user-custom').value.trim();
    if (!newName) return;

    const type = document.getElementById('change-user-type').value;
    const id = document.getElementById('change-user-id').value;

    let table = type;
    let col = 'user_name';

    if (type === 'todos') { table = 'todos'; col = 'completer_name'; }
    else if (type === 'todos_creator') { table = 'todos'; col = 'creator_name'; }

    await supabaseClient.from(table).update({ [col]: newName }).eq('id', id).eq('household_id', window.currentUser.household_id);

    document.getElementById('change-user-modal').classList.add('hidden');
    window.showToast("Zaktualizowano osobę! ✔️");
    window.refreshCurrentView();
};

window.closeChangeUserModal = function() {
    document.getElementById('change-user-modal').classList.add('hidden');
};
