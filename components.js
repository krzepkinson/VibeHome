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
