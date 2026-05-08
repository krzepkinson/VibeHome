// ==========================================
// ROUTER: ZARZĄDZANIE WIDOKAMI (router.js)
// ==========================================

window.Router = (() => {
    const viewConfig = {
        'auth':      { onEnter: null },
        'dashboard': { onEnter: () => window.loadDashboardOverview?.(true) },
        'home':      { onEnter: () => window.loadDashboard?.() },
        // MAPOWANIE: health -> view-profile
        'health':    { screenId: 'view-profile', onEnter: () => window.initHealthModule?.() },
        'todo':      { onEnter: () => window.loadTodos?.() },
        // MAPOWANIE: settings -> view-settings-main
        'settings':  { screenId: 'view-settings-main', onEnter: () => window.initSettingsModule?.() },
        'archive-screen': { onEnter: () => window.loadArchiveData?.() },
        'pharmacy-screen': { onEnter: () => window.loadPharmacyItems?.() },
        'health-book-screen': { onEnter: () => window.loadHealthBook?.() },
        'stats-screen': { onEnter: () => window.loadStats?.() }
    };

    let activeView = 'auth';
    let historyStack = [];

    window.switchView = function(viewName) {
        if (activeView === viewName && viewName !== 'auth') return;

        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        
        const config = viewConfig[viewName];
        const targetId = config?.screenId || `view-${viewName}`;
        const targetScreen = document.getElementById(targetId) || document.getElementById(viewName);
        
        if (!targetScreen) {
            console.error(`Router: Nie znaleziono widoku: ${viewName} (szukano ID: ${targetId})`);
            return;
        }

        targetScreen.classList.remove('hidden');
        window.scrollTo(0, 0);

        const nav = document.getElementById('bottom-nav');
        if (nav) {
            const isSubScreen = viewName.includes('-screen');
            nav.classList.toggle('hidden', viewName === 'auth' || isSubScreen);
            
            nav.querySelectorAll('button').forEach(btn => {
                const isActive = btn.getAttribute('onclick')?.includes(`'${viewName}'`);
                btn.style.opacity = isActive ? '1' : '0.5';
            });
        }

        activeView = viewName;
        window.activeView = viewName;

        if (config && typeof config.onEnter === 'function') {
            config.onEnter();
        }
    };

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

    window.refreshCurrentView = function() {
        if (viewConfig[activeView]?.onEnter) {
            viewConfig[activeView].onEnter();
        }
    };

    return { active: () => activeView };
})();
