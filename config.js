const CONFIG = {
    SUPABASE_URL: "https://znrrvqgqxjxgahpfuqkm.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucnJ2cWdxeGp4Z2FocGZ1cWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTQwMjcsImV4cCI6MjA5MjA5MDAyN30.-G3UiUGsDaca7KomB4dv9sWxDcIvFqik_xpEMAW3jAM",
    VAPID_PUBLIC_KEY: "BL2GdHoe3QiVQrSO7NDLwbfMMcuF-07IGUFuXQgdJjd-TDl3PriVMvFnbqphZzpH48CH5IXn2hhS0sEzUAWLyoA",
    APP_VERSION: "2.8.0",
    VERSION: "2.8.0",   // ZMIANA: Zmienna potrzebna dla router.js (omijanie cache'u)
    DEBUG: true,        // ZMIANA: Zmienna potrzebna dla store.js (logowanie w konsoli)
    CACHE_TTL: 30000,
    DEFAULT_AVATAR: "👤"
};

Object.freeze(CONFIG);
window.CONFIG = CONFIG;

// --- TA LINIJKA JEST KLUCZOWA ---
// Tworzymy klienta i przypisujemy go do window, aby inne pliki go widziały
window.supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
