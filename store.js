// ==========================================
// CENTRALNY MAGAZYN DANYCH - LOCAL FIRST (store.js)
// ==========================================

window.AppStore = (() => {
    const STORAGE_KEY = 'bento_app_store_v1';

    // Domyślny stan początkowy
    const defaultState = {
        tasks: [], logs: [], profiles: [], rooms: [], 
        todos: [], hTasks: [], hLogs: [], pharmacy: [], 
        hMeasurements: [], checklists: [], calendarEvents: []
    };

    // Błyskawiczny odczyt z pamięci urządzenia (0 ms przy starcie)
    const loadInitialState = () => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                return { ...defaultState, ...parsed };
            }
        } catch (e) {
            console.warn("Błąd odczytu z localStorage:", e);
        }
        return { ...defaultState };
    };

    let state = loadInitialState();
    let listeners = [];

    // Zapis stanu w pamięci podręcznej telefonu
    const saveToStorage = (newState) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        } catch (e) {
            console.warn("Błąd zapisu do localStorage:", e);
        }
    };

    return {
        // Pobierz aktualny stan z pamięci RAM
        get: () => state,

        // Zapis stanu + natychmiastowa persystencja na dysku
        set: (updater) => {
            const nextState = typeof updater === 'function' 
                ? updater(state) 
                : { ...state, ...updater };
            
            state = nextState;
            saveToStorage(state);
            
            if (window.CONFIG && window.CONFIG.DEBUG) {
                console.log("Store updated & saved locally:", state);
            }
            
            listeners.forEach(callback => callback(state));
        },

        // Zapisz się na powiadomienia o zmianach
        subscribe: (callback) => {
            listeners.push(callback);
            return () => {
                listeners = listeners.filter(l => l !== callback);
            };
        },

        // Wyszyszczenie pamięci lokalnej (np. przy wylogowaniu)
        clearStorage: () => {
            try {
                localStorage.removeItem(STORAGE_KEY);
                state = { ...defaultState };
                listeners.forEach(callback => callback(state));
            } catch (e) {
                console.warn("Błąd czyszczenia storage:", e);
            }
        }
    };
})();
