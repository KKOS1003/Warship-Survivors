/* V29: restrained underwater fog and particles. No fake seabed, surface plane, beams, or caustic stripes. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const canvas=document.createElement('canvas');canvas.id='naval-underwater-fx';
 Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'4',pointerEvents:'none',opacity:'0',display:'none'});
 document.body.appendChild(canvas);
 const ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx){window.__navalUnderwater={update:()=>false};return;}
 const coarse=matchMedia('(pointer:coarse)').matches;
 const config={enabled:true,intensity:clamp((Number($('uw26-intensity')?.value)||70)/100,.2,1.7),particles:!coarse};
 let W=0,H=0,scale=1,last=0,phase=0,depth=0,pitch=0,swell=0,active=false,fade=0;
 let particles=[];
 const seed=()=>Math.random();
 function resize(){
  const px=Math.min(coarse?720:1250,innerWidth*(coarse?.9:1));
  scale=px/Math.max(1,innerWidth);W=Math.max(1,Math.round(innerWidth*scale));H=Math.max(1,Math.round(innerHeight*scale));
  canvas.width=W;canvas.height=H;
  particles=Array.from({length:coarse?24:62},()=>({x:seed()*W,y:seed()*H,r:.6+seed()*1.6,rate:.1+seed()*.5,offset:seed()*10}));
 }
 resize();window.addEventListener('resize',resize);
 const setOptions=o=>{
  if(typeof o.enabled==='boolean')config.enabled=o.enabled;
  if(Number.isFinite(Number(o.intensity)))config.intensity=clamp(Number(o.intensity),.2,1.7);
  if(typeof o.particles==='boolean')config.particles=o.particles;
  return {...config};
 };
 // The real FFT ocean is a separate renderer; water height is conservatively approximated at y=0.
 function update({y=0,angle=0,wave=0,dt=0}={}){
  depth=Math.max(0,-Number(y));pitch=angle||0;swell=wave||0;
  const next=config.enabled&&window.__navalCameraDiveEnabled===true&&Number(y)<-.8;
  if(next!==active){active=next;document.body.classList.toggle('g-underwater',active);}
  return active;
 }
 function paint(now){
  requestAnimationFrame(paint);
  const dt=clamp((now-last)/1000||0,0,.06);
  if(now-last<(coarse?48:30))return;
  last=now;
  const target=active?1:0;fade+=(target-fade)*clamp(dt*5.5,.02,1);
  if(fade<.014){canvas.style.display='none';ctx.clearRect(0,0,W,H);return;}
  canvas.style.display='block';canvas.style.opacity=String(clamp(fade,0,1));
  phase+=dt;
  const deep=clamp(depth/38,0,1),bright=clamp(.65+.25*Math.sin(pitch)+.10*(1-deep),.28,1.06);
  const strength=config.intensity;
  ctx.clearRect(0,0,W,H);
  // Subtle depth absorption. The THREE scene already uses real distance fog;
  // avoid the old triangular sun-beams and horizontal pseudo-surface lines,
  // which appeared to be an unrelated seabed/texture sheet from side-on views.
  const grad=ctx.createLinearGradient(0,0,0,H);
  const alpha=clamp((.055+deep*.080)*strength,0,.19);
  grad.addColorStop(0,`rgba(2,${Math.floor(48*bright)},${Math.floor(65*bright)},${alpha*.80})`);
  grad.addColorStop(1,`rgba(0,${Math.floor(30*bright)},${Math.floor(46*bright)},${alpha})`);
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  ctx.save();
  if(config.particles){
   ctx.fillStyle=`rgba(191,234,231,${.11*(1-deep*.45)*strength})`;
   for(const pt of particles){
    const x=(pt.x+Math.sin(phase*.7+pt.offset)*W*.008+W)%W;
    const y=(pt.y-phase*pt.rate*16+H*40)%H;
    ctx.beginPath();ctx.arc(x,y,pt.r,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();
 }
 requestAnimationFrame(paint);
 window.__navalUnderwater={setOptions,update,get active(){return active;},get depth(){return depth;},get config(){return {...config};}};
 const enable=$('uw26-enable'),level=$('uw26-intensity'),out=$('uw26-intensity-out');
 if(enable){enable.addEventListener('change',()=>setOptions({enabled:enable.checked}));}
 if(level){level.addEventListener('input',()=>{setOptions({intensity:Number(level.value)/100});if(out)out.textContent=level.value+'%';});}
})();
