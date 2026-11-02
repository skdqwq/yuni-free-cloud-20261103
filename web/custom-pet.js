(() => {
 const core=window.CustomPetCore,api={current:null};window.CustomPet=api;
 let currentStage=null,userId=null,record=null,dialog=null,version=0;
 function notify(){api.current=record?.active?record.images:null;window.dispatchEvent(new Event('nini:custom-pet-change'));}
 function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('yuni-custom-pets',1);req.onupgradeneeded=()=>req.result.createObjectStore('pets');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function read(id){const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('pets').objectStore('pets').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}finally{db.close();}}
 async function save(id,data){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('pets','readwrite');tx.objectStore('pets').put(data,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
 async function image(file){const error=core.fileError(file);if(error)throw Error(error);const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8192||img.naturalHeight>8192)throw Error('图片尺寸过大，请选择较小的图片');const scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png');}catch(e){throw Error(e.message==='图片尺寸过大，请选择较小的图片'?e.message:'图片无法读取，请换一张图片');}finally{URL.revokeObjectURL(url);}}
 function close(){dialog?.remove();dialog=null;}
 function open(){
  if(!userId||dialog)return;const id=userId;let draft={...(record?.images||{})},pending=0;dialog=document.createElement('div');dialog.className='custom-pet-overlay';
  dialog.innerHTML='<section class="custom-pet-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-pet-title"><button class="custom-pet-close" type="button" aria-label="关闭">×</button><h2 id="custom-pet-title">自定义宠物</h2><p>上传一张待机图片即可使用；其他动作图片可选。支持 PNG、JPG、WebP，每张不超过 5 MB。透明背景效果更好。</p><div class="custom-pet-fields"></div><p class="custom-pet-tip">图片保存在当前设备的浏览器中，按账号区分；多张图片会在对应动作时切换。</p><p class="custom-pet-status" role="status"></p><div class="custom-pet-actions"><button type="button" data-restore>切回 NiNi</button><button type="button" data-save>保存并使用</button></div></section>';
  const shell=dialog,fields=dialog.querySelector('.custom-pet-fields'),status=dialog.querySelector('.custom-pet-status'),saveButton=dialog.querySelector('[data-save]');
  for(const [slot,label] of [['idle','待机（必选）'],['wave','打招呼（可选）'],['happy','开心（可选）'],['jump','跳跃（可选）']]){
   const row=document.createElement('div');row.className='custom-pet-field';row.innerHTML=`<label>${label}<input type="file" accept="image/png,image/jpeg,image/webp"></label><img alt="${label}预览"><button type="button">移除</button>`;const img=row.querySelector('img');function preview(){if(draft[slot]){img.src=draft[slot];img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}}preview();
   row.querySelector('input').onchange=async e=>{const f=e.target.files[0];if(!f)return;pending++;saveButton.disabled=true;try{const result=await image(f);if(dialog===shell&&userId===id){draft[slot]=result;preview();status.textContent=`${label}图片已选择`;}}catch(err){if(dialog===shell)status.textContent=err.message;}finally{pending--;if(dialog===shell)saveButton.disabled=pending>0;e.target.value='';}};
   row.querySelector('button').onclick=()=>{delete draft[slot];preview();status.textContent='图片已从当前设置移除，保存后生效。';};fields.append(row);
  }
  dialog.querySelector('.custom-pet-close').onclick=close;dialog.onclick=e=>{if(e.target===dialog)close();};
  dialog.querySelector('[data-save]').onclick=async()=>{if(pending)return;if(!draft.idle){status.textContent='请先上传一张待机图片。';return;}try{saveButton.disabled=true;await save(id,{active:true,images:draft});if(userId!==id)return;record={active:true,images:draft};notify();close();}catch{status.textContent='保存失败，请检查浏览器存储空间后重试。';}finally{saveButton.disabled=false;}};
  dialog.querySelector('[data-restore]').onclick=async()=>{try{await save(id,{active:false,images:record?.images||{}});if(userId!==id)return;record={active:false,images:record?.images||{}};notify();close();}catch{status.textContent='切换失败，请重试。';}};
  document.body.append(dialog);dialog.querySelector('.custom-pet-close').focus();
 }
 async function setup(){const stage=document.querySelector('.stage');if(!stage){if(currentStage){version++;currentStage=null;userId=null;record=null;close();notify();}return;}if(stage===currentStage)return;currentStage=stage;const token=++version;userId=null;record=null;notify();
  try{const response=await fetch('/api/auth/me');if(!response.ok)return;const user=await response.json();if(token!==version||stage!==document.querySelector('.stage')||!user.id)return;userId=String(user.id);const id=userId,loaded=await read(id);if(token!==version||userId!==id)return;record=loaded;notify();const button=document.createElement('button');button.type='button';button.className='custom-pet-open';button.textContent='更换宠物';button.onclick=open;const anchor=stage.querySelector('.nini-personality-wrap');(anchor||stage).append(button);}
  catch{if(token===version){const hint=document.createElement('p');hint.className='custom-pet-error';hint.textContent='宠物设置暂不可用，请检查浏览器存储权限。';stage.append(hint);}}
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog){e.stopImmediatePropagation();close();}},true);
 new MutationObserver(setup).observe(document.getElementById('app'),{childList:true,subtree:true});setup();
})();
