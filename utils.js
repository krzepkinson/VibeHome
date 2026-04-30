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
