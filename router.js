// ==========================================
// ROUTER: ZARZĄDZANIE WIDOKAMI (router.js)
// ==========================================

window.Router = (() => {
    // Mapa widoków i ich funkcji "na wejście"
    const viewConfig = {
        'auth':      { onEnter: null },
        'dashboard': { onEnter: () => window.loadDashboardOverview?.(true) },
        'home':      { onEnter: () => window.loadDashboard?.() },
        'health':    { onEnter: () => window.initHealthModule?.() },
        'todo':      { onEnter: () => window.loadTodos?.() },
        'archive-screen': { onEnter: () => window.loadArchiveData?.() },
        'pharmacy-screen': { onEnter: () => window.loadPharmacyItems?.() },
        'health-book-screen': { onEnter: () => window.loadHealthBook?.() },
        'stats-screen': { onEnter: () => window.loadStats?.() }
    };

    let activeView = 'auth';
    let historyStack = [];

    // GŁÓWNA FUNKCJA PRZEŁĄCZANIA
    window.switchView = function(viewName) {
        if (activeView === viewName && viewName !== 'auth') return;

        // 1. Zarządzanie warstwą wizualną (CSS)
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        const targetScreen = document.getElementById(`view-${viewName}`) || document.getElementById(viewName);
        
        if (!targetScreen) {
            console.error(`Router: Nie znaleziono widoku o ID: ${viewName}`);
            return;
        }

        targetScreen.classList.remove('hidden');
        window.scrollTo(0, 0);

        // 2. Aktualizacja nawigacji dolnej
        const nav = document.getElementById('bottom-nav');
        if (nav) {
            // Ukrywamy nawigację na ekranie logowania i ekranach podrzędnych (screens)
            const isSubScreen = viewName.includes('-screen');
            nav.classList.toggle('hidden', viewName === 'auth' || isSubScreen);
            
            // Podświetlanie ikon w navi
            nav.querySelectorAll('button').forEach(btn => {
                const isActive = btn.getAttribute('onclick')?.includes(`'${viewName}'`);
                btn.style.opacity = isActive ? '1' : '0.5';
            });
        }

        // 3. Logika modułu (Uruchomienie onEnter, jeśli istnieje)
        activeView = viewName;
        window.activeView = viewName; // Zachowujemy dla kompatybilności wstecznej

        if (viewConfig[viewName] && typeof viewConfig[viewName].onEnter === 'function') {
            viewConfig[viewName].onEnter();
        }
    };

    // Obsługa przycisku "Wstecz" (Go Back)
    window.goBack = function() {
        if (historyStack.length > 0) {
            const prev = historyStack.pop();
            window.switchView(prev);
        } else {
            window.switchView('dashboard');
        }
    };

    window.goForward = function(viewName) {
        historyStack.push(activeView);
        window.switchView(viewName);
    };

    // Odświeżanie obecnego widoku (np. po zapisaniu danych)
    window.refreshCurrentView = function() {
        if (viewConfig[activeView]?.onEnter) {
            viewConfig[activeView].onEnter();
        }
    };

    return {
        active: () => activeView,
        config: viewConfig
    };
})();
