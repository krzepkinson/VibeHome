// ==========================================
// LOGIKA: STATYSTYKI ZADAŃ (stats.js)
// ==========================================

window.StatsModule = (() => {
    // --- PRYWATNE FUNKCJE POMOCNICZE (Tylko dla statystyk) ---

    function computeTaskStats(task, allLogs) {
        const taskLogs = allLogs
            .filter(l => l.task_id === task.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (taskLogs.length === 0) {
            return {
                task, totalLogs: 0, onTimePct: 0, currentStreak: 0, bestStreak: 0,
                lastDone: null, isCurrentlyOverdue: true 
            };
        }

        let onTime = 0;
        let bestStreak = 0;
        let tempStreak = 0;

        for (let i = 0; i < taskLogs.length; i++) {
            const log = taskLogs[i];
            const prevLog = taskLogs[i - 1];
            let isOnTime = false;

            if (!prevLog) {
                isOnTime = true; // Pierwszy wpis zawsze na czas
            } else {
                // Sprawdzamy terminowość zgodnie z logiką utils.js
                const prevDate = new Date(prevLog.created_at);
                prevDate.setHours(0, 0, 0, 0);
                const nextDueDate = new Date(prevDate);
                nextDueDate.setDate(nextDueDate.getDate() + task.interval_days);
                
                const actualDate = new Date(log.created_at);
                actualDate.setHours(0, 0, 0, 0);
                
                isOnTime = actualDate <= nextDueDate;
            }

            if (isOnTime) {
                onTime++;
                tempStreak++;
                if (tempStreak > bestStreak) bestStreak = tempStreak;
            } else {
                tempStreak = 1;
            }
        }

        // Używamy nowej, uniwersalnej funkcji do sprawdzenia obecnego stanu
        const isCurrentlyOverdue = window.isTaskOverdue(task, taskLogs);
        const currentStreak = isCurrentlyOverdue ? 0 : tempStreak;

        return {
            task,
            totalLogs: taskLogs.length,
            onTimePct: Math.round((onTime / taskLogs.length) * 100),
            currentStreak,
            bestStreak,
            lastDone: taskLogs[taskLogs.length - 1].created_at,
            isCurrentlyOverdue
        };
    }

    function renderTaskStat(s) {
        const { task, totalLogs, onTimePct, currentStreak, bestStreak, lastDone, isCurrentlyOverdue } = s;

        const streakLabel = currentStreak > 0
            ? `<span class="text-[10px] bg-[#0f5223]/30 text-[#c4eed0] px-2 py-0.5 rounded-full border border-[#0f5223]/50 shrink-0">🔥 ${currentStreak}× z rzędu</span>`
            : `<span class="text-[10px] bg-[#3c1414]/40 text-[#ffb4ab] px-2 py-0.5 rounded-full border border-[#8c1d18]/30 shrink-0">streak przerwany</span>`;

        const pctColor = onTimePct >= 80 ? 'bg-[#c4eed0]' : onTimePct >= 50 ? 'bg-neutral-400' : 'bg-[#ffb4ab]';
        const statusLabel = isCurrentlyOverdue 
            ? '<span class="text-[#ffb4ab]">Wymaga zrobienia</span>' 
            : '<span class="text-[#c4eed0]">Na czas</span>';

        const lastLabel = lastDone
            ? new Date(lastDone).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
            : 'nigdy';

        return `
        <div class="bg-[#1e1f20] rounded-[20px] border border-[#333537] p-4 mb-3 shadow-sm animate-fade-in">
            <div class="flex items-start justify-between mb-3 gap-2">
                <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-neutral-100 text-sm truncate">${window.esc(task.name)}</h3>
                    <p class="text-[10px] text-neutral-500 mt-0.5">
                        co ${task.interval_days} dni • ${statusLabel}
                    </p>
                </div>
                ${streakLabel}
            </div>

            <div class="flex items-center gap-2 mb-3">
                <div class="flex-1 h-1.5 bg-[#333537] rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${pctColor} transition-all" style="width:${onTimePct}%"></div>
                </div>
                <span class="text-[10px] text-neutral-400 w-8 text-right shrink-0">${onTimePct}%</span>
            </div>

            <div class="flex gap-4">
                <div class="text-center">
                    <div class="text-sm font-medium text-neutral-200">${totalLogs}</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest">wpisów</div>
                </div>
                <div class="w-px bg-[#333537]"></div>
                <div class="text-center">
                    <div class="text-sm font-medium text-neutral-200">${bestStreak}</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest">rekord</div>
                </div>
                <div class="w-px bg-[#333537]"></div>
                <div class="text-center">
                    <div class="text-sm font-medium ${currentStreak > 0 ? 'text-[#c4eed0]' : 'text-neutral-500'}">${currentStreak}</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest">aktualny</div>
                </div>
            </div>
        </div>`;
    }

    // --- PUBLICZNE API MODUŁU ---

    window.openStatsScreen = async function() {
        window.goForward('stats-screen');
        await window.loadStats();
    };

    window.loadStats = async function() {
        const container = document.getElementById('stats-list');
        if (!container) return;
        container.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Obliczam statystyki...</p>`;

        const hid = window.currentUser.household_id;

        // Fetch z limitem dla historii (punkt 5 Claude'a), ale wystarczającym dla statystyk
        const [tasksRes, logsRes] = await Promise.all([
            window.supabaseClient.from('tasks')
                .select('*')
                .eq('household_id', hid)
                .eq('is_archived', false)
                .gt('interval_days', 0),
            window.supabaseClient.from('activity_logs')
                .select('*')
                .eq('household_id', hid)
                .order('created_at', { ascending: true })
                .limit(1000) 
        ]);

        const tasks = tasksRes.data || [];
        const logs = logsRes.data || [];

        if (tasks.length === 0) {
            container.innerHTML = window.UI.renderEmptyState("Brak danych", "Dodaj zadania cykliczne, by zobaczyć statystyki.");
            return;
        }

        const statsData = tasks.map(task => computeTaskStats(task, logs));

        // Sortowanie: Najdłuższe aktywne serie na górę
        statsData.sort((a, b) => b.currentStreak - a.currentStreak || b.onTimePct - a.onTimePct);

        // Globalne podsumowanie
        const bestGlobalStreak = Math.max(...statsData.map(s => s.bestStreak), 0);
        const activeStreaks = statsData.filter(s => s.currentStreak > 0).length;
        const avgOnTime = Math.round(statsData.reduce((acc, s) => acc + s.onTimePct, 0) / statsData.length);

        let html = `
            <div class="grid grid-cols-3 gap-2 mb-6 animate-fade-in">
                <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center shadow-sm">
                    <div class="text-xl font-medium text-[#c4eed0]">${activeStreaks}</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Aktywne</div>
                </div>
                <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center shadow-sm">
                    <div class="text-xl font-medium text-[#ffb4ab]">${bestGlobalStreak}</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Rekord</div>
                </div>
                <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center shadow-sm">
                    <div class="text-xl font-medium ${avgOnTime >= 80 ? 'text-[#c4eed0]' : 'text-neutral-200'}">${avgOnTime}%</div>
                    <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Średnia</div>
                </div>
            </div>`;

        html += statsData.map(s => renderTaskStat(s)).join('');
        container.innerHTML = html;
    };

    return {
        load: window.loadStats,
        compute: computeTaskStats
    };
})();
