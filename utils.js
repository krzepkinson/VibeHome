// ==========================================
// FUNKCJE POMOCNICZE (utils.js)
// ==========================================

window.esc = function(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
};

window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerText = message;
    toast.classList.remove('opacity-0', 'translate-y-10');
    
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }
    
    window.toastTimeout = setTimeout(() => { 
        toast.classList.add('opacity-0', 'translate-y-10'); 
    }, 3000);
};

window.urlB64ToUint8Array = function(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) { 
        outputArray[i] = rawData.charCodeAt(i); 
    }
    return outputArray;
};

// NIEZAWODNE ODŚWIEŻANIE AKTYWNEGO WIDOKU
window.refreshCurrentView = async function() {
    const btn = document.activeElement; 
    if (btn && btn.tagName === 'BUTTON' && btn.innerText.includes('↻')) {
        btn.style.transform = 'rotate(180deg)';
        btn.classList.add('opacity-50');
    }
    
    try {
        const view = window.activeView;
        if (document.getElementById('checklist-screen') && !document.getElementById('checklist-screen').classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') {
                await window.loadChecklistItems();
            }
        } else if (view === 'dashboard') {
            if (typeof window.loadDashboardOverview === 'function') {
                await window.loadDashboardOverview(true); 
            }
        } else if (view === 'home') {
            if (typeof window.loadDashboard === 'function') {
                await window.loadDashboard();
            }
        } else if (view === 'todo') {
            if (typeof window.loadTodosAndLists === 'function') {
                await window.loadTodosAndLists();
            }
        } else if (view === 'health') {
            if (typeof window.initHealthModule === 'function') {
                await window.initHealthModule();
            }
        }
    } catch(e) { 
        console.error("Błąd odświeżania:", e); 
    } finally {
        if (btn && btn.tagName === 'BUTTON' && btn.innerText.includes('↻')) {
            setTimeout(() => { 
                btn.style.transform = ''; 
                btn.classList.remove('opacity-50'); 
            }, 300);
        }
    }
};

// --- SYSTEM PANCERNYCH KOMUNIKATÓW ---

window.customConfirm = function(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    window._confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
};

window.closeConfirmModal = function(result) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (result && typeof window._confirmCallback === 'function') {
        window._confirmCallback();
    }
    window._confirmCallback = null;
};

// --- WSPÓŁDZIELONA LOGIKA BIZNESOWA ---

window.isTaskOverdue = function(task, logs) {
    if (!task.interval_days) return false;
    
    const lastLog = logs.find(l => l.activity_name === task.name);
    if (!lastLog) return true;
    
    const lastDate = new Date(lastLog.created_at);
    lastDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + task.interval_days);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return nextDate <= today;
};
// --- SYSTEM PULL-TO-REFRESH ---

window.initPullToRefresh = function() {
    const mainScreen = document.getElementById('main-screen');
    const ptrIndicator = document.getElementById('ptr-indicator');
    const ptrIcon = document.getElementById('ptr-icon');
    
    if (!mainScreen || !ptrIndicator) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = 70; // Ile pikseli trzeba pociągnąć

    mainScreen.addEventListener('touchstart', (e) => {
        // Zaczynamy ciągnąć tylko, jeśli jesteśmy na samej górze listy
        if (mainScreen.scrollTop === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
            ptrIndicator.style.transition = 'none';
            ptrIcon.style.transition = 'none';
        }
    }, { passive: true });

    mainScreen.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;

        if (pullDistance > 0 && mainScreen.scrollTop === 0) {
            // Dodajemy "opór" przy ciągnięciu (mnożnik 0.4)
            const visualDistance = Math.min(pullDistance * 0.4, threshold + 20);
            ptrIndicator.style.transform = `translateY(${visualDistance - 60}px)`; // -60px to wysokość ukrycia
            ptrIcon.style.transform = `rotate(${visualDistance * 4}deg)`;
        }
    }, { passive: true });

    mainScreen.addEventListener('touchend', async () => {
        if (!isPulling) return;
        isPulling = false;
        const pullDistance = currentY - startY;
        
        ptrIndicator.style.transition = 'transform 0.3s ease-out';
        ptrIcon.style.transition = 'transform 0.3s ease-out';

        // Jeśli przeciągnęliśmy wystarczająco mocno
        if (pullDistance > threshold && mainScreen.scrollTop === 0) {
            ptrIndicator.style.transform = `translateY(15px)`; // Zatrzymujemy kółko lekko poniżej górnej krawędzi
            ptrIcon.classList.add('animate-spin');
            
            // WYWOŁANIE NASZEGO ODŚWIEŻANIA
            await window.refreshCurrentView();
            
            // Po zakończeniu odświeżania chowamy kółko
            ptrIndicator.style.transform = `translateY(-100%)`;
            ptrIcon.classList.remove('animate-spin');
        } else {
            // Jeśli pociągnęliśmy za słabo - od razu chowamy
            ptrIndicator.style.transform = `translateY(-100%)`;
        }
        
        startY = 0;
        currentY = 0;
    });
};

// Odpalamy nasłuchiwanie gestów od razu po załadowaniu apki
document.addEventListener('DOMContentLoaded', window.initPullToRefresh);
