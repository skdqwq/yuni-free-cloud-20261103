(function(root){
 const presets=['Serena','Vivian','Uncle_Fu','Dylan','Eric'];
 const api={
  rate:value=>({slow:.8,calm:.9,normal:1}[value]||.9),
  select:(voices,id)=>voices.find(v=>id&&v.voiceURI===id)||null,
  // Model installation is supported only by the direct local desktop app.
  // Cloud and preview proxies deliberately do not expose its management API.
  localModelsAllowed:origin=>['http://localhost:8080','http://127.0.0.1:8080'].includes(origin),
  source:(saved,localModels)=>localModels&&presets.includes(saved)?saved:'system'
 };
 if(typeof module!=='undefined')module.exports=api;else root.NiniVoiceCore=api;
})(typeof window==='undefined'?globalThis:window);
