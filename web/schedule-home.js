(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDay = value => { const d=new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const localInput = value => { const d=new Date(value); return `${localDay(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const hm = value => new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const shortDate = value => new Date(value).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
  const icon = (name, size=20) => {
    const paths={calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h.01M14 15h.01"/>',
      arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',plus:'<path d="M12 5v14M5 12h14"/>',
      leaf:'<path d="M19 4c1 9-2 15-9 15-7 0-7-9-1-11 5-2 7-1 10-4Z"/><path d="m5 21 9-10"/>',chevron:'<path d="m9 5 7 7-7 7"/>'};
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.calendar}</svg>`;
  };
  let root, state=null, owner=null, preview=null, editing=null, filter='pending', selected=localDay(Date.now()), weekOffset=0, busy=false, mounting=false;
  let activeSection='arrange';
  const defaults=()=>({windows:[{start:'18:00',end:'22:00'}],weekdays:[1,2,3,4,5,6,0],focus:25,rest:5,lead:10,quietOutside:true});

  function route(label) { [...document.querySelectorAll('.segmented button')].find(b=>b.textContent.trim()===label)?.click();requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'})); }
  function jumpTo(section) {
    activeSection=section;
    if(!$('.view-home'))route('今晚');
    requestAnimationFrame(()=>{
      const target=$(`[data-section="${section}"]`);
      if(section==='pause' && target)target.open=true;
      target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      syncNav();
    });
  }
  function syncNav(){document.querySelectorAll('.schedule-nav [data-section-link]').forEach(b=>{const on=$('.view-home')&&b.dataset.sectionLink===activeSection;b.classList.toggle('active',!!on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
  function mountNav(app) {
    app.classList.add('schedule-ready');document.body.classList.add('schedule-app');
    const header=$('.nav',app);
    if(header&&!$('.schedule-nav',header)){
      const nav=document.createElement('nav');nav.className='schedule-nav';nav.setAttribute('aria-label','主要功能');
      nav.innerHTML='<button type="button" data-section-link="arrange">日程安排</button><button type="button" data-section-link="plans">我的计划</button><button type="button" data-section-link="pause">休息一下</button>';
      header.insertBefore(nav,$('.nav-user',header));
      nav.querySelectorAll('button').forEach(b=>b.onclick=()=>jumpTo(b.dataset.sectionLink));
      const settings=document.createElement('button');settings.type='button';settings.className='schedule-account';settings.textContent='设置';settings.onclick=()=>route('档案');$('.nav-user',header)?.prepend(settings);
      const menu=document.createElement('details');menu.className='schedule-user-menu';
      menu.innerHTML='<summary aria-label="账户菜单">⋯</summary><div><button type="button" data-account-settings>档案与设置</button><button type="button" data-account-exit>退出登录</button></div>';
      menu.querySelector('[data-account-settings]').onclick=()=>{menu.open=false;route('档案');};
      menu.querySelector('[data-account-exit]').onclick=()=>{menu.open=false;$('.nav-quit',header)?.click();};
      $('.nav-user',header)?.append(menu);
    }
    syncNav();
  }
  function tell(message, error=false) { const el=$('[data-home-status]',root);if(!el)return;el.textContent=message;el.classList.toggle('is-error',error); }
  function habitFields(h) {
    return `<details class="schedule-habits" data-habits><summary><span>${icon('clock',16)} 我的空闲时间与节奏</span><b data-habit-summary>${esc(h.windows.map(w=>w.start+'–'+w.end).join(' / '))} · 每段 ${h.focus} 分钟</b><span class="schedule-expand">调整</span></summary><div class="habit-inner"><p>把上课、工作和睡眠留在这些时段之外。以下时间可以按你的生活调整。</p><fieldset class="habit-weekdays"><legend>每周哪些天</legend>${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="weekday" value="${d}" ${h.weekdays.includes(d)?'checked':''}><span>${['日','一','二','三','四','五','六'][d]}</span></label>`).join('')}</fieldset><div data-windows>${h.windows.map((w,i)=>windowFields(w,i)).join('')}</div><button type="button" class="schedule-text-button" data-add-window>${icon('plus',14)} 添加一个空闲时段</button><div class="habit-rhythm"><label>每段专注<input name="focus" type="number" min="10" max="180" required value="${h.focus}"><span>分钟</span></label><label>中间休息<input name="rest" type="number" min="0" max="60" required value="${h.rest}"><span>分钟</span></label><label>提前提醒<input name="lead" type="number" min="0" max="120" required value="${h.lead}"><span>分钟</span></label></div><label class="habit-quiet"><input type="checkbox" name="quietOutside" ${h.quietOutside?'checked':''}> 只在可用时段提醒我</label><p class="habit-reminder">网页内提醒需要保持页面打开。也可以在“我的计划”中主动启用系统通知。</p></div></details>`;
  }
  function windowFields(w,i){return `<div class="habit-window"><label>空闲时段 ${i+1}<input type="time" name="start${i}" value="${esc(w.start)}" required></label><span>至</span><label><span class="sr-only">时段 ${i+1} 结束</span><input type="time" name="end${i}" value="${esc(w.end)}" required></label>${i?'<button type="button" data-remove-window aria-label="移除此时段">×</button>':''}</div>`;}
  function formHTML(h) {
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(22,0,0,0);
    return `<form class="schedule-form" data-plan-form><div class="schedule-note-top"><span>留给接下来的自己</span><span aria-hidden="true">✦</span></div><label class="task-title-label" for="schedule-task">想把哪件事安排好？</label><input id="schedule-task" name="title" class="schedule-title-input" maxlength="240" required autocomplete="off" placeholder="例如，准备周五的课堂报告"><div class="schedule-form-row"><label for="schedule-duration">预计需要多久<div class="duration-field"><input id="schedule-duration" name="duration" type="number" min="5" max="1440" required value="45"><span>分钟</span></div></label><label for="schedule-deadline">最晚什么时候完成<input id="schedule-deadline" name="deadline" type="datetime-local" required value="${localInput(tomorrow)}"></label></div><div class="duration-presets" aria-label="常用任务时长">${[15,25,45,60].map(n=>`<button type="button" data-duration="${n}" aria-pressed="${n===45}">${n} 分钟</button>`).join('')}</div>${habitFields(h)}<div class="schedule-form-bottom"><button type="submit" class="schedule-primary" data-generate>为我安排日程 ${icon('arrow',18)}</button><p>先看安排，再由你确认。<br>会留出休息，也不会自动延后截止时间。</p></div><button type="button" class="schedule-text-button cancel-edit" data-cancel-edit hidden>取消调整，安排新任务</button><p class="schedule-status" data-home-status role="status"></p></form>`;
  }
  function mountHome() {
    const app=$('.app'), home=$('.view-home');
    if(!app||!$('.stage')){
      document.body.classList.remove('schedule-app');app?.classList.remove('schedule-ready');
      root=null;state=null;owner=null;preview=null;editing=null;return;
    }
    mountNav(app);
    if(!home){root=null;return;}
    if(!window.YuniPlannerUI||!window.NiniPlanner)return;
    if($('.schedule-home',home)){root=$('.schedule-home',home);return;}
    preview=null;editing=null;filter='pending';selected=localDay(Date.now());weekOffset=0;
    root=document.createElement('div');root.className='schedule-home';
    const today=new Date();
    root.innerHTML=`<header class="schedule-intro"><div><p class="schedule-date">${icon('calendar',15)} ${today.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}<span>把时间，留给重要的事</span></p><h1>让想做的事，<br class="mobile-break">有个<span>刚好的安排。</span></h1><p class="schedule-subtitle">按你的空闲时间拆成小步，也把休息认真留出来。</p></div><div class="schedule-desk" aria-hidden="true"><div class="desk-light"></div><div class="desk-lamp"><i></i><b></b><span></span></div><div class="desk-paper"><span>ONE THING<br>AT A TIME.</span><i></i><i></i></div><img src="/nini.webp" alt=""><div class="desk-line"></div></div></header><section class="schedule-main" data-section="arrange" aria-labelledby="arrange-title"><div class="schedule-section-head"><div><span class="tier-number">01</span><h2 id="arrange-title">安排日程</h2><span class="section-caption">从一件事开始</span></div><span class="schedule-sync" data-sync>正在读取安排…</span></div><div class="schedule-workspace"><div data-form-area>${formHTML(defaults())}</div><section class="schedule-agenda" aria-label="日程与试排结果" data-agenda><p class="schedule-loading">正在读取你的日程…</p></section></div></section><section class="schedule-plans" data-section="plans" aria-labelledby="plans-title"><div class="schedule-section-head"><div><span class="tier-number">02</span><h2 id="plans-title">我的计划</h2><span class="section-caption" data-plan-count>一步一步，慢慢完成</span></div><button class="schedule-text-button" type="button" data-notifications>${icon('clock',15)} 提醒设置</button></div><div class="plan-filters" role="group" aria-label="按任务状态筛选">${[['pending','待完成'],['done','已完成'],['cancelled','已撤销']].map(([value,text])=>`<button type="button" data-filter="${value}" aria-pressed="${value==='pending'}">${text}<span data-count="${value}">0</span></button>`).join('')}</div><div data-task-list></div><p class="schedule-plan-status" role="status" data-plan-status></p></section><details class="schedule-pause" data-section="pause"><summary><div><span class="tier-number">03</span><h2>也给自己，留一点空白。</h2></div><span>小岛、纸条与陪伴 <b>＋</b></span></summary><div class="pause-content"><div class="pause-intro">日程之外，<br>NiNi 也愿意安静陪着你。<p>想用的时候，再打开就好。</p></div><div class="pause-links"><button type="button" data-pause="quiet">去睡前小岛<span>什么都不说，坐一会儿</span>${icon('chevron',16)}</button><button type="button" data-pause="write">写一张纸条<span>先放下还挂念的事</span>${icon('chevron',16)}</button><button type="button" data-pause="chat">和 NiNi 聊聊<span>想多说一点的时候</span>${icon('chevron',16)}</button><button type="button" data-pause="morning">晨间的一句话<span>新的一天，慢慢开始</span>${icon('chevron',16)}</button></div></div></details><footer class="schedule-footer"><span>屿 YUNI</span><p>安排好事情，也照顾好自己。</p>${icon('leaf',19)}</footer>`;
    home.prepend(root);bindRoot();renderAll();
    const mounted=root;
    window.YuniPlannerUI.load().then(next=>{if(root!==mounted||!mounted.isConnected)return;state=next;renderAll();hydrateHabits();}).catch(error=>{if(root===mounted){tell(error.message,true);$('[data-sync]',root).textContent='日程暂未读到';$('[data-agenda]',root).innerHTML='<div class="agenda-empty"><h3>暂时没能读到日程</h3><p>请检查连接，再重试一次。</p><button type="button" class="schedule-secondary" data-retry>重新读取</button></div>';$('[data-retry]',root).onclick=()=>reload();}});
  }
  function hydrateHabits(){if(!state?.habits||!root)return;const details=$('[data-habits]',root);details.outerHTML=habitFields(state.habits);}
  async function reload(){try{state=await window.YuniPlannerUI.load();hydrateHabits();renderAll();tell('日程已更新。');}catch(e){tell(e.message,true);}}
  function bindRoot() {
    const home=root;
    $('[data-plan-form]',home).onsubmit=e=>{e.preventDefault();if(!state){tell('日程尚未读到，请稍后重试。',true);return;}try{const form=new FormData(e.target),task={title:String(form.get('title')).trim(),duration:Number(form.get('duration')),deadline:String(form.get('deadline'))};const habits=readHabits(form);showPreview(task,habits);}catch(error){tell(error.message,true);}};
    home.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.duration){$('#schedule-duration',home).value=b.dataset.duration;syncDuration();invalidatePreview();}
      if(b.hasAttribute('data-add-window')){const wrap=$('[data-windows]',home),count=wrap.children.length;if(count>=8){tell('最多可以设置 8 个空闲时段。',true);return;}wrap.insertAdjacentHTML('beforeend',windowFields({start:'',end:''},count));invalidatePreview();}
      if(b.hasAttribute('data-remove-window')){b.closest('.habit-window').remove();renumberWindows();invalidatePreview();}
      if(b.dataset.filter){filter=b.dataset.filter;renderPlans();}
      if(b.hasAttribute('data-new-task')){clearEdit();$('#schedule-task',home).focus();jumpTo('arrange');}
      if(b.hasAttribute('data-cancel-edit')){clearEdit();tell('已取消调整，原来的安排还在。');}
      if(b.dataset.day){selected=b.dataset.day;renderAgenda();}
      if(b.dataset.week){const weekday=(new Date(selected+'T12:00').getDay()+6)%7;weekOffset+=Number(b.dataset.week);const first=startWeek(new Date());first.setDate(first.getDate()+weekOffset*7+weekday);selected=localDay(first);renderAgenda();}
      if(b.hasAttribute('data-today')){weekOffset=0;selected=localDay(Date.now());renderAgenda();}
      if(b.hasAttribute('data-confirm-plan'))await confirmPlan();
      if(b.hasAttribute('data-edit-preview')){preview=null;renderAgenda();tell('可以修改任务或时间，再试排一次。');$('#schedule-task',home).focus();}
      if(b.hasAttribute('data-adjust-habits')){$('[data-habits]',home).open=true;$('[name=start0]',home).focus();}
      if(b.dataset.editTask){const task=state?.tasks.find(t=>t.id===b.dataset.editTask);if(task)editTask(task);}
      if(b.dataset.taskDone||b.dataset.taskCancel)await updateTask(b,b.dataset.taskDone||b.dataset.taskCancel,b.dataset.taskDone?'done':'cancel');
      if(b.hasAttribute('data-notifications')){try{const message=await window.YuniPlannerUI.enableNotifications();$('[data-plan-status]',home).textContent=message;}catch{ $('[data-plan-status]',home).textContent='暂时无法启用通知，网页内提醒仍然可用。';}}
      if(b.dataset.pause){if(b.dataset.pause==='chat')route('聊聊');else if(b.dataset.pause==='morning')route('晨间');else window.YuniNight?.[b.dataset.pause]?.();}
    });
    home.addEventListener('input',e=>{if(e.target.id==='schedule-duration')syncDuration();if(e.target.closest('[data-plan-form]')&&preview){preview=null;renderAgenda();tell('已修改条件，请重新试排。');}});
    home.addEventListener('invalid',e=>{const details=e.target.closest('details');if(details)details.open=true;},true);
    home.addEventListener('change',e=>{if(e.target.closest('[data-habits]')){try{const h=readHabits(new FormData($('[data-plan-form]',home)));$('[data-habit-summary]',home).textContent=h.windows.map(w=>w.start+'–'+w.end).join(' / ')+' · 每段 '+h.focus+' 分钟';}catch{ /* Validation appears on submission, while fields are still being edited. */ }}});
  }
  function renumberWindows(){document.querySelectorAll('.habit-window').forEach((row,i)=>{const inputs=row.querySelectorAll('input');inputs[0].name='start'+i;inputs[1].name='end'+i;row.querySelector('label').childNodes[0].textContent='空闲时段 '+(i+1);row.querySelector('.sr-only').textContent='时段 '+(i+1)+' 结束';});}
  function invalidatePreview(){if(preview){preview=null;renderAgenda();tell('已修改条件，请重新试排。');}}
  function readHabits(form){const windows=[];for(let i=0;i<8;i++){const start=form.get('start'+i),end=form.get('end'+i);if(start||end)windows.push({start,end});}const h={windows,weekdays:form.getAll('weekday').map(Number),focus:Number(form.get('focus')),rest:Number(form.get('rest')),lead:Number(form.get('lead')),quietOutside:form.has('quietOutside')};window.NiniPlanner.validateHabits(h);return h;}
  function syncDuration(){const n=Number($('#schedule-duration',root).value);root.querySelectorAll('[data-duration]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.duration)===n)));}
  function showPreview(task,habits,notice='') {
    const tasks=state.tasks.filter(t=>t.id!==editing);
    const result=window.NiniPlanner.plan(habits,task,tasks);
    preview={task,habits,result,revision:state.revision,editing};
    tell(notice||'已试排。看看这些时间，合适再确认。');renderAgenda();
    const heading=$('[data-preview-title]',root);heading?.focus({preventScroll:true});
    if(innerWidth<800)$('[data-agenda]',root).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  function blockRows(blocks){return blocks.map((b,i)=>`<li><span class="preview-index">${String(i+1).padStart(2,'0')}</span><div><b>${shortDate(b.start)} · ${hm(b.start)}–${hm(b.end)}</b><span>${Math.round((Date.parse(b.end)-Date.parse(b.start))/60000)} 分钟专注</span></div>${icon('check',15)}</li>`).join('');}
  function renderPreview(){const {task,habits,result}=preview;return `<div class="schedule-preview"><span class="preview-kicker">${result.missing?'还需要一点调整':'为你留好了这些时间'}</span><h3 data-preview-title tabindex="-1">${esc(task.title)}</h3><p>截止 ${shortDate(task.deadline)} ${hm(task.deadline)} · 共 ${task.duration} 分钟</p><ol class="schedule-preview-blocks">${blockRows(result.blocks)}</ol>${result.missing?`<p class="schedule-shortage">还差 <b>${result.missing} 分钟</b>没有排下。试着增加空闲时段，或调整任务时长。</p><button class="schedule-secondary" type="button" data-adjust-habits>调整空闲时间</button>`:`<div class="preview-rest">${icon('leaf',16)} 每段之间，留 ${habits.rest} 分钟休息。</div><button class="schedule-primary" type="button" data-confirm-plan>${editing?'确认更新日程':'确认加入日程'} ${icon('check',18)}</button>`}<button class="schedule-text-button" type="button" data-edit-preview>← 继续修改</button><small>${editing?'确认后才替换这项任务原有的时段。':'确认前不会写入你的日程。'}</small></div>`;}
  async function confirmPlan(){if(!preview||busy)return;busy=true;const button=$('[data-confirm-plan]',root);if(button){button.disabled=true;button.textContent='正在保存…';}try{
    const pending=preview,fresh=await window.YuniPlannerUI.load();state=fresh;
    const current=window.NiniPlanner.plan(pending.habits,pending.task,fresh.tasks.filter(t=>t.id!==pending.editing));
    const signature=blocks=>JSON.stringify(blocks.map(b=>[b.start,b.end]));
    if(fresh.revision!==pending.revision||signature(current.blocks)!==signature(pending.result.blocks)||current.missing){showPreview(pending.task,pending.habits,'时间或日程有更新，已重新试排，请再确认一次。');return;}
    const previous=fresh.tasks.find(t=>t.id===pending.editing);
    const task={...previous,id:previous?.id||crypto.randomUUID(),...pending.task,deadline:new Date(pending.task.deadline).toISOString(),blocks:current.blocks,status:'pending',createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    state=await window.YuniPlannerUI.commit({...fresh,habits:pending.habits,tasks:previous?fresh.tasks.map(t=>t.id===previous.id?task:t):[...fresh.tasks,task]});
    selected=localDay(current.blocks[0].start);weekOffset=Math.floor((startWeek(new Date(selected+'T12:00')).getTime()-startWeek(new Date()).getTime())/(7*86400000));
    preview=null;editing=null;filter='pending';$('#schedule-task',root).value='';$('[data-generate]',root).innerHTML=`为我安排日程 ${icon('arrow',18)}`;$('[data-cancel-edit]',root).hidden=true;renderAll();tell(previous?'日程已更新，原时段已替换。':'已加入日程。接下来，按自己的节奏一步步来。');
  }catch(e){tell(e.message,true);if(button?.isConnected){button.disabled=false;button.innerHTML=`再次确认 ${icon('check',18)}`;}}finally{busy=false;}}
  function editTask(task){editing=task.id;preview=null;$('#schedule-task',root).value=task.title;$('#schedule-duration',root).value=task.duration;$('#schedule-deadline',root).value=localInput(task.deadline);$('[data-generate]',root).innerHTML=`重新试排日程 ${icon('arrow',18)}`;$('[data-cancel-edit]',root).hidden=false;syncDuration();renderAgenda();jumpTo('arrange');$('#schedule-task',root).focus();tell('调整后重新试排，确认之前原计划会保留。');}
  function clearEdit(){editing=null;preview=null;$('#schedule-task',root).value='';$('[data-generate]',root).innerHTML=`为我安排日程 ${icon('arrow',18)}`;$('[data-cancel-edit]',root).hidden=true;renderAgenda();}
  async function updateTask(button,id,type){if(busy)return;busy=true;button.disabled=true;try{state=await window.YuniPlannerUI.update(id,type);renderAll();tell(type==='done'?'又完成一件事，做得很好。':'已撤销这项安排，需要时可以重新安排。');}catch(e){tell(e.message,true);button.disabled=false;}finally{busy=false;}}
  function startWeek(value){const d=new Date(value);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
  function agendaBlocks(day){return (state?.tasks||[]).filter(t=>t.status==='pending').flatMap(task=>task.blocks.filter(b=>localDay(b.start)===day).map(block=>({task,block}))).sort((a,b)=>Date.parse(a.block.start)-Date.parse(b.block.start));}
  function renderAgenda(){if(!root)return;const target=$('[data-agenda]',root);if(preview){target.innerHTML=renderPreview();return;}if(!state){target.innerHTML='<p class="schedule-loading">正在读取你的日程…</p>';return;}
    const start=startWeek(new Date());start.setDate(start.getDate()+weekOffset*7);
    const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
    const slots=agendaBlocks(selected),minutes=slots.reduce((n,{block:b})=>n+(Date.parse(b.end)-Date.parse(b.start))/60000,0);
    target.innerHTML=`<div class="agenda-heading"><h3>${selected===localDay(Date.now())?'今天的日程':shortDate(selected+'T12:00')+'的日程'}</h3><div><button type="button" data-week="-1" aria-label="上一周">‹</button><span>${start.getMonth()+1}月</span><button type="button" data-week="1" aria-label="下一周">›</button><button type="button" data-today>今天</button></div></div><div class="schedule-week" role="group" aria-label="选择日期">${days.map(d=>{const date=localDay(d);return `<button type="button" data-day="${date}" aria-pressed="${date===selected}" class="${date===localDay(Date.now())?'is-today':''}"><span>${['日','一','二','三','四','五','六'][d.getDay()]}</span><b>${d.getDate()}</b><i class="${agendaBlocks(date).length?'has-plans':''}"></i></button>`;}).join('')}</div>${slots.length?`<p class="agenda-summary">${slots.length} 段专注 <span>·</span> ${Math.round(minutes)} 分钟 <span>·</span> 也别忘了留白</p><ol class="schedule-timeline">${slots.map(({task:t,block:b})=>`<li><time>${hm(b.start)}<span>${hm(b.end)}</span></time><div class="timeline-marker"></div><div class="timeline-item"><span>${Math.round((Date.parse(b.end)-Date.parse(b.start))/60000)} 分钟专注</span><b>${esc(t.title)}</b><button type="button" data-edit-task="${esc(t.id)}" aria-label="调整 ${esc(t.title)}">查看安排 ${icon('arrow',13)}</button></div></li>`).join('')}</ol><p class="agenda-bottom">${icon('leaf',14)} 不必把每一格，都填得满满当当。</p>`:`<div class="agenda-empty"><div class="empty-calendar" aria-hidden="true"><span></span><i></i><i></i><i></i><b>✓</b></div><h3>给这一天，留一个好的开始。</h3><p>这里还没有安排。<br>写下想做的事，先从一小步开始。</p><span class="empty-handwritten">空白，也是时间的一部分。</span></div>`}`;
  }
  function renderPlans(){if(!root)return;const tasks=state?.tasks||[];root.querySelectorAll('[data-count]').forEach(e=>e.textContent=tasks.filter(t=>t.status===e.dataset.count).length);root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));const pending=tasks.filter(t=>t.status==='pending');$('[data-plan-count]',root).textContent=pending.length?`${pending.length} 件待办，按自己的节奏完成`:'一步一步，慢慢完成';const list=tasks.filter(t=>t.status===filter).slice().sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline));$('[data-task-list]',root).innerHTML=list.length?`<div class="schedule-plan-list">${list.map(t=>`<article class="schedule-plan-row ${t.status==='done'?'is-done':''}"><button type="button" class="task-check" ${t.status==='pending'?`data-task-done="${esc(t.id)}" aria-label="完成 ${esc(t.title)}"`:'disabled aria-label="'+(t.status==='done'?'已完成':'已撤销')+'"'}>${t.status==='done'?icon('check',15):''}</button><div><h3>${esc(t.title)}</h3><p>${t.duration} 分钟 <span>·</span> 截止 ${shortDate(t.deadline)} ${hm(t.deadline)} <span>·</span> ${t.blocks.length} 段安排</p></div><div class="plan-row-actions">${t.status==='pending'?`<button type="button" data-edit-task="${esc(t.id)}">调整</button><button type="button" data-task-cancel="${esc(t.id)}">撤销</button>`:t.status==='cancelled'?`<button type="button" data-edit-task="${esc(t.id)}">重新安排</button>`:'<span class="plan-finished">完成啦</span>'}</div></article>`).join('')}</div>`:`<div class="plans-empty"><span>${icon(filter==='done'?'check':'calendar',20)}</span><p>${filter==='done'?'完成的事会收在这里。':'pending'===filter?'还没有待办，安排一件你想做的事吧。':'没有撤销的安排。'}</p>${filter==='pending'?'<button type="button" data-new-task>安排第一件事 →</button>':''}</div>`;}
  function renderAll(){if(!root)return;const sync=$('[data-sync]',root),text=state?'已同步到账户':'正在读取安排…';if(sync.textContent!==text)sync.textContent=text;renderAgenda();renderPlans();}
  window.addEventListener('yuni:planner-state',event=>{const next=event.detail;if(owner&&next.user!==owner){state=null;preview=null;editing=null;}owner=next.user;state=next.state;if(root?.isConnected)renderAll();});
  document.addEventListener('click',event=>{const menu=$('.schedule-user-menu[open]');if(menu&&!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=$('.schedule-user-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();}}});
  let queued=false;
  function mount(){if(mounting)return;mounting=true;try{mountHome();}finally{mounting=false;}}
  window.YuniScheduleHome={mount};
  window.addEventListener('yuni:planner-ready',mount);
  new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount();});}).observe($('#app'),{childList:true,subtree:true});
  mount();
})();
