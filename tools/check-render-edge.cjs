// Real loopback upstreams exercise cookie sessions, streamed responses and WS tunnels.
const assert=require('node:assert/strict'),http=require('node:http'),net=require('node:net'),crypto=require('node:crypto');
const {createEdgeProxy,upstreamOrigin}=require('./render-edge.cjs');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
for(const origin of ['http://example.com','http://127.0.0.1:80','https://user:password@example.com','https://example.com/path','https://example.com/?token=fixture'])assert.throws(()=>upstreamOrigin(origin));
assert.equal(upstreamOrigin('https://app.yunii.cn').protocol,'https:');
assert.throws(()=>upstreamOrigin('http://example.com',true));
const requests=[];
let finishStream;
const app=http.createServer(async(req,res)=>{
 const body=[];for await(const chunk of req)body.push(chunk);
 requests.push({path:req.url,method:req.method,headers:req.headers,body:Buffer.concat(body).toString()});
 if(req.url==='/redirect'){res.writeHead(302,{Location:appOrigin+'/target','Set-Cookie':['sid=fixture; Path=/; HttpOnly; Secure; Domain=app.yunii.cn','other=2; Path=/; SameSite=Lax']});return res.end();}
 if(req.url==='/stream'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: first\n\n');finishStream=()=>res.end('data: done\n\n');return;}
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',source:'app'}));
});
app.on('upgrade',(req,socket)=>{const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');socket.on('data',data=>socket.write(data));});
const site=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('SITE '+req.url);});
let appOrigin,siteOrigin,edge,prefixedEdge,base,tunnel;
const connections=new Set();
function track(server){server.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));});}
track(app);track(site);
(async()=>{
 try{
  appOrigin=await listen(app);siteOrigin=await listen(site);
  edge=createEdgeProxy({appOrigin,siteOrigin,allowLocalTestOrigins:true});track(edge);base=await listen(edge);
  const response=await fetch(base+'/api/planner',{method:'PUT',headers:{Origin:base,Cookie:'sid=fixture','Content-Type':'application/json'},body:'{"revision":4}'});
  assert.equal(response.status,200);assert.equal(response.headers.get('x-yuni-backend'),'tencent');assert.equal((await response.json()).source,'app');
  const passed=requests.at(-1);assert.equal(passed.headers.cookie,'sid=fixture');assert.equal(passed.headers.origin,appOrigin);assert.equal(passed.headers['x-forwarded-host'],new URL(base).host);assert.equal(passed.headers['x-forwarded-proto'],'https');assert.equal(passed.body,'{"revision":4}');
  const redirect=await fetch(base+'/redirect',{redirect:'manual'});assert.equal(redirect.headers.get('location'),'/target');assert.equal(redirect.headers.getSetCookie().length,2);assert.ok(redirect.headers.getSetCookie().every(c=>!/Domain=/i.test(c)));assert.match(redirect.headers.getSetCookie()[0],/HttpOnly; Secure/);
  const staticPage=await fetch(base+'/showcase/index.html?v=fixture');assert.equal(await staticPage.text(),'SITE /index.html?v=fixture');assert.equal(staticPage.headers.get('x-yuni-route'),'showcase');
  const canonical=await fetch(base+'/showcase',{redirect:'manual'});assert.equal(canonical.status,308);assert.equal(canonical.headers.get('location'),'/showcase/');
  prefixedEdge=createEdgeProxy({appOrigin,siteOrigin,sitePrefix:'/showcase',allowLocalTestOrigins:true});track(prefixedEdge);const prefixedBase=await listen(prefixedEdge);assert.equal(await(await fetch(prefixedBase+'/showcase/index.html')).text(),'SITE /showcase/index.html');
  const count=requests.length;assert.equal((await fetch(base+'/api/voice-manager')).status,503);assert.equal((await fetch(base+'/%61pi/internal-state')).status,503);assert.equal((await fetch(base+'/api/planner',{headers:{Origin:'https://unexpected.example'}})).status,403);assert.equal(requests.length,count);
  const stream=await fetch(base+'/stream'),reader=stream.body.getReader();const first=await reader.read();assert.equal(Buffer.from(first.value).toString(),'data: first\n\n');finishStream();assert.equal(Buffer.from((await reader.read()).value).toString(),'data: done\n\n');await reader.cancel();
  await new Promise((resolve,reject)=>{
   const request=http.request(base+'/ws',{headers:{Origin:base,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Key':crypto.randomBytes(16).toString('base64'),'Sec-WebSocket-Version':'13'}});
   request.on('upgrade',(response,socket)=>{tunnel=socket;assert.equal(response.statusCode,101);socket.once('data',bytes=>{try{assert.equal(bytes.toString(),'fixture-echo');socket.destroy();resolve();}catch(error){reject(error);}});socket.write('fixture-echo');});
   request.on('error',reject);request.setTimeout(5000,()=>request.destroy(Error('WS test timed out')));request.end();
  });
  console.log('PASS: fixed HTTPS targets; session cookies and Origin; private route protection; separate showcase; unbuffered stream; WebSocket tunnel');
 }finally{tunnel?.destroy();for(const socket of connections)socket.destroy();if(edge)await close(edge);if(prefixedEdge)await close(prefixedEdge);if(app.listening)await close(app);if(site.listening)await close(site);}
})().catch(error=>{console.error(error);process.exitCode=1;});
