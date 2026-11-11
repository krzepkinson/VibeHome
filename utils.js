// ==========================================
// FUNKCJE POMOCNICZE (utils.js)
// ==========================================

window.esc = function(str) {
    if (str == null) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

// --- GLOBALNE FUNKCJE CZASU I DATY ---
window.getTodayLocalString = function(dObj = new Date()) {
    if (!dObj || isNaN(dObj.getTime())) return '';
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

window.formatLocalDatetime = function(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

window.parseLocalDatetime = function(dtStr) {
    if (!dtStr) return null;
    if (dtStr.length === 16) dtStr += ':00'; // Fix dla Safari
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return new Date(dtStr.replace('T', ' ').replace(/-/g, '/'));
    return d;
};
// ------------------------------------

window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.style.pointerEvents = 'none';
    toast.classList.remove('opacity-0', '-translate-y-10');
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); }, 3000);
};

window.refreshCurrentView = async function(forceRefresh = false) {
    try {
        const view = window.activeView;
        if (document.getElementById('checklist-screen') && !document.getElementById('checklist-screen').classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') await window.loadChecklistItems();
        } else if (view === 'dashboard') {
            if (typeof window.loadDashboardOverview === 'function') await window.loadDashboardOverview(forceRefresh); 
        } else if (view === 'home') {
            if (typeof window.loadDashboard === 'function') await window.loadDashboard(forceRefresh);
        } else if (view === 'todo') {
            if (typeof window.loadTodosAndLists === 'function') await window.loadTodosAndLists(forceRefresh);
        } else if (view === 'health') {
            if (typeof window.initHealthModule === 'function') await window.initHealthModule(forceRefresh);
        } else if (view === 'pharmacy-screen') {
            if (typeof window.loadPharmacyItems === 'function') await window.loadPharmacyItems(forceRefresh);
        }
    } catch(e) { console.error("Błąd odświeżania:", e); }
};

window.customConfirm = function(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    window._confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
    window.UX?.openDialog('confirm-modal');
};

window.closeConfirmModal = function(result) {
    document.getElementById('confirm-modal').classList.add('hidden');
    window.UX?.closeDialog('confirm-modal');
    if (result && typeof window._confirmCallback === 'function') window._confirmCallback();
    window._confirmCallback = null;
};

window.isTaskOverdue = function(task, logsArray) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskLogs = logsArray.filter(l => l.task_id === task.id || l.health_task_id === task.id);
    const lastLog = taskLogs[0]; 

    if (task.task_type === 'one_time') {
        if (taskLogs.length > 0) return false; 
        if (!task.event_date) return false;
        
        const evDate = new Date(task.event_date);
        evDate.setHours(0, 0, 0, 0);
        return evDate <= today;
    }

    if (task.interval_days && task.interval_days > 0) {
        if (!lastLog) return true; 
        
        const lastDateStr = lastLog.created_at || lastLog.start_date;
        if (!lastDateStr) return true;

        const nextDate = new Date(lastDateStr);
        nextDate.setHours(0, 0, 0, 0);
        nextDate.setDate(nextDate.getDate() + task.interval_days);
        
        return nextDate <= today;
    }

    return false; 
};

