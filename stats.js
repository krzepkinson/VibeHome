// ==========================================
// LOGIKA: STATYSTYKI ZADAŃ (stats.js)
// ==========================================

window.openStatsScreen = async function() {
    window.goForward('stats-screen');
    await window.loadStats();
};

window.loadStats = async function() {
    const container = document.getElementById('stats-list');
    if (!container) return;
    container.innerHTML = `<p class="text-neutral-500 text-xs text-center py-10 animate-pulse">Obliczam statystyki...</p>`;

    const hid = window.currentUser.household_id;

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
    ]);

    const tasks = tasksRes.data || [];
    const logs = logsRes.data || [];

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="text-5xl mb-4 opacity-50">📊</div>
                <h3 class="text-neutral-200 font-medium text-sm">Brak danych</h3>
                <p class="text-neutral-500 text-xs mt-2 max-w-[240px] leading-relaxed">
                    Dodaj zadania cykliczne i je wykonuj, by zobaczyć statystyki.
                </p>
            </div>`;
        return;
    }

    // Oblicz statystyki dla każdego zadania
    const statsData = tasks.map(task => computeTaskStats(task, logs));

    // Sortuj: najdłuższy aktualny streak na górze
    statsData.sort((a, b) => b.currentStreak - a.currentStreak || b.onTimePct - a.onTimePct);

    // Oblicz globalne podsumowanie
    const totalLogs = logs.length;
    const onTimeLogs = logs.filter(l => {
        const task = tasks.find(t => t.id === l.task_id);
        if (!task || !task.interval_days) return false;
        const logDate = new Date(l.created_at);
        const prevLogs = logs
            .filter(x => x.task_id === l.task_id && new Date(x.created_at) < logDate)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const prevLog = prevLogs[0];
        if (!prevLog) return true;
        const daysSince = Math.floor((logDate - new Date(prevLog.created_at)) / 86400000);
        return daysSince <= task.interval_days * 1.2;
    }).length;

    const globalPct = totalLogs > 0 ? Math.round((onTimeLogs / totalLogs) * 100) : 0;
    const bestStreak = Math.max(...statsData.map(s => s.bestStreak), 0);
    const activeStreaks = statsData.filter(s => s.currentStreak > 0).length;

    // Renderuj nagłówek z podsumowaniem
    let html = `
        <div class="grid grid-cols-3 gap-2 mb-6">
            <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center">
                <div class="text-xl font-medium text-[#c4eed0]">${activeStreaks}</div>
                <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Aktywne streaki</div>
            </div>
            <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center">
                <div class="text-xl font-medium text-[#ffb4ab]">${bestStreak}</div>
                <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Rekord streak</div>
            </div>
            <div class="bg-[#1e1f20] border border-[#333537] rounded-[20px] p-3 text-center">
                <div class="text-xl font-medium ${globalPct >= 80 ? 'text-[#c4eed0]' : globalPct >= 50 ? 'text-neutral-200' : 'text-[#ffb4ab]'}">${globalPct}%</div>
                <div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Na czas</div>
            </div>
        </div>`;

    // Renderuj każde zadanie
    html += statsData.map(s => renderTaskStat(s)).join('');
    container.innerHTML = html;
};

function computeTaskStats(task, allLogs) {
    const taskLogs = allLogs
        .filter(l => l.task_id === task.id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (taskLogs.length === 0) {
        return {
            task,
            totalLogs: 0,
            onTimePct: 0,
            currentStreak: 0,
            bestStreak: 0,
            lastDone: null,
            daysUntilNext: null
        };
    }

    // Tolerancja 20% interwału — np. dla tygodniowego zadania OK jest zrobić je w ciągu 8.4 dnia
    const tolerance = task.interval_days * 1.2;
    let onTime = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < taskLogs.length; i++) {
        const log = taskLogs[i];
        const prevLog = taskLogs[i - 1];
        let isOnTime = false;

        if (!prevLog) {
            // Pierwszy wpis zawsze liczy się jako terminowy
            isOnTime = true;
        } else {
            const daysSincePrev = Math.floor(
                (new Date(log.created_at) - new Date(prevLog.created_at)) / 86400000
            );
            isOnTime = daysSincePrev <= tolerance;
        }

        if (isOnTime) {
            onTime++;
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            tempStreak = 1;
        }
    }

    // Sprawdź czy aktualny streak jest nadal żywy
    const lastLog = taskLogs[taskLogs.length - 1];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastDate = new Date(lastLog.created_at); lastDate.setHours(0, 0, 0, 0);
    const daysSinceLast = Math.floor((today - lastDate) / 86400000);
    const isStreakAlive = daysSinceLast <= Math.ceil(tolerance);

    const currentStreak = isStreakAlive ? tempStreak : 0;

    // Dni do następnego wykonania
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + task.interval_days);
    const daysUntilNext = Math.ceil((nextDate - today) / 86400000);

    return {
        task,
        totalLogs: taskLogs.length,
        onTimePct: Math.round((onTime / taskLogs.length) * 100),
        currentStreak,
        bestStreak,
        lastDone: lastLog.created_at,
        daysUntilNext
    };
}

function renderTaskStat(s) {
    const { task, totalLogs, onTimePct, currentStreak, bestStreak, lastDone, daysUntilNext } = s;

    const streakLabel = currentStreak > 0
        ? `<span class="text-[10px] bg-[#0f5223]/30 text-[#c4eed0] px-2 py-0.5 rounded-full border border-[#0f5223]/50 shrink-0">🔥 ${currentStreak}× z rzędu</span>`
        : `<span class="text-[10px] bg-[#3c1414]/40 text-[#ffb4ab] px-2 py-0.5 rounded-full border border-[#8c1d18]/30 shrink-0">streak przerwany</span>`;

    const pctColor = onTimePct >= 80 ? 'bg-[#c4eed0]' : onTimePct >= 50 ? 'bg-neutral-400' : 'bg-[#ffb4ab]';

    let nextLabel = '';
    if (daysUntilNext !== null) {
        if (daysUntilNext < 0) {
            nextLabel = `<span class="text-[#ffb4ab]">${Math.abs(daysUntilNext)} dni po terminie</span>`;
        } else if (daysUntilNext === 0) {
            nextLabel = `<span class="text-[#ffb4ab]">dziś!</span>`;
        } else {
            nextLabel = `<span class="text-neutral-500">za ${daysUntilNext} dni</span>`;
        }
    }

    const lastLabel = lastDone
        ? new Date(lastDone).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
        : 'nigdy';

    return `
    <div class="bg-[#1e1f20] rounded-[20px] border border-[#333537] p-4 mb-3 shadow-sm">
        <div class="flex items-start justify-between mb-3 gap-2">
            <div class="flex-1 min-w-0">
                <h3 class="font-medium text-neutral-100 text-sm truncate">${window.esc(task.name)}</h3>
                <p class="text-[10px] text-neutral-500 mt-0.5">
                    co ${task.interval_days} dni
                    ${lastDone ? `• ostatnio ${lastLabel}` : ''}
                    ${daysUntilNext !== null ? `• następny: ${nextLabel}` : ''}
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
