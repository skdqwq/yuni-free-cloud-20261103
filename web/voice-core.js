(function(root){
 const api={rate:value=>({slow:.8,calm:.9,normal:1}[value]||.9),select:(voices,id)=>voices.find(v=>id&&v.voiceURI===id)||null};
 if(typeof module!=='undefined')module.exports=api;else root.NiniVoiceCore=api;
})(typeof window==='undefined'?globalThis:window);
