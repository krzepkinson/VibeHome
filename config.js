const CONFIG = {
    SUPABASE_URL: "https://[reducted].supabase.co",
    SUPABASE_KEY: "[reducted]",
    VAPID_PUBLIC_KEY: "[reducted]",
    APP_VERSION: "2.8.6",
    VERSION: "2.8.6",
    DEBUG: true,        // ZMIANA: Zmienna potrzebna dla store.js (logowanie w konsoli)
    CACHE_TTL: 30000,
    DEFAULT_AVATAR: "👤"
};

Object.freeze(CONFIG);
window.CONFIG = CONFIG;

// --- TA LINIJKA JEST KLUCZOWA ---
// Tworzymy klienta i przypisujemy go do window, aby inne pliki go widziały
window.supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
