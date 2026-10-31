/*
 * V29 — subtle ship/sea contact. Original procedural overlay, no external textures.
 * No long filled ribbons or rectangular sprites: foam is made from small, broken
 * strokes and flecks in world space, projected through the current camera.
 * Drawn between Open Water and the transparent Three.js ship canvas.
 * This is an approximation until both renderers share their FFT height/depth.
 */
export function createWaterContactFX(THREE, shipRoot) {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const canvas=document.createElement('canvas');
  canvas.id='naval-sea-contact-canvas';
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'1',pointerEvents:'none',display:'block'});
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  const coarse=matchMedia('(pointer:coarse)').matches;
  let W=1,H=1,DPR=1,clock=0,lastDraw=0,lastTrail=-10;
  let history=[],stats={visible:false,foamSegments:0,wakePoints:0};
  const local=new THREE.Vector3(),p=new THREE.Vector3(),v=new THREE.Vector3();
  function resize(){
    W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);
    DPR=Math.min(devicePixelRatio||1,coarse?1:1.5);
    canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize();addEventListener('resize',resize,{passive:true});
  function projectWorld(x,y,z,camera){
    p.set(x,y,z);
    v.copy(p).applyMatrix4(camera.matrixWorldInverse);
    if(v.z>=-.11)return null;
    v.copy(p).project(camera);
    if(!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.z< -1||v.z>1)return null;
    return {x:(v.x*.5+.5)*W,y:(.5-v.y*.5)*H};
  }
  // Only a tiny height ripple: don't counterfeit large FFT waves in screen space.
  function seaY(x,z){return .14+.08*Math.sin(x*.013+z*.021+clock*.45)+.05*Math.sin(z*.037-clock*.33);}
  function shipPoint(side,t,beam,length,offset,camera){
    const fullness=Math.sqrt(Math.max(.035,1-Math.pow(Math.abs(t),2.85)));
    const lx=side*(beam*fullness+offset);
    const lz=t*length*.465;
    local.set(lx,0,lz);shipRoot.localToWorld(local);
    return projectWorld(local.x,seaY(local.x,local.z),local.z,camera);
  }
  function drawFleck(pt,seed,opacity,stretch){
    if(!pt||pt.x< -30||pt.x>W+30||pt.y< -30||pt.y>H+30)return false;
    const angle=(hash(seed+8.5)-.5)*.9;
    const len=clamp((1.1+hash(seed+2)*3.8)*stretch,.85,6.8);
    const w=clamp(.55+hash(seed+3)*1.15,.55,1.70);
    ctx.lineCap='round';ctx.strokeStyle=`rgba(233,245,240,${clamp(opacity,0,.58)})`;ctx.lineWidth=w;
    ctx.beginPath();ctx.moveTo(pt.x-len*.4,pt.y+angle*len*.35);
    ctx.lineTo(pt.x+len*.55,pt.y-angle*len*.35);ctx.stroke();
    return true;
  }
  function hullFoam(camera,beam,length,speed,strength){
    const speedFactor=clamp(speed/21,0,1);
    const normal=coarse?75:132;
    let drawn=0;
    // Discrete foam fragments, instead of the old solid cyan outline.
    for(const side of [-1,1]){
      for(let i=0;i<normal;i++){
        const seed=i*17.731+(side<0?37:107);
        const t=hash(seed)*1.88-.94;
        // More agitation near the bow, less along the still-waterline midships.
        const bow=clamp((-t+.25)*.9,0,1);
        const chance=(.31+.29*speedFactor+.10*bow)*clamp(strength/1.25,0,1);
        if(hash(seed+16)>chance)continue;
        const offset=.4+Math.pow(hash(seed+19),1.9)*(1.7+2.1*speedFactor);
        const pt=shipPoint(side,t,beam,length,offset,camera);
        const alpha=clamp((.11+.24*speedFactor+.075*bow)*(1-hash(seed+20)*.3)*strength,0,.52);
        drawn+=Number(drawFleck(pt,seed,alpha,1+speedFactor*.65));
      }
      // Short disconnected bright tips at the bow, never a continuous ribbon.
      for(let i=0;i<22;i++){
        const seed=i*9.29+side*57;
        if(hash(seed+clock*.12)>.39*clamp(strength/1.4,0,1))continue;
        const t=-.95+hash(seed+5)*.39;
        const offset=.5+hash(seed+2)*(1.1+speedFactor*1.5);
        drawn+=Number(drawFleck(shipPoint(side,t,beam,length,offset,camera),seed,.18+.15*speedFactor,1.1));
      }
    }
    return drawn;
  }
  function wake(camera,length,speed,strength,dt,running){
    if(speed<2.5){history.length=0;return 0;}
    if(running&&clock-lastTrail>.26){
      lastTrail=clock;
      local.set(0,0,length*.435);shipRoot.localToWorld(local);
      // Vessel's forward local z points towards its stern in this rig.
      history.unshift({x:local.x,z:local.z,t:clock,heading:shipRoot.rotation.y});
      if(history.length>58)history.pop();
    }
    let drawn=0;
    for(let i=0;i<history.length;i++){
      const s=history[i],age=(clock-s.t)/11;
      if(age>=1)continue;
      const fade=Math.pow(1-age,1.3);
      for(const side of [-1,1]){
        const r=side*(1.1+age*11),hx=Math.cos(s.heading),hz=-Math.sin(s.heading);
        const x=s.x+r*hx,z=s.z+r*hz;
        const pos=projectWorld(x,seaY(x,z),z,camera);
        const seed=i*39.61+side*211.7;
        if(hash(seed+Math.floor(clock*.45))>.70)continue;
        const alpha=clamp((.12+.15*Math.min(1,speed/20))*strength*fade,0,.38);
        drawn+=Number(drawFleck(pos,seed,alpha,1.4+age*.5));
      }
    }
    return drawn;
  }
  function update({camera,dt=0,phase='title',speed=0,opts={},shipLength=260,beam=16}={}){
    const now=performance.now();if(now-lastDraw<(coarse?45:32))return;
    lastDraw=now;ctx.clearRect(0,0,W,H);
    const strength=clamp(Number(opts.wake??1),0,2);
    if(!ctx||!camera||!opts.enabled||strength<.01||camera.position.y<-.6){
      stats={visible:false,foamSegments:0,wakePoints:0};return;
    }
    const running=phase==='running';if(running&&dt>0)clock+=Math.min(.13,dt);
    camera.updateMatrixWorld(true);shipRoot.updateMatrixWorld(true);
    const pieces=hullFoam(camera,clamp(beam,3,45),clamp(shipLength,25,430),Math.max(0,speed),strength);
    const tail=wake(camera,clamp(shipLength,25,430),Math.max(0,speed),strength,dt,running);
    stats={visible:pieces>0,foamSegments:pieces,wakePoints:tail};
  }
  function reset(){ctx.clearRect(0,0,W,H);history=[];clock=0;lastTrail=-10;}
  return {update,reset,get stats(){return {...stats};}};
}
