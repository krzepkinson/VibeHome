// Nazwa cache
const CACHE_NAME = 'homevibe-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Aktywowany i gotowy do powiadomień');
});

// Obsługa kliknięcia w powiadomienie
self.onnotificationclick = function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
};

// Nasłuchiwanie na powiadomienia typu PUSH (z serwera)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'HomeVibe', body: 'Masz zadanie do wykonania!' };
    
    const options = {
        body: data.body,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});
