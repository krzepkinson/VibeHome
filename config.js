const CONFIG = {
    SUPABASE_URL: "https://znrrvqgqxjxgahpfuqkm.supabase.co",
    SUPABASE_KEY: "sb_publishable_NBhB0zf-fuRqkJMmllSEQg_7qcmtcOE",
    VAPID_PUBLIC_KEY: "BL2GdHoe3QiVQrSO7NDLwbfMMcuF-07IGUFuXQgdJjd-TDl3PriVMvFnbqphZzpH48CH5IXn2hhS0sEzUAWLyoA",
    APP_VERSION: "3.0.1",
    VERSION: "3.0.1",
    DEBUG: true,        // ZMIANA: Zmienna potrzebna dla store.js (logowanie w konsoli)
    CACHE_TTL: 30000,
    DEFAULT_AVATAR: "👤"
};

Object.freeze(CONFIG);
window.CONFIG = CONFIG;

// --- TA LINIJKA JEST KLUCZOWA ---
// Tworzymy klienta i przypisujemy go do window, aby inne pliki go widziały
window.supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
