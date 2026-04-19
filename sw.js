// Instalacja Service Workera
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Zainstalowany');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Aktywowany');
});

// Pusty nasłuchiwacz, by apka spełniała wymogi instalacji PWA
self.addEventListener('fetch', (event) => {
    // Na razie nic nie robimy
});