/* Audio stays in this tab and is sent only to the loopback voice service. */
(() => {
  let reference = null, currentAudio = null, active = null, selection = 0;
  function clear() { selection++; stop(); reference = null; }
  function stop() {
    if (active) { active.abort(); active = null; }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  }
  async function select(file) {
    clear(); const version = selection;
    if (!file || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的录音。');
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('当前浏览器不支持读取音频。');
    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration < 3 || decoded.duration > 30) throw new Error('请选择 3 至 30 秒的清晰录音。');
      const n = decoded.length, sr = decoded.sampleRate, output = new ArrayBuffer(44 + n * 2), view = new DataView(output);
      const write = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
      write(0,'RIFF'); view.setUint32(4,36+n*2,true); write(8,'WAVE'); write(12,'fmt ');
      view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
      view.setUint32(24,sr,true); view.setUint32(28,sr*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
      write(36,'data'); view.setUint32(40,n*2,true);
      const channels = Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
      for (let i=0;i<n;i++) { let x=0; for (const ch of channels) x+=ch[i]; x=Math.max(-1,Math.min(1,x/channels.length)); view.setInt16(44+i*2,x<0?x*32768:x*32767,true); }
      let binary=''; const bytes=new Uint8Array(output);
      for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      if(version===selection) reference=btoa(binary);
    } finally { await ctx.close().catch(()=>{}); }
  }
  async function speak(text, onStatus, preset = null) {
    if (!preset && !reference) throw new Error('请先选择声音样本。');
    stop(); const controller=new AbortController(); active=controller;
    try {
      onStatus('正在本机生成声音，首次加载可能需要一些时间…');
      let res;
      const path=preset?'/preset':'/synthesize';
      const payload=preset?{text,speaker:preset}:{text,audio:reference};
      try { res=await fetch('http://127.0.0.1:8073'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal}); }
      catch(err){if(err.name==='AbortError')throw err;throw new Error('连接不上本地语音服务，请确认服务已启动。');}
      if(!res.ok){let err={};try{err=await res.json()}catch{}throw new Error(err.error||'本地语音服务暂不可用。');}
      const blob=await res.blob(); if(controller.signal.aborted) return;
      const url=URL.createObjectURL(blob); const player=new Audio(url); currentAudio=player;
      try {
        await new Promise((resolve,reject)=>{player.onended=resolve;player.onerror=()=>reject(new Error('音频播放失败。'));controller.signal.addEventListener('abort',resolve,{once:true});player.play().catch(()=>reject(new Error('播放受浏览器限制，请再点一次试听。')));onStatus('正在播放');});
      } finally { player.pause(); URL.revokeObjectURL(url); if(currentAudio===player)currentAudio=null; }
    } finally { if(active===controller)active=null; }
  }
  window.YuniClone={select,speak,speakPreset:(text,preset,onStatus)=>speak(text,onStatus,preset),stop,clear};
})();
