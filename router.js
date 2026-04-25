// ==========================================
// SYSTEM NAWIGACJI I ROUTINGU (router.js)
// ==========================================

let activeView = '';
let navHistory = []; 

window.switchView = function(view, skipHistory = false) {
    try {
        activeView = view;
        
        // 1. Zarządzanie kolorami na dolnym pasku nawigacji
        const navIds = ['dashboard', 'home', 'health', 'settings'];
        navIds.forEach(id => {
            const el = document.getElementById(`nav-${id}`);
            if (!el) return;
            
            // Jeśli jesteśmy w profilu, podświetlamy Zdrowie
            if (view === id || (view === 'profile' && id === 'health')) {
                el.className = `flex flex-col items-center justify-center w-full h-full text-[${id === 'dashboard' ? '#c4eed0' : id === 'home' ? '#a8c7fa' : id === 'settings' ? '#e3e3e3' : '#ffb4ab'}] transition-colors`;
            } else {
                el.className = 'flex flex-col items-center justify-center w-full h-full text-neutral-500 hover:text-neutral-300 transition-colors';
            }
        });

        // 2. Ukrywanie starych widoków
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        const header = document.getElementById('global-nav-header');
        if (header) header.classList.add('hidden');
        
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) bottomNav.classList.remove('hidden');

        // 3. Uruchamianie odpowiedniego modułu
        if (view === 'dashboard') { 
            document.getElementById('view-dashboard').classList.remove('hidden'); 
            if(typeof loadDashboardOverview === 'function') loadDashboardOverview(); 
        }
        else if (view === 'home') { 
            document.getElementById('view-home').classList.remove('hidden'); 
            if(typeof loadDashboard === 'function') loadDashboard(); 
        } 
        else if (view === 'health' || view === 'profile') { 
            document.getElementById('view-profile').classList.remove('hidden'); 
            if(typeof initHealthModule === 'function') initHealthModule(); 
            view = 'health'; // Do paska adresu wstawiamy tylko 'health'
        } 
        else if (view === 'settings') { 
            document.getElementById('view-settings-main').classList.remove('hidden'); 
            if(typeof initSettingsModule === 'function') initSettingsModule(); 
        }

        // 4. Magia podmiany URL (History API)
        if (!skipHistory && ['dashboard', 'home', 'health', 'settings'].includes(view)) {
            window.history.pushState({ view: view }, '', `/${view}`);
        }
    } catch (e) {
        console.error("Błąd podczas ładowania widoku (switchView): ", e);
    }
};

window.goForward = function(screenId) {
    navHistory.push(activeView); 
    document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
    
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.add('hidden');
    
    const screenEl = document.getElementById(screenId);
    if (screenEl) screenEl.classList.remove('hidden');
};

window.goBack = function() {
    // Bezpieczne zamykanie okien edycji
    ['settings-screen', 'health-settings-screen', 'edit-profile-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    // Czyszczenie filtra pokoju, jeśli wchodzimy z zakładki Dom
    if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null) {
        if(typeof clearRoomFilter === 'function') {
            clearRoomFilter(); 
            return; 
        }
    }

    const prev = navHistory.pop();
    window.switchView(prev || 'dashboard', false); 
};

// --- START APLIKACJI I NASŁUCHIWANIE PRZEGLĄDARKI ---

window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.replace('/', '') || 'dashboard';
    const validViews = ['dashboard', 'home', 'health', 'settings'];
    const viewToLoad = validViews.includes(path) ? path : 'dashboard';

    window.history.replaceState({ view: viewToLoad }, '', `/${viewToLoad}`);
    window.switchView(viewToLoad, true);

    // Rejestracja Service Workera
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('Service Worker gotowy!', reg);
        }).catch(err => console.error('Błąd SW', err));
    }
});

window.addEventListener('popstate', (event) => {
    ['settings-screen', 'health-settings-screen', 'edit-profile-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('[id$="-modal"]').forEach(m => m.classList.add('hidden'));

    if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null && event.state?.view !== 'home') {
        if(typeof clearRoomFilter === 'function') clearRoomFilter();
    }

    if (event.state && event.state.view) {
        window.switchView(event.state.view, true);
    } else {
        window.switchView('dashboard', true);
    }
});
