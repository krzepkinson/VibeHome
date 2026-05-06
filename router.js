// ==========================================
// SYSTEM NAWIGACJI I ROUTINGU (router.js)
// ==========================================

// ZMIANA: Konsekwentna deklaracja globalna
window.activeView = '';

window.switchView = function(view, skipHistory = false) {
    try {
        if (!window.currentUser && view !== 'auth') { view = 'auth'; }
        window.activeView = view; // ZMIANA
        
        const navIds = ['dashboard', 'home', 'health', 'settings', 'todo'];
        navIds.forEach(id => {
            const el = document.getElementById(`nav-${id}`);
            if (!el) return;
            if (view === id || (view === 'profile' && id === 'health')) {
                el.className = `flex flex-col items-center justify-center w-full h-full text-[${id === 'dashboard' ? '#c4eed0' : id === 'home' ? '#a8c7fa' : id === 'settings' ? '#e3e3e3' : id === 'todo' ? '#a8c7fa' : '#ffb4ab'}] transition-colors`;
            } else {
                el.className = 'flex flex-col items-center justify-center w-full h-full text-neutral-500 hover:text-neutral-300 transition-colors';
            }
        });

        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        
        const header = document.getElementById('global-nav-header');
        if (header) header.classList.add('hidden');
        
        const bottomNav = document.getElementById('bottom-nav');

        if (view === 'auth') {
            document.getElementById('view-auth').classList.remove('hidden');
            if (bottomNav) bottomNav.classList.add('hidden');
        } else {
            if (bottomNav) bottomNav.classList.remove('hidden');
            
            if (view === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); if(typeof loadDashboardOverview === 'function') loadDashboardOverview(); }
            else if (view === 'home') { document.getElementById('view-home').classList.remove('hidden'); if(typeof loadDashboard === 'function') loadDashboard(); } 
            else if (view === 'health' || view === 'profile') { document.getElementById('view-profile').classList.remove('hidden'); if(typeof initHealthModule === 'function') initHealthModule(); view = 'health'; } 
            else if (view === 'todo') { document.getElementById('view-todo').classList.remove('hidden'); if(typeof initTodoModule === 'function') initTodoModule(); }
            else if (view === 'settings') { document.getElementById('view-settings-main').classList.remove('hidden'); if(typeof initSettingsModule === 'function') initSettingsModule(); }
        }

        if (!skipHistory && ['dashboard', 'home', 'health', 'settings', 'auth', 'todo'].includes(view)) {
            window.history.pushState({ view: view, subScreen: null }, '', `/${view}`);
        }
    } catch (e) { console.error("Błąd switchView: ", e); }
};

window.goForward = function(screenId) {
    document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.add('hidden');
    const screenEl = document.getElementById(screenId);
    if (screenEl) screenEl.classList.remove('hidden');

    // ZMIANA: Użycie window.activeView
    window.history.pushState({ view: window.activeView, subScreen: screenId }, '', `#${screenId}`);
};

window.goBack = function() {
    const subScreens = ['settings-screen', 'health-settings-screen', 'edit-profile-screen', 'settings-rooms-screen', 'settings-profiles-screen', 'checklist-screen', 'archive-screen'];
    
    const isSubScreenOpen = subScreens.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });

    if (isSubScreenOpen) {
        window.history.back();
        return;
    }

    if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null) {
        if(typeof clearRoomFilter === 'function') { clearRoomFilter(); return; }
    }

    window.switchView('dashboard', false); 
};

window.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = await window.checkSession();
    let path = window.location.pathname.replace('/', '') || 'dashboard';
    const validViews = ['dashboard', 'home', 'health', 'settings', 'auth', 'todo'];
    let viewToLoad = validViews.includes(path) ? path : 'dashboard';

    if (!isLoggedIn) viewToLoad = 'auth';
    else if (viewToLoad === 'auth') viewToLoad = 'dashboard';

    window.history.replaceState({ view: viewToLoad, subScreen: null }, '', `/${viewToLoad}`);
    window.switchView(viewToLoad, true);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('Błąd SW', err));
    }
});

window.addEventListener('popstate', (event) => {
    document.querySelectorAll('[id$="-modal"]').forEach(m => m.classList.add('hidden'));

    const state = event.state;

    if (state && state.subScreen) {
        document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) bottomNav.classList.add('hidden');
        const screenEl = document.getElementById(state.subScreen);
        if (screenEl) screenEl.classList.remove('hidden');
    } else {
        ['settings-screen', 'health-settings-screen', 'edit-profile-screen', 'settings-rooms-screen', 'settings-profiles-screen', 'checklist-screen', 'archive-screen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null && state?.view !== 'home') {
            if(typeof clearRoomFilter === 'function') clearRoomFilter();
        }

        if (state && state.view) {
            window.switchView(state.view, true);
        } else {
            window.switchView('dashboard', true);
        }
    }
});
