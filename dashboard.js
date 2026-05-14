// ==========================================
// LOGIKA: PRZEGLĄD BENTO BOX (dashboard.js)
// ==========================================

window.DashboardModule = (() => {

    window.dashboardCacheTime = 0;

    window.invalidateDashboardCache = function() { 
        window.dashboardCacheTime = 0; 
    };

    window.loadDashboardOverview = async function(forceRefresh = false) {
        const now = Date.now();
        if (forceRefresh || (now - window.dashboardCacheTime > window.CONFIG.CACHE_TTL)) {
            
            document.getElementById('widget-home-content').innerHTML = `<p class="text-neutral-500 text-xs text-center py-4 animate-pulse">Ładowanie...</p>`;
            document.getElementById('widget-health-content').innerHTML = `<p class="text-neutral-500 text-xs text-center py-4 animate-pulse">Ładowanie...</p>`;
            document.getElementById('widget-todo-content').innerHTML = `<p class="text-neutral-500 text-xs text-center py-4 animate-pulse">Ładowanie...</p>`;
            
            const hid = window.currentUser.household_id; 
            
            try {
                const [tasksRes, logsRes, hTasksRes, hLogsRes, todoRes, profilesRes, roomsRes, listsRes] = await Promise.all([
                    window.supabaseClient.from('tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                    window.supabaseClient.from('activity_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(200),
                    window.supabaseClient.from('health_tasks').select('*').eq('household_id', hid).eq('is_archived', false),
                    window.supabaseClient.from('health_logs').select('*').eq('household_id', hid).order('start_date', { ascending: false }).limit(200),
                    window.supabaseClient.from('todos').select('*').eq('household_id', hid).eq('is_archived', false).order('created_at', { ascending: false }).limit(100),
                    window.supabaseClient.from('profiles').select('*').eq('household_id', hid),
                    window.supabaseClient.from('rooms').select('*').eq('household_id', hid).order('name'),
                    window.supabaseClient.from('checklists').select('*').eq('household_id', hid).eq('is_archived', false)
                ]);

                window.AppStore.set({
                    tasks: tasksRes.data || [],
                    logs: logsRes.data || [],
                    hTasks: hTasksRes.data || [],
                    hLogs: hLogsRes.data || [],
                    todos: todoRes.data || [],
                    profiles: profilesRes.data || [],
                    rooms: roomsRes.data || [],
                    checklists: listsRes.data || []
                });
                
                window.dashboardCacheTime = now;
            } catch (err) {
                console.error("Dashboard fetch error:", err);
                window.showToast("Błąd synchronizacji");
            }
        }
        window.renderDashboardUI();
    };

    window.renderDashboardUI = function() {
        const state = window.AppStore.get();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayStr = window.getTodayLocalString(today);

        const greetingEl = document.getElementById('dashboard-greeting');
        if (greetingEl && window.currentUser && window.currentUser.name) {
            greetingEl.innerText = `Dzień dobry, ${window.currentUser.name}!`;
        }

        _renderTodaySection(state, todayStr);
        _renderHomeWidget(state, today);
        _renderHealthWidget(state, today);
        _renderTodoWidget(state);
        _renderHorizonSection(state, today);
        
        const overlay = document.getElementById('dashboard-history-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            _renderHistoryOverlay(state);
        }
    };

    // --- RENDEROWANIE: ZADANIA NA DZIŚ ---
    function _renderTodaySection(state, todayStr) {
        const todayContainer = document.getElementById('dashboard-today-container');
        if (!todayContainer) return;

        const healthToday = state.hTasks.filter(ht => {
            if (ht.task_type === 'one_time' && ht.event_date === todayStr) {
                const isDone = state.hLogs.some(l => l.health_task_id === ht.id);
                return !isDone;
            }
            if (ht.task_type === 'cyclical' && ht.interval_days) {
                const taskLogs = state.hLogs.filter(l => l.health_task_id === ht.id);
                if (taskLogs.length === 0) return false;
                const lastLog = taskLogs[0];
                const nextDate = new Date(lastLog.start_date);
                nextDate.setDate(nextDate.getDate() + ht.interval_days);
                return window.getTodayLocalString(nextDate) === todayStr;
            }
            return false;
        });

        const homeToday = state.tasks.filter(t => {
            if (!t.interval_days) return false;
            const taskLogs = state.logs.filter(l => l.task_id === t.id);
            if (taskLogs.length === 0) return false;
            const lastLog = taskLogs[0];
            const nextDate = new Date(lastLog.created_at);
            nextDate.setDate(nextDate.getDate() + t.interval_days);
            return window.getTodayLocalString(nextDate) === todayStr;
        });

        if (healthToday.length > 0 || homeToday.length > 0) {
            let html = `
                <h3 class="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3 px-1">Plan na dziś</h3>
                <div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            `;
            
            // ZMIANA: Kompaktowe, pionowe kafelki dla zdrowia z zawijaniem tekstu (line-clamp)
            html += healthToday.map(ht => {
                const icon = ht.task_type === 'cyclical' ? '❤️' : '📅';
                return `
                <div class="js-quick-log-health flex flex-col justify-between w-[115px] h-[90px] p-3 bg-[#004a77]/20 border border-[#004a77]/40 rounded-[16px] shadow-sm shrink-0 cursor-pointer active:scale-95 transition-transform" data-id="${ht.id}">
                    <div class="text-[12px] font-bold text-[#c2e7ff] leading-tight line-clamp-2">${window.esc(ht.name)}</div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-[10px] text-[#a8c7fa]/80 uppercase font-medium">Dziś</span>
                        <span class="text-xs opacity-80">${icon}</span>
                    </div>
                </div>`;
            }).join('');

            // ZMIANA: Kompaktowe, pionowe kafelki dla domu z zawijaniem tekstu (line-clamp)
            html += homeToday.map(t => {
                let roomIcon = '🏠';
                if (t.room && state.rooms) {
                    const roomObj = state.rooms.find(r => r.name === t.room);
                    if (roomObj && roomObj.icon) roomIcon = roomObj.icon;
                }

                return `
                <div class="js-dash-log-task flex flex-col justify-between w-[115px] h-[90px] p-3 bg-[#1e1f20] border border-[#333537] rounded-[16px] shadow-sm shrink-0 cursor-pointer active:scale-95 transition-transform" data-id="${t.id}">
                    <div class="text-[12px] font-bold text-neutral-200 leading-tight line-clamp-2">${window.esc(t.name)}</div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-[10px] text-neutral-500 uppercase font-medium">Dziś</span>
                        <span class="text-xs opacity-80">${window.esc(roomIcon)}</span>
                    </div>
                </div>`;
            }).join('');

            html += `</div>`;
            todayContainer.innerHTML = html;
            todayContainer.classList.remove('hidden');
        } else {
            todayContainer.classList.add('hidden');
        }
    }

    // --- RENDEROWANIE: WIDGET DOMU (Zaległe + Wkrótce) ---
    function _renderHomeWidget(state, today) {
        let overdueHome = [];
        let upcomingHome = [];

        state.tasks.forEach(t => {
            const taskLogs = state.logs.filter(l => l.task_id === t.id);
            
            if (!t.interval_days || t.interval_days === 0) {
                if (taskLogs.length === 0) overdueHome.push(t);
                return;
            }
            
            if (taskLogs.length === 0) {
                overdueHome.push(t); 
                return;
            }
            
            const lastLog = taskLogs[0];
            const nextDate = new Date(lastLog.created_at);
            nextDate.setDate(nextDate.getDate() + t.interval_days);
            nextDate.setHours(0,0,0,0);
            
            const diff = Math.ceil((nextDate - today) / 86400000);
            if (diff < 0) overdueHome.push(t);
            else if (diff >= 0 && diff <= 3) upcomingHome.push({ task: t, days: diff });
        });

        const badgesContainer = document.getElementById('widget-home-badges');
        const content = document.getElementById('widget-home-content');
        
        let badgesHtml = '';
        if (overdueHome.length > 0) badgesHtml += `<span class="px-2 py-1 bg-[#3c1414] text-[#ffb4ab] border border-[#8c1d18]/40 rounded-lg text-[9px] font-bold uppercase tracking-wider">${overdueHome.length} zaległe</span>`;
        if (upcomingHome.length > 0) badgesHtml += `<span class="px-2 py-1 bg-amber-900/30 text-amber-200 border border-amber-700/40 rounded-lg text-[9px] font-bold uppercase tracking-wider">${upcomingHome.length} wkrótce</span>`;
        
        badgesContainer.innerHTML = badgesHtml;

        if (overdueHome.length > 0 || upcomingHome.length > 0) {
            let html = '';
            
            if (overdueHome.length > 0) {
                html += `<h4 class="text-[9px] text-[#ffb4ab] uppercase tracking-widest font-bold px-2 py-1.5 opacity-80">Zaległe</h4>`;
                html += overdueHome.map(t => _renderHomeRow(t, 'Zaległe', 'text-[#ffb4ab]')).join('');
            }
            
            if (upcomingHome.length > 0) {
                if(overdueHome.length > 0) html += `<div class="h-px bg-[#333537]/50 mx-2 my-2"></div>`;
                html += `<h4 class="text-[9px] text-amber-200 uppercase tracking-widest font-bold px-2 py-1.5 opacity-80">W najbliższych dniach</h4>`;
                html += upcomingHome.sort((a,b)=> a.days - b.days).map(item => {
                    let label = item.days === 0 ? 'Dzisiaj' : (item.days === 1 ? 'Jutro' : `Za ${item.days} dni`);
                    return _renderHomeRow(item.task, label, 'text-amber-200');
                }).join('');
            }
            content.innerHTML = html;
            // Usunięto: Zawsze domyślnie schowane akordeony (zgodnie z prośbą)
        } else {
            content.innerHTML = `<div class="p-4 flex flex-col items-center justify-center text-center">
                <span class="text-3xl opacity-50 mb-2">✨</span>
                <p class="text-sm font-medium text-[#c4eed0]">Wszystko lśni!</p>
                <p class="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Brak zadań na najbliższe dni</p>
            </div>`;
        }
    }

    function _renderHomeRow(t, subtitle, subtitleColor) {
        return `
        <div class="flex items-center justify-between p-2 hover:bg-[#1e1f20] rounded-xl transition-colors group mb-1">
            <div class="flex-1 min-w-0 pr-3 cursor-pointer js-dash-nav" data-view="home">
                <h3 class="text-sm font-medium text-neutral-200 truncate">${window.esc(t.name)}</h3>
                <p class="text-[10px] ${subtitleColor} font-medium mt-0.5">${subtitle} <span class="text-neutral-500 font-normal">• ${window.esc(t.room || 'Dom')}</span></p>
            </div>
            <button class="js-dash-log-task w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${t.id}">✓</button>
        </div>`;
    }

    // --- RENDEROWANIE: WIDGET ZDROWIA ---
    function _renderHealthWidget(state, today) {
        const badgesContainer = document.getElementById('widget-health-badges');
        const content = document.getElementById('widget-health-content');

        let activeHealth = [];
        const durationTasks = state.hTasks.filter(t => t.task_type === 'duration');
        durationTasks.forEach(t => {
            const activeLog = state.hLogs.find(l => l.health_task_id === t.id && l.end_date === null);
            if (activeLog) activeHealth.push({ task: t, log: activeLog });
        });

        let upcomingRoutines = [];
        const cyclicalTasks = state.hTasks.filter(t => t.task_type === 'cyclical');
        cyclicalTasks.forEach(t => {
            if (!t.interval_days) return;
            const taskLogs = state.hLogs.filter(l => l.health_task_id === t.id);
            if (taskLogs.length === 0) return;
            
            const lastLog = taskLogs[0];
            const nextDate = new Date(lastLog.start_date);
            nextDate.setDate(nextDate.getDate() + t.interval_days);
            nextDate.setHours(0,0,0,0);
            
            const diff = Math.ceil((nextDate - today) / 86400000);
            if (diff <= 3) upcomingRoutines.push({ task: t, days: diff });
        });

        let overdueEvents = [];
        const eventTasks = state.hTasks.filter(t => t.task_type === 'one_time');
        eventTasks.forEach(t => {
            if (!t.event_date) return;
            const isDone = state.hLogs.some(l => l.health_task_id === t.id);
            if (isDone) return;
            const evDate = new Date(t.event_date); evDate.setHours(0,0,0,0);
            const diff = Math.ceil((evDate - today) / 86400000);
            if (diff < 0) overdueEvents.push({ task: t, days: diff });
        });

        let badgesHtml = '';
        if (activeHealth.length > 0) badgesHtml += `<span class="px-2 py-1 bg-rose-900/50 text-[#ffb4ab] border border-rose-800/60 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] animate-pulse"></span> ${activeHealth.length} Aktywne</span>`;
        if (overdueEvents.length > 0) badgesHtml += `<span class="px-2 py-1 bg-[#3c1414] text-[#ffb4ab] border border-[#8c1d18]/40 rounded-lg text-[9px] font-bold uppercase tracking-wider">${overdueEvents.length} Zaległe</span>`;
        if (upcomingRoutines.length > 0) badgesHtml += `<span class="px-2 py-1 bg-[#1e1f20] text-neutral-300 border border-[#333537] rounded-lg text-[9px] font-bold uppercase tracking-wider">${upcomingRoutines.length} Rutyny</span>`;
        
        badgesContainer.innerHTML = badgesHtml;

        if (activeHealth.length > 0 || upcomingRoutines.length > 0 || overdueEvents.length > 0) {
            let html = '';
            
            if (activeHealth.length > 0) {
                html += `<h4 class="text-[9px] text-rose-300 uppercase tracking-widest font-bold px-2 py-1.5 opacity-80 flex items-center gap-1"><span class="animate-pulse">🔴</span> Trwające sytuacje</h4>`;
                html += activeHealth.map(item => {
                    const profile = state.profiles.find(p => p.id === item.task.profile_id);
                    const start = new Date(item.log.start_date); start.setHours(0,0,0,0);
                    const diff = Math.floor((today - start) / 86400000);
                    const label = diff === 0 ? 'Zaczęło się dziś' : `Trwa od ${diff} dni`;
                    
                    return `
                    <div class="flex items-center justify-between p-3 bg-rose-900/10 border border-rose-900/30 rounded-xl mb-1.5">
                        <div class="flex-1 min-w-0 pr-3 js-dash-nav cursor-pointer" data-view="health">
                            <h3 class="text-sm font-medium text-rose-200 truncate">🤒 ${window.esc(item.task.name)}</h3>
                            <p class="text-[10px] text-rose-400/80 mt-0.5">${label} <span class="text-rose-400/50">• ${profile ? profile.name : ''}</span></p>
                        </div>
                        <button class="js-close-health-log w-8 h-8 rounded-full bg-rose-900/40 text-rose-200 flex items-center justify-center active:scale-90 border border-rose-800/60 shadow-inner shrink-0" data-id="${item.log.id}">■</button>
                    </div>`;
                }).join('');
            }

            if (overdueEvents.length > 0) {
                if(activeHealth.length > 0) html += `<div class="h-px bg-[#333537]/50 mx-2 my-2"></div>`;
                html += `<h4 class="text-[9px] text-[#ffb4ab] uppercase tracking-widest font-bold px-2 py-1.5 opacity-80">Przegapione wizyty</h4>`;
                html += overdueEvents.sort((a,b)=> a.days - b.days).map(item => {
                    const profile = state.profiles.find(p => p.id === item.task.profile_id);
                    let label = `Zaległe (${Math.abs(item.days)} dni temu)`;
                    
                    return `
                    <div class="flex items-center justify-between p-2 hover:bg-[#1e1f20] rounded-xl transition-colors group mb-1">
                        <div class="flex-1 min-w-0 pr-3 cursor-pointer js-dash-nav" data-view="health">
                            <h3 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.task.name)}</h3>
                            <p class="text-[10px] text-[#ffb4ab] font-medium mt-0.5">${label} <span class="text-neutral-500 font-normal">• ${profile ? profile.name : ''}</span></p>
                        </div>
                        <button class="js-quick-log-health w-8 h-8 rounded-full bg-[#0f5223]/20 border border-[#0f5223]/50 text-[#c4eed0] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${item.task.id}">✓</button>
                    </div>`;
                }).join('');
            }

            if (upcomingRoutines.length > 0) {
                if(activeHealth.length > 0 || overdueEvents.length > 0) html += `<div class="h-px bg-[#333537]/50 mx-2 my-2"></div>`;
                html += `<h4 class="text-[9px] text-[#c2e7ff] uppercase tracking-widest font-bold px-2 py-1.5 opacity-80">Zbliżające się rutyny</h4>`;
                html += upcomingRoutines.sort((a,b)=> a.days - b.days).map(item => {
                    const profile = state.profiles.find(p => p.id === item.task.profile_id);
                    let label = item.days < 0 ? `Zaległe (${Math.abs(item.days)}d)` : item.days === 0 ? 'Dzisiaj' : (item.days === 1 ? 'Jutro' : `Za ${item.days} dni`);
                    let labelColor = item.days < 0 ? 'text-[#ffb4ab]' : (item.days === 0 ? 'text-amber-200' : 'text-[#a8c7fa]');
                    
                    return `
                    <div class="flex items-center justify-between p-2 hover:bg-[#1e1f20] rounded-xl transition-colors group mb-1">
                        <div class="flex-1 min-w-0 pr-3 cursor-pointer js-dash-nav" data-view="health">
                            <h3 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.task.name)}</h3>
                            <p class="text-[10px] ${labelColor} font-medium mt-0.5">${label} <span class="text-neutral-500 font-normal">• ${profile ? profile.name : ''}</span></p>
                        </div>
                        <button class="js-quick-log-health w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${item.task.id}">✓</button>
                    </div>`;
                }).join('');
            }
            content.innerHTML = html;
            // Usunięto: Zawsze domyślnie schowane akordeony
        } else {
            content.innerHTML = `<div class="p-4 flex flex-col items-center justify-center text-center">
                <span class="text-3xl opacity-50 mb-2">🌿</span>
                <p class="text-sm font-medium text-neutral-300">Wszyscy zdrowi</p>
                <p class="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Brak aktywnych zdarzeń</p>
            </div>`;
        }
    }

    // --- RENDEROWANIE: WIDGET ZADAŃ ---
    function _renderTodoWidget(state) {
        const activeTodos = state.todos.filter(t => !t.is_completed);
        const badge = document.getElementById('widget-todo-badge');
        const content = document.getElementById('widget-todo-content');
        
        if (activeTodos.length > 0) {
            const toShow = activeTodos.slice(0, 5);
            badge.innerText = `${activeTodos.length} otwartych`;
            badge.classList.remove('hidden');
            
            let html = toShow.map(todo => `
                <div class="flex items-center justify-between p-2 hover:bg-[#1e1f20] rounded-xl transition-colors mb-1">
                    <div class="flex-1 min-w-0 pr-3 cursor-pointer js-dash-nav" data-view="todo">
                        <h3 class="text-sm font-medium text-neutral-200 truncate">${window.esc(todo.title)}</h3>
                    </div>
                    <button class="js-dash-complete-todo w-8 h-8 rounded-full bg-[#004a77]/20 border border-[#004a77]/50 text-[#a8c7fa] flex items-center justify-center active:scale-90 text-base font-bold shrink-0" data-id="${todo.id}">✓</button>
                </div>
            `).join('');
            
            if (activeTodos.length > 5) {
                html += `<div class="text-[10px] text-neutral-500 text-center mt-2 cursor-pointer hover:text-[#a8c7fa] py-2 js-dash-nav" data-view="todo">+${activeTodos.length - 5} więcej w module</div>`;
            }
            content.innerHTML = html;
            // Usunięto: Zawsze domyślnie schowane akordeony
        } else {
            badge.classList.add('hidden');
            content.innerHTML = `<div class="p-4 flex flex-col items-center justify-center text-center">
                <span class="text-3xl opacity-50 mb-2">🎉</span>
                <p class="text-sm font-medium text-neutral-300">Lista czysta!</p>
                <p class="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Czas na relaks</p>
            </div>`;
        }
    }

    // --- RENDEROWANIE: NA HORYZONCIE ---
    function _renderHorizonSection(state, today) {
        const container = document.getElementById('dashboard-horizon-container');
        if (!container) return;

        let horizonItems = [];

        state.hTasks.forEach(ht => {
            if (ht.task_type !== 'one_time' || !ht.event_date) return;
            const isDone = state.hLogs.some(l => l.health_task_id === ht.id);
            if (isDone) return;
            const evDate = new Date(ht.event_date); evDate.setHours(0, 0, 0, 0);
            if (evDate > today) {
                horizonItems.push({
                    type: 'health', date: evDate, id: ht.id, name: ht.name, profile_id: ht.profile_id
                });
            }
        });

        if (state.checklists) {
            state.checklists.forEach(list => {
                if (list.list_type === 'packing' && list.start_date) {
                    const stDate = new Date(list.start_date); stDate.setHours(0, 0, 0, 0);
                    if (stDate > today) {
                        horizonItems.push({
                            type: 'trip', date: stDate, endDate: list.end_date ? new Date(list.end_date) : null,
                            id: list.id, title: list.title
                        });
                    }
                }
            });
        }

        horizonItems.sort((a, b) => a.date - b.date);

        if (horizonItems.length > 0) {
            let html = `<h3 class="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3 px-1">Na horyzoncie</h3>`;
            html += horizonItems.map(item => {
                const daysUntil = Math.ceil((item.date - today) / 86400000);
                const urgencyLabel = daysUntil === 1 ? 'Jutro!' : `Za ${daysUntil} dni`;
                const colorClass = daysUntil <= 3 ? 'text-amber-400' : 'text-[#a8c7fa]';
                
                if (item.type === 'health') {
                    const profile = state.profiles.find(p => p.id === item.profile_id);
                    return `
                    <div class="flex items-center justify-between px-4 py-3 bg-[#1e1f20] rounded-[16px] border border-[#333537] mb-1.5 shadow-sm js-dash-nav cursor-pointer active:scale-95 transition-transform" data-view="health">
                        <div class="flex gap-4 items-center">
                            <div class="text-2xl opacity-80">🗓️</div>
                            <div>
                                <h4 class="text-sm font-medium text-neutral-200">${window.esc(item.name)}</h4>
                                <p class="text-[10px] text-neutral-500 mt-0.5">
                                    <span class="font-bold ${colorClass}">${urgencyLabel}</span> • ${profile ? profile.name : 'Zdrowie'}
                                </p>
                            </div>
                        </div>
                    </div>`;
                } else if (item.type === 'trip') {
                    let dateLabel = item.date.toLocaleDateString('pl-PL', {day: '2-digit', month: '2-digit'});
                    if (item.endDate) {
                        dateLabel += ' - ' + item.endDate.toLocaleDateString('pl-PL', {day: '2-digit', month: '2-digit'});
                    }

                    return `
                    <div class="js-open-packing-list flex items-center justify-between px-4 py-3 bg-[#0f2334] rounded-[16px] border border-[#004a77]/50 mb-1.5 shadow-sm cursor-pointer active:scale-95 transition-transform" data-id="${item.id}" data-title="${window.esc(item.title)}">
                        <div class="flex gap-4 items-center">
                            <div class="text-2xl opacity-80">🧳</div>
                            <div>
                                <h4 class="text-sm font-medium text-[#c2e7ff]">${window.esc(item.title)}</h4>
                                <p class="text-[10px] text-[#a8c7fa]/70 mt-0.5">
                                    <span class="font-bold text-[#c2e7ff]">${urgencyLabel}</span> • ${dateLabel}
                                </p>
                            </div>
                        </div>
                    </div>`;
                }
            }).join('');
            container.innerHTML = html;
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    // --- RENDEROWANIE: HISTORIA OVERLAY ---
    function _renderHistoryOverlay(state) {
        const listEl = document.getElementById('dashboard-history-list');
        if (!listEl) return;

        let historyItems = [];
        state.logs.forEach(l => { const t = state.tasks.find(x => x.id === l.task_id); if (!t || t.show_in_history !== false) historyItems.push({ table: 'activity_logs', id: l.id, title: l.activity_name, date: new Date(l.created_at), icon: '🏠', bg: 'bg-[#0f5223]/20', border: 'border-[#0f5223]/50', user: l.user_name || '?' }); });
        state.hLogs.forEach(l => { const ht = state.hTasks.find(x => x.id === l.health_task_id); if (!ht || ht.show_in_history !== false) { const profile = state.profiles.find(p => p.id === ht?.profile_id); const title = (ht ? ht.name : 'Zdarzenie') + (profile ? ` (${profile.name})` : ''); historyItems.push({ table: 'health_logs', id: l.id, title, date: l.end_date ? new Date(l.end_date) : new Date(l.start_date), icon: '❤️', bg: 'bg-[#8c1d18]/20', border: 'border-[#8c1d18]/50', user: l.user_name || '?' }); } });
        state.todos.filter(t => t.is_completed).forEach(t => { historyItems.push({ table: 'todos', id: t.id, title: t.title, date: t.completed_at ? new Date(t.completed_at) : new Date(t.created_at), icon: '📝', bg: 'bg-[#004a77]/20', border: 'border-[#004a77]/50', user: t.completer_name || '?' }); });
        
        historyItems.sort((a, b) => b.date - a.date);
        
        if (historyItems.length === 0) {
            listEl.innerHTML = window.UI.renderEmptyState("Brak historii", "Nic się jeszcze nie wydarzyło");
            return;
        }

        listEl.innerHTML = `<div class="relative border-l-2 border-[#333537] ml-3 mt-2 mb-6 space-y-4">` + historyItems.slice(0, 50).map(item => {
            const initial = (item.user || '?')[0].toUpperCase();
            return `
            <div class="relative pl-5 animate-fade-in">
                <div class="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full ${item.bg} ${item.border} border flex items-center justify-center text-xs shadow-md">${item.icon}</div>
                <div class="bg-[#1e1f20] px-3 py-2 rounded-[12px] border border-[#333537] shadow-sm flex justify-between items-center">
                    <div class="flex-1 min-w-0 pr-2">
                        <h4 class="text-sm font-medium text-neutral-200 truncate">${window.esc(item.title)}</h4>
                        <p class="text-[10px] text-neutral-500 mt-0.5">${item.date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <div class="js-dash-change-user w-6 h-6 rounded-full bg-[#333537] border border-[#444746] text-neutral-300 text-[10px] flex items-center justify-center font-bold cursor-pointer active:scale-90 transition-transform" data-table="${item.table}" data-id="${item.id}" data-username="${window.esc(item.user)}">${initial}</div>
                        <button class="js-dash-undo-log text-neutral-500 hover:text-[#ffb4ab] p-1.5 active:scale-90 transition-transform text-xs" data-table="${item.table}" data-id="${item.id}" title="Cofnij">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('') + `</div>`;
    }

    // ==========================================
    // NIEŚMIERTELNY KOSZYK (SZYBKIE ZAKUPY)
    // ==========================================
    window.openQuickShoppingList = async function() {
        const state = window.AppStore.get();
        let shoppingList = (state.checklists || []).find(l => l.list_type === 'shopping' && !l.is_archived);

        if (shoppingList) {
            window.switchView('todo');
            setTimeout(() => window.openChecklistScreen(shoppingList.id, shoppingList.title, 'shopping'), 50);
        } else {
            window.showToast("Tworzę nowy koszyk...");
            const hid = window.currentUser.household_id;
            const uid = window.currentUser.user_id;
            
            const { data, error } = await window.supabaseClient.from('checklists').insert([{
                title: 'Zakupy',
                list_type: 'shopping',
                household_id: hid,
                user_id: uid,
                is_archived: false
            }]).select().single();

            if (error) {
                window.showToast("Błąd koszyka: " + error.message);
                return;
            }

            window.AppStore.set({
                checklists: [...(state.checklists || []), data]
            });

            window.switchView('todo');
            setTimeout(() => window.openChecklistScreen(data.id, data.title, 'shopping'), 50);
        }
    };

    window.toggleWidgetAccordion = function(targetId, chevronEl) {
        const content = document.getElementById(targetId);
        if (!content) return;
        
        const isHidden = content.classList.contains('hidden');
        
        if (isHidden) {
            content.classList.remove('hidden');
            if (chevronEl) chevronEl.style.transform = 'rotate(180deg)';
        } else {
            content.classList.add('hidden');
            if (chevronEl) chevronEl.style.transform = 'rotate(0deg)';
        }
    };

    window.quickLogTaskDashboard = async function(taskId) {
        window.customConfirm("Odhaczyć jako zrobione?", async () => {
            if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
            const finalTaskId = isNaN(taskId) ? taskId : Number(taskId);
            const state = window.AppStore.get();
            const task = state.tasks.find(t => t.id == finalTaskId);
            const now = new Date();

            const { error } = await window.supabaseClient.from('activity_logs').insert([{ 
                task_id: finalTaskId, activity_name: task ? task.name : 'Zadanie', created_at: now.toISOString(), 
                user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
            }]);

            if (error) { window.showToast("Błąd bazy: " + error.message); return; }

            if (task && task.interval_days > 0) {
                const nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + task.interval_days);
                await window.supabaseClient.from('tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalTaskId);
            } else if (task) {
                await window.supabaseClient.from('tasks').update({ is_archived: true }).eq('id', finalTaskId);
            }
            window.showToast('Zapisano! ✔️'); window.invalidateDashboardCache(); window.loadDashboardOverview(true); 
        });
    };

    window.quickCompleteTodoDashboard = async function(id) {
        const finalId = isNaN(id) ? id : Number(id);
        const { error } = await window.supabaseClient.from('todos').update({ is_completed: true, completed_at: new Date().toISOString(), completer_name: window.currentUser.name }).eq('id', finalId);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.invalidateDashboardCache(); window.loadDashboardOverview(true);
    };

    window.quickLogHealthDashboard = async function(taskId) {
        window.customConfirm("Odhaczyć to zdarzenie?", async () => {
            const finalId = isNaN(taskId) ? taskId : Number(taskId);
            const state = window.AppStore.get();
            const task = state.hTasks.find(t => t.id == finalId);
            const now = new Date();

            const { error } = await window.supabaseClient.from('health_logs').insert([{ 
                health_task_id: finalId, start_date: now.toISOString(), end_date: now.toISOString(), 
                user_id: window.currentUser.user_id, household_id: window.currentUser.household_id, user_name: window.currentUser.name 
            }]);
            
            if (error) { window.showToast("Błąd: " + error.message); return; }

            if (task && task.interval_days > 0) {
                const nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + task.interval_days);
                await window.supabaseClient.from('health_tasks').update({ next_due_at: nextDate.toISOString() }).eq('id', finalId);
            }
            window.showToast('Zapisano! ❤️'); window.invalidateDashboardCache(); window.loadDashboardOverview(true);
        });
    };

    window.closeHealthLogDashboard = async function(logId) {
        if (typeof window.triggerHaptic === 'function') window.triggerHaptic();
        const { error } = await window.supabaseClient.from('health_logs').update({ end_date: new Date().toISOString() }).eq('id', logId).eq('household_id', window.currentUser.household_id);
        if (error) { window.showToast("Błąd: " + error.message); return; }
        window.showToast("Zakończono sytuację!"); 
        window.invalidateDashboardCache(); 
        window.loadDashboardOverview(true);
    };

    window.undoActionDashboard = function(table, id) {
        window.customConfirm("Cofnąć to wykonanie?", async () => {
            let errorObj = null;
            if (table === 'todos') {
                const { error } = await window.supabaseClient.from('todos').update({ is_completed: false, completed_at: null, completer_name: null }).eq('id', id);
                errorObj = error;
            } else {
                const { error } = await window.supabaseClient.from(table).delete().eq('id', id);
                errorObj = error;
            }

            if (errorObj) { 
                window.showToast("Błąd: " + errorObj.message); 
            } else {
                window.showToast("Cofnięto!");
                window.invalidateDashboardCache();
                window.loadDashboardOverview(true);
                document.getElementById('dashboard-history-overlay').classList.add('hidden');
            }
        });
    };

    // ==========================================
    // DELEGACJA ZDARZEŃ (VIA DISPATCHER)
    // ==========================================
    if (window.EventDispatcher) {
        
        window.EventDispatcher.onClick('.js-toggle-widget', (e, el) => {
            const chevron = el.querySelector('.js-chevron');
            window.toggleWidgetAccordion(el.dataset.target, chevron);
        });

        window.EventDispatcher.onClick('.js-open-packing-list', (e, el) => {
            window.switchView('todo');
            setTimeout(() => window.openChecklistScreen(el.dataset.id, el.dataset.title, 'packing'), 50);
        });

        window.EventDispatcher.onClick('.js-open-cart', () => window.openQuickShoppingList());
        
        window.EventDispatcher.onClick('.js-open-history', () => {
            document.getElementById('dashboard-history-overlay').classList.remove('hidden');
            _renderHistoryOverlay(window.AppStore.get());
        });
        
        window.EventDispatcher.onClick('.js-close-history', () => document.getElementById('dashboard-history-overlay').classList.add('hidden'));

        window.EventDispatcher.onClick('.js-dashboard-refresh', () => {
            window.invalidateDashboardCache();
            window.loadDashboardOverview(true);
        });

        window.EventDispatcher.onClick('.js-dash-nav', (e, el) => window.switchView(el.dataset.view));
        window.EventDispatcher.onClick('.js-dash-complete-todo', (e, el) => window.quickCompleteTodoDashboard(el.dataset.id));
        window.EventDispatcher.onClick('.js-dash-undo-log', (e, el) => window.undoActionDashboard(el.dataset.table, el.dataset.id));
        window.EventDispatcher.onClick('.js-dash-log-task', (e, el) => window.quickLogTaskDashboard(el.dataset.id));
        window.EventDispatcher.onClick('.js-quick-log-health', (e, el) => window.quickLogHealthDashboard(el.dataset.id));
        window.EventDispatcher.onClick('.js-close-health-log', (e, el) => window.closeHealthLogDashboard(el.dataset.id));
        window.EventDispatcher.onClick('.js-dash-change-user', (e, el) => window.openChangeUserModal(el.dataset.table, el.dataset.id, el.dataset.username));
        
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return { load: window.loadDashboardOverview };
})();
