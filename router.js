// ==========================================
// ROUTER & MODAL ENGINE - LOCAL FIRST (router.js)
// ==========================================

window.Router = (() => {
    const VIEW_CACHE_PREFIX = 'bento_view_cache_';
    const MODAL_CACHE_PREFIX = 'bento_modal_cache_';

    const viewConfig = {
        // GŁÓWNE WIDOKI
        'auth':      { onEnter: null },
        'dashboard': { file: 'dashboard.html', onEnter: () => window.loadDashboardOverview?.(true) },
        'home':      { file: 'home.html', onEnter: () => window.loadDashboard?.() },
        'health':    { file: 'health.html', onEnter: () => window.initHealthModule?.() },
        'todo':      { file: 'todo.html', onEnter: () => window.initTodoModule?.() },
        'settings':  { file: 'settings.html', onEnter: () => window.initSettingsModule?.() },
        
        // EKRANY PODRZĘDNE
        'archive-screen': { file: 'archive.html', onEnter: () => window.loadArchiveData?.() },
        'pharmacy-screen': { file: 'pharmacy.html', onEnter: () => window.loadPharmacyItems?.() },
        'health-book-screen': { file: 'health-book.html', onEnter: () => window.loadHealthBook?.() },
        'stats-screen': { file: 'stats.html', onEnter: () => window.loadStats?.() },
        'checklist-screen': { file: 'checklist.html', onEnter: () => window.initChecklistUI?.() },
        'settings-rooms-screen': { file: 'settings-rooms.html', onEnter: () => window.loadAppRooms?.() },
        'settings-profiles-screen': { file: 'settings-profiles.html', onEnter: () => window.loadAppProfiles?.() },
        'edit-profile-screen': { file: 'edit-profile.html', onEnter: null },
        'settings-screen': { file: 'task-settings.html', onEnter: null },
        'calendar': { file: 'calendar.html', onEnter: () => window.CalendarModule?.init() },
        'health-settings-screen': { file: 'health-settings.html', onEnter: null }
    };

    let activeView = 'auth';
    let loadedViews = new Map();

    // POMOCNICZE: Bezpieczny odczyt i zapis w localStorage
    const getCachedHtml = (key) => {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    };

    const setCachedHtml = (key, html) => {
        try { localStorage.setItem(key, html); } catch (e) {}
    };

    // 1. SILNIK PRZEŁĄCZANIA WIDOKÓW
    window.switchView = async function(viewName, pushToHistory = true) {
        if (activeView === viewName && viewName !== 'auth') return;

        const config = viewConfig[viewName];
        if (!config) {
            console.error(`Router: Nie znaleziono konfiguracji dla widoku: ${viewName}`);
            return;
        }

        // Ukrywamy wszystkie ekrany
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        
        // --- WIDOK Z PLIKU / LOCAL STORAGE ---
        if (config.file) {
            const container = document.getElementById('view-container');
            const cacheKey = VIEW_CACHE_PREFIX + viewName;

            if (!loadedViews.has(viewName)) {
                let html = getCachedHtml(cacheKey);

                // Jeśli brak w pamięci podręcznej urządzenia, pobieramy przez sieć
                if (!html) {
                    try {
                        const appVersion = (window.CONFIG && window.CONFIG.VERSION) ? window.CONFIG.VERSION : Date.now();
                        const response = await fetch(`/views/${config.file}?v=${appVersion}`);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        html = await response.text();
                        setCachedHtml(cacheKey, html);
                    } catch (err) {
                        console.error(`Błąd ładowania ${config.file}:`, err);
                        window.showToast?.("Brak połączenia - widok niedostępny");
                        window.switchView('dashboard', false); 
                        return;
                    }
                } else {
                    // Cicha aktualizacja w tle jeśli jest zasięg
                    fetch(`/views/${config.file}`).then(r => r.ok ? r.text() : null).then(freshHtml => {
                        if (html && freshHtml) setCachedHtml(cacheKey, freshHtml);
                    }).catch(() => {});
                }

                const wrapper = document.createElement('div');
                wrapper.id = `view-${viewName}`;
                wrapper.className = 'screen-view transition-all duration-300';
                wrapper.innerHTML = html;
                
                if (container) container.appendChild(wrapper);
                loadedViews.set(viewName, wrapper);
            }
            loadedViews.get(viewName).classList.remove('hidden');
        } 
        // --- WIDOK WBUDOWANY W INDEX.HTML ---
        else {
            const targetId = config.screenId || `view-${viewName}`;
            const targetScreen = document.getElementById(targetId) || document.getElementById(viewName);
            
            if (!targetScreen) {
                console.error(`Router: Brak wbudowanego widoku o ID: ${targetId}`);
                return;
            }
            targetScreen.classList.remove('hidden');
        }

        window.scrollTo(0, 0);

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
            config.onEnter();
        }
    };

    // 2. PANCERNY SILNIK MODALI OFFLINE
    window.loadAndShowModal = async function(modalId, modalPath, onReadyCallback) {
        let modalEl = document.getElementById(modalId);
        const cacheKey = MODAL_CACHE_PREFIX + modalId;

        if (!modalEl) {
            let html = getCachedHtml(cacheKey);

            if (!html) {
                try {
                    const response = await fetch(modalPath);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    html = await response.text();
                    setCachedHtml(cacheKey, html);
                } catch (err) {
                    console.error(`Błąd pobierania modala ${modalPath}:`, err);
                    window.showToast?.("Tryb offline - brak szablonu formularza");
                    return;
                }
            } else {
                // Cicha aktualizacja w tle
                fetch(modalPath).then(r => r.ok ? r.text() : null).then(freshHtml => {
                    if (freshHtml) setCachedHtml(cacheKey, freshHtml);
                }).catch(() => {});
            }

            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            modalEl = wrapper.firstElementChild;
            document.body.appendChild(modalEl);
        }

        modalEl.classList.remove('hidden');
        modalEl.style.pointerEvents = 'auto';

        if (typeof onReadyCallback === 'function') {
            onReadyCallback(modalEl);
        }
    };

    // 3. CICHE POBIERANIE WSZYSTKICH EKRANÓW I FORMULARZY W TLE (Prefetching)
    window.prefetchAllViewsAndModals = async function() {
        if (!navigator.onLine) return;

        // Pobieramy widoki
        Object.entries(viewConfig).forEach(([vName, cfg]) => {
            if (cfg.file) {
                const cacheKey = VIEW_CACHE_PREFIX + vName;
                if (!getCachedHtml(cacheKey)) {
                    fetch(`/views/${cfg.file}`).then(r => r.ok ? r.text() : null).then(html => {
                        if (html) setCachedHtml(cacheKey, html);
                    }).catch(() => {});
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
        window.switchView(viewName); 
    };

    window.refreshCurrentView = function() {
        if (viewConfig[activeView]?.onEnter) {
            viewConfig[activeView].onEnter();
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
