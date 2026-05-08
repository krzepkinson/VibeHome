// ==========================================
// SERVICE WORKER: CACHING + PUSH (sw.js)
// ==========================================

const CACHE_NAME = 'homevibe-v2.1.0';

// 1. Lista plików do "zamrożenia" w pamięci telefonu (App Shell)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.png',
    '/utils.js',
    '/components.js',
    '/config.js',
    '/auth.js',
    '/router.js',
    '/dashboard.js',
    '/home.js',
    '/health.js',
    '/todo.js',
    '/settings.js',
    '/stats.js',
    '/search.js',
    '/household.js',
    '/user-log.js'
];

// 2. INSTALACJA: Pobieramy pliki do Cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Pre-caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 3. AKTYWACJA: Usuwamy stare wersje Cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 4. FETCH: Strategia "Network First, Fallback to Cache"
// Próbujemy z sieci, jeśli brak neta - bierzemy z pamięci.
self.addEventListener('fetch', (event) => {
    // Nie cachujemy zapytań do bazy danych Supabase (muszą być na żywo)
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// 5. PUSH: Odbieranie powiadomień (Twoja oryginalna logika)
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
        vibrate: [200, 100, 200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// 6. KLIKNIĘCIE: Obsługa kliknięcia (Twoja oryginalna logika)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
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
