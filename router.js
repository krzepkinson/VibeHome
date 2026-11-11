// ==========================================
// ROUTER & MODAL ENGINE - LOCAL FIRST (router.js)
// ==========================================

window.Router = (() => {
    const APP_VERSION = String(window.CONFIG?.VERSION || '1');
    const VIEW_CACHE_BASE = 'bento_view_cache_';
    const MODAL_CACHE_BASE = 'bento_modal_cache_';
    const VIEW_CACHE_PREFIX = `${VIEW_CACHE_BASE}${APP_VERSION}_`;
    const MODAL_CACHE_PREFIX = `${MODAL_CACHE_BASE}${APP_VERSION}_`;
    const withVersion = (path) => `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(APP_VERSION)}`;

    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            const isOldViewCache = key?.startsWith(VIEW_CACHE_BASE) && !key.startsWith(VIEW_CACHE_PREFIX);
            const isOldModalCache = key?.startsWith(MODAL_CACHE_BASE) && !key.startsWith(MODAL_CACHE_PREFIX);
            if (isOldViewCache || isOldModalCache) localStorage.removeItem(key);
        }
    } catch (e) {}

    const viewConfig = {
        // GŁÓWNE WIDOKI
        'auth':      { onEnter: null },
        'dashboard': { file: 'dashboard.html', onEnter: (forceRefresh = false) => window.loadDashboardOverview?.(forceRefresh) },
        'home':      { file: 'home.html', onEnter: (forceRefresh = false) => window.loadDashboard?.(forceRefresh) },
        'health':    { file: 'health.html', onEnter: (forceRefresh = false) => window.initHealthModule?.(forceRefresh) },
        'todo':      { file: 'todo.html', onEnter: (forceRefresh = false) => window.initTodoModule?.(forceRefresh) },
        'settings':  { file: 'settings.html', onEnter: (forceRefresh = false) => window.initSettingsModule?.(forceRefresh) },
        
        // EKRANY PODRZĘDNE
        'archive-screen': { file: 'archive.html', onEnter: (forceRefresh = false) => window.loadArchiveData?.(forceRefresh) },
        'pharmacy-screen': { file: 'pharmacy.html', onEnter: (forceRefresh = false) => window.loadPharmacyItems?.(forceRefresh) },
        'health-book-screen': { file: 'health-book.html', onEnter: async (forceRefresh = false) => {
            window.loadHealthBook?.();
            await window.loadDashboardOverview?.(forceRefresh);
            window.loadHealthBook?.();
        } },
        'stats-screen': { file: 'stats.html', onEnter: (forceRefresh = false) => window.loadStats?.(forceRefresh) },
        'checklist-screen': { file: 'checklist.html', onEnter: (forceRefresh = false) => window.initChecklistUI?.(forceRefresh) },
        'settings-rooms-screen': { file: 'settings-rooms.html', onEnter: () => window.loadAppRooms?.() },
        'settings-profiles-screen': { file: 'settings-profiles.html', onEnter: () => window.loadAppProfiles?.() },
        'edit-profile-screen': { file: 'edit-profile.html', onEnter: null },
        'settings-screen': { file: 'task-settings.html', onEnter: null },
        'calendar': { file: 'calendar.html', onEnter: (forceRefresh = false) => window.CalendarModule?.init(forceRefresh) },
        'health-settings-screen': { file: 'health-settings.html', onEnter: null }
    };

    let activeView = 'auth';
    let loadedViews = new Map();
    const pendingViewLoads = new Map();
    const pendingModalLoads = new Map();
    let navigationRequestId = 0;

    // POMOCNICZE: Bezpieczny odczyt i zapis w localStorage
    const getCachedHtml = (key) => {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    };

    const setCachedHtml = (key, html) => {
        try { localStorage.setItem(key, html); } catch (e) {}
    };

    const loadViewTemplate = (viewName, config) => {
        const cacheKey = VIEW_CACHE_PREFIX + viewName;
        const cachedHtml = getCachedHtml(cacheKey);
        if (cachedHtml) return Promise.resolve(cachedHtml);
        if (pendingViewLoads.has(viewName)) return pendingViewLoads.get(viewName);

        const promise = fetch(withVersion(`/views/${config.file}`))
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(html => {
                setCachedHtml(cacheKey, html);
                return html;
            })
            .finally(() => pendingViewLoads.delete(viewName));

        pendingViewLoads.set(viewName, promise);
        return promise;
    };

    const loadModalTemplate = (modalId, modalPath) => {
        const cacheKey = MODAL_CACHE_PREFIX + modalId;
        const cachedHtml = getCachedHtml(cacheKey);
        if (cachedHtml) return Promise.resolve(cachedHtml);
        if (pendingModalLoads.has(modalId)) return pendingModalLoads.get(modalId);

        const promise = fetch(withVersion(modalPath))
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(html => {
                setCachedHtml(cacheKey, html);
                return html;
            })
            .finally(() => pendingModalLoads.delete(modalId));

        pendingModalLoads.set(modalId, promise);
        return promise;
    };

    // 1. SILNIK PRZEŁĄCZANIA WIDOKÓW
    window.switchView = async function(viewName, pushToHistory = true) {
        if (activeView === viewName && viewName !== 'auth') return;

        const requestId = ++navigationRequestId;

        const config = viewConfig[viewName];
        if (!config) {
            console.error(`Router: Nie znaleziono konfiguracji dla widoku: ${viewName}`);
            return;
        }

        let targetScreen = null;

        if (config.file) {
            const container = document.getElementById('view-container');
            if (!loadedViews.has(viewName)) {
                let html;
                try {
                    html = await loadViewTemplate(viewName, config);
                } catch (err) {
                    if (requestId === navigationRequestId) {
                        console.error(`Błąd ładowania ${config.file}:`, err);
                        window.showToast?.('Nie udało się otworzyć widoku. Sprawdź połączenie i spróbuj ponownie.');
                    }
                    return;
                }

                if (requestId !== navigationRequestId) return;

                const wrapper = document.createElement('div');
                wrapper.id = `view-${viewName}`;
                wrapper.className = 'screen-view transition-all duration-300';
                wrapper.innerHTML = html;
                if (!container) return;
                container.appendChild(wrapper);
                loadedViews.set(viewName, wrapper);
            }
            targetScreen = loadedViews.get(viewName);
        } else {
            const targetId = config.screenId || `view-${viewName}`;
            targetScreen = document.getElementById(targetId) || document.getElementById(viewName);
            
            if (!targetScreen) {
                console.error(`Router: Brak wbudowanego widoku o ID: ${targetId}`);
                return;
            }
        }

        if (requestId !== navigationRequestId || !targetScreen) return;

        // Zmieniamy ekran dopiero po przygotowaniu celu, żeby wolne pobranie
        // szablonu nie zostawiało użytkownika z pustym ekranem.
        document.querySelectorAll('.screen-view').forEach(el => {
            if (el !== targetScreen) el.classList.add('hidden');
        });
        targetScreen.classList.remove('hidden');

        const mainScreen = document.getElementById('main-screen');
        if (mainScreen) mainScreen.scrollTop = 0;

        if (pushToHistory && viewName !== 'auth') {
            const newUrl = viewName === 'dashboard' ? '/' : `/?view=${viewName}`;
            window.history.pushState({ view: viewName }, '', newUrl);
        }

        // Nawigacja dolna
        const nav = document.getElementById('bottom-nav');
        if (nav) {
            const isSubScreen = viewName.includes('-screen');
            nav.classList.toggle('hidden', viewName === 'auth' || isSubScreen);
            
            nav.querySelectorAll('button').forEach(btn => {
                const isActive = btn.dataset.view === viewName || btn.getAttribute('onclick')?.includes(`'${viewName}'`);
                btn.style.opacity = isActive ? '1' : '0.5';
            });
        }

        activeView = viewName;
        window.activeView = viewName;

        if (typeof config.onEnter === 'function') {
            try {
                const result = config.onEnter();
                if (result && typeof result.catch === 'function') {
                    result.catch(err => console.error(`Błąd inicjalizacji widoku ${viewName}:`, err));
                }
            } catch (err) {
                console.error(`Błąd inicjalizacji widoku ${viewName}:`, err);
            }
        }
    };

    // 2. PANCERNY SILNIK MODALI OFFLINE
    window.loadAndShowModal = async function(modalId, modalPath, onReadyCallback) {
        let modalEl = document.getElementById(modalId);

        if (!modalEl) {
            let html;
            try {
                html = await loadModalTemplate(modalId, modalPath);
            } catch (err) {
                console.error(`Błąd pobierania modala ${modalPath}:`, err);
                window.showToast?.('Nie udało się otworzyć formularza. Spróbuj ponownie.');
                return;
            }

            // Inne szybkie dotknięcie mogło zakończyć to samo pobieranie.
            modalEl = document.getElementById(modalId);
            if (!modalEl) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                modalEl = wrapper.firstElementChild;
                if (!modalEl) return;
                document.body.appendChild(modalEl);
            }
        }

        modalEl.classList.remove('hidden');
        modalEl.style.pointerEvents = 'auto';

        if (typeof onReadyCallback === 'function') {
            onReadyCallback(modalEl);
        }
    };

    window.prefetchModalTemplate = function(modalId, modalPath) {
        if (getCachedHtml(MODAL_CACHE_PREFIX + modalId)) return;
        loadModalTemplate(modalId, modalPath).catch(() => {});
    };

    // 3. CICHE POBIERANIE WSZYSTKICH EKRANÓW I FORMULARZY W TLE (Prefetching)
    window.prefetchAllViewsAndModals = async function() {
        if (!navigator.onLine) return;

        [
            ['new-pharmacy-item-modal', '/modals/new-pharmacy-item.html'],
            ['edit-pharmacy-item-modal', '/modals/edit-pharmacy-item.html']
        ].forEach(([modalId, modalPath]) => window.prefetchModalTemplate(modalId, modalPath));

        // Pobieramy szablony widoków bez blokowania bieżącego ekranu.
        Object.entries(viewConfig).forEach(([vName, cfg]) => {
            if (cfg.file) {
                const cacheKey = VIEW_CACHE_PREFIX + vName;
                if (!getCachedHtml(cacheKey)) {
                    loadViewTemplate(vName, cfg).catch(() => {});
                }
            }
        });
    };

    window.goBack = function() { 
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.switchView('dashboard'); 
        }
    };
    
    window.goForward = function(viewName) { 
        return window.switchView(viewName); 
    };

    window.refreshCurrentView = function(forceRefresh = false) {
        if (viewConfig[activeView]?.onEnter) {
            return viewConfig[activeView].onEnter(forceRefresh);
        }
    };

    // --- POPSTATE & INICJALIZACJA TŁA ---
    window.addEventListener('popstate', (e) => {
        if (e.state?.view === 'home' && !e.state?.roomFilter && activeView === 'home') {
            if (typeof window.clearRoomFilter === 'function') {
                window.clearRoomFilter();
            }
            return; 
        }
        
        if (e.state && e.state.view) {
            const targetView = (e.state.view === 'auth' && window.currentUser) 
                ? 'dashboard' 
                : e.state.view;
            window.switchView(targetView, false);
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get('view') || 'dashboard';
            
            if (window.currentUser) {
                window.switchView(view === 'auth' ? 'dashboard' : view, false);
            } else {
                window.switchView('auth', false);
            }
        }
    });

    // Uruchom cichy prefetch po załadowaniu
    setTimeout(() => window.prefetchAllViewsAndModals(), 2000);

    return { active: () => activeView };
})();
