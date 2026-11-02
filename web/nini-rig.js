import * as THREE from './vendor/three.module.js';

export const actions=[['wave','招招手'],['nod','点头回应'],['think','歪头想想'],['talk','说话手势'],['look','左右看看'],['walk','小步走走'],['jump','轻轻一跳'],['dance','开心跳舞']];
const lengths={wave:2.8,nod:2.2,think:3.6,talk:3.0,look:3.4,walk:4,jump:1.8,dance:4,happy:2.4};
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const envelope=(t,a=.15,b=.8)=>smooth(t/a)*(1-smooth((t-b)/(1-b)));

export function create(el){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 const canvas=renderer.domElement;canvas.className='nini-motion-canvas';canvas.setAttribute('aria-hidden','true');el.append(canvas);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.8,1.8,1.8,-1.8,.1,30);
 camera.position.set(0,1.9,8);camera.lookAt(0,1.53,0);
 scene.add(new THREE.HemisphereLight(0xeaf2ff,0x5e5265,3));
 const key=new THREE.DirectionalLight(0xffead6,4.2);key.position.set(-3,5,6);scene.add(key);
 const fill=new THREE.DirectionalLight(0xb9ceff,1.6);fill.position.set(4,2,1);scene.add(fill);
 const rim=new THREE.DirectionalLight(0x93b6ff,2.6);rim.position.set(1,4,-4);scene.add(rim);
 const materials=[],geometries=[];
 const mat=(color,roughness=.6,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra});materials.push(m);return m;};
 const navy=mat(0x14234f,.76),cream=mat(0xffefd7,.78),orange=mat(0xed803d,.56),black=mat(0x0c111a,.14),mouthMat=mat(0x783225,.85),gold=mat(0xe6ad53,.38),white=mat(0xffffff,.35);
 const pink=mat(0xef9c9d,.9,{transparent:true,opacity:.35,depthWrite:false});
 const sphere=new THREE.SphereGeometry(1,48,32);geometries.push(sphere);
 function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
 function oval(parent,material,pos,size){const m=new THREE.Mesh(sphere,material);m.position.set(...pos);m.scale.set(...size);parent.add(m);return m;}
 const root=group(scene),spine=group(root);oval(spine,navy,[0,1.05,0],[.85,.96,.64]);
 oval(spine,cream,[0,1.0,.525],[.71,.74,.20]);
 const head=group(spine,0,1.64,0);
 oval(head,navy,[0,.38,0],[.89,.85,.70]);
 // A single curved heart-shaped face patch follows the head surface.
 const faceShape=new THREE.Shape();faceShape.moveTo(0,.47);
 faceShape.bezierCurveTo(-.12,.73,-.27,.84,-.42,.75);faceShape.bezierCurveTo(-.64,.63,-.71,.32,-.65,.09);
 faceShape.bezierCurveTo(-.61,-.16,-.32,-.32,0,-.32);faceShape.bezierCurveTo(.32,-.32,.61,-.16,.65,.09);
 faceShape.bezierCurveTo(.71,.32,.64,.63,.42,.75);faceShape.bezierCurveTo(.27,.84,.12,.73,0,.47);
 const flatFace=new THREE.ShapeGeometry(faceShape,32),facePoints=[];
 const surface=(x,y)=>.70*Math.sqrt(Math.max(.025,1-(x/.89)**2-((y-.38)/.85)**2));
 const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
 function tessellate(a,b,c,depth){if(!depth){for(const p of [a,b,c])facePoints.push(p[0],p[1],surface(...p)+.02);return;}const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);tessellate(a,ab,ca,depth-1);tessellate(ab,b,bc,depth-1);tessellate(ca,bc,c,depth-1);tessellate(ab,bc,ca,depth-1);}
 const positions=flatFace.attributes.position,indices=flatFace.index.array;
 for(let i=0;i<indices.length;i+=3){const points=[0,1,2].map(k=>[positions.getX(indices[i+k]),positions.getY(indices[i+k])]);tessellate(...points,3);}
 flatFace.dispose();const faceGeometry=new THREE.BufferGeometry();faceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(facePoints,3));
 const normals=[];for(let i=0;i<facePoints.length;i+=3){const n=new THREE.Vector3(facePoints[i]/(.89*.89),(facePoints[i+1]-.38)/(.85*.85),facePoints[i+2]/(.7*.7)).normalize();normals.push(n.x,n.y,n.z);}faceGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometries.push(faceGeometry);head.add(new THREE.Mesh(faceGeometry,cream));
 const tuft=oval(head,navy,[-.055,1.17,-.06],[.13,.265,.115]);tuft.rotation.z=-.56;tuft.rotation.x=.32;
 const eyes=[];
 for(const x of [-.285,.285]){
  const eye=group(head,x,.43,surface(x,.43)+.02);
  const glass=oval(eye,black,[0,0,.021],[.105,.137,.062]);
  const glint=oval(glass,white,[-.22,.31,.82],[.20,.18,.15]);
  eyes.push({eye,glass,glint});
  const blush=oval(head,pink,[x*1.48,.19,surface(x*1.48,.19)+.018],[.10,.045,.010]);blush.rotation.y=x>0?.36:-.36;
 }
 const upper=group(head,0,.246,.71),lower=group(head,0,.184,.71);
 oval(head,mouthMat,[0,.19,.75],[.162,.058,.105]);
 oval(upper,orange,[0,0,.105],[.185,.078,.16]);
 oval(lower,orange,[0,-.005,.10],[.163,.052,.143]);
 // Independent shoulders and wing tips, rather than deforming the torso.
 const skeletons=[];
 function wing(side){const shoulder=group(spine,side*.80,1.46,.015);shoulder.rotation.z=side*.22;
  const geometry=new THREE.SphereGeometry(1,32,32);geometry.scale(.19,.49,.19);geometry.translate(0,-.36,0);geometries.push(geometry);
  const skinIndices=[],weights=[];for(let i=0;i<geometry.attributes.position.count;i++){const y=geometry.attributes.position.getY(i),w=smooth((-.32-y)/.43);skinIndices.push(0,1,0,0);weights.push(1-w,w,0,0);}
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,navy),bone=new THREE.Bone(),tip=new THREE.Bone();tip.position.set(0,-.43,0);bone.add(tip);mesh.add(bone);shoulder.add(mesh);const skeleton=new THREE.Skeleton([bone,tip]);skeletons.push(skeleton);mesh.bind(skeleton);return {shoulder,tip};}
 const left=wing(-1),right=wing(1);
 function foot(side){const leg=group(root,side*.30,.24,.02);oval(leg,navy,[0,0,0],[.12,.19,.14]);const toe=group(leg,0,-.12,.12);oval(toe,orange,[0,0,.07],[.235,.105,.285]);return {leg,toe};}
 const leftFoot=foot(-1),rightFoot=foot(1);
 // Pocket and the small star remain part of NiNi's identity.
 const pocketShape=new THREE.Shape();pocketShape.moveTo(-.17,.13);pocketShape.lineTo(.17,.13);pocketShape.bezierCurveTo(.18,-.13,-.16,-.13,-.17,.13);
 const pocketGeometry=new THREE.ShapeGeometry(pocketShape,24);geometries.push(pocketGeometry);
 const pocket=new THREE.Mesh(pocketGeometry,cream);pocket.position.set(.31,1.23,.713);pocket.rotation.y=.20;spine.add(pocket);
 const note=oval(spine,cream,[.31,1.37,.68],[.14,.19,.024]);note.rotation.z=.16;
 const starShape=new THREE.Shape();for(let i=0;i<8;i++){const a=Math.PI/2+i*Math.PI/4,r=i%2?.033:.09;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();
 const starGeometry=new THREE.ShapeGeometry(starShape);geometries.push(starGeometry);const star=new THREE.Mesh(starGeometry,gold);star.position.set(.31,1.42,.719);star.rotation.z=.15;spine.add(star);
 const shadowGeometry=new THREE.CircleGeometry(.72,48);geometries.push(shadowGeometry);const shadowMat=new THREE.MeshBasicMaterial({color:0x050916,transparent:true,opacity:.13,depthWrite:false});materials.push(shadowMat);
 const shadow=new THREE.Mesh(shadowGeometry,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.52,1);shadow.position.set(0,.012,0);scene.add(shadow);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let disposed=false,raf=0,last=0,time=0,action='idle',age=0,nextIdle=4.2;
 const gaze=new THREE.Vector2(),target=new THREE.Vector2();
 const pose={rootX:0,rootY:0,bodyY:0,bodyYaw:0,bodyRoll:0,headYaw:0,headPitch:0,headRoll:0,leftWing:-.22,rightWing:.22,leftTip:0,rightTip:0,leftLeg:0,rightLeg:0,leftLift:0,rightLift:0,jaw:0,blink:0};
 const resize=new ResizeObserver(()=>{const r=el.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);const aspect=r.width/r.height;camera.left=-1.8*aspect;camera.right=1.8*aspect;camera.updateProjectionMatrix();});resize.observe(el);
 function play(name){if(disposed)return;action=lengths[name]?name:'wave';age=0;el.dataset.action=action;}
 function update(now){
  if(disposed)return;if(!el.isConnected){dispose();return;}const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(!document.hidden){time+=dt;age+=dt;nextIdle-=dt;
   const p={rootX:0,rootY:0,bodyY:0,bodyYaw:0,bodyRoll:0,headYaw:0,headPitch:0,headRoll:0,leftWing:-.22,rightWing:.22,leftTip:0,rightTip:0,leftLeg:0,rightLeg:0,leftLift:0,rightLift:0,jaw:0,blink:0};
   gaze.lerp(target,1-Math.exp(-dt*8));
   p.headYaw=gaze.x*.28;p.headPitch=-gaze.y*.12;
   if(!reduced){
    // Small independent idle gestures are infrequent; the belly never scales.
    p.bodyY=.008*Math.sin(time*1.65);const b=time%4.7;p.blink=b>4.25&&b<4.48?Math.sin((b-4.25)/.23*Math.PI):0;
    if(action==='idle'&&nextIdle<0){play(['look','nod','think'][Math.floor(Math.random()*3)]);nextIdle=8+Math.random()*5;}
    let t=Math.min(age/(lengths[action]||1),1),e=envelope(t);
    if(action==='wave'){p.leftWing-=1.5*e;p.leftTip=.30*Math.sin(age*13)*e;p.headRoll=.07*e;p.headYaw-=.10*e;p.jaw=.12*e;}
    if(action==='nod'){p.headPitch+=.22*Math.sin(age*6)*e;p.headRoll=.025*Math.sin(age*3)*e;}
    if(action==='think'){p.headRoll=.18*e;p.headYaw-=.25*e;p.headPitch-=.10*e;p.rightWing+=.90*e;p.rightTip=.45*e;}
    if(action==='look'){p.headYaw+=.48*Math.sin(t*Math.PI*2)*e;p.bodyYaw=.12*Math.sin(t*Math.PI*2)*e;}
    if(action==='talk'||(action==='idle'&&el.dataset.state==='speaking')){const strength=action==='idle'?1:e;p.jaw=(.12+.30*Math.max(0,Math.sin(time*17)))*strength;p.headPitch+=.05*Math.sin(time*4)*strength;p.leftWing-=.32*(.5+.5*Math.sin(time*3))*strength;p.rightWing+=.25*(.5+.5*Math.sin(time*3+2))*strength;}
    if(action==='walk'){const gait=age*9;p.rootX=.25*Math.sin(t*Math.PI*2)*e;p.bodyYaw=.25*Math.cos(t*Math.PI*2)*e;p.leftLeg=.28*Math.sin(gait)*e;p.rightLeg=-p.leftLeg;p.leftLift=.10*Math.max(0,Math.sin(gait))*e;p.rightLift=.10*Math.max(0,-Math.sin(gait))*e;p.leftWing-=.18*Math.sin(gait)*e;p.rightWing-=.18*Math.sin(gait)*e;p.bodyRoll=.035*Math.sin(gait)*e;}
    if(action==='jump'){
     const flight=t>.25&&t<.75?Math.sin((t-.25)/.5*Math.PI):0;
     const crouch=t<.25?Math.sin(t/.25*Math.PI):t>.75?Math.sin((t-.75)/.25*Math.PI)*.65:0;
     p.rootY=flight*.36;p.bodyY-=crouch*.11;p.leftWing-=flight*.85;p.rightWing+=flight*.85;p.leftLeg=-flight*.25;p.rightLeg=-flight*.25;p.jaw=flight*.20;
    }
    if(action==='dance'){const beat=Math.sin(age*9);p.rootY=.055*Math.abs(beat)*e;p.bodyRoll=.08*beat*e;p.headRoll=-.08*beat*e;p.leftWing-=e*(1.1+.25*beat);p.rightWing+=e*(1.1-.25*beat);p.leftLift=.08*Math.max(0,beat)*e;p.rightLift=.08*Math.max(0,-beat)*e;p.jaw=.24*e;}
    if(action==='happy'){p.headPitch=.14*e;p.headRoll=.12*Math.sin(age*4)*e;p.blink=Math.max(p.blink,.87*e);p.leftWing-=.55*e;p.rightWing+=.55*e;p.jaw=.18*e;}
    if(t>=1&&action!=='idle'){action='idle';age=0;el.dataset.action='idle';}
   }
   for(const k of Object.keys(pose))pose[k]=THREE.MathUtils.damp(pose[k],p[k],k==='blink'?45:14,dt);
   root.position.set(pose.rootX,pose.rootY,0);spine.position.y=pose.bodyY;spine.rotation.set(0,pose.bodyYaw,pose.bodyRoll);
   head.rotation.set(pose.headPitch,pose.headYaw,pose.headRoll);tuft.rotation.z=-.56+pose.headRoll*.15;
   left.shoulder.rotation.z=pose.leftWing;right.shoulder.rotation.z=pose.rightWing;left.tip.rotation.x=pose.leftTip;right.tip.rotation.x=pose.rightTip;
   leftFoot.leg.rotation.x=pose.leftLeg;rightFoot.leg.rotation.x=pose.rightLeg;leftFoot.leg.position.y=.24+pose.leftLift;rightFoot.leg.position.y=.24+pose.rightLift;
   lower.rotation.x=pose.jaw;upper.rotation.x=-pose.jaw*.15;
   for(const eye of eyes){eye.glass.scale.y=.137*(1-.93*pose.blink);eye.eye.rotation.y=gaze.x*.10;eye.eye.rotation.x=-gaze.y*.06;}
   shadow.material.opacity=.13*(1-pose.rootY);shadow.scale.setScalar(1-pose.rootY*.22);
   renderer.render(scene,camera);
  }
  raf=requestAnimationFrame(update);
 }
 const move=e=>{const r=el.getBoundingClientRect();target.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1),THREE.MathUtils.clamp((e.clientY-r.top)/r.height*2-1,-1,1));};
 const enter=()=>{if(action==='idle')play('wave');},leave=()=>target.set(0,0);
 el.addEventListener('pointermove',move);el.addEventListener('pointerenter',enter);el.addEventListener('pointerleave',leave);
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resize.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('pointerenter',enter);el.removeEventListener('pointerleave',leave);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const s of skeletons)s.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}
 renderer.compile(scene,camera);el.dataset.renderer='rig-3d';el.classList.add('nini-mesh-ready');
 raf=requestAnimationFrame(update);return {play,dispose};
}
