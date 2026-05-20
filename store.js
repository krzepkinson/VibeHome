// ==========================================
// CENTRALNY MAGAZYN DANYCH (store.js)
// ==========================================

window.AppStore = (() => {
    // Stan początkowy
    let state = {
        tasks: [], logs: [], profiles: [], rooms: [], 
        todos: [], hTasks: [], hLogs: [], pharmacy: [], hMeasurements: []
    };
    
    let listeners = [];

    return {
        // Pobierz aktualny stan
        get: () => state,

        // ZMIANA KRYTYCZNA: Bezpieczny merge ze wsparciem dla funkcji (ochrona przed race-condition)
        set: (updater) => {
            const nextState = typeof updater === 'function' 
                ? updater(state) 
                : { ...state, ...updater };
            
            state = nextState;
            
            if (window.CONFIG && window.CONFIG.DEBUG) {
                console.log("Store updated:", state);
            }
            
            listeners.forEach(callback => callback(state));
        },

        // Zapisz się na powiadomienia o zmianach
        subscribe: (callback) => {
            listeners.push(callback);
            // Zwracamy funkcję do wypisania się (clean-up)
            return () => {
                listeners = listeners.filter(l => l !== callback);
            };
        }
    };
})();
