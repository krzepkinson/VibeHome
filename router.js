// ==========================================
// ROUTER: ZARZĄDZANIE WIDOKAMI (router.js)
// ==========================================

window.Router = (() => {
    const viewConfig = {
        'auth':      { onEnter: null },
        // TYLKO DASHBOARD I HOME ŁADUJEMY Z PLIKU:
        'dashboard': { file: 'dashboard.html', onEnter: () => window.loadDashboardOverview?.(true) },
        'home':      { file: 'home.html', onEnter: () => window.loadDashboard?.() },
        // RESZTA DZIAŁA PO STAREMU (szuka w index.html)
        'health':    { screenId: 'view-profile', onEnter: () => window.initHealthModule?.() },
        'todo':      { onEnter: () => window.initTodoModule?.() },
        'settings':  { screenId: 'view-settings-main', onEnter: () => window.initSettingsModule?.() },
        'archive-screen': { onEnter: () => window.loadArchiveData?.() },
        'pharmacy-screen': { onEnter: () => window.loadPharmacyItems?.() },
        'health-book-screen': { onEnter: () => window.loadHealthBook?.() },
        'stats-screen': { onEnter: () => window.loadStats?.() }
    };

    let activeView = 'auth';
    let loadedViews = new Map(); // Pamięć załadowanych widoków z plików

    // Dodano drugi parametr: pushToHistory (domyślnie true)
    window.switchView = async function(viewName, pushToHistory = true) {
        if (activeView === viewName && viewName !== 'auth') return;

        const config = viewConfig[viewName];
        if (!config) {
            console.error(`Router: Nie znaleziono konfiguracji dla widoku: ${viewName}`);
            return;
        }

        // Ukrywamy wszystkie ekrany
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        
        // --- TRYB 1: WIDOK Z PLIKU (Lazy Loading) ---
        if (config.file) {
            const container = document.getElementById('view-container');
            if (!loadedViews.has(viewName)) {
                try {
                    const response = await fetch(`/views/${config.file}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const html = await response.text();
                    
                    const wrapper = document.createElement('div');
                    wrapper.id = `view-${viewName}`;
                    wrapper.className = 'screen-view transition-all duration-300';
                    wrapper.innerHTML = html;
                    
                    container.appendChild(wrapper);
                    loadedViews.set(viewName, wrapper);
                } catch (err) {
                    console.error(`Błąd ładowania ${config.file}:`, err);
                    window.showToast("Błąd ładowania interfejsu");
                    return;
                }
            }
            loadedViews.get(viewName).classList.remove('hidden');
        } 
        // --- TRYB 2: WIDOK WBUDOWANY W INDEX.HTML ---
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

        // --- ZMIANA: Dodawanie do Historii Przeglądarki (URL) ---
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
                const isActive = btn.getAttribute('onclick')?.includes(`'${viewName}'`);
                btn.style.opacity = isActive ? '1' : '0.5';
            });
        }

        activeView = viewName;
        window.activeView = viewName;

        if (typeof config.onEnter === 'function') {
            config.onEnter();
        }
    };

    // --- ZMIANA: Wykorzystanie natywnego systemu przeglądarki ---
    window.goBack = function() { 
        if (window.history.length > 1) {
            window.history.back(); // Zleca przeglądarce wykonanie akcji "Wstecz" (uruchomi popstate)
        } else {
            window.switchView('dashboard'); // Bezpiecznik, gdy brak historii
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

    // --- NOWOŚĆ: Nasłuchiwanie gestów systemowych wstecz/dalej ---
    window.addEventListener('popstate', (e) => {
        // e.state zawiera to, co włożyliśmy przez pushState ({ view: 'home' })
        if (e.state && e.state.view) {
            // Przełączamy widok, ale dajemy flagę false, by nie tworzyć nowej historii
            window.switchView(e.state.view, false);
        } else {
            // Bezpiecznik dla pierwszej strony wejściowej lub głębokich linków
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get('view') || 'dashboard';
            
            if (window.currentUser) {
                window.switchView(view, false);
            } else {
                window.switchView('auth', false);
            }
        }
    });

    return { active: () => activeView };
})();
