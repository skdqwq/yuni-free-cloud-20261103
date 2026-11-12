(function(root){
const minutes=s=>{if(!/^\d{2}:\d{2}$/.test(s||''))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;};
function validateHabits(h){
 if(!h||!Array.isArray(h.windows)||!h.windows.length||h.windows.length>8)throw Error('请填写至少一个通常有空的时段');
 if(!Array.isArray(h.weekdays)||!h.weekdays.length||h.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('请选择可安排事务的星期');
 for(const [key,min,max] of [['focus',10,180],['rest',0,60],['lead',0,120]])if(!Number.isInteger(h[key])||h[key]<min||h[key]>max)throw Error('请检查专注、休息和提醒分钟数');
 const windows=h.windows.map(w=>({start:minutes(w.start),end:minutes(w.end)})).sort((a,b)=>a.start-b.start);
 windows.forEach((w,i)=>{if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start>=w.end)throw Error('可用时段的结束必须晚于开始（跨午夜请拆成两段）');if(i&&w.start<windows[i-1].end)throw Error('可用时段不能重叠');});
 return windows;
}
function plan(h,task,existing=[],now=Date.now()){
 const windows=validateHabits(h),deadline=Date.parse(task.deadline),duration=Number(task.duration);
 if(!task.title?.trim())throw Error('请告诉 NiNi 要做什么');
 if(!Number.isInteger(duration)||duration<5||duration>1440)throw Error('预计用时需为5—1440分钟');
 if(!Number.isFinite(deadline)||deadline<=now)throw Error('截止时间必须晚于现在');
 const horizon=new Date(now);horizon.setDate(horizon.getDate()+31);
 if(deadline>horizon.getTime())throw Error('请先安排未来31天内的事务');
 const busy=existing.filter(t=>t.status==='pending').flatMap(t=>t.blocks||[]).map(b=>({start:Date.parse(b.start),end:Date.parse(b.end)}));
 let remaining=duration;const blocks=[];
 const day=new Date(now);day.setHours(0,0,0,0);
 for(;day.getTime()<deadline;day.setDate(day.getDate()+1)){
  if(!h.weekdays.includes(day.getDay()))continue;
  for(const w of windows){
   const dateAt=m=>{const d=new Date(day);d.setMinutes(m);return d.getTime();};
   const end=Math.min(dateAt(w.end),deadline);let cursor=Math.max(dateAt(w.start),Math.ceil(now/60000)*60000);
   const occupied=[...busy,...blocks.map(b=>({start:Date.parse(b.start),end:Date.parse(b.end)}))].sort((a,b)=>a.start-b.start);
   while(cursor<end&&remaining>0){
    const conflict=occupied.find(b=>b.end+h.rest*60000>cursor&&b.start-h.rest*60000<=cursor);
    if(conflict){cursor=conflict.end+h.rest*60000;continue;}
    const next=occupied.find(b=>b.start>cursor);
    const stop=Math.min(end,next?next.start-h.rest*60000:end);
    const take=Math.min(h.focus,remaining,Math.floor((stop-cursor)/60000));
    if(take<Math.min(5,remaining)){cursor=next?next.end+h.rest*60000:end;continue;}
    blocks.push({start:new Date(cursor).toISOString(),end:new Date(cursor+take*60000).toISOString(),reminded:false,snoozeUntil:null});
    remaining-=take;cursor+=(take+h.rest)*60000;
   }
  }
 }
 return {blocks,missing:remaining,scheduled:duration-remaining};
}
function inWindow(h,now){const d=new Date(now),m=d.getHours()*60+d.getMinutes();return h.weekdays.includes(d.getDay())&&h.windows.some(w=>m>=minutes(w.start)&&m<minutes(w.end));}
function dueTasks(state,now=Date.now()){
 if(!state.habits)return [];
 if(state.habits.quietOutside&&!inWindow(state.habits,now))return [];
 return state.tasks.filter(t=>t.status==='pending').flatMap(t=>(t.blocks||[]).map((b,i)=>({task:t,block:b,index:i}))).filter(({block:b})=>!b.reminded&&(b.snoozeUntil?Date.parse(b.snoozeUntil):Date.parse(b.start)-state.habits.lead*60000)<=now);
}
const api={plan,validateHabits,dueTasks};
if(typeof module!=='undefined')module.exports=api;else root.NiniPlanner=api;
})(typeof window!=='undefined'?window:globalThis);
