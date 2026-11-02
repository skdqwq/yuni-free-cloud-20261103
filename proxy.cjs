const http=require('node:http'),net=require('node:net');
function route(url){let p;try{p=decodeURIComponent(new URL(url,'http://localhost').pathname);}catch{return 'disabled';}if(p.startsWith('/api/internal-state')||p==='/api/voice-manager'||p.startsWith('/api/voice-manager/'))return 'disabled';return ['/api/planner','/api/companion'].includes(p)?'planner':'app';}
function originAllowed(origin,host){if(!origin)return true;try{return ['http:','https:'].includes(new URL(origin).protocol)&&new URL(origin).host===host;}catch{return false;}}
function createProxy({appPort=8080,plannerPort=8082}={}){
 const server=http.createServer((req,res)=>{
  if(!originAllowed(req.headers.origin,req.headers.host)){res.writeHead(403);return res.end();}
  const target=route(req.url);if(target==='disabled'){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'此接口不对外开放'}));}
  const headers={...req.headers,host:`127.0.0.1:${target==='planner'?plannerPort:appPort}`};
  if(target==='planner'&&headers.origin)headers.origin='http://localhost:8080';
  const upstream=http.request({host:'127.0.0.1',port:target==='planner'?plannerPort:appPort,path:req.url,method:req.method,headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('服务暂不可用');});req.pipe(upstream);
 });
 server.on('upgrade',(req,socket,head)=>{if(!originAllowed(req.headers.origin,req.headers.host)){socket.destroy();return;}const upstream=net.connect(appPort,'127.0.0.1',()=>{upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);for(const [key,value] of Object.entries(req.headers))upstream.write(`${key}: ${value}\r\n`);upstream.write('\r\n');if(head.length)upstream.write(head);socket.pipe(upstream).pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());});
 return server;
}
if(require.main===module)createProxy().listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1');
module.exports={route,originAllowed,createProxy};
