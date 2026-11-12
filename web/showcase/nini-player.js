import * as THREE from "three";
import {GLTFLoader} from "./vendor/three/GLTFLoader.js";
import {MeshoptDecoder} from "./vendor/three/meshopt_decoder.mjs";
export async function startGreeting(){
 const figure=document.getElementById('nini-greeting');
 const canvas=figure.querySelector('.nini-canvas'),fallback=figure.querySelector('.nini-fallback');
 const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
 if(!context)throw Error('当前设备暂时无法播放动作');
 const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(max-width:720px)').matches?1.25:1.5));
 renderer.setClearColor(0,0);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.68,.68,.68,-.68,.01,10);
 camera.position.set(.035,.64,3);camera.lookAt(0,.62,0);
 scene.add(new THREE.HemisphereLight(0xd9e6ff,0x92929c,2.1));
 const key=new THREE.DirectionalLight(0xfff0df,1.4);key.position.set(-2,3,4);scene.add(key);
 const rim=new THREE.DirectionalLight(0x9cbaff,1.15);rim.position.set(2,2,-3);scene.add(rim);
 let model;
 try{model=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('./assets/nini-compact.glb',import.meta.url).href);}catch(error){renderer.dispose();throw error;}
 scene.add(model.scene);
 const mixer=new THREE.AnimationMixer(model.scene),action=mixer.clipAction(model.animations[0]);
 action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const render=()=>renderer.render(scene,camera);
 let previous,lastDraw;
 function tick(now){if(lastDraw!==undefined&&now-lastDraw<1000/30)return;mixer.update(Math.min(.1,(now-(previous??now))/1000));previous=now;lastDraw=now;render();}
 function sync(){previous=lastDraw=undefined;renderer.setAnimationLoop(figure.dataset.motion==='playing'?tick:null);}
 function resize(){const width=figure.clientWidth;if(width){renderer.setSize(width,width,false);render();}}
 const sizeObserver=new ResizeObserver(resize),motionObserver=new MutationObserver(sync);
 mixer.addEventListener('finished',()=>{renderer.setAnimationLoop(null);render();window.dispatchEvent(new Event('nini:greeting-finished'));});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);sizeObserver.disconnect();motionObserver.disconnect();canvas.hidden=true;fallback.hidden=false;delete figure.dataset.renderer;window.dispatchEvent(new Event('nini:greeting-lost'));},{once:true});
 resize();canvas.hidden=false;fallback.hidden=true;figure.dataset.renderer='3d';sizeObserver.observe(figure);motionObserver.observe(figure,{attributes:true,attributeFilter:['data-motion']});sync();
 return {replay(){action.reset().play();}};
}
