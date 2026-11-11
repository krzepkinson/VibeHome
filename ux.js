// Wspólna warstwa interfejsu. Bez pobierania danych i bez zależności od CDN.
window.UX = (() => {
    const paths = {
        plus:'M12 5v14M5 12h14', search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        settings:'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M13 3v6M7 9v6M15 15v6',
        calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2m4 0h2m-8 4h2',
        task:'M9 6h12M9 12h12M9 18h12M3 5l1 1 2-2M3 11l1 1 2-2M3 17l1 1 2-2',
        overview:'M3 4h5v5H3ZM12 5h9M12 9h6M3 15h5v5H3ZM12 16h9M12 20h6',
        home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
        heart:'M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.8a5.4 5.4 0 0 0 0-7.6ZM3 12h5l2-4 4 8 2-4h5',
        activity:'M2 12h5l3-8 4 16 3-8h5', package:'m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10M7 5l10 4',
        scan:'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 8v8M10 8v8M14 8v8M17 8v8',
        check:'m5 12 4 4L19 6', close:'m6 6 12 12M6 18 18 6', back:'m12 5-7 7 7 7M5 12h15',
        chevron:'m9 5 7 7-7 7', flag:'M5 21V4c5-4 9 4 14 0v10c-5 4-9-4-14 0',
        bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6',
        edit:'m15 4 5 5M3 21l5-1L21 7l-5-5L3 15v6Z', archive:'M3 4h18v5H3ZM5 9v12h14V9M10 13h4',
        list:'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',
        people:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M15 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.9M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
        person:'M20 21v-3a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v3M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
        thermometer:'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v10',
        repeat:'m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
        clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2',
        history:'M3 3v6h6M3 9a9 9 0 1 1 0 6M12 7v5l3 2',
        more:'M5 12h.01M12 12h.01M19 12h.01', note:'M4 3h16v18H4ZM8 8h8M8 12h8M8 16h5',
        trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
        room:'M5 21V3l14 2v16M2 21h20M14 12h.01', shopping:'M3 3h2l3 12h10l3-9H6M10 20h.01M18 20h.01',
        wrench:'M14 6a6 6 0 0 0-7 7l-5 5 4 4 5-5a6 6 0 0 0 7-7l-4 2-3-3 3-3Z',
        info:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6M12 7h.01',
        logout:'M9 3H3v18h6M14 7l5 5-5 5M7 12h12', sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'
    };
    const aliases = {'settings-2':'settings','calendar-days':'calendar','calendar-clock':'calendar','calendar-range':'calendar','calendar-check':'calendar','calendar-plus':'calendar','circle-check':'check','check-circle':'check','check-circle-2':'check','circle':'task','list-checks':'task','list-todo':'task','clipboard-list':'list','heart-pulse':'heart','stethoscope':'heart','user-round':'person','user':'person','users-round':'people','users':'people','user-plus':'person','scan-barcode':'scan','barcode':'scan','package-plus':'package','pill':'package','arrow-left':'back','chevron-right':'chevron','chevron-down':'chevron','x':'close','pencil':'edit','trash-2':'trash','more-horizontal':'more','ellipsis':'more','door-open':'room','shopping-basket':'shopping','shopping-cart':'shopping','refresh-cw':'repeat','rotate-ccw':'history','message-circle':'note','file-text':'note','book-open':'history','log-out':'logout','circle-alert':'info','alert-circle':'info','layout-list':'overview','folder':'list','luggage':'list','play':'activity','square':'check'};
    function icon(name, cls = '') {
        const path = paths[name === 'forward' ? 'chevron' : (aliases[name] || name)] || paths.info;
        return `<svg class="ux-icon ${String(cls).replace(/[^a-zA-Z0-9 _-]/g,'')}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
    }
    const emojiMap = {'✨':'overview','🏠':'home','📝':'task','❤️':'heart','⚙️':'settings','🔍':'search','📅':'calendar','🕒':'history','📊':'overview','📖':'history','💊':'package','📦':'package','📏':'thermometer','🤒':'activity','🔄':'repeat','🔔':'bell','✏️':'edit','🗑️':'trash','🗃️':'archive','🚪':'logout','🛒':'shopping','🧳':'list','🗂️':'list','✓':'check','✕':'close','←':'back','→':'chevron'};
    let decorateFrame = null, refreshFrame = null;
    const decorationScopes = new Set();
    function decorate(scope = document) {
        const markers=[...(scope.matches?.('[data-icon],[data-ux-icon]')?[scope]:[]),...scope.querySelectorAll('[data-icon],[data-ux-icon]')];
        markers.forEach(el => { if (!el.querySelector('svg')) el.innerHTML = icon(el.dataset.icon || el.dataset.uxIcon); });
        scope.querySelectorAll('button, span, [role="button"]').forEach(el => {
            if (el.closest('svg,select') || el.querySelector('svg') || el.children.length || !emojiMap[el.textContent.trim()]) return;
            const name = emojiMap[el.textContent.trim()];
            if (el.tagName === 'BUTTON' && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.title || ({edit:'Edytuj',trash:'Archiwizuj',close:'Zamknij',back:'Wróć',search:'Szukaj',calendar:'Kalendarz',settings:'Ustawienia',history:'Historia'}[name] || name));
            el.innerHTML = icon(name);
        });
    }
    function scheduleDecorate(scope) {
        decorationScopes.add(scope || document.getElementById('view-'+window.activeView) || document);
        if (!decorateFrame) decorateFrame = requestAnimationFrame(() => {
            decorateFrame = null;
            const scopes=[...decorationScopes];decorationScopes.clear();
            scopes.filter(s=>s===document||s.isConnected).filter(s=>!scopes.some(parent=>parent!==s&&parent.contains?.(s))).forEach(decorate);
            cleanupDialogs();
        });
    }
    function refresh() {
        if (refreshFrame) return;
        refreshFrame = requestAnimationFrame(() => {
            refreshFrame = null;
            const v = window.activeView;
            if (v === 'dashboard') window.renderDashboardUI?.();
            if (v === 'todo') window.renderTodoUI?.();
            if (v === 'home') window.renderHomeUI?.();
            if (v === 'health') window.renderHealthUI?.();
            if (v === 'pharmacy-screen') window.renderPharmacyList?.();
            if (v === 'calendar') window.CalendarModule?.refresh?.();
            if (v === 'health-book-screen') window.loadHealthBook?.();
            if (v === 'checklist-screen') window.renderChecklistFromStore?.();
            scheduleDecorate();
        });
    }
    const dialogs = [];
    function cleanupDialogs() {
        for (let i=dialogs.length-1;i>=0;i--) if (!dialogs[i].el.isConnected || dialogs[i].el.classList.contains('hidden')) {
            const [entry] = dialogs.splice(i,1);
            if (i===dialogs.length && entry.previous?.isConnected && !entry.previous.closest('.hidden')) entry.previous.focus({preventScroll:true});
        }
    }
    function openDialog(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return;
        const alreadyOpen = dialogs.some(x=>x.el===el);
        if (!alreadyOpen) dialogs.push({el,previous:document.activeElement});
        el.classList.remove('hidden'); el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
        if (!alreadyOpen) {
            const explicitTarget = el.querySelector('[autofocus]');
            const touchDevice = window.matchMedia?.('(pointer: coarse)').matches;
            const focusTarget = explicitTarget || (touchDevice
                ? el.querySelector('button:not(:disabled),[tabindex]:not([tabindex="-1"])')
                : el.querySelector('input:not([type="hidden"]),select,textarea,button:not(:disabled)')) || el;
            if (focusTarget === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex','-1');
            setTimeout(()=>{
                if (el.isConnected && !el.classList.contains('hidden')) focusTarget.focus?.({preventScroll:true});
            },0);
        }
        scheduleDecorate(el);
    }
    function closeDialog(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        el?.classList.add('hidden'); cleanupDialogs();
    }
    async function actionToast(message, label, callback) {
        const el = document.getElementById('toast');
        if (!el) { window.showToast?.(message); return; }
        if(window.toastTimeout) clearTimeout(window.toastTimeout);
        el.replaceChildren();
        const text = document.createElement('span'); text.textContent = message; el.append(text);
        if (label && callback) {
            const button=document.createElement('button');button.type='button';button.textContent=label;
            button.addEventListener('click',async()=>{button.disabled=true;try{await callback();el.classList.add('opacity-0','-translate-y-10');refresh();}catch(e){window.showToast?.(e.message||'Nie udało się wykonać działania.');}finally{button.disabled=false;}});
            el.append(button);
        }
        el.style.pointerEvents='auto';el.classList.remove('opacity-0','-translate-y-10');
        window.toastTimeout=setTimeout(()=>{el.classList.add('opacity-0','-translate-y-10');el.style.pointerEvents='none';},9000);
    }
    document.addEventListener('keydown', e => {
        cleanupDialogs(); const el=dialogs.at(-1)?.el; if(!el)return;
        if(e.key==='Escape'){
            e.preventDefault();e.stopImmediatePropagation();
            const closers={
                'quick-add-modal':window.closeQuickAddModal,'new-profile-modal':window.closeNewProfileModal,
                'edit-log-modal':window.closeEditLogModal,'task-detail-modal':window.TaskDetails?.close,
                'event-details-modal':window.EventModel?.closeDetails,'search-modal':window.closeGlobalSearch,
                'new-pharmacy-item-modal':window.closeNewPharmacyItemModal,'edit-pharmacy-item-modal':window.closeEditPharmacyModal,
                'new-measurement-modal':window.closeNewMeasurementModal,'edit-measurement-modal':window.closeEditMeasurementModal,
                'new-health-task-modal':window.closeNewHealthTaskModal,'edit-health-log-modal':window.closeEditHealthLogModal,
                'confirm-modal':()=>window.closeConfirmModal(false)
            };
            if(typeof closers[el.id]==='function')closers[el.id]();else closeDialog(el);
            return;
        }
        if(e.key==='Tab'){
            const all=[...el.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);
            if(!all.length){e.preventDefault();return;}
            if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}
            else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}
        }
    });
    document.addEventListener('DOMContentLoaded',()=>{
        decorate();new MutationObserver(records=>{
            let classChanged=false;
            records.forEach(record=>{if(record.type==='attributes')classChanged=true;else record.addedNodes.forEach(node=>{if(node.nodeType===1&&node.namespaceURI!=='http://www.w3.org/2000/svg')scheduleDecorate(node);});});
            if(classChanged)cleanupDialogs();
        }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
        window.AppStore?.subscribe(refresh);
    });
    let openedLink='';
    async function openFromUrl(){
        if(!window.currentUser?.household_id)return;
        const params=new URLSearchParams(location.search),kind=['task','event','episode','product','list'].find(k=>params.has(k));
        if(!kind)return;const key=params.get(kind),token=kind+':'+key;if(openedLink===token)return;openedLink=token;
        try{
            await window.loadDashboardOverview?.();
            if(kind==='task')window.openTaskDetails?.(key.includes(':')?key:'tasks:'+key);
            if(kind==='event')window.openEventDetails?.(key.includes(':')?key:'calendar_events:'+key);
            if(kind==='episode')window.openHealthEpisode?.(key);
            if(kind==='product')window.openPharmacyProduct?.(key);
            if(kind==='list'){const list=(window.AppStore.get()?.checklists||[]).find(l=>String(l.id)===String(key));if(list)window.openChecklistScreen(list.id,list.title,list.list_type);}
        }catch(error){window.showToast?.('Nie udało się otworzyć wpisu z powiadomienia.');}
    }
    document.addEventListener('app:view-changed',()=>setTimeout(openFromUrl,0));
    return { icon, decorate, refresh, openDialog, closeDialog, actionToast };
})();
