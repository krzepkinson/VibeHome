// ==========================================
// SERVICE WORKER: CACHING + PUSH (sw.js)
// ==========================================

const CACHE_NAME = 'homevibe-v3.0.3';

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
    '/quick-add.js',
    '/ux.js',
    '/ux.css',
    '/task-model.js',
    '/task-details.js',
    '/event-model.js',
    '/overview.js',
    '/calendar.js',
    '/home.js',
    '/health.js',
    '/todo.js',
    '/settings.js',
    '/stats.js',
    '/search.js',
    '/household.js',
    '/user-log.js',
    '/modals/quick-add.html'
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
        data: { ...payload.data, url: notificationUrl(payload), dateOfArrival: Date.now() }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// 6. KLIKNIĘCIE: Obsługa kliknięcia (Twoja oryginalna logika)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = notificationUrl(event.notification.data || {});
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windowClients => {
            const client = windowClients.find(client => new URL(client.url).origin === self.location.origin);
            if (client) { await client.navigate(target); return client.focus(); }
            return clients.openWindow(target);
        })
    );
});

function notificationUrl(payload) {
    const data = { ...payload.data, ...payload };
    if (data.url) { try { const url = new URL(data.url, self.location.origin); if(url.origin === self.location.origin)return url.href; } catch(error) {} }
    const aliases = { task:['todo','task','tasks'], event:['calendar','event','calendar_events'], episode:['health','episode',''], product:['pharmacy-screen','product',''], list:['todo','list',''] };
    const route = aliases[data.kind || data.type];
    if (route && (data.key || data.id)) { const key=data.key || (data.source ? data.source+':'+data.id : route[2] ? route[2]+':'+data.id : String(data.id)); const url=new URL('/',self.location.origin);url.searchParams.set('view',route[0]);url.searchParams.set(route[1],key);return url.href; }
    return new URL('/',self.location.origin).href;
}
