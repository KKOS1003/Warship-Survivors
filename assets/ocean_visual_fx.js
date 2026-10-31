/*
 * Naval Survivor V25 — optional near-field ocean detail layer.
 * Design ideas: Ultra-Water (Humpalumps, MIT) — glints, textured foam,
 * impact ripples. This is an independent implementation, NOT the
 * Ultra-Water FFT/lighting pipeline or a replacement for Open Water.
 */
export function createOceanVisualFX(THREE, scene) {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const onPhone=matchMedia('(pointer: coarse)').matches;
  const opts={enabled:true,wake:1.55,glints:onPhone?.28:.50,impacts:1.15,enemyWakes:true};
  const palette={wake:new THREE.Color(0xd7eff3)};
  const allWakes=new Map();
  const MAX_SEG=74, MAX_ENEMY_WAKES=10;
  let time=0,wind=8,swell=1,active=false,glintCell='',nextId=1;
  const shaderVert=`
    attribute float aAge;
    varying vec2 vUV;
    varying vec2 vXZ;
    varying float vAge;
    void main(){vUV=uv;vXZ=position.xz;vAge=aAge;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }`;
  const shaderFrag=`
    precision highp float;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uStorm;
    varying vec2 vUV;
    varying vec2 vXZ;
    varying float vAge;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      float n=noise(vXZ*.19+vec2(uTime*.16,-uTime*.13));
      float n2=noise(vXZ*.48-vec2(uTime*.25,uTime*.12));
      float grain=noise(vXZ*.94+uTime*.13);
      float side=abs(vUV.x*2.0-1.0);
      float feather=1.0-smoothstep(.71,1.0,side);
      float rapids=clamp(n*.67+n2*.44+grain*.15-.43,0.0,1.0);
      float crests=smoothstep(.29,.70,rapids) *(.52+.48*smoothstep(.24,.92,side));
      float center=.36*exp(-27.0*(vUV.x-.5)*(vUV.x-.5));
      float fade=pow(1.0-vAge,1.45);
      float alpha=clamp((crests*1.6+center*.9+.22)*feather*fade*uOpacity,0.0,.84);
      if(alpha<.012)discard;
      vec3 col=mix(vec3(.61,.78,.84),vec3(.91,.965,1.),n2*.8);
      col*=mix(.94,.78,uStorm);
      gl_FragColor=vec4(col,alpha);
    }`;
  const wakeMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:.65},uStorm:{value:0}},
    vertexShader:shaderVert,fragmentShader:shaderFrag,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    toneMapped:false
  });
  function makeWake(key,width,length){
    const pos=new Float32Array(MAX_SEG*2*3);
    const uv=new Float32Array(MAX_SEG*2*2);
    const age=new Float32Array(MAX_SEG*2);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAge',new THREE.BufferAttribute(age,1).setUsage(THREE.DynamicDrawUsage));
    const idx=[];for(let i=0;i<MAX_SEG-1;i++){let a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    geo.setIndex(idx);geo.setDrawRange(0,0);
    const mesh=new THREE.Mesh(geo,wakeMaterial);mesh.frustumCulled=false;mesh.renderOrder=-4;
    scene.add(mesh);
    const w={mesh,points:[],stamp:0,width,length};allWakes.set(key,w);return w;
  }
  function destroyWake(key){const w=allWakes.get(key);if(!w)return;
    scene.remove(w.mesh);w.mesh.geometry.dispose();allWakes.delete(key);}
  function sampleY(x,z){
    const h=Math.min(2.4,.18+Math.sqrt(Math.max(.1,swell))*.20);
    return .45+h*(.45*Math.sin(time*.43+x*.010+z*.007)+.25*Math.sin(time*.9-x*.027+z*.016));
  }
  function updateWake(key,p,dt){
    if(!p||p.speed<2.5){const w=allWakes.get(key);if(w){w.points.length=0;w.mesh.geometry.setDrawRange(0,0);}return;}
    let w=allWakes.get(key);if(!w)w=makeWake(key,p.width,p.length);
    const heading=p.heading ?? p.object.rotation.y;
    const sternDist=(p.length??w.length)*.43;
    const hx=Math.sin(heading),hz=Math.cos(heading);
    const px=p.object.position.x+hx*sternDist,pz=p.object.position.z+hz*sternDist;
    if(!w.points.length||time-w.stamp>.24||Math.hypot(px-w.points[0].x,pz-w.points[0].z)>8){
      w.stamp=time;w.points.unshift({x:px,z:pz,dir:heading,t:time,speed:p.speed});
      if(w.points.length>MAX_SEG)w.points.length=MAX_SEG;
    }
    const geo=w.mesh.geometry,pos=geo.attributes.position.array,uv=geo.attributes.uv.array,ages=geo.attributes.aAge.array;
    let rows=0;
    for(const pt of w.points){
      const age=(time-pt.t)/14;if(age>=1)continue;
      const grow=(5+33*Math.sqrt(age))*(p.width/30);
      const sideX=Math.cos(pt.dir),sideZ=-Math.sin(pt.dir);
      const y=Math.max(.75,sampleY(pt.x,pt.z)+.38);
      for(let s=0;s<2;s++){const q=rows*2+s,k=q*3,h=q*2,sign=s?1:-1;
        pos[k]=pt.x+sign*grow*sideX;pos[k+1]=y;pos[k+2]=pt.z+sign*grow*sideZ;
        uv[h]=s;uv[h+1]=age;ages[q]=age;
      }
      rows++;
    }
    geo.setDrawRange(0,Math.max(0,rows-1)*6);
    geo.attributes.position.needsUpdate=true;geo.attributes.uv.needsUpdate=true;geo.attributes.aAge.needsUpdate=true;
    geo.computeBoundingSphere();
  }
  // V29: retire the old row of 14 regular translucent planes. At oblique
  // camera angles they looked like oversized cyan tiles sitting on the water.
  // Small contact flecks are instead rendered by water_contact_fx.js.
  const shoulders=[];
  function updateShoulders(){} // legacy API kept for the existing update path
  // A single draw call for sunlight micro-glints, in world-space cells around the camera.
  const GLINT_COUNT=144,glintPos=new Float32Array(GLINT_COUNT*3),glintSeed=new Float32Array(GLINT_COUNT);
  const glintGeo=new THREE.BufferGeometry();
  glintGeo.setAttribute('position',new THREE.BufferAttribute(glintPos,3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<GLINT_COUNT;i++)glintSeed[i]=(i*0.6180339)%1;
  glintGeo.setAttribute('aSeed',new THREE.BufferAttribute(glintSeed,1));
  const glintMat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:.24}},transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
    vertexShader:`attribute float aSeed;varying float vSeed;uniform float uTime;
      void main(){vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=clamp(650.0/max(12.0,-mv.z),1.0,6.0);
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`precision highp float;varying float vSeed;uniform float uTime;uniform float uOpacity;
      void main(){vec2 p=gl_PointCoord-.5;
        float shape=exp(-75.0*p.y*p.y-13.0*p.x*p.x);
        float sparkle=pow(max(0.0,sin(uTime*(1.1+vSeed*.75)+vSeed*71.4)),6.0);
        float a=shape*sparkle*uOpacity;
        if(a<.014)discard;gl_FragColor=vec4(.79,.91,1.,a);}`
  });
  const glints=new THREE.Points(glintGeo,glintMat);glints.frustumCulled=false;glints.renderOrder=-5;scene.add(glints);
  const rippleGeo=new THREE.RingGeometry(.88,1.08,48);
  const ripples=[];const MAX_RIPPLES=34;
  function impact(p,power=1){
    if(!opts.enabled||opts.impacts<=0||Math.abs(p.y)>17||ripples.length>=MAX_RIPPLES)return;
    const mat=new THREE.MeshBasicMaterial({color:0xd8f5ff,transparent:true,opacity:.26,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const mesh=new THREE.Mesh(rippleGeo,mat);mesh.rotation.x=-Math.PI/2;
    mesh.position.set(p.x,Math.max(.55,sampleY(p.x,p.z)),p.z);mesh.renderOrder=-2;scene.add(mesh);
    ripples.push({mesh,age:0,life:2.2+power*.45,radius:1.4+power*.6,power});
  }
  const seeded=(n)=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  function rebuildGlints(playerPos){
    const tx=Math.floor(playerPos.x/160),tz=Math.floor(playerPos.z/160),key=tx+':'+tz;
    if(key===glintCell)return;glintCell=key;
    for(let i=0;i<GLINT_COUNT;i++){
      const cell=i%25,cx=cell%5-2,cz=Math.floor(cell/5)-2;
      const x=(tx+cx+seeded(i+123.13)) *160;
      const z=(tz+cz+seeded(i+874.74))*160;
      glintPos[3*i]=x;glintPos[3*i+1]=.75;glintPos[3*i+2]=z;
    }
    glintGeo.attributes.position.needsUpdate=true;
  }
  let optionsVersion=0;
  function setOptions(next){for(const [k,v] of Object.entries(next)){
      if(!(k in opts))continue;
      opts[k]=typeof opts[k]==='boolean'?!!v:clamp(Number(v)||0,0,2);
    }
    optionsVersion++;if(!opts.enabled){for(const w of allWakes.values())w.mesh.visible=false;glints.visible=false;}
    return {...opts};
  }
  function update({dt,player,enemies=[],sunElev=10,windSpeed=8,swellHs=1,phase='running',camera=null}){
    const submerged=!!camera&&camera.position.y<-.6;
    const running=phase==='running'&&opts.enabled;
    const shown=opts.enabled&&!submerged;
    active=shown;wind=windSpeed;swell=swellHs;
    if(dt>0&&running)time+=Math.min(.12,dt);
    wakeMaterial.uniforms.uTime.value=time;
    wakeMaterial.uniforms.uStorm.value=clamp((wind-12)/19,0,1);
    wakeMaterial.uniforms.uOpacity.value=Math.min(.92,opts.wake*.35);
    const canWake=opts.wake>.01&&shown;
    if(canWake&&player&&running)updateWake('player',player,dt);
    if(player)updateShoulders(player,shown,player.speed||0);
    const candidates=canWake&&opts.enemyWakes?enemies.filter(e=>e.hp>0&&e.group&&e.speed>3)
      .sort((a,b)=>a.group.position.distanceToSquared(player.object.position)-b.group.position.distanceToSquared(player.object.position)).slice(0,onPhone?4:MAX_ENEMY_WAKES):[];
    const alive=new Set(['player']);
    for(const e of candidates){
      const id=e;alive.add(id);
      if(running)updateWake(id,{object:e.group,heading:e.group.rotation.y,speed:e.speed,width:e.config?.model?.collision?.halfBeam?e.config.model.collision.halfBeam*2:14,length:e.config?.model?.lengthMeters||90},dt);
    }
    for(const key of [...allWakes.keys()]){
      const w=allWakes.get(key);w.mesh.visible=canWake&&alive.has(key);
      if(!alive.has(key)&&key!=='player')destroyWake(key);
    }
    glints.visible=shown&&opts.glints>.01&&sunElev>4;
    if(glints.visible&&player){rebuildGlints(player.object.position);
      glintMat.uniforms.uTime.value=time;
      glintMat.uniforms.uOpacity.value=opts.glints*clamp((sunElev-1)/18,0,1)*clamp(1-(wind-16)/30,.28,1);
      glintGeo.setDrawRange(0,onPhone?56:GLINT_COUNT);
    }
    for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];
      if(running)r.age+=dt;
      const f=clamp(r.age/r.life,0,1),size=r.radius+f*(12+18*r.power);
      r.mesh.scale.set(size,size,1);
      r.mesh.material.opacity=opts.enabled ? opts.impacts*.52*Math.pow(1-f,1.8):0;
      r.mesh.visible=shown;
      if(f>=1){scene.remove(r.mesh);r.mesh.material.dispose();ripples.splice(i,1);}
    }
  }
  function reset(){for(const key of [...allWakes.keys()])destroyWake(key);
    for(const r of ripples){scene.remove(r.mesh);r.mesh.material.dispose();}ripples.length=0;
    glintCell='';for(const p of shoulders)p.mesh.visible=false;}
  return {options:opts,setOptions,update,impact,reset,get stats(){return {wakes:allWakes.size,whitecaps:shoulders.filter(p=>p.mesh.visible).length,ripples:ripples.length,glints:glints.visible?glintGeo.drawRange.count:0};}};
}
