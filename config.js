// ==========================================
// KONFIGURACJA GLOBALNA (config.js)
// ==========================================

const CONFIG = {
    // Dane Supabase
    SUPABASE_URL: "https://znrrvqgqxjxgahpfuqkm.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucnJ2cWdxeGp4Z2FocGZ1cWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTQwMjcsImV4cCI6MjA5MjA5MDAyN30.-G3UiUGsDaca7KomB4dv9sWxDcIvFqik_xpEMAW3jAM",
    
    // Powiadomienia Push
    VAPID_PUBLIC_KEY: "BL2GdHoe3QiVQrSO7NDLwbfMMcuF-07IGUFuXQgdJjd-TDl3PriVMvFnbqphZzpH48CH5IXn2hhS0sEzUAWLyoA",
    
    // Ustawienia aplikacji
    APP_VERSION: "2.1.0",
    CACHE_TTL: 30000, // 30 sekund
    DEFAULT_AVATAR: "👤"
};

// BLOKADA: Sprawiamy, że konfiguracja jest niemożliwa do zmiany w trakcie działania apki
Object.freeze(CONFIG);

// Udostępniamy zamrożony obiekt globalnie
window.CONFIG = CONFIG;
