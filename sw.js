// ==========================================
// SERVICE WORKER (sw.js) - Obsługa w tle
// ==========================================

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Obsługa kliknięcia w powiadomienie
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Jeśli klikniesz w powiadomienie, aplikacja wyjdzie na wierzch (lub się otworzy)
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            if (windowClients.length > 0) {
                windowClients[0].focus();
            } else {
                clients.openWindow('/');
            }
        })
    );
});
