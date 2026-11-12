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

  // The model and Three.js are requested only after this explicit interaction.
  const figure=document.getElementById('nini-greeting'),button=document.getElementById('nini-motion'),status=document.getElementById('nini-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let loaded=false,loading=false,finished=false,paused=false,visible=true,player;
  function sync(){figure.dataset.motion=loaded&&!finished&&!paused&&visible&&!document.hidden?'playing':'paused';button.disabled=loading;button.textContent=loading?'NiNi 正在准备…':!loaded?'和 NiNi 打个招呼 ↗':finished?'再打个招呼 ↗':paused?'继续动作 ↗':'暂停动作';}
  button.addEventListener('click',async()=>{
    if(loading)return;
    if(!loaded){loading=true;sync();status.textContent='第一次准备动作需要稍等片刻。';try{const module=await import('./nini-player.js');player=await module.startGreeting();loaded=true;paused=false;status.textContent='你好呀。慢慢来，我陪你。';}catch{status.textContent='这台设备暂时无法播放立体动作，NiNi 的插图依然陪着你。';}finally{loading=false;sync();}}
    else if(finished){finished=false;paused=false;player.replay();sync();}
    else{paused=!paused;sync();}
  });
  window.addEventListener('nini:greeting-finished',()=>{finished=true;status.textContent='你好呀。慢慢来，我陪你。';sync();});
  window.addEventListener('nini:greeting-lost',()=>{loaded=false;finished=false;sync();status.textContent='动作已暂停，仍可查看 NiNi 插图。';});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',()=>{if(reduced.matches)paused=true;sync();});
  if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.1}).observe(figure);
  sync();
})();
