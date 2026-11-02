// Restore the NiNi animation used in the 18:06 experience version.
(() => {
 window.NiniLiveMode=window.NiniLiveMode||'idle';
 function create(el){
  const sprite=document.createElement('span');sprite.className='nini-sprite';el.appendChild(sprite);
  let timer=null,busy=false,disposed=false,mode=window.NiniLiveMode;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame=n=>{const map=[0,1,1,0,0,1,2,2,0,2,3,1];const f=n<12?map[n]:n-12;sprite.dataset.atlas=n<12?'hd':'jump-hd';sprite.style.backgroundPosition=`${(f%2)*100}% ${Math.floor(f/2)*100}%`;el.dataset.frame=n;const custom=window.CustomPet?.current;const src=window.CustomPetCore?.imageFor(custom,el.dataset.action||'idle');if(src){sprite.dataset.custom='true';sprite.style.backgroundImage=`url("${src}")`;}else{delete sprite.dataset.custom;sprite.style.removeProperty('background-image');}};
  function sequence(frames,speed,done){clearTimeout(timer);let i=0;function tick(){if(disposed||!el.isConnected)return;frame(frames[i++]);if(i<frames.length)timer=setTimeout(tick,speed);else if(done)timer=setTimeout(done,speed);}tick();}
  function idle(){busy=false;el.dataset.action=mode;if(reduced||mode==='focus'||mode==='rest'){frame(0);return;}sequence([0,0,0,0,0,0,1,2,1,0],330,idle);}
  function play(action,duration){if(disposed)return;if(duration===0){mode=action;window.NiniLiveMode=action;idle();return;}busy=true;el.dataset.action=action;if(reduced){frame(action==='talk'?9:action==='jump'?14:6);timer=setTimeout(idle,900);return;}const frames={wave:[4,5,6,7,6,5,4],talk:[8,9,10,9,11,9,8],jump:[12,12,13,14,14,15,0],happy:[0,2,10,11,0]};sequence(frames[action]||frames.wave,action==='jump'?140:180,idle);}
  const hover=()=>{if(!busy&&mode!=='focus'&&mode!=='rest')play('wave');};
  const move=e=>{const r=el.getBoundingClientRect();sprite.style.setProperty('--gaze',`${Math.max(-4,Math.min(4,(e.clientX-r.left-r.width/2)/35))}deg`);};
  const leave=()=>sprite.style.setProperty('--gaze','0deg');
  const expression=e=>play(e.detail.name,e.detail.duration??1800);
  const change=()=>frame(Number(el.dataset.frame||0));window.addEventListener('nini:custom-pet-change',change);
  el.addEventListener('pointerenter',hover);el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave);window.addEventListener('nini:expression',expression);
  idle();return {play,dispose(){disposed=true;clearTimeout(timer);el.removeEventListener('pointerenter',hover);el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);window.removeEventListener('nini:expression',expression);window.removeEventListener('nini:custom-pet-change',change);sprite.remove();}};
 }
 window.NiniMotion={create,actions:[]};
})();
