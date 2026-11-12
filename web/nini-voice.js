(() => {
 const synth=window.speechSynthesis,core=window.NiniVoiceCore,clone=window.YuniClone;
 if(!synth||!core)return;
 const localModels=Boolean(clone&&core.localModelsAllowed(location.origin));
 const nativeSpeak=synth.speak.bind(synth),nativeCancel=synth.cancel.bind(synth);
 const managerUrl=location.origin+'/api/voice-manager';
 async function manager(method='GET',body){if(!localModels)throw Error('当前使用设备系统声音。');const r=await fetch(managerUrl,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'声音管理服务不可用');return v;}
 let epoch=0, sampleReady=false, panel=null, source='system';
 const presets={Serena:'温柔女声 · Serena',Vivian:'明亮女声 · Vivian',Uncle_Fu:'醇厚男声 · 福叔',Dylan:'清朗男声 · Dylan',Eric:'活泼男声 · Eric'};
 const status=text=>{const el=panel?.querySelector('[data-status]');if(el)el.textContent=text;};
 synth.cancel=function(){epoch++;if(localModels)clone.stop();return nativeCancel();};
 synth.speak=function(u){
  const morning=document.querySelector('main .view-morning');
  if(localModels&&morning&&source!=='system'&&(u.lang||'').toLowerCase().startsWith('zh')){
   const id=++epoch;let started=false;
   const progress=message=>{if(id!==epoch)return;status(message);if(message==='正在播放'&&!started){started=true;u.dispatchEvent(new Event('start'));}};
   const chosen=source;const operation=(async()=>{progress('正在准备本地语音服务…');await manager('POST',{action:'start',kind:chosen==='sample'?'clone':'preset'});if(id!==epoch)return;return chosen==='sample'?clone.speak(u.text,progress):clone.speakPreset(u.text,chosen,progress);})();
   operation.then(()=>{if(id===epoch){status('播放结束');u.dispatchEvent(new Event('end'));}}).catch(e=>{if(id===epoch&&e.name!=='AbortError'){status(e.message||'语音生成失败，请切换系统声音。');u.dispatchEvent(new Event('error'));}});
   return;
  }
  if((u.lang||'').toLowerCase().startsWith('zh')){u.rate=core.rate(localStorage.getItem('nini-voice-rate'));const chosen=core.select(synth.getVoices(),localStorage.getItem('nini-voice-id'));if(chosen)u.voice=chosen;}
  return nativeSpeak(u);
 };
 function mount(){
  const morning=document.querySelector('main .view-morning');
  if(!morning){if(panel){synth.cancel();if(localModels)clone.clear();sampleReady=false;source='system';panel=null;}return;}
  if(morning.querySelector('.nini-voice-settings'))return;
  const section=document.createElement('details');panel=section;section.className='nini-voice-settings';
  section.innerHTML='<summary>朗读声音设置</summary><div class="nini-voice-controls"><div class="nini-voice-download"><strong>可选本地模型</strong><p>不下载也可使用系统声音。首次安装运行环境约需 8 GB，每种模型另约 2.3 GB；下载需要网络，生成时在本机处理。</p><div><button type="button" data-install="preset">下载预设音色</button><button type="button" data-install="clone">下载声音克隆</button><button type="button" data-release>关闭模型语音服务</button></div><p data-download-status role="status">正在检查安装状态…</p></div><label>声音来源<select data-source><option value="system">系统声音</option><option value="Serena">温柔女声 · Serena</option><option value="Vivian">明亮女声 · Vivian</option><option value="Uncle_Fu">醇厚男声 · 福叔</option><option value="Dylan">清朗男声 · Dylan（北京）</option><option value="Eric">活泼男声 · Eric（四川）</option><option value="sample">使用上传的声音</option></select></label><label>系统声音<select data-voice><option value="">设备默认中文声音</option></select></label><label>系统声音语速<select data-rate><option value="slow">稍慢</option><option value="calm">舒缓</option><option value="normal">标准</option></select></label><div class="nini-sample"><label>声音样本（3–30 秒，不超过 10 MB）<input data-sample type="file" accept="audio/*"></label><label><input data-consent type="checkbox"> 我使用的是自己的声音，或已获得本人授权</label><button type="button" data-remove>移除样本</button><small>样本只在本页面会话中使用，离开晨间或刷新后会清除；本地模型不使用系统语速。</small></div><div><button type="button" data-preview>试听声音</button><button type="button" data-stop>停止</button></div><p data-status role="status">声音由当前设备或本地模型提供。</p></div>';
  if(!localModels){
   section.querySelector('.nini-voice-download').remove();
   section.querySelector('[data-source]').closest('label').remove();
   section.querySelector('.nini-sample').remove();
   const note=document.createElement('p');note.className='nini-voice-note';note.textContent='使用当前设备的系统声音，无需下载。可以选择声音和语速。';section.querySelector('.nini-voice-controls').prepend(note);
   section.querySelector('[data-status]').textContent='准备就绪，点击“试听声音”听听看。';
  }
  morning.prepend(section);const list=section.querySelector('[data-voice]'),rate=section.querySelector('[data-rate]'),choice=section.querySelector('[data-source]'),file=section.querySelector('[data-sample]'),consent=section.querySelector('[data-consent]');
  let previewId=0,selectId=0;const saved=localStorage.getItem('nini-voice-preset');source=core.source(saved,localModels);if(choice)choice.value=source;
  let downloadTimer=null;
  async function updateDownloads(){if(!section.isConnected)return;try{const state=await manager();if(!section.isConnected)return;const label=section.querySelector('[data-download-status]');label.textContent=state.running?state.phase+'，请保持程序运行。':state.error?state.error:`预设音色：${state.preset?'已下载':'未下载'}；声音克隆：${state.clone?'已下载':'未下载'}。`;section.querySelectorAll('[data-install]').forEach(b=>{b.disabled=state.running||!!state[b.dataset.install];b.textContent=(state[b.dataset.install]?'已下载':'下载')+(b.dataset.install==='preset'?'预设音色':'声音克隆');});if(state.running){clearTimeout(downloadTimer);downloadTimer=setTimeout(updateDownloads,2000);}}catch{section.querySelector('[data-download-status]').textContent='声音管理服务暂不可用，系统声音仍可使用。';}}
  section.querySelectorAll('[data-install]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await manager('POST',{action:'install',kind:b.dataset.install});await updateDownloads();}catch(e){b.disabled=false;section.querySelector('[data-download-status]').textContent=e.message||'下载未能开始，请重试。';}});
  section.querySelector('[data-release]')?.addEventListener('click',async()=>{synth.cancel();try{const result=await manager('POST',{action:'stop'});source='system';choice.value='system';localStorage.setItem('nini-voice-preset','');status(result.stopped?'模型语音服务已关闭，已切换到系统声音。':'模型语音服务未运行，已切换到系统声音。');}catch(e){status(e.message||'语音服务关闭失败。');}});
  if(localModels)updateDownloads();
  rate.value=localStorage.getItem('nini-voice-rate')||'calm';
  function voices(){const savedId=localStorage.getItem('nini-voice-id')||'';list.replaceChildren(new Option('设备默认中文声音',''));for(const v of synth.getVoices().filter(v=>v.lang.toLowerCase().startsWith('zh')))list.add(new Option(`${v.name}（${v.lang}）`,v.voiceURI));list.value=core.select(synth.getVoices(),savedId)?savedId:'';}
  voices();synth.addEventListener('voiceschanged',voices,{once:true});
  list.onchange=()=>localStorage.setItem('nini-voice-id',list.value);rate.onchange=()=>localStorage.setItem('nini-voice-rate',rate.value);
  choice?.addEventListener('change',()=>{synth.cancel();if(choice.value==='sample'&&(!sampleReady||!consent.checked)){choice.value=source;status('请先选择合规录音并确认获得授权。');return;}source=choice.value;localStorage.setItem('nini-voice-preset',presets[source]?source:'');status(source==='system'?'正在使用系统声音。':'本地模型音色不使用系统语速。');});
  file?.addEventListener('change',async()=>{const id=++selectId;sampleReady=false;if(source==='sample'){source='system';choice.value=source;}clone.clear();try{await clone.select(file.files[0]);if(id!==selectId)return;sampleReady=true;status('样本已选择；确认授权后，可选择使用上传的声音。');}catch(e){if(id===selectId)status(e.message||'无法读取录音，请选择其他文件。');}});
  consent?.addEventListener('change',()=>{if(!consent.checked&&source==='sample'){synth.cancel();source='system';choice.value=source;}});
  section.querySelector('[data-remove]')?.addEventListener('click',()=>{selectId++;clone.clear();sampleReady=false;file.value='';consent.checked=false;if(source==='sample'){source='system';choice.value=source;}status('样本已移除。');});
  section.querySelector('[data-preview]').onclick=()=>{const id=++previewId;synth.cancel();const u=new SpeechSynthesisUtterance('早安，不用着急。让我们慢慢开始今天。');u.lang='zh-CN';u.onstart=()=>{if(id===previewId)status('正在试听');};u.onend=()=>{if(id===previewId)status('试听结束');};u.onerror=()=>{if(id===previewId&&source==='system')status('系统声音暂不可用，请检查设备声音设置。');};status('正在准备试听');synth.speak(u);};
  section.querySelector('[data-stop]').onclick=()=>{previewId++;synth.cancel();status('已停止播放');};
 }
 new MutationObserver(mount).observe(document.getElementById('app'),{childList:true,subtree:true});mount();
})();
