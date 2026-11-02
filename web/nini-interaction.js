(() => {
const personalities = {
 practical:{label:'务实',style:'清晰',line:'先说最重要的那件事，我们一起理清下一步。',hello:'我们先聊一件事。今天最想解决什么？'},
 gentle:{label:'温柔',style:'温柔',line:'不用急着把话说好，我在这里听。',hello:'我过来陪你啦。想说什么都可以。'},
 cute:{label:'可爱',style:'轻松',line:'啾！戳戳我，一起玩一会儿吧。',hello:'蹦！我来啦～要不要和我说说今天？'},
 boss:{label:'霸总',style:'霸总',line:'别一个人硬扛。今晚，有我陪你。',hello:'过来，陪你的人到了。今天谁让你不开心了？'}
};
let personality=localStorage.getItem('yuni-nini-personality')||'gentle';
if(!personalities[personality]) personality='gentle';
let lastStage=null,dialog=null,returnFocus=null,centralActor=null;
const emotionTracker=NiniEmotion.createTracker();
const comfortLines={
 practical:'听起来这会儿不太好受。我陪你把最难的那件事理一理，也可以先歇一会。',
 gentle:'听起来你这会儿有些难受。我过来陪陪你，不急着说，也不用马上好起来。',
 cute:'小企鹅过来陪你啦。难受的时候不用勉强自己开心，要不要和我说说？',
 boss:'别一个人硬扛。我在这儿，想说就说，想安静一会儿我也陪着。'
};
let pendingComfort=null;
const cooldown=5*60*1000;
const recentlyShown=()=>Date.now()-Number(sessionStorage.getItem('nini-last-comfort')||0)<cooldown;
window.addEventListener('nini:chat-turn',event=>{
 const reason=emotionTracker.observe(event.detail.sessionId,event.detail.text);
 if(!reason||dialog||document.querySelector('.planner-overlay,.companion-overlay')||recentlyShown())return;
 clearTimeout(pendingComfort);
 const started=Date.now();
 const tryComfort=()=>{
   const input=document.querySelector('main textarea, main input[placeholder*=组织语言]');
   if(dialog||document.querySelector('.planner-overlay,.companion-overlay')||recentlyShown()||document.hidden||!input||input.value.trim())return;
   const state=document.querySelector('.stage .nini')?.dataset.state;
   if(state==='thinking'||state==='speaking'){
     if(Date.now()-started<15000)pendingComfort=setTimeout(tryComfort,350);
     return;
   }
   sessionStorage.setItem('nini-last-comfort',String(Date.now()));
   open('comfort');
 };
 pendingComfort=setTimeout(tryComfort,1200);
});
window.addEventListener('nini:pet-open',()=>open());
function actor(el){return window.NiniMotion.create(el);}
function choose(id,stage){
 personality=id;localStorage.setItem('yuni-nini-personality',id);stage.dataset.personality=id;
 stage.querySelectorAll('.nini-personalities button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.personality===id)));
 syncStyle(stage);stage.querySelector('.nini-hint').textContent=personalities[id].line;
}
function syncStyle(stage){const target=[...stage.querySelectorAll('.styles button')].find(b=>b.textContent.trim()===personalities[personality].style);if(target&&!target.classList.contains('on'))target.click();}
function close(){if(!dialog)return;clearTimeout(pendingComfort);sessionStorage.setItem('nini-last-comfort',String(Date.now()));centralActor.dispose();dialog.remove();dialog=null;centralActor=null;document.body.classList.remove('nini-dialog-open');document.getElementById('app').inert=false;returnFocus?.focus();}
function open(reason){
 if(dialog)return;returnFocus=document.activeElement;
 const comforting=reason==='comfort';
 dialog=document.createElement('div');dialog.className='nini-playground';
 dialog.innerHTML='<div class="nini-play-center" role="dialog" aria-modal="true" aria-label="和 NiNi 玩一会"><button class="nini-play-close" aria-label="关闭互动">×</button><p class="nini-speech" role="status"></p><button class="nini-center-pet" aria-label="摸摸 NiNi，让它跳一跳"></button><div class="nini-play-actions"><button data-play="happy">摸摸头</button><button data-play="chat">陪我聊聊 →</button><button data-play="plan">帮我安排事务</button><button data-play="companion">专注 · 心情 · 玩耍</button></div><small>戳戳我试试 · Esc 返回</small></div>';
 document.body.appendChild(dialog);document.body.classList.add('nini-dialog-open');document.getElementById('app').inert=true;
 const pet=dialog.querySelector('.nini-center-pet');centralActor=actor(pet);
 
 const speak=text=>{dialog.querySelector('.nini-speech').textContent=window.CustomPet?.current?text.replace('小企鹅','我'):text;};speak(comforting?comfortLines[personality]:personalities[personality].hello);
 dialog.dataset.reason=comforting?'comfort':'click';
 if(comforting){dialog.querySelector('[data-play=jump]')?.remove();dialog.querySelector('small').textContent='想聊就聊，想安静一会儿也可以 · Esc 返回';}
 centralActor.play(comforting?'comfort':'wave');let touches=0;
 pet.addEventListener('click',()=>{touches++;centralActor.play(comforting?'nod':['wave','nod','think','walk','dance','jump'][(touches-1)%6]);speak(comforting?comfortLines[personality]:personality==='boss'?'行，再陪你玩一次。今天想和我聊什么？':personality==='practical'?'活动一下也好。准备好了，我们就聊。':personality==='cute'?'嘿嘿，再蹦一下！接住我的开心～':'谢谢你的摸摸。你愿意的话，我陪你聊一会。');});
 dialog.querySelector('.nini-play-close').onclick=close;
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 dialog.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>{if(b.dataset.play==='companion'){close();window.dispatchEvent(new CustomEvent('nini:companion-open'));return;}if(b.dataset.play==='plan'){close();window.dispatchEvent(new Event('nini:planner-open'));return;}if(b.dataset.play==='chat'){close();[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim()==='聊聊')?.click();document.querySelector('main textarea, main input[placeholder*=组织语言]')?.focus();return;}centralActor.play(b.dataset.play);speak(b.dataset.play==='happy'?(personality==='boss'?'只准你摸。好了，今天想和我聊什么？':'嘿嘿，收到你的摸摸啦。'):'蹦！我在这儿，来和我聊聊吧。');});
 pet.focus();
}
function setup(){
 const stage=document.querySelector('.stage'),nini=stage?.querySelector('.nini');if(!stage||!nini||stage===lastStage)return;lastStage=stage;
 nini.setAttribute('role','button');nini.tabIndex=0;nini.setAttribute('aria-label','点击 NiNi，让它跳到中央');const side=actor(nini);
 nini.addEventListener('click',open);nini.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
 const controls=document.createElement('div');controls.className='nini-personality-wrap';
 controls.innerHTML='<div class="nini-personality-label">NiNi 的性格</div><div class="nini-personalities" role="group" aria-label="选择 NiNi 的性格">'+Object.entries(personalities).map(([id,p])=>`<button type="button" data-personality="${id}" aria-pressed="false">${p.label}</button>`).join('')+'</div><p class="nini-hint"></p>';
 controls.querySelectorAll('button').forEach(b=>b.onclick=()=>{choose(b.dataset.personality,stage);side.play('talk');});
 const styles=stage.querySelector('.styles');if(styles){styles.after(controls);new MutationObserver(()=>syncStyle(stage)).observe(styles,{attributes:true,attributeFilter:['class'],subtree:true});}else stage.appendChild(controls);
 choose(personality,stage);
}
 document.addEventListener('keydown',e=>{if(!dialog)return;if(e.key==='Escape'){close();return;}if(e.key==='Tab'){const buttons=[...dialog.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}});
 new MutationObserver(setup).observe(document.getElementById('app'),{childList:true,subtree:true});setup();
})();
