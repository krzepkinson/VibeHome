// ==========================================
// MAGAZYN KOMPONENTÓW UI (components.js)
// ==========================================

window.UI = {
    
    // --- 1. KOMPONENTY OGÓLNE ---
    renderEmptyState: function(msg, subtext = "Wszystko pod kontrolą") { 
        return `
        <div class="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div class="text-5xl mb-4 opacity-50">✨</div>
            <h3 class="text-neutral-200 font-medium text-sm mb-1">${msg}</h3>
            <p class="text-neutral-500 text-[10px] uppercase tracking-widest">${subtext}</p>
        </div>`; 
    },

    // --- 2. KOMPONENTY: DOM I PRZEGLĄD ---
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

    renderDashboardHomeTask: function(task) {
        return `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1e1f20] rounded-[12px] border border-[#333537] mb-1 border-l-4 border-l-[#ffb4ab] shadow-sm animate-fade-in">
            <div class="flex-1 cursor-pointer pr-2" onclick="window.switchView('home')">
                <h3 class="font-medium text-neutral-100 text-sm">${window.esc(task.name)}</h3>
                <p class="text-[10px] text-[#ffb4ab] mt-0.5">Czas na odświeżenie</p>
            </div>
            <button class="js-dash-log-task w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${task.id}">✓</button>
        </div>`;
    },

    renderHomeTaskCard: function(item) {
        const status = window.getCompactStatus(item.last?.created_at, item.t.interval_days);
        const roomBadge = (window.HomeModule?.getRoomFilter?.() || window.currentRoomFilter) === 'Wszystkie' ? 
            `<span class="bg-[#004a77]/30 text-[#a8c7fa] px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest ml-2">${window.esc(item.t.room || 'Inne')}</span>` : '';

        return `
        <div class="relative overflow-hidden rounded-[16px] mb-1.5 group">
            <div class="absolute inset-0 bg-[#3c1414] flex justify-end items-center px-6">
                <button class="js-delete-task text-[#ffb4ab] flex flex-col items-center gap-1 active:scale-90 transition-transform" data-id="${item.t.id}" data-name="${window.esc(item.t.name)}">
                    <span class="text-xl">🗑️</span>
                    <span class="text-[8px] font-bold uppercase tracking-tighter">Usuń</span>
                </button>
            </div>
            <div class="js-swipe-item relative flex items-center justify-between p-3 bg-[#1e1f20] border border-[#333537] rounded-[16px] transition-transform duration-200 ease-out cursor-pointer active:bg-[#252627]" data-id="${item.t.id}">
                <div class="flex-1 min-w-0 pr-2">
                    <h3 class="font-medium text-neutral-100 text-sm flex items-center">${window.esc(item.t.name)} ${roomBadge}</h3>
                    <div class="flex items-center gap-3 mt-1">
                        <p class="text-[10px] text-neutral-500 font-medium">${status.label}</p>
                        <div class="w-1 h-1 rounded-full bg-[#333537]"></div>
                        <p class="text-[10px] ${status.color} font-bold uppercase tracking-tight">${status.tooltip.replace('.', '')}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button class="js-add-log w-10 h-10 rounded-full bg-[#0f5223]/20 text-[#c4eed0] flex items-center justify-center active:scale-90 text-xl border border-[#0f5223]/50" data-id="${item.t.id}" data-name="${window.esc(item.t.name)}">+</button>
                </div>
            </div>
        </div>`;
    },

    // --- 3. KOMPONENTY: ZDROWIE ---
    renderHealthActiveTask: function(task, log) {
        return `
        <div class="flex items-center justify-between p-4 bg-rose-900/10 rounded-[20px] border border-rose-900/40 shadow-sm">
            <div class="flex-1">
                <h4 class="text-sm font-medium text-rose-200">${window.esc(task.name)}</h4>
                <p class="text-[10px] text-rose-400/80 mt-0.5">Trwa od: ${new Date(log.start_date).toLocaleDateString('pl-PL')}</p>
            </div>
            <button class="js-close-health-log w-10 h-10 rounded-full bg-rose-900/40 text-rose-200 flex items-center justify-center active:scale-90 border border-rose-800/60 shadow-inner" data-id="${log.id}">■</button>
        </div>`;
    },

    renderHealthUpcomingTask: function(task, label) {
        return `
        <div class="flex items-center justify-between p-4 bg-amber-900/10 rounded-[20px] border border-amber-900/30">
            <div class="flex-1">
                <h4 class="text-sm font-medium text-amber-100">${window.esc(task.name)}</h4>
                <p class="text-[10px] text-amber-500/80 mt-0.5">${new Date(task.event_date).toLocaleDateString('pl-PL')} • ${label}</p>
            </div>
            <button class="js-start-health-log w-10 h-10 rounded-full bg-amber-900/30 text-amber-200 flex items-center justify-center active:scale-90 border border-amber-800/40 shadow-sm" data-id="${task.id}" data-type="one_time">✓</button>
        </div>`;
    },

    renderHealthRoutineTask: function(task, statusHtml) {
        return `
        <div class="flex items-center justify-between p-3.5 bg-[#1e1f20] rounded-[18px] border border-[#333537] mb-1.5 shadow-sm">
            <div class="js-open-health-settings flex-1 pr-2 cursor-pointer" data-id="${task.id}">
                <h4 class="text-sm font-medium text-neutral-100">${window.esc(task.name)}</h4>
                <p class="text-[10px] text-neutral-500 mt-0.5">${statusHtml}</p>
            </div>
            <button class="js-start-health-log w-9 h-9 rounded-full bg-[#3c1414] text-[#ffb4ab] flex items-center justify-center active:scale-90 border border-[#8c1d18]/40 shadow-sm" data-id="${task.id}" data-type="cyclical">+</button>
        </div>`;
    },

    renderHealthDayEvent: function(task, isDone) {
        return `
        <div class="px-3 py-2 bg-[#1e1f20] rounded-xl border border-[#004a77]/30 mb-1.5 flex justify-between items-center">
            <div>
                <p class="text-sm font-medium text-[#c2e7ff]">📅 ${window.esc(task.name)}</p>
                <p class="text-[10px] text-neutral-500 mt-0.5">${isDone ? 'Zrealizowane' : 'Do zrobienia'}</p>
            </div>
        </div>`;
    },

    renderHealthDayLog: function(task, log) {
        return `
        <div class="px-3 py-2 bg-[#131314] rounded-xl border border-[#333537] mb-1.5 flex justify-between items-center">
            <div>
                <p class="text-sm font-medium text-neutral-200">${window.esc(task.name)}</p>
                <p class="text-[10px] text-neutral-500 mt-0.5">${log.end_date ? 'Zdarzenie zakończone' : 'W trakcie...'}</p>
            </div>
        </div>`;
    },

    renderProfileSwitcherItem: function(profile, isCurrent) {
        const activeClass = isCurrent ? 'bg-[#333537] border border-[#a8c7fa]' : '';
        const color = window.getAvatarColor ? window.getAvatarColor(profile.name) : 'bg-neutral-600';
        return `
        <div class="js-select-profile flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-[#333537] ${activeClass}" data-id="${profile.id}">
            <div class="w-8 h-8 rounded-full ${color} text-white shadow-inner flex items-center justify-center text-xs font-bold">${window.esc(profile.name.charAt(0).toUpperCase())}</div>
            <span class="text-sm text-neutral-200">${window.esc(profile.name)}</span>
        </div>`;
    },

    renderPharmacyItem: function(item, statusHtml, borderClass, opacityClass) {
        return `
        <div class="relative overflow-hidden mb-1 rounded-[14px] group ${opacityClass}">
            <div class="absolute inset-0 bg-rose-900/80 flex justify-end items-center pr-4">
                <button class="js-delete-pharmacy-item text-[#ffb4ab] text-lg active:scale-90 transition-transform" data-id="${item.id}">🗑️</button>
            </div>
            <div class="swipe-front relative z-10 flex items-center justify-between p-2.5 bg-[#1e1f20] rounded-[14px] border ${borderClass} w-full transition-transform shadow-sm">
                <div class="flex flex-col flex-1 min-w-0 pr-2">
                    <h3 class="font-medium text-neutral-100 text-sm truncate leading-tight">${window.esc(item.name)}</h3>
                    ${item.purpose ? `<p class="text-[10px] text-neutral-500 truncate leading-tight mt-0.5">${window.esc(item.purpose)}</p>` : ''}
                </div>
                <div class="shrink-0 flex items-center gap-2">
                    ${statusHtml}
                    <button class="js-delete-pharmacy-item hidden md:block opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-[#ffb4ab] px-1 text-sm shrink-0 transition-opacity" data-id="${item.id}">✕</button>
                </div>
            </div>
        </div>`;
    },

    renderHealthHistoryLog: function(log) {
        return `
        <div class="bg-[#131314] px-3 py-2 rounded-[12px] flex justify-between items-center border border-[#333537] mb-1.5">
            <div>
                <p class="text-xs font-medium text-neutral-200">${new Date(log.start_date).toLocaleDateString('pl-PL')}</p>
                <p class="text-[9px] text-neutral-500">${log.end_date ? 'do ' + new Date(log.end_date).toLocaleDateString('pl-PL') : 'trwa'}</p>
            </div>
            <button class="js-delete-health-log text-neutral-500 text-sm active:scale-90 transition-transform" data-id="${log.id}">🗑️</button>
        </div>`;
    },

    renderHealthBookSeparator: function(monthYear) {
        return `
        <div class="relative -left-7 mb-4 mt-6">
            <span class="bg-[#1e1f20] px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-neutral-400 border border-[#333537] shadow-sm">${monthYear}</span>
        </div>`;
    },

    renderHealthBookTimelineItem: function(item) {
        return `
        <div class="relative mb-5 last:mb-0">
            <div class="absolute -left-[22px] top-4 w-2.5 h-2.5 rounded-full ${item.bg.split(' ')[0]} border border-[#333537] shadow-[0_0_8px_rgb(0,0,0,0.5)]"></div>
            <div class="bg-[#1e1f20] rounded-[20px] border ${item.bg} p-3.5 shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-1.5">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-base shrink-0">${item.icon}</span>
                        <h4 class="font-medium text-sm ${item.color} truncate">${window.esc(item.title)}</h4>
                    </div>
                    <span class="text-[9px] text-neutral-500 font-medium shrink-0 pt-0.5">${item.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <p class="text-[11px] text-neutral-400 leading-relaxed ml-7">${item.desc}</p>
            </div>
        </div>`;
    }
};
