// An in-app desktop-pet style shell. It never creates an operating-system overlay.
(() => {
let host=null,actor=null,pending=false,drag=null,mode=window.NiniLiveMode||'idle',key='';
function clamp(x,y){return {x:Math.max(8,Math.min(innerWidth-148,x)),y:Math.max(8,Math.min(innerHeight-190,y))};}
function position(x,y,save=false){const p=clamp(x,y);host.style.left=p.x+'px';host.style.top=p.y+'px';if(save)localStorage.setItem(key,JSON.stringify(p));}
function remove(){actor?.dispose();host?.remove();host=null;actor=null;drag=null;}
async function setup(){if(!document.querySelector('.stage')){remove();return;}if(host||pending)return;pending=true;try{const r=await fetch('/api/auth/me');if(!r.ok)return;const u=await r.json();if(!document.querySelector('.stage'))return;key='nini-pet-position:'+u.id;
 host=document.createElement('div');host.className='nini-desktop-pet';host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label','NiNi 桌宠，可拖动，点击打开互动');host.innerHTML='<span class="nini-pet-bubble">戳戳我，或拖我到旁边</span><span class="nini-pet-figure"></span>';document.body.append(host);actor=NiniMotion.create(host.querySelector('.nini-pet-figure'));if(!['focus','rest','comfort'].includes(window.NiniLiveMode))actor.play('wave',2200);
 let p={x:innerWidth-170,y:Math.max(80,innerHeight-405)};try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))p=saved;}catch{}position(p.x,p.y);
 host.addEventListener('pointerdown',e=>{const r=host.getBoundingClientRect();host.getAnimations().forEach(a=>a.cancel());position(r.left,r.top);drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};host.setPointerCapture(e.pointerId);});
 host.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)drag.moved=true;position(drag.left+dx,drag.top+dy);});
 host.addEventListener('pointerup',()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved){position(parseFloat(host.style.left),parseFloat(host.style.top),true);actor.play('happy');}else window.dispatchEvent(new Event('nini:pet-open'));});
 host.addEventListener('pointercancel',()=>{drag=null;});host.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.dispatchEvent(new Event('nini:pet-open'));}});
 }finally{pending=false;}}
window.addEventListener('nini:expression',e=>{if(e.detail.duration===0)mode=e.detail.name;if(host)host.querySelector('.nini-pet-bubble').textContent=e.detail.name==='focus'?'我安静陪你专注':e.detail.name==='rest'?'歇歇眼睛，喝口水':e.detail.name==='happy'?'做得好！给你一个庆祝':'我在这儿，戳戳我';});
window.addEventListener('resize',()=>{if(host)position(parseFloat(host.style.left),parseFloat(host.style.top));});
document.addEventListener('focusin',e=>{if(!host||!e.target.matches('input,textarea'))return;const pet=host.getBoundingClientRect(),input=e.target.getBoundingClientRect();if(pet.right>input.left&&pet.left<input.right&&pet.bottom>input.top&&pet.top<input.bottom)position(pet.left,input.top-pet.height-18);});
setInterval(()=>{if(!host||drag||document.hidden||['focus','rest','comfort'].includes(mode)||document.querySelector('.nini-playground,.companion-overlay,.planner-overlay'))return;actor.play('walk',2600);const p=host.getBoundingClientRect(),distance=p.left>innerWidth/2?-24:24;host.animate([{transform:'translateX(0)'},{transform:`translateX(${distance}px)`},{transform:'translateX(0)'}],{duration:2600,easing:'ease-in-out'});},24000);
new MutationObserver(setup).observe(document.getElementById('app'),{childList:true,subtree:true});setup();
})();
