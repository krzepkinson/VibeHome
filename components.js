// ==========================================
// MAGAZYN KOMPONENTÓW UI (components.js)
// ==========================================

window.UI = {
    
    // 1. Pusty stan (Empty State)
    renderEmptyState: function(msg, subtext = "Wszystko pod kontrolą") { 
        return `
        <div class="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div class="text-5xl mb-4 opacity-50">✨</div>
            <h3 class="text-neutral-200 font-medium text-sm mb-1">${msg}</h3>
            <p class="text-neutral-500 text-[10px] uppercase tracking-widest">${subtext}</p>
        </div>`; 
    },

    // 2. Kafelek: Zadanie (Todo) na głównym ekranie
    renderDashboardTodo: function(todo) {
        return `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#a8c7fa] shadow-sm animate-fade-in">
            <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('todo')">
                <h3 class="font-medium text-neutral-100 text-sm truncate">${window.esc(todo.title)}</h3>
                <p class="text-[10px] text-neutral-500 mt-0.5">${new Date(todo.created_at).toLocaleDateString('pl-PL')}</p>
            </div>
            <button class="js-dash-complete-todo w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${todo.id}">✓</button>
        </div>`;
    },

    // 3. Kafelek: Czynność domowa (Zaległa)
    renderDashboardHomeTask: function(task) {
        return `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#ffb4ab] shadow-sm animate-fade-in">
            <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                <h3 class="font-medium text-neutral-100 text-sm">${window.esc(task.name)}</h3>
                <p class="text-[10px] text-[#ffb4ab] mt-0.5">Czas na odświeżenie</p>
            </div>
            <button class="js-dash-log-task w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${task.id}">✓</button>
        </div>`;
    }
};
// Dodaj to do obiektu window.UI = { ... }

renderHomeTaskCard: function(item) {
    const status = window.getCompactStatus(item.last?.created_at, item.t.interval_days);
    const roomBadge = currentRoomFilter === 'Wszystkie' ? 
        `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${window.esc(item.t.room || 'Inne')}</span>` : '';

    return `
    <div class="relative overflow-hidden rounded-[16px] mb-1.5 group">
        <div class="absolute inset-0 bg-[#3c1414] flex justify-end items-center px-6">
            <button class="js-delete-task text-[#ffb4ab] flex flex-col items-center gap-1 active:scale-90 transition-transform" data-id="${item.t.id}" data-name="${window.esc(item.t.name)}">
                <span class="text-xl">🗑️</span>
                <span class="text-[8px] font-bold uppercase tracking-tighter">Usuń</span>
            </button>
        </div>

        <div class="js-swipe-item relative flex items-center justify-between p-3 bg-[#1e1f20] border border-[#333537] rounded-[16px] transition-transform duration-200 ease-out cursor-pointer active:bg-[#252627]" 
             data-id="${item.t.id}">
            
            <div class="flex-1 min-w-0 pr-2">
                <h3 class="font-medium text-neutral-100 text-sm flex items-center">
                    ${window.esc(item.t.name)} ${roomBadge}
                </h3>
                <div class="flex items-center gap-3 mt-1">
                    <p class="text-[10px] text-neutral-500 font-medium">
                        ${status.label}
                    </p>
                    <div class="w-1 h-1 rounded-full bg-[#333537]"></div>
                    <p class="text-[10px] ${status.color} font-bold uppercase tracking-tight">
                        ${status.tooltip.replace('.', '')}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
                <button class="js-add-log w-10 h-10 rounded-full bg-[#0f5223]/20 text-[#c4eed0] flex items-center justify-center active:scale-90 text-xl border border-[#0f5223]/50" 
                        data-id="${item.t.id}" data-name="${window.esc(item.t.name)}">
                    +
                </button>
            </div>
        </div>
    </div>`;
}
