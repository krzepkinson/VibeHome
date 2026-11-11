// ==========================================
// SERVICE WORKER: CACHING + PUSH (sw.js)
// ==========================================

const CACHE_NAME = 'homevibe-v2.8.6';

// 1. Lista plików do "zamrożenia" w pamięci telefonu (App Shell)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.png',
    '/events.js',
    '/utils.js',
    '/store.js',
    '/components.js',
    '/config.js',
    '/auth.js',
    '/router.js',
    '/dashboard.js',
    '/calendar.js',
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

    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isExternalLibrary = ['cdn.jsdelivr.net', 'cdn.tailwindcss.com'].includes(requestUrl.hostname)
        && ['script', 'style'].includes(event.request.destination);
    const isAppAsset = requestUrl.origin === self.location.origin
        && /\.(html|js|css|json|png|jpe?g|svg|woff2?)$/i.test(requestUrl.pathname);

    const networkRequest = fetch(event.request);
    if (isAppAsset || isExternalLibrary) {
        event.waitUntil(networkRequest.then(response => {
            if (!response.ok && response.type !== 'opaque') return;
            return caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }).catch(() => {}));
    }

    event.respondWith(networkRequest.catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') return caches.match('/index.html');
            return Response.error();
        })));
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
