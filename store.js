// ==========================================
// CENTRALNY MAGAZYN DANYCH - LOCAL FIRST (store.js)
// ==========================================

window.AppStore = (() => {
    const LEGACY_STORAGE_KEY = 'bento_app_store_v1';
    const STORAGE_KEY_PREFIX = `${LEGACY_STORAGE_KEY}:`;

    const createDefaultState = () => ({
        tasks: [], logs: [], profiles: [], rooms: [],
        todos: [], hTasks: [], hLogs: [], pharmacy: [],
        hMeasurements: [], checklists: [], checklistItems: [], calendarEvents: []
    });

    let state = createDefaultState();
    let activeStorageKey = null;
    let listeners = [];

    const notify = () => listeners.forEach(callback => callback(state));

    const loadFromStorage = (key) => {
        try {
            const cached = key && localStorage.getItem(key);
            if (cached) return { ...createDefaultState(), ...JSON.parse(cached) };
        } catch (e) {
            console.warn('Błąd odczytu z localStorage:', e);
        }
        return createDefaultState();
    };

    const saveToStorage = () => {
        if (!activeStorageKey) return;
        try {
            localStorage.setItem(activeStorageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Błąd zapisu do localStorage:', e);
        }
    };

    return {
        get: () => state,

        // Dane lokalne są odseparowane dla konta i gospodarstwa domowego.
        setScope: (userId, householdId) => {
            if (!userId) {
                activeStorageKey = null;
                state = createDefaultState();
                notify();
                return;
            }

            const scope = `${encodeURIComponent(String(userId))}:${encodeURIComponent(String(householdId || 'no-household'))}`;
            const nextKey = `${STORAGE_KEY_PREFIX}${scope}`;
            if (nextKey === activeStorageKey) return;

            activeStorageKey = nextKey;
            state = loadFromStorage(activeStorageKey);

            // Stary klucz nie był przypisany do użytkownika, więc nie da się go
            // bezpiecznie przypisać do jednego z domowników.
            try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) {}
            notify();
        },

        set: (updater) => {
            const nextState = typeof updater === 'function'
                ? updater(state)
                : { ...state, ...updater };

            if (!nextState || typeof nextState !== 'object') return;
            state = { ...createDefaultState(), ...nextState };
            saveToStorage();
            notify();
        },

        subscribe: (callback) => {
            listeners.push(callback);
            return () => { listeners = listeners.filter(listener => listener !== callback); };
        },

        clearStorage: () => {
            try {
                if (activeStorageKey) localStorage.removeItem(activeStorageKey);
                state = createDefaultState();
                notify();
            } catch (e) {
                console.warn('Błąd czyszczenia storage:', e);
            }
        }
    };
})();
