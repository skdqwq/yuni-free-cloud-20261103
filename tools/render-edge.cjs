'use strict';
const http=require('node:http'),https=require('node:https');
const fs=require('node:fs'),path=require('node:path');
const {route,originAllowed}=require('../proxy.cjs');
const hopByHop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','proxy-connection']);
const wechatVerificationPath='/2594ff6de56a7d6c1fb434cdc53ecb64.txt';

function upstreamOrigin(value,allowLocalTestOrigins=false){
 const url=new URL(value);
 const localTest=allowLocalTestOrigins&&url.protocol==='http:'&&url.hostname==='127.0.0.1';
 if((url.protocol!=='https:'&&!localTest)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Upstream must be an HTTPS origin without credentials or a path');
 return url;
}
function createEdgeProxy({appOrigin,siteOrigin,sitePrefix='',allowLocalTestOrigins=false}={}){
 if(!['','/showcase'].includes(sitePrefix))throw Error('Unsupported showcase upstream path');
 const origins={app:upstreamOrigin(appOrigin,allowLocalTestOrigins),site:upstreamOrigin(siteOrigin,allowLocalTestOrigins)};
 const wechatVerification=fs.readFileSync(path.join(__dirname,'../web',wechatVerificationPath.slice(1)));
 const agents={https:new https.Agent({keepAlive:true,maxSockets:32}),http:new http.Agent({keepAlive:true,maxSockets:16})};
 function target(req){
  if(!req.url?.startsWith('/')||req.url.startsWith('//'))throw Error('Invalid request target');
  const decoded=decodeURIComponent(new URL(req.url,'https://edge.invalid').pathname);
  if(route(req.url)==='disabled')return {disabled:true};
  const site=decoded==='/showcase'||decoded.startsWith('/showcase/');
  const origin=origins[site?'site':'app'];
  if(origin.host===req.headers.host)throw Error('Upstream loop');
  // Never resolve an untrusted request target as a URL: this is a fixed-origin proxy.
  const path=site?req.url.replace(/^\/showcase(?=\/|\?|$)/,'')||'/':req.url;
  return {origin,path:(site?sitePrefix:'')+(path.startsWith('?')?'/'+path:path),kind:site?'showcase':'application'};
 }
 function headers(req,origin,upgrade=false){
  const result={};
  const connectionTokens=new Set((req.headers.connection||'').toLowerCase().split(',').map(s=>s.trim()));
  for(const [key,value] of Object.entries(req.headers))if(!hopByHop.has(key)&&!connectionTokens.has(key))result[key]=value;
  result.host=origin.host;
  if(req.headers.origin)result.origin=origin.origin;
  result['x-forwarded-host']=req.headers.host;
  result['x-forwarded-proto']='https';
  if(upgrade){result.connection='Upgrade';result.upgrade='websocket';}
  return result;
 }
 function responseHeaders(raw,origin,kind){
  const result={};
  for(const [key,value] of Object.entries(raw))if(!hopByHop.has(key))result[key]=value;
  if(result['set-cookie'])result['set-cookie']=result['set-cookie'].map(cookie=>cookie.replace(/;\s*Domain=[^;]*/ig,''));
  if(result.location){
   try{const location=new URL(result.location,origin);if(location.origin===origin.origin){const path=kind==='showcase'&&sitePrefix&&location.pathname.startsWith(sitePrefix+'/')?location.pathname.slice(sitePrefix.length):location.pathname;result.location=(kind==='showcase'?'/showcase':'')+path+location.search+location.hash;}}catch{delete result.location;}
  }
  result['x-yuni-backend']='tencent';result['x-yuni-route']=kind;
  return result;
 }
 const server=http.createServer((req,res)=>{
  if(!req.headers.host){res.writeHead(400);return res.end();}
  if(!originAllowed(req.headers.origin,req.headers.host)){res.writeHead(403);return res.end();}
  let selected;try{selected=target(req);}catch{res.writeHead(400);return res.end();}
  if(selected.disabled){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'此接口不对外开放'}));}
  // Serve this public ownership challenge on the Render hostname itself.
  if(new URL(req.url,'https://edge.invalid').pathname===wechatVerificationPath){
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
   res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Length':wechatVerification.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Yuni-Route':'verification'});
   return res.end(req.method==='HEAD'?undefined:wechatVerification);
  }
  if(req.url==='/showcase'){res.writeHead(308,{Location:'/showcase/'});return res.end();}
  const {origin,path,kind}=selected,transport=origin.protocol==='https:'?https:http;
  const upstream=transport.request({protocol:origin.protocol,hostname:origin.hostname,port:origin.port||undefined,path,method:req.method,headers:headers(req,origin),agent:agents[origin.protocol==='https:'?'https':'http']},reply=>{
   res.writeHead(reply.statusCode,responseHeaders(reply.headers,origin,kind));reply.pipe(res);
   reply.on('error',()=>res.destroy());
  });
  upstream.setTimeout(120000,()=>upstream.destroy(Error('Upstream timeout')));
  upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'连接服务器暂时不顺畅，请稍后重试。'}));}else res.destroy();});
  req.on('aborted',()=>upstream.destroy());res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});req.pipe(upstream);
 });
 server.on('upgrade',(req,socket,head)=>{
  if(!req.headers.host){socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return;}
  if(!originAllowed(req.headers.origin,req.headers.host)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  let selected;try{selected=target(req);}catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return;}
  if(selected.disabled||selected.kind!=='application'||new URL(req.url,'https://edge.invalid').pathname!=='/ws'){socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return;}
  const {origin,path}=selected,transport=origin.protocol==='https:'?https:http;
  const request=transport.request({protocol:origin.protocol,hostname:origin.hostname,port:origin.port||undefined,path,headers:headers(req,origin,true),agent:false});
  request.on('upgrade',(reply,upstream,upstreamHead)=>{
   upstream.setTimeout(0);
   socket.write('HTTP/1.1 101 Switching Protocols\r\n');
   for(let i=0;i<reply.rawHeaders.length;i+=2)socket.write(reply.rawHeaders[i]+': '+reply.rawHeaders[i+1]+'\r\n');
   socket.write('\r\n');if(upstreamHead.length)socket.write(upstreamHead);if(head.length)upstream.write(head);
   socket.pipe(upstream).pipe(socket);upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
  });
  request.on('response',reply=>{socket.write(`HTTP/1.1 ${reply.statusCode} Upstream response\r\nConnection: close\r\n\r\n`);reply.pipe(socket);});
  request.on('error',()=>socket.destroy());request.setTimeout(30000,()=>request.destroy());request.end();
 });
 server.on('close',()=>{agents.https.destroy();agents.http.destroy();});
 return server;
}
module.exports={createEdgeProxy,upstreamOrigin};
