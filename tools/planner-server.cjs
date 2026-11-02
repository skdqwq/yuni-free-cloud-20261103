const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),data=path.join(base,'data','planner');
fs.mkdirSync(data,{recursive:true});
const sandbox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(base,'web','planner-core.js'),'utf8'),sandbox);
const {validateHabits}=sandbox.module.exports;
const companionSandbox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(base,'web','companion-core.js'),'utf8'),companionSandbox);
const companion=companionSandbox.module.exports;
const voiceManager=require('./voice-install.cjs').create(base);
function validate(s){
 if(!s||!Number.isInteger(s.revision)||!Array.isArray(s.tasks)||s.tasks.length>400)throw Error('任务数据格式不正确');
 if(s.habits)validateHabits(s.habits);
 if(s.companion)companion.valid(s.companion);
 const ids=new Set();
 for(const t of s.tasks){
  if(typeof t.id!=='string'||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>240||!['pending','done','cancelled'].includes(t.status)||!Number.isInteger(t.duration)||t.duration<5||t.duration>1440||!Number.isFinite(Date.parse(t.deadline))||!Array.isArray(t.blocks)||!t.blocks.length||t.blocks.length>300)throw Error('事务格式不正确');
  ids.add(t.id);
  for(const b of t.blocks)if(!Number.isFinite(Date.parse(b.start))||!Number.isFinite(Date.parse(b.end))||Date.parse(b.end)<=Date.parse(b.start)||Date.parse(b.end)>Date.parse(t.deadline)||typeof b.reminded!=='boolean'||(b.snoozeUntil&&!Number.isFinite(Date.parse(b.snoozeUntil))))throw Error('安排时段格式不正确');
 }
}
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!['http://localhost:8080','http://127.0.0.1:8080'].includes(origin)){res.writeHead(403);res.end();return;}
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 const send=(code,obj)=>{res.writeHead(code);res.end(JSON.stringify(obj));};
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, PUT, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);res.end();return;}
 if(req.url==='/health'){send(200,{service:'nini-planner'});return;}
 if(!['/api/planner','/api/companion','/api/voice-manager'].includes(req.url)){send(404,{error:'没有这个接口'});return;}
 try{
  const auth=await fetch('http://127.0.0.1:8080/api/auth/me',{headers:{cookie:req.headers.cookie||''},signal:AbortSignal.timeout(4000)});
  if(!auth.ok){send(401,{error:'请先登录屿 YUNI'});return;}
  const user=await auth.json();if(!user.id){send(401,{error:'请先登录'});return;}
  if(req.url==='/api/voice-manager'){
   if(req.method==='GET'){send(200,voiceManager.status());return;}
   if(req.method!=='POST'){send(405,{error:'方法不支持'});return;}
   if(!origin){send(403,{error:'请求来源无效'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1000){send(413,{error:'请求过大'});return;}}
   try{const request=JSON.parse(body);if(request.action==='install'){send(202,voiceManager.install(request.kind));return;}if(request.action==='start'){await voiceManager.start(request.kind);send(200,voiceManager.status());return;}if(request.action==='stop'){const stopped=await voiceManager.stop();send(200,{stopped});return;}send(400,{error:'不支持的操作'});}catch(e){send(400,{error:e.message||'操作失败'});}return;
  }
  const stateUrl='http://127.0.0.1:8080/api/internal-state';
  const read=async()=>{const r=await fetch(stateUrl,{headers:{cookie:req.headers.cookie||''},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('读取失败');return r.json();};
  const write=async next=>{const r=await fetch(stateUrl,{method:'PUT',headers:{cookie:req.headers.cookie||'','Content-Type':'application/json'},body:JSON.stringify(next),signal:AbortSignal.timeout(15000)});if(!r.ok){const e=Error('数据已更新，请刷新后重试');e.status=r.status;throw e;}Object.assign(next,await r.json());};
  const companionResponse=current=>({revision:current.revision,companion:current.companion||companion.fresh(),serverNow:Date.now()});
  if(req.method==='GET'){const current=await read();send(200,req.url==='/api/companion'?companionResponse(current):current);return;}
  if(req.url==='/api/companion'){
   if(req.method!=='POST'){send(405,{error:'方法不支持'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){send(413,{error:'数据过大'});return;}}
   try{const event=JSON.parse(body),current=await read();if(event.expectedUser&&event.expectedUser!==String(user.id)){send(409,{error:'账号已切换，请重新打开陪伴空间'});return;}if(event.type==='mood')event.id=crypto.randomUUID();
    if(event.type==='task_done'&&!current.tasks.some(t=>t.id===event.id&&t.status==='done'))throw Error('请先确认这件事务已经完成');
    current.companion=companion.apply(current.companion,event);await write(current);send(200,companionResponse(current));
   }catch(error){send(error.status||400,{error:error.message});}return;
  }
  if(req.method!=='PUT'){send(405,{error:'方法不支持'});return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>200000){send(413,{error:'数据过大'});return;}}
  let next;try{next=JSON.parse(body);validate(next);}catch(error){send(400,{error:error.message});return;}
  const current=await read();
  if(current.revision!==next.revision){send(409,{error:'安排已在另一个页面更新，请刷新后重试'});return;}
  await write(next);send(200,next);
 }catch(error){send(error.status||503,{error:'安排服务暂时不可用，请检查本地程序是否已启动'});}
}).listen(8082,'127.0.0.1');
