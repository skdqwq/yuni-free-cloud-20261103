(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal, owner, turns = [], started, reminder, recognition, busy = false;
  const titles = {self:'留给自己', tomorrow:'明天照着说', keep:'先放在这里'};
  async function api(path, method='GET', body) {
    const r = await fetch('/api/night' + path, {method, credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
    if (!r.ok) throw new Error(r.status === 401 ? '请先登录，再试一次。' : '暂时没有完成，请稍后再试。');
    return r.json();
  }
  async function checkOwner() {
    const r = await fetch('/api/auth/me', {credentials:'same-origin'});
    if (!r.ok) throw new Error('请先登录，再进入睡前空间。');
    const me = await r.json();
    if (owner !== me.id) { turns=[]; started=0; clearTimeout(reminder); owner=me.id; }
  }
  function close() {
    recognition?.stop(); recognition=null; modal?.remove(); modal=null;
    turns=[]; started=0; clearTimeout(reminder);
    document.body.classList.remove('night-open');
    document.querySelector('.night-entry')?.focus();
  }
  function status(text) { const el = modal?.querySelector('[data-status]'); if(el) el.textContent=text; }
  function shell(title, content) {
    if (!modal) {
      modal=document.createElement('div'); modal.className='night-overlay';
      modal.addEventListener('click', e=>{if(e.target===modal) close();});
      document.body.append(modal); document.body.classList.add('night-open');
    }
    modal.innerHTML=`<section class="night-dialog" role="dialog" aria-modal="true" aria-labelledby="night-title"><header><span>屿 YUNI · 睡前空间</span><button type="button" data-close aria-label="关闭睡前空间">×</button></header><h2 id="night-title">${title}</h2><div class="night-content">${content}</div><p class="night-status" role="status" data-status></p></section>`;
    modal.querySelector('[data-close]').onclick=close;
  }
  function menu() {
    shell('今晚，先照顾一下自己', `<p class="night-lead">不用把事情讲完整，也不用今晚解决。你可以选一个舒服的方式开始。</p><div class="night-grid"><button data-action="chat"><b>和 NiNi 说说</b><span>说一点，或者只是待一会儿</span></button><button data-action="card"><b>放下一件事</b><span>写成封存卡，明天再看</span></button><button data-action="cards"><b>查看封存卡</b><span>自己决定什么时候打开</span></button><button data-action="prefs"><b>我的陪伴偏好</b><span>少追问、少建议，由你决定</span></button></div><p class="night-note">NiNi 是 AI 伙伴，不提供诊断或治疗；如遇紧急危险，请联系身边可信任的人或当地急救服务。</p>`);
    modal.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>({chat,card:cardForm,cards:listCards,prefs:preferences})[b.dataset.action]());
  }
  async function open() { try { await checkOwner(); menu(); } catch(e) { alert(e.message); } }
  function back(){ return '<button type="button" class="night-back" data-back>← 返回睡前空间</button>'; }
  function chat() {
    if (!started) { started=Date.now(); reminder=setTimeout(()=>{if(modal?.querySelector('.night-thread')) status('已经聊了一会儿。你可以继续，也可以在这里停下来休息。');},15*60*1000); }
    shell('和 NiNi 说说',`${back()}<p class="night-note">这是 AI 对话，内容会发送给模型服务；本窗口的对话不会保存，关闭或刷新后无法恢复。</p><div class="night-thread" aria-live="polite"></div><form class="night-chat-form"><label for="night-input">想说的话</label><textarea id="night-input" maxlength="2000" rows="3" placeholder="想到哪里，就说到哪里"></textarea><div class="night-actions"><button type="button" data-voice>语音输入</button><button type="submit" class="primary">发送</button><button type="button" data-finish>今晚先到这里</button></div></form><p class="night-note">语音输入依赖浏览器支持和授权，识别内容会先显示在输入框，由你决定是否发送。</p>`);
    modal.querySelector('[data-back]').onclick=menu;
    const thread=modal.querySelector('.night-thread');
    const draw=()=>{thread.innerHTML=turns.length?turns.map(t=>`<div class="night-bubble ${t.role==='user'?'mine':''}">${esc(t.text)}</div>`).join(''):'<div class="night-bubble">我在。今晚有什么想放下的，慢慢说就好。</div>';thread.scrollTop=thread.scrollHeight;};draw();
    modal.querySelector('[data-finish]').onclick=()=>{clearTimeout(reminder); started=0; turns=[]; recognition?.stop(); recognition=null; menu();status('今晚就到这里。愿你有一段安静的时间。');};
    const input=modal.querySelector('#night-input');
    modal.querySelector('[data-voice]').onclick=()=>{
      const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!Speech){status('当前浏览器不支持语音输入，可以使用键盘或手机输入法语音。');return;}
      try { recognition?.stop(); recognition=new Speech(); recognition.lang='zh-CN'; recognition.interimResults=false;
        recognition.onresult=e=>{input.value += e.results[0][0].transcript; status('已识别，请检查后再发送。');};
        recognition.onerror=()=>status('语音识别未完成，请检查浏览器权限或使用文字输入。'); recognition.start(); status('正在听，请说话。');
      } catch {status('暂时无法开始语音输入。');}
    };
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const text=input.value.trim();if(!text||busy)return;const history=turns.slice(-6); turns.push({role:'user',text});input.value='';draw();busy=true;const send=modal.querySelector('button[type=submit]');send.disabled=true;status('NiNi 正在想怎么回应…');
      try{const result=await api('/reply','POST',{text,turn:Math.floor(turns.length/2)+1,history});turns.push({role:'assistant',text:result.reply});if(modal?.contains(thread)){draw();status(result.engine==='fallback'?'模型暂不可用，已使用简短备用回复。':'');}}
      catch(err){turns.pop(); if(modal?.contains(thread)){input.value=text;draw();status(err.message);}}finally{busy=false;if(send.isConnected)send.disabled=false;}
    };
  }
  function cardForm() {
    shell('把这件事先放在这里',`${back()}<p class="night-lead">可以是一件事，也可以是一句明天想说的话。只有点击保存后才会写入你的账号。</p><form><label for="night-card">想留下的内容</label><textarea id="night-card" maxlength="500" rows="4" required placeholder="例如：明天我想先说清楚自己的感受"></textarea><fieldset><legend>这句话想怎么用？</legend><label><input type="radio" name="purpose" value="self" checked> 留给自己看</label><label><input type="radio" name="purpose" value="tomorrow"> 明天照着说</label><label><input type="radio" name="purpose" value="keep"> 不发出去，只是放着</label></fieldset><div class="night-actions"><button class="primary" type="submit">保存封存卡</button><button type="button" data-list>查看我的卡片</button></div></form><p class="night-note">保存的内容会同步到你的账号；不会自动发送给别人，也不会自动推送提醒。你可以随时删除。</p>`);
    modal.querySelector('[data-back]').onclick=menu;modal.querySelector('[data-list]').onclick=listCards;
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault(); const f=new FormData(e.target), button=e.target.querySelector('[type=submit]');button.disabled=true;try{await api('/cards','POST',{content:modal.querySelector('#night-card').value.trim(),purpose:f.get('purpose')});await listCards();status('已经收好，今晚不必急着处理。');}catch(err){status(err.message);}finally{button.disabled=false;}};
  }
  async function listCards(){
    shell('我的封存卡',`${back()}<p>正在读取…</p>`);modal.querySelector('[data-back]').onclick=menu;
    try{const data=await api('/cards');if(!modal)return;shell('我的封存卡',`${back()}<p class="night-lead">想看的时候再打开，不需要今晚解决。</p><div class="night-cards">${data.length?data.map(c=>`<article><div><span>${esc(titles[c.purpose]||'留给自己')}</span><time>${esc(new Date(c.created_at).toLocaleDateString('zh-CN'))}</time></div><p>${esc(c.content)}</p><button type="button" data-delete="${esc(c.id)}">删除这张卡</button></article>`).join(''):'<p>这里还没有卡片。</p>'}</div><button type="button" class="primary" data-new>写一张封存卡</button>`);
      modal.querySelector('[data-back]').onclick=menu;modal.querySelector('[data-new]').onclick=cardForm;
      modal.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('确定删除这张封存卡吗？删除后无法恢复。'))return;try{await api('/cards/'+encodeURIComponent(b.dataset.delete),'DELETE');await listCards();status('已删除。');}catch(err){status(err.message);}});
    }catch(err){status(err.message);}
  }
  async function preferences(){
    shell('我的陪伴偏好',`${back()}<p>正在读取…</p>`);modal.querySelector('[data-back]').onclick=menu;
    try{const p=await api('/preferences');if(!modal)return;shell('我的陪伴偏好',`${back()}<p class="night-lead">由你选择是否保存以下偏好，以便下次在睡前空间使用。</p><form><label class="night-check"><input type="checkbox" name="fewerQuestions" ${p.fewerQuestions?'checked':''}> 少追问</label><label class="night-check"><input type="checkbox" name="shortStories" ${p.shortStories?'checked':''}> 故事短一点</label><label class="night-check"><input type="checkbox" name="noAdvice" ${p.noAdvice?'checked':''}> 不主动给建议</label><div class="night-actions"><button type="submit" class="primary">保存偏好</button><button type="button" data-clear>删除已保存偏好</button></div></form><p class="night-note">这里只保存上述开关，不保存事件内容或生成情绪画像；可随时删除。原应用的档案设置仍可在“档案”中管理。</p>`);
      modal.querySelector('[data-back]').onclick=menu;modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/preferences','PUT',{fewerQuestions:f.has('fewerQuestions'),shortStories:f.has('shortStories'),noAdvice:f.has('noAdvice')});status('偏好已保存。');}catch(err){status(err.message);}};
      modal.querySelector('[data-clear]').onclick=async()=>{try{await api('/preferences','DELETE');await preferences();status('已删除保存的偏好。');}catch(err){status(err.message);}};
    }catch(err){status(err.message);}
  }
  document.addEventListener('keydown',e=>{if(!modal)return;if(e.key==='Escape'){e.stopImmediatePropagation();close();return;}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,input,textarea')].filter(el=>!el.disabled);if(!items.length)return;if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}},true);
  function mount(){const stage=document.querySelector('.stage');if(!stage){if(modal)close();owner=null;turns=[];started=0;clearTimeout(reminder);return;}if(stage.querySelector('.night-entry'))return;const b=document.createElement('button');b.type='button';b.className='night-entry';b.innerHTML='<b>今晚的睡前空间</b><span>说说心情 · 放下一件事</span>';b.onclick=open;const planner=stage.querySelector('.planner-entry');if(planner)planner.before(b);else stage.append(b);}
  new MutationObserver(mount).observe(document.getElementById('app'),{childList:true,subtree:true});mount();
})();
