const {spawn}=require('node:child_process');
const children=[];let stopping=false;
function stop(code){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),1500).unref();}
function launch(cmd,args){const c=spawn(cmd,args,{stdio:'inherit'});children.push(c);c.on('error',()=>stop(1));c.on('exit',code=>{if(!stopping)stop(code||1);});return c;}
(async()=>{
 if(process.env.YUNI_RUNTIME_MODE==='edge-proxy'){
  require('./tools/render-edge.cjs').createEdgeProxy({appOrigin:process.env.YUNI_PROXY_APP_ORIGIN,siteOrigin:process.env.YUNI_PROXY_SITE_ORIGIN,sitePrefix:process.env.YUNI_PROXY_SITE_PATH||''}).listen(Number(process.env.PORT||10000),process.env.HOST||'0.0.0.0');
  console.log('YUNI edge proxy started; application and showcase use the configured Tencent HTTPS origins.');return;
 }
 if(process.env.SPRING_PROFILES_ACTIVE==='cloud'&&!process.env.YUNI_DB_URL)throw Error('Cloud database is required');
 launch('java',['-Xmx96m','-XX:MaxMetaspaceSize=96m','-XX:+UseSerialGC','-Xss512k','-jar','yuni.jar','--server.port=8080','--server.address=127.0.0.1','--spring.web.resources.static-locations=file:/app/web/','--server.forward-headers-strategy=framework']);
 let ready=false;for(let n=0;n<240&&!stopping;n++){try{const r=await fetch('http://127.0.0.1:8080/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!ready)throw Error('Application startup failed');
 require('./tools/planner-server.cjs'); require('./proxy.cjs').createProxy().listen(Number(process.env.PORT||10000),process.env.HOST||'0.0.0.0');
})().catch(e=>{console.error(e.message);stop(1);});
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));
