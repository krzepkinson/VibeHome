// ==========================================
// SERVICE WORKER (sw.js) - Obsługa w tle
// ==========================================

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// NOWOŚĆ: Odbieranie powiadomień Push z serwera Supabase!
self.addEventListener('push', (event) => {
    let payload = { title: "HomeVibe", body: "Masz nowe powiadomienie!" };

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200, 100, 200], // Specyficzna wibracja HomeVibe
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
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
