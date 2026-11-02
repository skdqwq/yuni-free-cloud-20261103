const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn:nativeSpawn}=require('node:child_process');
const validKind=k=>k==='preset'||k==='clone';
const initialState=()=>({running:false,phase:'idle',kind:null,error:null});
const isReady=f=>Boolean(f.python&&f.model&&f.tokenizer&&f.runtime);
function create(base,options={}){
 const spawn=options.spawn||nativeSpawn;
 const root=path.join(base,'voice-service'),uv=path.join(base,'tools','uv.exe'),venv=path.join(root,'venv'),py=path.join(venv,'Scripts','python.exe');let state=initialState(),startPromise=null,ownedService=null;
 const modelDir=k=>path.join(root,k==='preset'?'preset-model':'model');
 const exists=p=>fs.existsSync(p);
 function ready(k){if(!validKind(k))return false;const dir=modelDir(k);return isReady({python:exists(py),runtime:['torch','qwen_tts','soundfile.py'].every(x=>exists(path.join(venv,'Lib','site-packages',x))),model:exists(path.join(dir,'model.safetensors')),tokenizer:exists(path.join(dir,'speech_tokenizer','model.safetensors'))});}
 function status(){return {...state,preset:ready('preset'),clone:ready('clone')};}
 function run(file,args,phase){state.phase=phase;return new Promise((resolve,reject)=>{const p=spawn(file,args,{cwd:root,windowsHide:true,stdio:'ignore'});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error('下载或安装失败，请检查网络和剩余空间后重试。')));});}
 async function healthy(){if(options.healthy)return options.healthy();try{const r=await fetch('http://127.0.0.1:8073/health',{headers:{Origin:'http://localhost:8080'},signal:AbortSignal.timeout(1500)});const a=await r.json();return r.ok&&a.ok===true&&a.service==='yuni-voice';}catch{return false;}}
 function occupied(){return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:8073});socket.setTimeout(1000);socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(false)});});}
 async function start(k){if(!validKind(k))throw Error('不支持的声音类型');if(!ready(k))throw Error('请先下载需要的声音模型。');if(await healthy())return;if(startPromise)return startPromise;startPromise=(async()=>{if(await occupied())throw Error('8073 端口已被其他程序占用，请先解决端口冲突。');const p=spawn(py,['-u',path.join(root,'server.py')],{cwd:root,windowsHide:true,detached:true,stdio:'ignore'});ownedService=p;p.once('error',()=>{if(ownedService===p)ownedService=null;});p.once('exit',()=>{if(ownedService===p)ownedService=null;});p.unref();for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));if(await healthy())return;}throw Error('本地语音服务未能启动，请检查 8073 端口。');})();try{await startPromise;}finally{startPromise=null;}}
 async function stop(){if(state.running)throw Error('下载正在进行，请等待完成。');if(!ownedService){if(await healthy())throw Error('当前语音服务并非由本程序启动，请关闭原服务后重试。');return false;}const p=ownedService;ownedService=null;p.kill();return true;}
 function install(k){if(!validKind(k))throw Error('不支持的声音类型');if(state.running)throw Error('已有声音下载进行中，请等待完成。');if(ready(k)){state={running:false,phase:'done',kind:k,error:null};return status();}state={running:true,phase:'准备安装',kind:k,error:null};
  (async()=>{fs.mkdirSync(root,{recursive:true});if(!exists(uv))throw Error('缺少下载工具，请重新获取轻量运行包。');
   if(!exists(py)){const folder=path.join(root,'python');await run(uv,['python','install','3.12','--install-dir',folder],'正在准备 Python 运行环境');const sub=fs.readdirSync(folder).find(x=>/^cpython-3\.12.*windows-x86_64/.test(x));if(!sub)throw Error('Python 环境安装未完成。');await run(uv,['venv',venv,'--python',path.join(folder,sub,'python.exe')],'正在创建独立环境');}
   const runtime=['torch','qwen_tts','soundfile.py'].every(x=>exists(path.join(venv,'Lib','site-packages',x)));
   if(!runtime){await run(uv,['pip','install','--python',py,'--index-url','https://download.pytorch.org/whl/cu128','torch==2.8.0','torchaudio==2.8.0'],'正在下载 GPU 运行库（体积较大）');await run(uv,['pip','install','--python',py,'qwen-tts==0.1.1','transformers==4.57.3','soundfile'],'正在安装语音组件');}
   const repo=k==='preset'?'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice':'Qwen/Qwen3-TTS-12Hz-0.6B-Base',revision=k==='preset'?'85e237c12c027371202489a0ec509ded67b5e4b5':'5d83992';
   await run(py,['-m','huggingface_hub.cli.hf','download',repo,'--revision',revision,'--local-dir',modelDir(k)],'正在下载声音模型');if(!ready(k))throw Error('模型文件不完整，请重试下载。');await start(k);state={running:false,phase:'done',kind:k,error:null};
  })().catch(e=>{state={running:false,phase:'error',kind:k,error:e.message||'安装失败，请重试。'};});return status();}
 return {status,install,start,stop};
}
module.exports={validKind,initialState,isReady,create};
