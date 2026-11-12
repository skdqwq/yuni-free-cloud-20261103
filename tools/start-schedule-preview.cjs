const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const url='http://127.0.0.1:18080/';
const jdkRoot=path.resolve(root,'../build-tools/jdk');
const javaFolder=fs.existsSync(jdkRoot)&&fs.readdirSync(jdkRoot).find(name=>name.startsWith('jdk-21'));
const java=javaFolder?path.join(jdkRoot,javaFolder,'bin','java.exe'):'java';
const jar=path.join(root,'target','yuni-backend-0.2.0.jar');
if(!fs.existsSync(jar))throw Error('Build the local backend JAR before starting the preview.');
if(process.argv.includes('--check')){for(const file of ['web/index.html','web/schedule-home.js','web/schedule-home.css','tools/planner-server.cjs'])if(!fs.existsSync(path.join(root,file)))throw Error('Missing '+file);console.log('PASS: local runtime and preview assets are available.');process.exit(0);}
function listening(port){return new Promise(resolve=>{const socket=net.connect(port,'127.0.0.1');socket.setTimeout(1500);const done=value=>{socket.destroy();resolve(value);};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.once('timeout',()=>done(false));});}
async function ready(){try{const r=await fetch(url+'api/health',{signal:AbortSignal.timeout(2000)});const page=await fetch(url,{signal:AbortSignal.timeout(2000)});return r.ok&&(await page.text()).includes('schedule-home.js');}catch{return false;}}
let child,stopping=false;
function stop(code=0){if(stopping)return;stopping=true;child?.kill('SIGTERM');setTimeout(()=>process.exit(code),600).unref();}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
(async()=>{
 if(await ready()){console.log('YUNI preview is already running: '+url);return;}
 for(const port of [8080,8082,18080])if(await listening(port))throw Error('Port '+port+' is occupied. Close the other local preview before restarting.');
 const log=fs.openSync(path.join(root,'schedule-preview.log'),'a');
 child=spawn(java,['-Xmx192m','-jar',jar,'--server.port=8080','--server.address=127.0.0.1','--spring.datasource.url=jdbc:h2:file:./data/schedule-preview;MODE=MySQL;DB_CLOSE_DELAY=-1','--spring.web.resources.static-locations=file:./web/','--yuni.llm.gateway-url=','--yuni.llm.api-key='],{cwd:root,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,SPRING_PROFILES_ACTIVE:'',YUNI_DB_USER:'sa',YUNI_DB_PASSWORD:'',YUNI_LLM_KEY:'',YUNI_GATEWAY_URL:''}});
 child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!stopping){console.error('Backend stopped. See schedule-preview.log.');stop(code||1);}});
 console.log('Starting isolated local YUNI preview...');
 let started=false;
 for(let i=0;i<45&&!stopping;i++){try{const r=await fetch('http://127.0.0.1:8080/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){started=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
 if(!started)throw Error('Backend startup timed out. See schedule-preview.log.');
 require('./planner-server.cjs');
 const proxy=require('../proxy.cjs').createProxy();
 proxy.on('error',error=>{console.error(error.message);stop(1);});
 proxy.listen(18080,'127.0.0.1',()=>{console.log('Ready: '+url);console.log('Keep this window open while previewing. Press Ctrl+C to stop.');console.log('This preview uses a local test database and does not call paid AI services.');});
})().catch(error=>{console.error(error.message);stop(1);});