// --- SYSTEM PULL-TO-REFRESH ---
window.initPullToRefresh = (() => {
    const initialized = new WeakSet();
    // Stuknięcie i touchend bez potwierdzonego ruchu nie zmieniają DOM.
    // Safari wysyła click po zakończeniu sekwencji dotykowej:
    // https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
    const excluded = 'button,a,input,select,textarea,label,[role="button"],[contenteditable]:not([contenteditable="false"]),[data-no-pull-refresh],.js-swipe-item,.swipe-front,[role="dialog"],[aria-modal="true"],.ux-modal,.ux-dialog,.ux-sheet,.ux-dialog-panel';
    return function() {
        const mainScreen = document.getElementById('main-screen');
        const ptrIndicator = document.getElementById('ptr-indicator');
        const ptrIcon = document.getElementById('ptr-icon');
        if (!mainScreen || !ptrIndicator || !ptrIcon || initialized.has(mainScreen)) return;
        initialized.add(mainScreen);
        let gesture = null, refreshing = false;
        const deadZone = 12, refreshDistance = 100;

        function hideIndicator() {
            ptrIndicator.style.transition = 'transform 0.3s ease-out';
            ptrIndicator.style.transform = 'translateY(-100%)';
            ptrIcon.style.transform = '';
            ptrIcon.classList.remove('animate-spin');
        }
        function cancel() {
            const visible = gesture?.pulling;
            gesture = null;
            if (visible && !refreshing) hideIndicator();
        }
        function canStart(target) {
            if (!target || target.closest(excluded) || mainScreen.scrollTop > 0 || window.activeView === 'auth') return false;
            // Osobny scroll listy lub nakładki nie odświeża widoku pod spodem.
            let node = target;
            for (; node && node !== mainScreen; node = node.parentElement) {
                const style = window.getComputedStyle(node);
                if (style.position === 'fixed' || node.scrollHeight > node.clientHeight && /auto|scroll/.test(style.overflowY)) return false;
            }
            return node === mainScreen;
        }
        mainScreen.addEventListener('touchstart', event => {
            cancel();
            if (refreshing || event.touches.length !== 1) return;
            const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
            if (!canStart(target)) return;
            const touch = event.touches[0];
            gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, view: window.activeView, pulling: false };
        }, { passive: true });
        mainScreen.addEventListener('touchmove', event => {
            if (!gesture || refreshing) return;
            if (event.touches.length !== 1 || mainScreen.scrollTop > 0 || window.activeView !== gesture.view) { cancel(); return; }
            const touch = Array.from(event.touches).find(point => point.identifier === gesture.id);
            if (!touch) { cancel(); return; }
            const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
            if (!gesture.pulling) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) <= deadZone) return;
                if (dy <= deadZone || dy <= Math.abs(dx) * 1.3) { cancel(); return; }
                gesture.pulling = true;
                ptrIndicator.style.transition = 'none';
            }
            if (dy <= 0 || Math.abs(dx) > dy) { cancel(); return; }
            const visual = Math.min(Math.max(0, dy - deadZone) * 0.4, 90);
            ptrIndicator.style.transform = `translateY(${visual - 60}px)`;
            ptrIcon.style.transform = `rotate(${visual * 4}deg)`;
        }, { passive: true });
        mainScreen.addEventListener('touchend', event => {
            const completed = gesture;
            gesture = null;
            if (!completed?.pulling) return;
            const touch = Array.from(event.changedTouches || []).find(point => point.identifier === completed.id);
            const dy = touch ? touch.clientY - completed.y : 0, dx = touch ? touch.clientX - completed.x : 0;
            if (!touch || event.touches.length || mainScreen.scrollTop > 0 || window.activeView !== completed.view || dy < refreshDistance || dy <= Math.abs(dx) * 1.3) { hideIndicator(); return; }
            refreshing = true;
            ptrIndicator.style.transition = 'transform 0.3s ease-out';
            ptrIndicator.style.transform = 'translateY(15px)';
            ptrIcon.classList.add('animate-spin');
            Promise.resolve().then(() => window.refreshCurrentView(true))
                .catch(error => console.error('Błąd odświeżania gestem:', error))
                .finally(() => { refreshing = false; hideIndicator(); });
        }, { passive: true });
        mainScreen.addEventListener('touchcancel', cancel, { passive: true });
        mainScreen.addEventListener('scroll', () => { if (mainScreen.scrollTop > 0) cancel(); }, { passive: true });
        document.addEventListener('app:view-changed', cancel);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cancel(); });
        window.addEventListener('pagehide', cancel);
    };
})();
document.addEventListener('DOMContentLoaded', window.initPullToRefresh);

