// ==========================================
// CENTRALNY MAGAZYN DANYCH - LOCAL FIRST (store.js)
// ==========================================

window.AppStore = (() => {
    const LEGACY_STORAGE_KEY = 'bento_app_store_v1';
    const STORAGE_KEY_PREFIX = `${LEGACY_STORAGE_KEY}:`;
    const DB_NAME = 'bento-app-local';
    const DB_VERSION = 1;
    const DB_STORE = 'household_states';

    const createDefaultState = () => ({
        tasks: [], logs: [], profiles: [], rooms: [],
        todos: [], hTasks: [], hLogs: [], pharmacy: [],
        hMeasurements: [], checklists: [], checklistItems: [], calendarEvents: [],
        lastSyncedAt: 0, lastSyncAttemptAt: 0
    });

    let state = createDefaultState();
    let activeStorageKey = null;
    let listeners = [];
    let persistTimer = null;
    let stateRevision = 0;
    let dbPromise = null;
    let indexedDBAvailable = null;

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

    const getLocalSavedAt = (key) => {
        try { return Number(localStorage.getItem(`${key}:saved_at`) || 0); }
        catch (e) { return 0; }
    };

    const openDatabase = () => {
        if (!window.indexedDB) {
            indexedDBAvailable = false;
            return Promise.reject(new Error('IndexedDB niedostępne'));
        }
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                let request;
                try { request = window.indexedDB.open(DB_NAME, DB_VERSION); }
                catch (error) { reject(error); return; }
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'key' });
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('Nie udało się otworzyć lokalnej bazy.'));
                request.onblocked = () => reject(new Error('Lokalna baza jest zablokowana.'));
            }).catch(error => {
                indexedDBAvailable = false;
                dbPromise = null;
                throw error;
            });
        }
        return dbPromise.then(db => {
            indexedDBAvailable = true;
            return db;
        });
    };

    const readIndexedState = async (key) => {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_STORE, 'readonly');
            const request = transaction.objectStore(DB_STORE).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Nie udało się odczytać lokalnej bazy.'));
        });
    };

    const writeIndexedState = async (key, snapshot, updatedAt) => {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_STORE, 'readwrite');
            transaction.objectStore(DB_STORE).put({ key, state: snapshot, updatedAt });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Nie udało się zapisać lokalnej bazy.'));
            transaction.onabort = () => reject(transaction.error || new Error('Zapis lokalnej bazy został przerwany.'));
        });
    };

    const deleteIndexedState = async (key) => {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_STORE, 'readwrite');
            transaction.objectStore(DB_STORE).delete(key);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Nie udało się usunąć lokalnej bazy.'));
        });
    };

    const persistLocalSnapshot = (key, snapshot, savedAt) => {
        try {
            const serialized = JSON.stringify(snapshot);
            localStorage.setItem(key, serialized);
            localStorage.setItem(`${key}:saved_at`, String(savedAt));
        } catch (e) {
            console.warn('Nie udało się zapisać cache w localStorage:', e);
        }
    };

    const persistSnapshot = (key, snapshot) => {
        const savedAt = Date.now();
        if (indexedDBAvailable === false) {
            persistLocalSnapshot(key, snapshot, savedAt);
            return;
        }
        writeIndexedState(key, snapshot, savedAt).catch(error => {
            indexedDBAvailable = false;
            console.warn('Błąd zapisu cache do IndexedDB; używam localStorage.', error);
            persistLocalSnapshot(key, snapshot, savedAt);
        });
    };

    const saveToStorage = () => {
        if (!activeStorageKey) return;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            if (!activeStorageKey) return;
            persistSnapshot(activeStorageKey, state);
        }, 150);
    };

    const flushToStorage = () => {
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = null;
        if (!activeStorageKey) return;
        persistSnapshot(activeStorageKey, state);
    };

    window.addEventListener('pagehide', flushToStorage);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushToStorage();
    });

    return {
        get: () => state,

        // Dane lokalne są odseparowane dla konta i gospodarstwa domowego.
        setScope: async (userId, householdId) => {
            if (!userId) {
                flushToStorage();
                activeStorageKey = null;
                state = createDefaultState();
                stateRevision++;
                notify();
                return;
            }

            const scope = `${encodeURIComponent(String(userId))}:${encodeURIComponent(String(householdId || 'no-household'))}`;
            const nextKey = `${STORAGE_KEY_PREFIX}${scope}`;
            if (nextKey === activeStorageKey) return;

            flushToStorage();
            activeStorageKey = nextKey;
            state = loadFromStorage(activeStorageKey);
            stateRevision++;
            const revisionAtLoad = stateRevision;
            const localSavedAt = getLocalSavedAt(nextKey);

            // Stary klucz nie był przypisany do użytkownika, więc nie da się go
            // bezpiecznie przypisać do jednego z domowników.
            try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) {}
            notify();

            try {
                const indexed = await readIndexedState(nextKey);
                if (activeStorageKey !== nextKey || stateRevision !== revisionAtLoad) return;
                if (indexed?.state && Number(indexed.updatedAt || 0) > localSavedAt) {
                    state = { ...createDefaultState(), ...indexed.state };
                    stateRevision++;
                    notify();
                }
            } catch (e) {
                // Older Safari versions and private browsing can disable IndexedDB.
            }
        },

        set: (updater) => {
            const nextState = typeof updater === 'function'
                ? updater(state)
                : { ...state, ...updater };

            if (!nextState || typeof nextState !== 'object') return;
            state = { ...createDefaultState(), ...nextState };
            stateRevision++;
            saveToStorage();
            notify();
        },

        subscribe: (callback) => {
            listeners.push(callback);
            return () => { listeners = listeners.filter(listener => listener !== callback); };
        },

        clearStorage: () => {
            try {
                if (persistTimer) clearTimeout(persistTimer);
                persistTimer = null;
                if (activeStorageKey) {
                    const key = activeStorageKey;
                    localStorage.removeItem(key);
                    localStorage.removeItem(`${key}:saved_at`);
                    deleteIndexedState(key).catch(() => {});
                }
                state = createDefaultState();
                stateRevision++;
                notify();
            } catch (e) {
                console.warn('Błąd czyszczenia storage:', e);
            }
        }
    };
})();
