window.Overview = (() => {
  const expanded=new Set(), esc=v=>window.esc(v), same=(a,b)=>String(a)===String(b);
  const day=v=>{const d=new Date(v);d.setHours(0,0,0,0);return d;};
  const fmt=v=>new Date(v).toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
  function when(v,time=''){const n=Math.round((day(v)-day(new Date()))/86400000);return(n===0?'Dziś':n===1?'Jutro':n<0?`${-n} dni po terminie`:n<8?`Za ${n} dni`:fmt(v))+(time?' · '+time:'');}
  function row(e){return `<button type="button" class="ux-row js-overview-open" data-kind="${e.kind}" data-key="${esc(e.key)}">${UX.icon(e.icon)}<span class="ux-row-main"><span class="ux-row-title">${esc(e.name)}</span><span class="ux-row-meta">${esc(e.meta)}</span></span><span class="ux-row-end ${e.late?'ux-warn':''}">${esc(e.status)}</span></button>`;}
  function section(id,title,entries,limit=3){if(!entries.length)return '';return `<section class="ux-section"><h2 class="ux-section-title"><span>${title}</span><span>${entries.length}</span></h2>${(expanded.has(id)?entries:entries.slice(0,limit)).map(row).join('')}${entries.length>limit?`<button type="button" class="ux-btn ghost small js-overview-more" data-section="${id}">${expanded.has(id)?'Zwiń':`Pokaż pozostałe (${entries.length-limit})`}</button>`:''}</section>`;}
  function render(){
    const el=document.getElementById('overview-content');if(!el)return;
    const s=AppStore.get(),today=day(new Date()),days=Number(document.getElementById('dashboard-horizon')?.value||90),until=new Date(today);until.setDate(until.getDate()+days);until.setHours(23,59,59,999);
    const profiles=s.profiles||[],person=id=>profiles.find(p=>same(p.id,id))?.name;
    const tasks=window.TaskModel?.list()||[];
    const entry=t=>({kind:'task',key:t.key,name:t.name,meta:[t.area,t.room,person(t.profileId),t.repeat?.every?TaskModel.repeatLabel(t.repeat):''].filter(Boolean).join(' · '),status:t.dueAt?when(t.dueAt):'Bez terminu',late:t.dueAt&&day(t.dueAt)<today,icon:t.important?'flag':t.area==='Dom'?'wrench':t.area==='Zdrowie'?'heart':'task',date:t.dueAt?new Date(t.dueAt):null,important:t.important});
    const events=(window.EventModel?.list({includePast:false})||[]).filter(e=>new Date(e.startsAt)<=until).map(e=>({kind:'event',key:e.key,name:e.name,meta:[e.area==='Zdrowie'?'Zdrowie':'Wydarzenie',person(e.profileId)].filter(Boolean).join(' · '),status:when(e.startsAt,e.allDay?'':e.time),icon:'calendar',date:new Date(e.startsAt)}));
    const lists=(s.checklists||[]).filter(l=>!l.is_archived&&l.list_type==='packing'&&l.start_date&&day(l.start_date)>=today&&day(l.start_date)<=until).flatMap(l=>{const items=(s.checklistItems||[]).filter(i=>same(i.checklist_id,l.id)),left=items.filter(i=>!i.is_completed).length;if(items.length&&!left)return [];return[{kind:'list',key:String(l.id),name:l.title,meta:`Pakowanie · ${items.length-left}/${items.length} gotowe`,status:when(l.start_date),icon:'list',date:new Date(l.start_date)}];});
    const upcoming=[...events,...tasks.filter(t=>t.dueAt&&day(t.dueAt)>=today&&new Date(t.dueAt)<=until).map(entry),...lists].sort((a,b)=>a.date-b.date);
    const action=tasks.filter(t=>t.important&&!t.dueAt||t.dueAt&&day(t.dueAt)<today).map(entry).sort((a,b)=>Number(b.important)-Number(a.important)||(b.date?.getTime()||0)-(a.date?.getTime()||0));
    const active=(window.HealthEntries?.listEpisodes({activeOnly:true})||[]).map(e=>({kind:'episode',key:String(e.id),name:e.name,meta:[person(e.profileId),e.startDate?'od '+fmt(e.startDate):''].filter(Boolean).join(' · '),status:'Trwa',icon:'activity'}));
    const undated=tasks.filter(t=>!t.dueAt&&!t.important).map(entry);
    el.innerHTML=section('dates','Terminy',upcoming,4)+section('action','Do załatwienia',action,3)+section('active','W toku',active,2)+(undated.length?`<section class="ux-section"><button type="button" class="ux-btn ghost small js-overview-more" data-section="undated">${expanded.has('undated')?'Zwiń zadania bez terminu':`Zadania bez terminu (${undated.length})`}</button>${expanded.has('undated')?undated.map(row).join(''):''}</section>`:'')+(!upcoming.length&&!action.length&&!active.length?'<p class="ux-empty">Nie ma bliskich terminów ani spraw wymagających działania. Pozostałe zadania są dostępne na liście.</p>':'');
    const summary=document.getElementById('overview-summary');if(summary)summary.textContent=`${action.length} do załatwienia · ${upcoming.length} w ${days} dni`;UX.decorate(el);
  }
  const previous=window.renderDashboardUI;
  window.renderDashboardUI=()=>{previous?.();render();};
  EventDispatcher.onClick('.js-overview-more',(e,el)=>{const id=el.dataset.section;expanded.has(id)?expanded.delete(id):expanded.add(id);render();});
  EventDispatcher.onClick('.js-overview-open',(e,el)=>{const {kind,key}=el.dataset;if(kind==='task')window.openTaskDetails(key);if(kind==='event')window.openEventDetails(key);if(kind==='episode')window.openHealthEpisode(key);if(kind==='list'){const l=(AppStore.get().checklists||[]).find(l=>same(l.id,key));if(l)window.openChecklistScreen(l.id,l.title,l.list_type);}});
  return {render};
})();
