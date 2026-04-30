// ==========================================
// NARZĘDZIA POMOCNICZE (utils.js)
// ==========================================

// 1. Funkcja zabezpieczająca tekst przed XSS (używaj wszędzie zamiast ${zmienna} w innerHTML)
window.esc = function(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
};

// 2. Inicjalizacja bazy danych Supabase (dostępna globalnie dla wszystkich plików)
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// 2. Globalny system "dymków" (Toasts)
let toastTimeout;

window.showToast = function(msg) {
    const toastEl = document.getElementById('toast'); 
    if (!toastEl) return;
    
    toastEl.innerText = msg; 
    toastEl.classList.remove('opacity-0', 'translate-y-10');
    
    clearTimeout(toastTimeout); 
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
};
// 5. Konwerter klucza VAPID (dla powiadomień Push)
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
// 6. Globalne odświeżanie widoku (Synchronizacja)
window.refreshCurrentView = async function() {
    // Animacja wciśniętego przycisku
    const btn = document.activeElement; 
    if (btn && btn.tagName === 'BUTTON') {
        btn.style.transform = 'rotate(180deg)';
        btn.classList.add('opacity-50');
    }

    try {
        // Sprawdzamy czy otwarty jest ekran konkretnej Checklisty
        const checklistScreen = document.getElementById('checklist-screen');
        if (checklistScreen && !checklistScreen.classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') await window.loadChecklistItems();
        } else {
            // Jeśli nie, odświeżamy aktywną zakładkę główną
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
