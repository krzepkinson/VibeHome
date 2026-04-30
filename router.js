// ==========================================
// SYSTEM NAWIGACJI I ROUTINGU (router.js)
// ==========================================

let activeView = '';
let navHistory = []; 

window.switchView = function(view, skipHistory = false) {
    try {
        if (!window.currentUser && view !== 'auth') {
            view = 'auth';
        }
        
        activeView = view;
        
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
                view = 'health'; 
            } 
            else if (view === 'todo') { 
                document.getElementById('view-todo').classList.remove('hidden'); 
                if(typeof initTodoModule === 'function') initTodoModule(); 
            }
            else if (view === 'settings') { 
                document.getElementById('view-settings-main').classList.remove('hidden'); 
                if(typeof initSettingsModule === 'function') initSettingsModule(); 
            }
        }

        if (!skipHistory && ['dashboard', 'home', 'health', 'settings', 'auth', 'todo'].includes(view)) {
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
    // Dodano zamykanie nowych ekranów ustawień
    ['settings-screen', 'health-settings-screen', 'edit-profile-screen', 'settings-rooms-screen', 'settings-profiles-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    if (navHistory.length > 0) {
        const prev = navHistory.pop();
        window.switchView(prev || 'dashboard', false);
        return; 
    }

    if (typeof currentRoomFilter !== 'undefined' && currentRoomFilter !== null) {
        if(typeof clearRoomFilter === 'function') {
            clearRoomFilter(); 
            return; 
        }
    }

    window.switchView('dashboard', false); 
};

window.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = await window.checkSession();
    let path = window.location.pathname.replace('/', '') || 'dashboard';
    const validViews = ['dashboard', 'home', 'health', 'settings', 'auth', 'todo'];
    let viewToLoad = validViews.includes(path) ? path : 'dashboard';

    if (!isLoggedIn) {
        viewToLoad = 'auth';
    } else if (viewToLoad === 'auth') {
        viewToLoad = 'dashboard';
    }

    window.history.replaceState({ view: viewToLoad }, '', `/${viewToLoad}`);
    window.switchView(viewToLoad, true);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('Błąd SW', err));
    }
});

window.addEventListener('popstate', (event) => {
    ['settings-screen', 'health-settings-screen', 'edit-profile-screen', 'settings-rooms-screen', 'settings-profiles-screen'].forEach(id => {
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
