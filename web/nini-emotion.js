// Local conversational cues, not a diagnosis. Only newly sent user turns are examined.
(function(root) {
  function score(text) {
    const clauses=String(text).split(/[，。！？!?；;\n]/);
    let result=0;
    for (let clause of clauses) {
      clause=clause.replace(/「[^」]*」|“[^”]*”|"[^"]*"/g,'');
      if (/如果|假如|假设|举个例|台词|电影|小说|朋友说|他说|她说|别人说/.test(clause)) continue;
      clause=clause.replace(/(?:没有|并不|不再|不怎么|不是很|不太|没那么|一点也不|不)(?:觉得|感到)?(?:难受|难过|伤心|低落|焦虑|痛苦|孤独|开心不起来)/g,'');
      clause=clause.replace(/不想死|不会伤害自己|不想伤害自己|不想哭|不再崩溃/g,'');
      if (/好多了|好起来了|缓过来了|没事了|不难过了/.test(clause)) continue;
      if (/撑不住|扛不住|受不了了|崩溃|绝望|活不下去|不想活|想死|伤害自己|很难受|特别难受|太难受|好难受|很痛苦|好想哭|忍不住哭|一直哭|哭了很久/.test(clause)) result=Math.max(result,3);
      else if (/难受|难过|伤心|低落|好累|很累|疲惫|睡不着|焦虑|压力好大|压力很大|委屈|孤独|没人理解|不开心|开心不起来|烦死|心烦|烦躁|提不起劲/.test(clause)) result=Math.max(result,1);
    }
    return result;
  }
  function createTracker() {
    let session=null, recent=[];
    return {observe(id,text) {
      if(session!==id){session=id;recent=[];}
      const value=score(text);recent.push(value);recent=recent.slice(-3);
      if(value>=3) return 'strong';
      if(value>0 && recent.filter(n=>n>0).length>=2) return 'sustained';
      return null;
    }};
  }
  const api={score,createTracker};
  if(typeof module!=='undefined') module.exports=api;
  else root.NiniEmotion=api;
})(typeof window!=='undefined'?window:globalThis);
