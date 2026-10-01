import * as THREE from 'three';

// Compact urban stage: procedural textures, shared geometry and one shadow light.
export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070c18');
  scene.fog = new THREE.Fog('#070c18', 12, 32);
  const textures = [];
  const cones = [];
  function texture(size, paint) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    paint(canvas.getContext('2d'), size);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map); return map;
  }
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const concrete = texture(256, (ctx, size) => {
    ctx.fillStyle = '#353b43'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = random() > .5 ? 'rgba(190,199,210,.07)' : 'rgba(0,0,0,.12)';
      ctx.fillRect(random()*size, random()*size, 1+random()*3, 1+random()*2);
    }
    ctx.strokeStyle = 'rgba(10,15,22,.3)'; ctx.lineWidth = 1;
    for (let i=0; i<9; i++) {
      const x=random()*size, y=random()*size;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+15,y+4); ctx.lineTo(x+23,y+17); ctx.stroke();
    }
  });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(5,5);
  const graffiti = texture(1024, (ctx, size) => {
    ctx.clearRect(0,0,size,size);
    // Paint splashes and drips stay baked into a single transparent wall decal.
    for (let i=0; i<130; i++) {
      ctx.fillStyle = i%2 ? 'rgba(255,112,35,.22)' : 'rgba(42,190,225,.18)';
      ctx.beginPath(); ctx.arc(150+random()*720,220+random()*590,2+random()*13,0,Math.PI*2); ctx.fill();
    }
    ctx.save(); ctx.translate(512,512); ctx.rotate(-.055); ctx.transform(1,0,-.12,1,0,0);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='italic 900 240px Arial Black, Impact, sans-serif';
    ctx.lineJoin='round';
    for (const [word,y,color] of [['FARM',-132,'#ff923e'],['AURA',112,'#50d1e5']]) {
      ctx.lineWidth=36; ctx.strokeStyle='#111724'; ctx.strokeText(word,8,y+12);
      ctx.lineWidth=15; ctx.strokeStyle='#e5e0cf'; ctx.strokeText(word,0,y);
      ctx.fillStyle=color; ctx.fillText(word,0,y);
      ctx.lineWidth=3; ctx.strokeStyle='#172035'; ctx.strokeText(word,0,y);
    }
    ctx.restore();
    for(let i=0;i<15;i++) {
      ctx.fillStyle=i%2?'#ff923e':'#50d1e5'; ctx.fillRect(220+random()*570,690+random()*35,3+random()*5,15+random()*60);
    }
    ctx.strokeStyle='#ff923e'; ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(240,812); ctx.lineTo(805,780); ctx.stroke();
  });
  const box = new THREE.BoxGeometry(1,1,1);
  const plane = new THREE.PlaneGeometry(1,1);
  const cone = new THREE.CircleGeometry(1,24);
  const rim = new THREE.TorusGeometry(1,.065,6,24);
  const floorMaterial = new THREE.MeshStandardMaterial({color:'#434b58',map:concrete,roughness:.48,metalness:.18});
  const brick = texture(256, (ctx, size) => {
    ctx.fillStyle = '#343a44'; ctx.fillRect(0, 0, size, size);
    for (let row=0; row<8; row++) for (let col=-1; col<4; col++) {
      const x=col*85+(row%2)*42;
      const shade=42+Math.floor(random()*18);
      ctx.fillStyle=`rgb(${shade},${shade+4},${shade+10})`;
      ctx.fillRect(x+2,row*32+2,81,28);
      ctx.fillStyle='rgba(180,190,205,.08)';ctx.fillRect(x+3,row*32+3,79,1);
    }
  });
  brick.wrapS=brick.wrapT=THREE.RepeatWrapping; brick.repeat.set(6,3);
  const wallMaterial = new THREE.MeshStandardMaterial({color:'#89919d',map:brick,roughness:.92});
  const dark = new THREE.MeshStandardMaterial({color:'#111722',roughness:.75,metalness:.22});
  const trim = new THREE.MeshStandardMaterial({color:'#303b4b',roughness:.5,metalness:.55});
  const speakerCone = new THREE.MeshStandardMaterial({color:'#080d15',roughness:.88});
  const orange = new THREE.MeshStandardMaterial({color:'#ff9c44',emissive:'#ff660d',emissiveIntensity:2.1});
  const cyan = new THREE.MeshStandardMaterial({color:'#87efff',emissive:'#16bfe7',emissiveIntensity:1.8});
  function mesh(geometry, material, position, scale, parent=scene) {
    const object = new THREE.Mesh(geometry,material); object.position.set(...position); object.scale.set(...scale); parent.add(object); return object;
  }
  const ground = mesh(plane,floorMaterial,[0,0,0],[40,40,1]);
  ground.name='ground'; ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
  mesh(box,wallMaterial,[0,2.8,-3.3],[12,5.6,.3]);
  mesh(box,trim,[0,.16,-3.08],[12,.32,.18]);
  mesh(box,dark,[0,5.5,-3],[12,.18,.5]);
  const art = mesh(plane,new THREE.MeshStandardMaterial({map:graffiti,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1}),[0,2.15,-2.4],[3.1,2.15,1]);
  art.name='FARM AURA graffiti';
  // Reused industrial framing and equipment keep the stage compact.
  mesh(box,trim,[0,4.7,-2.8],[10,.16,.18]);
  for (const side of [-1,1]) {
    mesh(box,trim,[side*4.45,2.35,-2.7],[.16,4.7,.18]);
    const brace=mesh(box,trim,[side*3.85,4.1,-2.7],[1.65,.09,.12]);brace.rotation.z=side*.75;
    mesh(box,side<0?orange:cyan,[side*2.9,4.58,-2.65],[2.4,.04,.05]);
    for (let i=0;i<2;i++) {
      const x=side*(3.25+i*.82), y=.28+i*.12;
      mesh(box,dark,[x,y,-1.9],[.72,y*2,.66]);
      mesh(box,trim,[x,y*2+.025,-1.9],[.76,.05,.7]);
      mesh(box,trim,[x,y,-1.555],[.46,.035,.025]);
    }
  }
  // A few roof silhouettes are scenery, never a traversable city.
  const skylineMaterial=new THREE.MeshBasicMaterial({color:'#101725'});
  const skyline=new THREE.InstancedMesh(box,skylineMaterial,10);
  const transform=new THREE.Object3D();
  for(let i=0;i<10;i++){
    const height=5.9+random()*2.3;
    transform.position.set((i-4.5)*2.1,height/2,-7-random()*3);
    transform.scale.set(1.5+random()*.6,height,1.2);transform.updateMatrix();skyline.setMatrixAt(i,transform.matrix);
  }
  scene.add(skyline);
  // Scattered seams and damp patches avoid a development-grid appearance.
  const damp=new THREE.MeshStandardMaterial({color:'#293440',roughness:.29,metalness:.2,transparent:true,opacity:.48,depthWrite:false});
  for(let i=0;i<7;i++){
    const patch=mesh(cone,damp,[(random()-.5)*8,.007,random()*5-2],[.2+random()*.55,.08+random()*.25,1]);
    patch.rotation.x=-Math.PI/2;patch.rotation.z=random()*Math.PI;
  }
  for (const side of [-1,1]) {
    // Short return walls and pillars frame the stage without an explorable city.
    mesh(box,wallMaterial,[side*5.4,2.4,-1.8],[.35,4.8,3]);
    mesh(box,trim,[side*4.9,2.4,-3],[.32,4.8,.5]);
    mesh(box,dark,[side*3.6,1.5,-3.08],[1.3,2.8,.1]);
    for (let j=0;j<8;j++) mesh(box,trim,[side*3.6,.35+j*.32,-2.99],[1.18,.035,.05]);
    const neon = side<0 ? orange : cyan;
    for (const x of [2.5,4.65]) {
      mesh(box,dark,[side*x,2.35,-2.94],[.16,3.65,.12]);
      mesh(box,neon,[side*x,2.35,-2.85],[.055,3.45,.055]);
    }
    const speaker = new THREE.Group(); speaker.position.set(side*1.55,0,-1.25); speaker.rotation.y=-side*.12; scene.add(speaker);
    mesh(box,dark,[0,.88,0],[.83,1.76,.65],speaker);
    mesh(box,trim,[0,.07,.02],[.92,.14,.72],speaker);
    mesh(box,trim,[0,1.72,.02],[.88,.08,.69],speaker);
    for (const [y,r] of [[.52,.29],[1.16,.22]]) {
      const diaphragm=mesh(cone,speakerCone,[0,y,.333],[r,r,1],speaker);
      cones.push({mesh:diaphragm,radius:r});
      mesh(rim,trim,[0,y,.345],[r,r,r],speaker);
      mesh(cone,trim,[0,y,.35],[r*.28,r*.28,1],speaker);
    }
    mesh(box,neon,[0,1.52,.34],[.3,.025,.025],speaker);
    // Soft baked light pools suggest reflections without render targets or ray tracing.
    const poolMap = texture(128,(ctx,s) => {
      const gradient=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
      gradient.addColorStop(0,side<0?'rgba(255,105,25,.22)':'rgba(20,180,245,.18)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gradient; ctx.fillRect(0,0,s,s);
    });
    const pool=mesh(plane,new THREE.MeshBasicMaterial({map:poolMap,transparent:true,depthWrite:false}),[side*2.8,.012,-.85],[3,5,1]); pool.rotation.x=-Math.PI/2;
  }
  const ambient=new THREE.HemisphereLight('#9eb6df','#30231e',1.15);
  const front=new THREE.DirectionalLight('#fff1dc',2.6); front.position.set(1.8,5,6); front.castShadow=true;
  front.shadow.mapSize.set(1024,1024); Object.assign(front.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:18}); front.shadow.normalBias=.035;
  const warm=new THREE.PointLight('#ff741f',22,10,2); warm.position.set(-3,2.5,.5);
  const cool=new THREE.PointLight('#24bfff',15,10,2); cool.position.set(3,2.8,-.2);
  scene.add(ambient,front,warm,cool);
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let intensity=1;
  return {scene,
    update(delta,combo=1,time=0,visual={}) {
      const target=1 + Math.min(Math.max(combo-1,0),6)*.025;
      intensity=THREE.MathUtils.lerp(intensity,target,1-Math.exp(-Math.min(delta,.1)*4));
      const pulse=reducedMotion?1:1+.025*Math.sin(time*1.4)+(combo>=4?.03*Math.sin(time*2.4):0);
      const reaction=1+.13*(visual.celebrate??0)-.07*(visual.error??0);
      for(const {mesh,radius} of cones){
        const beat=reducedMotion?0:(visual.dancing?Math.sin(time*10)*.018:0)+.025*(visual.celebrate??0);
        mesh.scale.set(radius*(1+beat),radius*(1+beat),1);mesh.position.z=.333+beat*.12;
      }
      warm.intensity=22*intensity*reaction*pulse; cool.intensity=15*intensity*reaction*pulse;
      orange.emissiveIntensity=2.1*intensity*pulse*reaction; cyan.emissiveIntensity=1.8*intensity*pulse*reaction;
    },
    dispose() {
      const geometries=new Set(), materials=new Set();
      scene.traverse(object => {if(object.geometry)geometries.add(object.geometry); for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
      geometries.forEach(geometry=>geometry.dispose()); materials.forEach(material=>material.dispose()); textures.forEach(map=>map.dispose()); front.shadow.dispose();
    },
  };
}
