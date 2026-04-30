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
