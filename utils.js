// ==========================================
// FUNKCJE POMOCNICZE (utils.js)
// ==========================================

window.esc = function(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

window.getTodayLocalString = function(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
};

window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.remove('opacity-0', '-translate-y-10');
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); }, 3000);
};

window.refreshCurrentView = async function() {
    try {
        const view = window.activeView;
        if (document.getElementById('checklist-screen') && !document.getElementById('checklist-screen').classList.contains('hidden')) {
            if (typeof window.loadChecklistItems === 'function') await window.loadChecklistItems();
        } else if (view === 'dashboard') {
            if (typeof window.loadDashboardOverview === 'function') await window.loadDashboardOverview(true); 
        } else if (view === 'home') {
            if (typeof window.loadDashboard === 'function') await window.loadDashboard();
        } else if (view === 'todo') {
            if (typeof window.loadTodosAndLists === 'function') await window.loadTodosAndLists();
        } else if (view === 'health') {
            if (typeof window.initHealthModule === 'function') await window.initHealthModule();
        }
    } catch(e) { console.error("Błąd odświeżania:", e); }
};

window.customConfirm = function(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    window._confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
};

window.closeConfirmModal = function(result) {
    document.getElementById('confirm-modal').classList.add('hidden');
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
window.initPullToRefresh = function() {
    const mainScreen = document.getElementById('main-screen');
    const ptrIndicator = document.getElementById('ptr-indicator');
    const ptrIcon = document.getElementById('ptr-icon');
    if (!mainScreen || !ptrIndicator) return;
    
    let startY = 0; let currentY = 0; let isPulling = false; const threshold = 70;
    
    mainScreen.addEventListener('touchstart', (e) => {
        if (mainScreen.scrollTop === 0) { startY = e.touches[0].clientY; isPulling = true; ptrIndicator.style.transition = 'none'; }
    }, { passive: true });
    
    mainScreen.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].clientY; const diff = currentY - startY;
        if (diff > 0 && mainScreen.scrollTop === 0) {
            const visual = Math.min(diff * 0.4, threshold + 20);
            ptrIndicator.style.transform = `translateY(${visual - 60}px)`; 
            ptrIcon.style.transform = `rotate(${visual * 4}deg)`;
        }
    }, { passive: true });
    
    mainScreen.addEventListener('touchend', () => {
        if (!isPulling) return; 
        isPulling = false;
        ptrIndicator.style.transition = 'transform 0.3s ease-out';
        
        if (currentY - startY > threshold && mainScreen.scrollTop === 0) {
            ptrIndicator.style.transform = `translateY(15px)`; 
            ptrIcon.classList.add('animate-spin');
            
            Promise.resolve().then(async () => {
                await window.refreshCurrentView();
                ptrIndicator.style.transform = `translateY(-100%)`; 
                ptrIcon.classList.remove('animate-spin');
            });
        } else { 
            ptrIndicator.style.transform = `translateY(-100%)`; 
        }
    }, { passive: true });
};
document.addEventListener('DOMContentLoaded', window.initPullToRefresh);

// --- SYSTEM SWIPE-TO-DELETE ---
window.setupGlobalSwipe = function() {
    let startX = 0; let isDragging = false; let activeItem = null; let openItem = null;
    
    const handleStart = (e) => {
        const swipeFront = e.target.closest('.swipe-front, .js-swipe-item');
        if (openItem && openItem !== swipeFront) { openItem.style.transform = 'translateX(0px)'; openItem = null; }
        if (!swipeFront) return;
        activeItem = swipeFront; startX = e.touches ? e.touches[0].clientX : e.pageX; isDragging = true;
        activeItem.style.transition = 'none';
    };
    
    const handleMove = (e) => {
        if (!isDragging || !activeItem) return;
        let x = e.touches ? e.touches[0].clientX : e.pageX;
        const diff = x - startX;
        if (diff < 0) activeItem.style.transform = `translateX(${Math.max(diff, -100)}px)`;
    };
    
    const handleEnd = (e) => {
        if (!isDragging || !activeItem) return; isDragging = false;
        activeItem.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        let x = e.changedTouches ? e.changedTouches[0].clientX : e.pageX;
        if (x - startX < -40) { activeItem.style.transform = 'translateX(-64px)'; openItem = activeItem; }
        else { activeItem.style.transform = 'translateX(0px)'; }
        activeItem = null;
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
