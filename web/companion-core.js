(function(root){
function fresh(){return {version:1,focus:{phase:'idle',status:'idle',endsAt:null,remaining:0,minutes:25,rest:5,taskId:'',taskTitle:'',rounds:0},moods:[],care:{affection:0,day:'',pets:0,feeds:0,games:0,best:0},celebrated:[]};}
function day(now){const d=new Date(now);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function valid(c){
 if(!c||c.version!==1||!c.focus||!c.care||!Array.isArray(c.moods)||c.moods.length>90||!Array.isArray(c.celebrated)||c.celebrated.length>400)throw Error('陪伴数据格式不正确');
 const f=c.focus,p=c.care;
 if(!['idle','focus','ready_rest','rest','ready_focus'].includes(f.phase)||!['idle','running','paused','waiting'].includes(f.status)||!Number.isInteger(f.minutes)||f.minutes<1||f.minutes>180||!Number.isInteger(f.rest)||f.rest<1||f.rest>60||!Number.isInteger(f.rounds)||f.rounds<0||f.rounds>100000||!Number.isFinite(f.remaining)||f.remaining<0||f.remaining>180*60000||typeof f.taskId!=='string'||f.taskId.length>80||typeof f.taskTitle!=='string'||f.taskTitle.length>240)throw Error('番茄钟设置不正确');
 if(f.status==='running'&&(!['focus','rest'].includes(f.phase)||!Number.isFinite(Date.parse(f.endsAt))))throw Error('计时状态不正确');
 if(f.status==='paused'&&!['focus','rest'].includes(f.phase))throw Error('暂停状态不正确');
 if(['ready_rest','ready_focus'].includes(f.phase)&&f.status!=='waiting')throw Error('休息状态不正确');
 for(const k of ['affection','pets','feeds','games','best'])if(!Number.isInteger(p[k])||p[k]<0||p[k]>(k==='affection'?10000:100000))throw Error('互动记录不正确');
 if(typeof p.day!=='string'||p.day.length>10||c.celebrated.some(id=>typeof id!=='string'||id.length>80))throw Error('互动记录不正确');
 const ids=new Set();for(const m of c.moods){if(typeof m.id!=='string'||!m.id||m.id.length>80||ids.has(m.id)||!Number.isInteger(m.score)||m.score<1||m.score>5||typeof m.note!=='string'||m.note.length>300||!Number.isFinite(Date.parse(m.at)))throw Error('心情记录不正确');ids.add(m.id);}
 return c;
}
function apply(input,event,now=Date.now()){
 const c=JSON.parse(JSON.stringify(input||fresh()));valid(c);const f=c.focus,p=c.care;
 const reward=n=>{p.affection=Math.min(10000,p.affection+n);};
 if(p.day!==day(now)){p.day=day(now);p.pets=0;p.feeds=0;p.games=0;}
 switch(event.type){
 case 'start':
  if(f.status==='running'||f.status==='paused')throw Error('先完成或结束当前这一轮');
  Object.assign(f,{phase:'focus',status:'running',minutes:event.minutes,rest:event.rest,remaining:0,endsAt:new Date(now+event.minutes*60000).toISOString(),taskId:event.taskId||'',taskTitle:event.taskTitle||''});break;
 case 'pause':if(f.status!=='running')throw Error('当前没有正在进行的计时');f.remaining=Math.max(0,Date.parse(f.endsAt)-now);f.endsAt=null;f.status='paused';break;
 case 'resume':if(f.status!=='paused')throw Error('当前没有暂停的计时');f.endsAt=new Date(now+f.remaining).toISOString();f.remaining=0;f.status='running';break;
 case 'stop':Object.assign(f,{phase:'idle',status:'idle',endsAt:null,remaining:0});break;
 case 'advance':
  if(f.status==='running'&&now>=Date.parse(f.endsAt)){if(f.phase==='focus'){f.rounds++;f.phase='ready_rest';reward(2);}else f.phase='ready_focus';f.status='waiting';f.endsAt=null;f.remaining=0;}break;
 case 'rest':if(f.phase!=='ready_rest')throw Error('先完成这一轮专注');Object.assign(f,{phase:'rest',status:'running',endsAt:new Date(now+f.rest*60000).toISOString(),remaining:0});break;
 case 'mood':if(!event.id)throw Error('记录缺少标识');c.moods.unshift({id:event.id,score:event.score,note:String(event.note||'').trim(),at:new Date(now).toISOString()});c.moods=c.moods.slice(0,90);break;
 case 'delete_mood':c.moods=c.moods.filter(m=>m.id!==event.id);break;
 case 'pet':if(p.pets>=20)throw Error('今天的摸头亲密度已收满，仍然可以继续摸摸 NiNi');p.pets++;reward(1);break;
 case 'feed':if(p.feeds>=3)throw Error('今天已经吃过三份小点心啦，明天再来吧');p.feeds++;reward(2);break;
 case 'game':if(!Number.isInteger(event.hits)||event.hits<0||event.hits>100)throw Error('游戏分数不正确');p.games++;p.best=Math.max(p.best,event.hits);if(event.hits&&p.games<=5)reward(3);break;
 case 'task_done':if(typeof event.id!=='string'||!event.id||event.id.length>80)throw Error('任务标识不正确');if(!c.celebrated.includes(event.id)){c.celebrated.push(event.id);c.celebrated=c.celebrated.slice(-400);reward(3);}break;
 default:throw Error('不支持的互动操作');
 }
 return valid(c);
}
function remaining(f,now=Date.now()){return f.status==='running'?Math.max(0,Date.parse(f.endsAt)-now):f.status==='paused'?f.remaining:0;}
function level(points){return [{min:0,name:'初次见面'},{min:20,name:'渐渐熟悉'},{min:50,name:'默契伙伴'},{min:100,name:'亲密朋友'},{min:200,name:'老朋友'},{min:350,name:'长期陪伴'}].filter(l=>points>=l.min).at(-1).name;}
const api={fresh,valid,apply,remaining,level,day};if(typeof module!=='undefined')module.exports=api;else root.NiniCompanion=api;
})(typeof window!=='undefined'?window:globalThis);
