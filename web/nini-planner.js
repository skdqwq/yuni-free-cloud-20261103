(() => {
let state=null,user=null,modal=null,draft=null,seedTitle='',saving=false,loading=false,activeReminder=null;
let published='',loadInFlight=null,lastSynced=0;
function timedFetch(url,options={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);return fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timer));}
function publish(){const signature=String(user)+'|'+JSON.stringify(state);if(signature===published)return;published=signature;window.dispatchEvent(new CustomEvent('yuni:planner-state',{detail:{user,state:state?structuredClone(state):null}}));}
const endpoint=`${location.origin}/api/planner`;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>new Date(s).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const toast=message=>{let e=document.querySelector('.planner-error');if(e)e.textContent=message;else{e=document.createElement('div');e.className='planner-status';e.textContent=message;document.body.append(e);setTimeout(()=>e.remove(),5000);}};
async function api(method='GET',body){const r=await timedFetch(endpoint,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const result=await r.json();if(!r.ok)throw Error(result.error||'安排服务不可用');return result;}
async function performLoad(){const stage=document.querySelector('.stage');if(!stage)return false;const r=await timedFetch('/api/auth/me');if(!r.ok){state=null;user=null;close();dismissReminder();publish();return false;}const me=await r.json();if(document.querySelector('.stage')!==stage)return false;if(user&&user!==me.id){state=null;close();dismissReminder();}user=me.id;const result=await api();if(user!==me.id||document.querySelector('.stage')!==stage)return false;state=result;lastSynced=Date.now();renderCards();publish();return true;}
function load(){if(loadInFlight)return loadInFlight;const pending=performLoad().finally(()=>{if(loadInFlight===pending)loadInFlight=null;});loadInFlight=pending;return pending;}
async function commit(next){if(saving)throw Error('正在保存，请稍等');saving=true;try{state=await api('PUT',next);lastSynced=Date.now();renderCards();publish();return state;}finally{saving=false;}}
function close(){if(!modal)return;modal.remove();modal=null;document.body.classList.remove('planner-open');document.querySelector('.stage .planner-entry')?.focus();}
function shell(title,html){if(!modal){modal=document.createElement('div');modal.className='planner-overlay';document.body.append(modal);document.body.classList.add('planner-open');modal.onclick=e=>{if(e.target===modal)close();};}modal.innerHTML=`<section class="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-title"><header><span>NiNi · 事务收尾卡</span><button class="planner-close" aria-label="关闭事务安排">×</button></header><h2 id="planner-title">${title}</h2><div class="planner-body">${html}</div><p class="planner-error" role="alert"></p></section>`;modal.querySelector('.planner-close').onclick=close;modal.querySelector('input,button')?.focus();}
const actions=(text,back=false)=>`<div class="planner-actions">${back?'<button type="button" data-back>上一步</button>':''}<button class="primary" type="submit">${text}</button></div>`;
function habitsForm(step=0,h){
 const initial=h||state.habits||{windows:[],weekdays:[],focus:'',rest:'',lead:'',quietOutside:true};
 const title=['先告诉我，你通常什么时候有空？','你习惯一次专注多久？','我提前多久提醒你比较合适？'][step];
 let content='';
 if(step===0)content=`<p>请填写所选星期通常共有的空闲时段，把上课、工作、睡眠和固定安排留在外面。修改习惯会用于之后的新安排。</p><div class="planner-weekdays">${['日','一','二','三','四','五','六'].map((d,i)=>`<label><input type="checkbox" name="day" value="${i}" ${initial.weekdays.includes(i)?'checked':''}>周${d}</label>`).join('')}</div>${[0,1,2].map(i=>`<div class="planner-row"><label>可用时段 ${i+1}${i?'（选填）':''}<input type="time" name="start${i}" value="${escape(initial.windows[i]?.start)}" ${!i?'required':''}></label><span>至</span><label>结束<input type="time" name="end${i}" value="${escape(initial.windows[i]?.end)}" ${!i?'required':''}></label></div>`).join('')}`;
 if(step===1)content=`<p>我会按这个节奏拆分任务，在两段专注之间留出休息，不把整晚排满。</p><label>每次专注多久（10—180分钟）<input name="focus" type="number" min="10" max="180" required value="${initial.focus}" placeholder="例如 25"></label><label>两段之间休息多久（0—60分钟）<input name="rest" type="number" min="0" max="60" required value="${initial.rest}" placeholder="例如 5"></label>`;
 if(step===2)content=`<p>NiNi 会在网页内提醒你。你也可以启用手机、电脑常见的系统通知弹窗。</p><label>提前提醒（0—120分钟）<input name="lead" type="number" min="0" max="120" required value="${initial.lead}" placeholder="例如 10"></label><label class="planner-check"><input name="quiet" type="checkbox" ${initial.quietOutside?'checked':''}>只在我填写的可用时段提醒，其他时间保持安静</label><p class="planner-note">提前提醒若落在安静时段，会顺延至可用时段。网页需要保持打开，重新打开会补提醒；系统通知需点击按钮授权，浏览器或系统仍可能限制通知。</p><button type="button" data-notifications>启用系统通知</button><p class="planner-notification-state" role="status"></p>`;
 shell(title,`<div class="planner-progress">了解习惯 ${step+1} / 3</div><form>${content}${actions(step===2?'记住习惯，开始安排':'下一步',step>0)}</form>`);
 modal.querySelector('[data-back]')?.addEventListener('click',()=>habitsForm(step-1,initial));
 modal.querySelector('[data-notifications]')?.addEventListener('click',enableNotifications);
 modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{
  const next=structuredClone(initial);
  if(step===0){next.weekdays=f.getAll('day').map(Number);next.windows=[];for(let i=0;i<3;i++){const start=f.get('start'+i),end=f.get('end'+i);if(start||end)next.windows.push({start,end});}NiniPlanner.validateHabits({...next,focus:25,rest:5,lead:10});}
  if(step===1){next.focus=Number(f.get('focus'));next.rest=Number(f.get('rest'));}
  if(step===2){next.lead=Number(f.get('lead'));next.quietOutside=f.has('quiet');NiniPlanner.validateHabits(next);await commit({...state,habits:next});taskForm(draft?.task);return;}
  habitsForm(step+1,next);
 }catch(error){toast(error.message);}};
}
async function enableNotifications(){let message;if(!('Notification'in window))message='此浏览器不支持系统通知，网页内提醒仍可用';else{const result=await Notification.requestPermission();message=result==='granted'?'系统通知已启用':result==='denied'?'系统通知未获授权，网页内提醒仍可用':'暂未授权，网页内提醒仍可用';}const e=modal?.querySelector('.planner-notification-state');if(e)e.textContent=message;return message;}
function taskForm(task={title:seedTitle,duration:'',deadline:''}){
 draft=null;
 shell('想安排哪件事？',`<p>我会先按你的习惯试排未来31天内的事务。你确认后，才会写入收尾卡并开启提醒。</p><form><label>要做什么<input name="title" maxlength="240" required value="${escape(task.title)}" placeholder="例如：准备周三的课堂报告"></label><div class="planner-row"><label>预计用时（分钟）<input name="duration" type="number" min="5" max="1440" required value="${escape(task.duration)}"></label><label>截止时间<input name="deadline" type="datetime-local" required value="${escape(task.deadline)}"></label></div>${actions('按我的习惯生成安排')}</form><div class="planner-foot-actions"><button data-edit>修改安排习惯</button><button data-list>查看收尾卡</button></div>`);
 modal.querySelector('[data-edit]').onclick=()=>habitsForm();modal.querySelector('[data-list]').onclick=list;
 modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),task={title:String(f.get('title')).trim(),duration:Number(f.get('duration')),deadline:String(f.get('deadline'))};try{preview(task);}catch(error){toast(error.message);}};
}
function blockList(blocks){return `<ol class="planner-blocks">${blocks.map(b=>`<li>${time(b.start)} — ${new Date(b.end).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</li>`).join('')}</ol>`;}
function preview(task){
 const result=NiniPlanner.plan(state.habits,task,state.tasks);draft={task,result};
 shell(result.missing?'时间有点紧，我们先调整一下':'我帮你这样安排，合适吗？',`<h3>${escape(task.title)}</h3><p>截止 ${time(task.deadline)} · 共 ${task.duration} 分钟</p>${blockList(result.blocks)}<p>每段最多 ${state.habits.focus} 分钟，间隔休息 ${state.habits.rest} 分钟。</p>${result.missing?`<p class="planner-shortage">还差 ${result.missing} 分钟。可修改可用时段、预计用时，或自行调整截止；我不会自动改截止。</p>`:'<p>确认后会保存到你的账号，并按已填写的偏好提醒。</p>'}<div class="planner-actions"><button data-edit-task>修改事务</button><button data-edit-habits>调整习惯</button>${!result.missing?'<button class="primary" data-confirm>确认写入收尾卡</button>':''}</div>`);
 modal.querySelector('[data-edit-task]').onclick=()=>taskForm(task);modal.querySelector('[data-edit-habits]').onclick=()=>habitsForm();
 modal.querySelector('[data-confirm]')?.addEventListener('click',async()=>{try{
  // Recalculate at confirmation time so an old preview cannot reserve elapsed time.
  const current=NiniPlanner.plan(state.habits,task,state.tasks);if(current.missing){preview(task);return;}
  await commit({...state,tasks:[...state.tasks,{id:crypto.randomUUID(),...task,deadline:new Date(task.deadline).toISOString(),blocks:current.blocks,status:'pending',createdAt:new Date().toISOString()}]});seedTitle='';list();
 }catch(error){toast(error.message);}});
}
function cardsHTML(){
 if(!state)return '<p>正在读取安排…</p>';
 if(!state.tasks.length)return '<p>还没有安排。先让 NiNi 了解你的习惯，再把想做的事交给它。</p>';
 return state.tasks.slice().reverse().map(t=>`<article class="planner-task"><div class="planner-task-heading"><h3>${escape(t.title)}</h3><span>${{pending:'待完成',done:'已完成',cancelled:'已撤销'}[t.status]}</span></div><p>截止 ${time(t.deadline)} · ${t.duration} 分钟</p>${blockList(t.blocks)}${t.status==='pending'?`<div class="planner-actions"><button data-done="${escape(t.id)}">标记完成</button><button data-snooze="${escape(t.id)}">10分钟后提醒</button><button data-cancel="${escape(t.id)}">撤销安排</button></div>`:''}</article>`).join('');
}
function bindCards(root){root.querySelectorAll('[data-done],[data-snooze],[data-cancel]').forEach(b=>b.onclick=async()=>{try{const type=b.hasAttribute('data-done')?'done':b.hasAttribute('data-cancel')?'cancel':'snooze';const id=b.dataset.done||b.dataset.cancel||b.dataset.snooze;await updateTask(id,type);if(modal)list();}catch(error){toast(error.message);}});}
async function updateTask(id,type){const next=structuredClone(state),t=next.tasks.find(t=>t.id===id);if(!t)return;if(type==='done')t.status='done';else if(type==='cancel')t.status='cancelled';else{const index=activeReminder?.id===id?activeReminder.index:t.blocks.findIndex(b=>!b.reminded);const b=t.blocks[index<0?t.blocks.length-1:index];b.reminded=false;b.snoozeUntil=new Date(Date.now()+10*60000).toISOString();}await commit(next);if(type==='done')window.dispatchEvent(new CustomEvent('nini:task-completed',{detail:{id}}));if(activeReminder?.id===id)dismissReminder();}
function list(){shell('你的事务收尾卡',`<div class="planner-foot-actions"><button class="primary" data-new>安排一件事</button><button data-habits>修改习惯</button><button data-notifications>启用系统通知</button></div><p class="planner-notification-state" role="status"></p>${cardsHTML()}`);modal.querySelector('[data-new]').onclick=()=>taskForm();modal.querySelector('[data-habits]').onclick=()=>habitsForm();modal.querySelector('[data-notifications]').onclick=enableNotifications;bindCards(modal);}
async function open(title=''){try{if(document.querySelector('.nini-playground'))document.querySelector('.nini-play-close')?.click();if(!await load())throw Error('请先登录');seedTitle=title;if(!state.habits)habitsForm();else taskForm();}catch(error){toast(error.message);}}
function renderCards(){const main=document.querySelector('main');if(!main)return;const isCard=[...document.querySelectorAll('nav button.on')].some(b=>b.textContent.trim()==='收尾卡');let area=document.querySelector('#nini-planner-cards');if(!isCard){area?.remove();const original=main.querySelector('.content-inner');if(original)original.hidden=false;return;}const original=main.querySelector('.content-inner');if(original)original.hidden=!!state?.tasks.length&&original.textContent.includes('还没有卡片');if(!area){area=document.createElement('section');area.id='nini-planner-cards';area.className='planner-inline';main.append(area);}const signature=JSON.stringify(state);if(area.dataset.signature===signature)return;area.dataset.signature=signature;area.innerHTML=`<div class="planner-task-heading"><h2>NiNi 的事务收尾卡</h2><button data-open-planner>安排一件事</button></div>${cardsHTML()}`;area.querySelector('[data-open-planner]').onclick=()=>open();bindCards(area);}
function dismissReminder(){document.querySelector('.nini-reminder')?.remove();activeReminder=null;}
async function notifyDue(){if(document.hidden||!document.querySelector('.stage')||loading)return;loading=true;try{if((!state||Date.now()-lastSynced>60000)&&!await load())return;if(activeReminder)return;const due=NiniPlanner.dueTasks(state)[0];if(!due)return;
 const next=structuredClone(state);next.tasks.find(t=>t.id===due.task.id).blocks[due.index].reminded=true;
 await commit(next);activeReminder={id:due.task.id,index:due.index};
 const banner=document.createElement('aside');banner.className='nini-reminder';banner.setAttribute('role','status');banner.innerHTML=`<img src="/nini.webp" alt="NiNi"><div><strong>NiNi 来提醒你啦</strong><p>${escape(due.task.title)}</p><small>${time(due.block.start)} · ${Date.now()>Date.parse(due.block.end)?'已过安排时段，看看是否需要重新安排':Date.now()<Date.parse(due.block.start)?'快到安排时间啦，先准备一下':'到安排时间了，按你的节奏来'}</small><div class="planner-actions"><button data-finish>完成了</button><button data-later>10分钟后</button><button data-dismiss>知道了</button></div></div>`;banner.querySelector('img').src=window.CustomPet?.current?.idle||'/nini.webp';document.body.append(banner);
 banner.querySelector('[data-finish]').onclick=()=>updateTask(due.task.id,'done').catch(e=>toast(e.message));banner.querySelector('[data-later]').onclick=()=>updateTask(due.task.id,'snooze').catch(e=>toast(e.message));banner.querySelector('[data-dismiss]').onclick=dismissReminder;
 if('Notification'in window&&Notification.permission==='granted'){try{const n=new Notification('NiNi · 事务提醒',{body:due.task.title+'\n'+time(due.block.start),icon:window.CustomPet?.current?.idle||location.origin+'/nini.webp',tag:'nini-'+due.task.id});n.onclick=()=>{window.focus();open();n.close();};}catch{}}
 }catch{ /* Existing cards remain available; retry when the local service returns. */ }finally{loading=false;}}
function setup(){const stage=document.querySelector('.stage');const clock=stage?.querySelector('.stage-time');if(clock){const label=new Date().toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});if(clock.textContent!==label)clock.textContent=label;}if(!stage){loadInFlight=null;lastSynced=0;state=null;user=null;draft=null;seedTitle='';close();dismissReminder();publish();return;}if(!stage.querySelector('.planner-entry')){const b=document.createElement('button');b.className='planner-entry';b.textContent='让 NiNi 帮我安排';b.onclick=()=>open();stage.querySelector('.nini-personality-wrap')?.after(b);if(!b.isConnected)stage.append(b);load().catch(e=>toast(e.message));}renderCards();}
window.YuniPlannerUI={
 load:async()=>{if(!await load())throw Error('登录已过期，请重新登录');return structuredClone(state);},
 commit:async next=>structuredClone(await commit(next)),
 update:async(id,type)=>{if(!await load())throw Error('请先登录');await updateTask(id,type);return structuredClone(state);},
 enableNotifications,
 open
};
window.dispatchEvent(new Event('yuni:planner-ready'));
window.addEventListener('nini:chat-turn',event=>{if(/(?:帮我|请|想|需要).*(?:安排|计划)|提醒我|记到收尾卡/.test(event.detail.text)){if(!modal)open(event.detail.text.slice(0,240));}});
window.addEventListener('nini:planner-open',()=>open());
document.addEventListener('keydown',e=>{if(!modal)return;if(e.key==='Escape'){e.stopImmediatePropagation();close();return;}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select')].filter(e=>!e.disabled);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}},true);
new MutationObserver(setup).observe(document.getElementById('app'),{childList:true,subtree:true});setup();setInterval(notifyDue,15000);window.addEventListener('focus',()=>{lastSynced=0;notifyDue();});
})();
