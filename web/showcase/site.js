(() => {
  'use strict';
  const form=document.getElementById('demo-form'),result=document.getElementById('demo-result');
  function preview(){
    const data=new FormData(form),title=String(data.get('task')).trim(),duration=Number(data.get('duration'));
    if(!title){result.textContent='先写下一件想做的事。';return;}
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(0,0,0,0);
    const deadline=new Date(tomorrow);deadline.setHours(20,0,0,0);
    const habits={windows:[{start:'18:00',end:'20:00'}],weekdays:[0,1,2,3,4,5,6],focus:25,rest:5,lead:0,quietOutside:true};
    const time=value=>new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
    try{
      const plan=window.NiniPlanner.plan(habits,{title,duration,deadline:deadline.toISOString()},[],tomorrow.getTime());
      result.replaceChildren();
      const heading=document.createElement('h4');heading.textContent='「'+title+'」可以这样开始';result.append(heading);
      const list=document.createElement('ol');
      plan.blocks.forEach((block,index)=>{const row=document.createElement('li'),number=document.createElement('span'),slot=document.createElement('b'),minutes=document.createElement('small');number.textContent=String(index+1).padStart(2,'0');slot.textContent=time(block.start)+'–'+time(block.end);minutes.textContent=Math.round((Date.parse(block.end)-Date.parse(block.start))/60000)+' 分钟专注';row.append(number,slot,minutes);list.append(row);});
      result.append(list);
      if(plan.missing){const notice=document.createElement('p');notice.className='shortage';notice.textContent='还差 '+plan.missing+' 分钟没有排下。可以在应用里增加空闲时段，或调整任务时长。';result.append(notice);}
    }catch(error){result.textContent=error.message||'请检查任务和时长。';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();preview();});preview();
  const descriptions={quiet:'去睡前小岛，什么都不说也可以。不用解释，也没有一定要完成的流程。',note:'把还挂念的事写成一张小纸条。由你选择保存，想看的时候再打开。',chat:'想多说一点的时候，再和 NiNi 聊聊。对话是可选的陪伴，也可以随时停下来。'};
  document.querySelectorAll('[data-space]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-space]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.getElementById('space-detail').textContent=descriptions[button.dataset.space];}));

  // Show the illustration immediately, then greet once when each figure enters view.
  // Only visible figures animate; no loop deforms the model or its wings.
  function animateFigure(figureId,buttonId,statusId){
    const figure=document.getElementById(figureId),button=document.getElementById(buttonId),status=document.getElementById(statusId),replay=document.querySelector(`[data-nini-replay="${figureId}"]`);
    if(!figure||!button)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let loaded=false,loading=false,paused=false,visible=false,manual=false,attempted=false,player,scheduled;
    function sync(){
      const playing=!paused&&visible&&!document.hidden&&(!reduced.matches||manual);
      figure.dataset.motion=playing?'playing':'paused';
      button.disabled=loading;
      button.textContent=loading?'NiNi 正在准备…':!loaded?'播放打招呼 ↗':paused?'继续动作':'暂停动作';
      button.setAttribute('aria-pressed',String(loaded&&!paused));
      if(replay)replay.hidden=!loaded;
    }
    async function load(){
      if(loaded||loading)return;attempted=true;loading=true;sync();
      try{const module=await import('./nini-player.js?v=showcase-20261112-2');player=await module.startGreeting({figureId,idleMotion:true});loaded=true;if(status)status.textContent='你好呀。慢慢来，我陪你。';}
      catch{if(status)status.textContent='NiNi 在这里，陪你慢慢来。';}
      finally{loading=false;sync();}
    }
    button.addEventListener('click',async()=>{if(loading)return;if(!loaded){manual=true;paused=false;await load();}else{paused=!paused;if(!paused)manual=true;sync();}});
    replay?.addEventListener('click',()=>{if(!player)return;manual=true;paused=false;player.replay();sync();});
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener('change',()=>{manual=false;if(reduced.matches)paused=true;sync();});
    window.addEventListener('nini:greeting-lost',event=>{if(event.detail?.figureId!==figureId)return;loaded=false;sync();});
    function observe(on){visible=on;clearTimeout(scheduled);sync();if(on&&!attempted&&!reduced.matches&&!navigator.connection?.saveData)scheduled=setTimeout(load,400);}
    if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>observe(entry.isIntersecting),{threshold:.15}).observe(figure);else observe(true);
    sync();
  }
  animateFigure('nini-hero','hero-nini-motion','hero-nini-status');
  animateFigure('nini-greeting','nini-motion','nini-status');
})();
