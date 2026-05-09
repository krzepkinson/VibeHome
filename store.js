// ==========================================
// CENTRALNY MAGAZYN DANYCH (store.js)
// ==========================================

window.AppStore = (() => {
    // Stan początkowy
    let state = {
        tasks: [], logs: [], profiles: [], rooms: [], 
        todos: [], hTasks: [], hLogs: [], pharmacy: []
    };
    
    let listeners = [];

    return {
        // Pobierz aktualny stan
        get: () => state,

        // Aktualizuj stan i powiadom wszystkich "słuchaczy"
        set: (newState) => {
            state = { ...state, ...newState };
            
            // POPRAWKA AUDYTU: Logowanie tylko w trybie deweloperskim
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