// --- SYSTEM SWIPE-TO-DELETE ---
window.setupGlobalSwipe = function() {
    let startX = 0; let startY = 0; let isDragging = false; let horizontalSwipe = false; let activeItem = null; let openItem = null;
    
    const handleStart = (e) => {
        const swipeFront = e.target.closest('.swipe-front, .js-swipe-item');
        if (openItem && openItem !== swipeFront) { openItem.style.transform = 'translateX(0px)'; openItem = null; }
        if (!swipeFront) return;
        if (window.activeView === 'home' && swipeFront.matches('.js-swipe-item')) return;
        activeItem = swipeFront;
        startX = e.touches ? e.touches[0].clientX : e.pageX;
        startY = e.touches ? e.touches[0].clientY : e.pageY;
        isDragging = true;
        horizontalSwipe = false;
    };
    
    const handleMove = (e) => {
        if (!isDragging || !activeItem) return;
        const x = e.touches ? e.touches[0].clientX : e.pageX;
        const y = e.touches ? e.touches[0].clientY : e.pageY;
        const diffX = x - startX;
        const diffY = y - startY;
        if (!horizontalSwipe && Math.abs(diffY) > 8 && Math.abs(diffY) > Math.abs(diffX)) {
            isDragging = false;
            activeItem = null;
            return;
        }
        if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
            horizontalSwipe = true;
            activeItem.style.transition = 'none';
            if (diffX < 0) activeItem.style.transform = `translateX(${Math.max(diffX, -100)}px)`;
        }
    };
    
    const handleEnd = (e) => {
        if (!isDragging || !activeItem) return;
        isDragging = false;
        if (!horizontalSwipe) { activeItem = null; return; }
        activeItem.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        let x = e.changedTouches ? e.changedTouches[0].clientX : e.pageX;
        if (x - startX < -40) { activeItem.style.transform = 'translateX(-64px)'; openItem = activeItem; }
        else { activeItem.style.transform = 'translateX(0px)'; }
        activeItem = null;
        horizontalSwipe = false;
    };
    
    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleEnd, { passive: true }); 
};
document.addEventListener('DOMContentLoaded', window.setupGlobalSwipe);

// --- HAPTIC FEEDBACK ---
window.triggerHaptic = function() {
    if (navigator && navigator.vibrate) navigator.vibrate(30);
};

// --- GENERATOR KOLORÓW AWATARÓW ---
window.getAvatarColor = function(name) {
    if (!name) return 'bg-neutral-600';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash += name.charCodeAt(i);
    }
    const colors = [
        'bg-rose-600', 'bg-blue-600', 'bg-emerald-600', 
        'bg-amber-600', 'bg-purple-600', 'bg-teal-600', 
        'bg-indigo-600', 'bg-pink-600'
    ];
    return colors[hash % colors.length];
};

// --- SYSTEM DYNAMICZNEGO ŁADOWANIA MODALI ---
window.loadAndShowModal = async function(modalId, filePath, onLoadedCallback) {
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error('Błąd pliku HTML');
            
            const html = await response.text();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            document.body.appendChild(wrapper.firstElementChild);
            modal = document.getElementById(modalId);
        } catch (error) {
            console.error("Błąd ładowania modala:", error);
            window.showToast("Błąd ładowania widoku!");
            return;
        }
    }
    
    modal.classList.remove('hidden');
    
    if (typeof onLoadedCallback === 'function') {
        onLoadedCallback();
    }
};

// --- PODPIĘCIE EVENT DISPATCHERA ---
if (window.EventDispatcher) {
    window.EventDispatcher.onClick('.js-global-go-back', () => { if(typeof window.goBack === 'function') window.goBack(); });
    window.EventDispatcher.onClick('.js-confirm-modal-btn', (e, el) => {
        if(typeof window.closeConfirmModal === 'function') window.closeConfirmModal(el.dataset.result === 'true');
    });
}
