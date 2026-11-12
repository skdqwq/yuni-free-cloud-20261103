// Exercise schedule rules and persistence against an isolated local preview.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const planner=require('../web/planner-core.js');
const base=process.env.YUNI_PREVIEW_URL||'http://127.0.0.1:18080';
const at=(hour,minute=0)=>new Date(2026,10,11,hour,minute).getTime();
const habits={windows:[{start:'18:00',end:'20:00'}],weekdays:[0,1,2,3,4,5,6],focus:25,rest:5,lead:10,quietOutside:true};
const task={title:'Test schedule',duration:70,deadline:new Date(at(20)).toISOString()};
const result=planner.plan(habits,task,[],at(10));
assert.equal(result.missing,0);
assert.deepEqual(result.blocks.map(b=>[new Date(b.start).getHours(),new Date(b.start).getMinutes(),new Date(b.end).getHours(),new Date(b.end).getMinutes()]),[[18,0,18,25],[18,30,18,55],[19,0,19,20]]);
const occupied={status:'pending',blocks:[{start:new Date(at(18)).toISOString(),end:new Date(at(18,30)).toISOString()}]};
assert.equal(Date.parse(planner.plan(habits,{...task,duration:25},[occupied],at(10)).blocks[0].start),at(18,35));
const shortage=planner.plan({...habits,windows:[{start:'18:00',end:'18:25'}]},{...task,duration:60},[],at(10));
assert.equal(shortage.missing,35);
assert.equal(shortage.blocks.at(-1).end,new Date(at(18,25)).toISOString());
assert.throws(()=>planner.plan(habits,{...task,deadline:new Date(at(9)).toISOString()},[],at(10)),/截止/);
assert.throws(()=>planner.validateHabits({...habits,windows:[{start:'18:00',end:'19:00'},{start:'18:30',end:'20:00'}]}),/重叠/);
assert.equal(planner.plan(habits,{...task,duration:25},[{...occupied,status:'done'}],at(10)).blocks[0].start,new Date(at(18)).toISOString());
console.log('PASS: split into focus blocks, rest gaps, conflict avoidance, visible shortage, deadlines, completed tasks release time');

function client(){let cookie='';return async(path,method='GET',body,expected=200)=>{
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','Origin':base,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const set=response.headers.getSetCookie();if(set.length)cookie=set.map(s=>s.split(';')[0]).join('; ');
 const text=await response.text();assert.equal(response.status,expected,path+' '+text.slice(0,100));
 try{return JSON.parse(text);}catch{return text;}
};}
(async()=>{
 const request=client();
 await request('/api/planner','GET',undefined,401);
 const username='qa_schedule_'+crypto.randomBytes(3).toString('hex'),password=crypto.randomBytes(20).toString('base64url');
 await request('/api/auth/register','POST',{username,password});
 const memory=await request('/api/memory');assert.equal(memory.fields.length,7);assert.equal(typeof memory.fields[0].value,'object');
 const initial=await request('/api/planner');assert.equal(initial.revision,0);assert.deepEqual(initial.tasks,[]);
 const day=new Date();day.setDate(day.getDate()+1);day.setHours(23,0,0,0);
 const liveTask={title:'Local QA task',duration:70,deadline:day.toISOString()};
 const live=planner.plan(habits,liveTask,[]);assert.equal(live.missing,0);
 const storedTask={...liveTask,id:crypto.randomUUID(),blocks:live.blocks,status:'pending',createdAt:new Date().toISOString()};
 const saved=await request('/api/planner','PUT',{revision:0,habits,tasks:[storedTask]});
 assert.equal(saved.revision,1);assert.equal(saved.tasks[0].title,liveTask.title);
 await request('/api/planner','PUT',{revision:0,habits,tasks:[]},409);
 assert.equal((await request('/api/planner')).tasks.length,1);
 await request('/api/auth/logout','POST',{});
 await request('/api/auth/login','POST',{username,password});
 assert.equal((await request('/api/planner')).revision,1);
 const other=client();await other('/api/auth/register','POST',{username:'qa_other_'+crypto.randomBytes(3).toString('hex'),password});
 assert.deepEqual((await other('/api/planner')).tasks,[]);
 console.log('PASS: real save/read, optimistic conflict protection, login persistence, account isolation');
 for(const path of ['/','/m','/schedule-home.js?v=5','/schedule-home.css?v=6'])await request(path);
 console.log('PASS: responsive entry pages and local source assets served');
})().catch(error=>{console.error(error);process.exitCode=1;});
