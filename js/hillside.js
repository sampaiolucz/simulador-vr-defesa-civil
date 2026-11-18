// Encosta com casa em área de risco (cenário de deslizamento).
//
// Perfil do terreno (coordenadas locais; o grupo fica em HILL_POS), olhando de lado:
//
//   encosta natural (bananeiras, lixo, árvore)
//        \
//         \ y≈6,2  ← topo do barranco (z = -5,6)
//          |  barranco (corte quase vertical)
//   y=3    |__ canaleta ___ quintal ____ casa ____  patamar (z de -4 a 4)
//                                                \  escadaria / descida
//   y=0                                           \____ rua (z ≥ 12) ____ ponto de apoio (escola, à esquerda)
//                                                         córrego (à direita, x ≈ 11)
import * as THREE from 'three';

export const HILL_POS = new THREE.Vector3(-300, 0, 0);

/** Altura do terreno no ponto local (x, z). */
export function groundH(x, z) {
  let y;
  if (z >= 12) y = 0;
  else if (z >= 4) y = (3 * (12 - z)) / 8;
  else if (z >= -4) y = 3;
  else if (z >= -5.6) y = 3 + ((-4 - z) / 1.6) * 3.2;
  else y = 6.2 + (-5.6 - z) * 0.55;
  if (x > 13 && z > 2) y += (x - 13) * 0.7; // morro do outro lado do córrego
  if (z < -5.8 || (z > 4.3 && z < 11.7)) y += Math.sin(x * 0.7) * 0.12 + Math.cos(z * 0.9 + x * 0.3) * 0.1;
  return y;
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(parent, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function cyl(parent, rt, rb, h, color, x, y, z, seg = 12, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function hitProxy(parent, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw, transparent = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function crackTexture(seed = 1) {
  return canvasTex(
    512,
    256,
    (ctx) => {
      let s = seed;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      ctx.strokeStyle = 'rgba(30,22,15,0.95)';
      ctx.lineCap = 'round';
      const branch = (x, y, ang, len, w) => {
        if (len < 12 || w < 0.6) return;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let cx = x;
        let cy = y;
        for (let i = 0; i < 6; i++) {
          cx += Math.cos(ang + (rnd() - 0.5) * 0.9) * (len / 6);
          cy += Math.sin(ang + (rnd() - 0.5) * 0.9) * (len / 6);
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        branch(cx, cy, ang + (rnd() - 0.5) * 1.2, len * 0.6, w * 0.6);
        if (rnd() > 0.4) branch((x + cx) / 2, (y + cy) / 2, ang + (rnd() > 0.5 ? 1 : -1) * 0.9, len * 0.45, w * 0.5);
      };
      branch(20, 128, 0, 300, 9);
      branch(260, 120, 0.2, 230, 6);
    },
    true
  );
}
function signTexture(lines, { bg = '#15803d', fg = '#ffffff', arrow = null, w = 512, h = 256, logo = null } = {}) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    let x0 = w / 2;
    if (logo) {
      ctx.drawImage(logo, 24, h / 2 - 70, 140, 140);
      x0 = w / 2 + 70;
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.font = i === 0 ? 'bold 58px Arial' : 'bold 36px Arial';
      ctx.fillText(l, x0, h / 2 + (i - (lines.length - 1) / 2) * 62 - (arrow ? 22 : 0), w - 60);
    });
    if (arrow) {
      const y = h - 48;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, y);
      ctx.lineTo(w * 0.75, y);
      ctx.stroke();
      const tip = arrow === 'left' ? w * 0.2 : w * 0.8;
      const back = arrow === 'left' ? 34 : -34;
      ctx.beginPath();
      ctx.moveTo(tip, y);
      ctx.lineTo(tip + back, y - 24);
      ctx.lineTo(tip + back, y + 24);
      ctx.closePath();
      ctx.fill();
    }
  });
}

export function buildHillside(scene, logoPromise) {
  const group = new THREE.Group();
  group.position.copy(HILL_POS);
  group.visible = false;
  scene.add(group);
  const o = {};
  const G = (x, z) => groundH(x, z);

  // ---------------------------------------------------------------- Terreno
  const geo = new THREE.PlaneGeometry(80, 64, 160, 128);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, G(x, z));
    if (z >= -5.7 && z <= -3.9) c.set(0x8a5a36); // barranco: terra exposta
    else if (z > -3.9 && z < 4.1 && x > -7.2 && x < 9) c.set(0xa48a6a); // quintal de terra batida
    else if (z < -5.7) c.set(Math.sin(x * 1.3 + z) > 0.55 ? 0x7a6a3f : 0x557a37); // encosta desmatada (manchas de terra)
    else c.set(0x5f8a3e);
    const n = 0.92 + Math.random() * 0.12;
    colors[i * 3] = c.r * n;
    colors[i * 3 + 1] = c.g * n;
    colors[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  group.add(terrain);

  // Serra do Mar ao fundo
  for (const [x, z, h, r] of [
    [-50, -62, 38, 26],
    [-18, -70, 46, 30],
    [15, -66, 40, 24],
    [45, -60, 34, 26],
    [70, -40, 30, 22],
    [-72, -38, 28, 22],
  ]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat(0x2f5a34, { flatShading: true }));
    m.position.set(x, h / 2 - 2, z);
    m.rotation.y = x;
    group.add(m);
  }

  // ---------------------------------------------------------------- Rua, calçada, córrego
  const street = new THREE.Mesh(new THREE.PlaneGeometry(36, 6), mat(0x4b4f55));
  street.rotation.x = -Math.PI / 2;
  street.position.set(-8, 0.02, 15);
  group.add(street);
  box(group, 36, 0.12, 1.2, 0xbdb6aa, -8, 0, 11.8);
  const waterTex = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6b5235';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,170,120,0.45)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w * 0.3, y);
      ctx.quadraticCurveTo(w / 2, y + 10, w - Math.random() * w * 0.3, y);
      ctx.stroke();
    }
  });
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(1, 6);
  o.stream = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 26), new THREE.MeshLambertMaterial({ map: waterTex }));
  o.stream.rotation.x = -Math.PI / 2;
  o.stream.position.set(11.6, 0.05, 19);
  group.add(o.stream);
  box(group, 0.3, 0.6, 26, 0x8d8a80, 10.2, -0.3, 19); // margem

  // ---------------------------------------------------------------- Casa (alvenaria com laje)
  const house = new THREE.Group();
  const wallM = mat(0xe8dcc6);
  box(house, 6, 2.7, 5, wallM, 4.5, 3, -0.7);
  box(house, 6.3, 0.18, 5.3, 0x9ca3af, 4.5, 5.7, -0.7); // laje
  cyl(house, 0.55, 0.5, 0.8, 0x1d4ed8, 6.3, 5.88, -2.0, 16); // caixa d'água
  box(house, 0.04, 1.0, 1.2, 0x7dd3fc, 1.48, 4.1, -2.0); // janela
  box(house, 0.06, 1.1, 0.07, 0x6b7280, 1.47, 4.05, -2.0);
  group.add(house);
  // porta voltada para o quintal (interativa)
  o.door = new THREE.Group();
  box(o.door, 0.06, 2.0, 0.9, 0x7c5c3e, 0, 0, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd4af37));
  knob.position.set(-0.05, 1.0, 0.3);
  o.door.add(knob);
  hitProxy(o.door, 0.4, 2.1, 1.0, -0.1, 1.05, 0);
  o.door.position.set(1.46, 3, 0.6);
  group.add(o.door);
  // trinca na parede (aparece com a chuva)
  o.wallCrack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: crackTexture(7), transparent: true, depthWrite: false }));
  o.wallCrack.position.set(1.445, 4.4, -0.9);
  o.wallCrack.rotation.set(0, -Math.PI / 2, -0.6);
  group.add(o.wallCrack);
  o.wallCrackHit = new THREE.Group();
  hitProxy(o.wallCrackHit, 0.3, 1.4, 2.0, 1.4, 4.4, -0.9);
  group.add(o.wallCrackHit);
  // cano de esgoto lançado na encosta (risco)
  o.pipe = new THREE.Group();
  const pipeM = mat(0xe5e7eb);
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 10), pipeM);
  p1.rotation.x = Math.PI / 2;
  p1.position.set(1.7, 3.25, 2.9);
  o.pipe.add(p1);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.6), new THREE.MeshLambertMaterial({ color: 0x5c4a2e, side: THREE.DoubleSide }));
  spill.position.set(1.7, 2.55, 4.75);
  spill.rotation.x = -0.75;
  o.pipe.add(spill);
  hitProxy(o.pipe, 0.6, 1.4, 3.6, 1.7, 3.0, 3.2);
  group.add(o.pipe);

  // ---------------------------------------------------------------- Quintal
  // muro do quintal (lado esquerdo) — com a chuva fica embarrigado e inclinado
  o.wall = new THREE.Group();
  const blockM = mat(0xb8b3aa);
  o.wallSegs = [];
  for (let i = 0; i < 3; i++) {
    const seg = box(o.wall, 0.2, 1.7, 2.35, blockM, 0, 0, -2.4 + i * 2.4);
    o.wallSegs.push(seg);
  }
  hitProxy(o.wall, 0.8, 1.9, 7.4, 0, 0.95, 0);
  o.wall.position.set(-7.1, 3, 0);
  group.add(o.wall);
  // canaleta de drenagem na base do barranco (boa prática)
  o.channel = new THREE.Group();
  box(o.channel, 8.6, 0.2, 0.08, 0xa8a29e, -2.7, 3, -3.62);
  box(o.channel, 8.6, 0.2, 0.08, 0xa8a29e, -2.7, 3, -3.98);
  const chWater = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.28), mat(0x8fb4c9));
  chWater.rotation.x = -Math.PI / 2;
  chWater.position.set(-2.7, 3.05, -3.8);
  o.channel.add(chWater);
  hitProxy(o.channel, 8.8, 0.5, 0.7, -2.7, 3.2, -3.8);
  group.add(o.channel);
  // trinca no chão do quintal (aparece com a chuva)
  o.groundCrack = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ map: crackTexture(3), transparent: true, depthWrite: false }));
  o.groundCrack.rotation.set(-Math.PI / 2, 0, 0.3);
  o.groundCrack.position.set(-3.8, 3.015, -1.6);
  group.add(o.groundCrack);
  o.groundCrackHit = new THREE.Group();
  hitProxy(o.groundCrackHit, 2.6, 0.4, 1.4, -3.8, 3.15, -1.6);
  group.add(o.groundCrackHit);
  // pluviômetro
  o.gauge = new THREE.Group();
  cyl(o.gauge, 0.03, 0.03, 1.15, 0x6b7280, 0, 0, 0, 8);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.05, 0.14, 16, 1, true), mat(0xe5e7eb, { side: THREE.DoubleSide }));
  funnel.position.y = 1.4;
  o.gauge.add(funnel);
  cyl(o.gauge, 0.06, 0.06, 0.28, 0xf3f4f6, 0, 1.08, 0, 12);
  hitProxy(o.gauge, 0.5, 1.7, 0.5, 0, 0.85, 0);
  o.gauge.position.set(-5.6, 3, 2.6);
  group.add(o.gauge);

  // ---------------------------------------------------------------- Barranco e encosta
  o.cut = new THREE.Group();
  hitProxy(o.cut, 15, 3.2, 1.4, 0.5, 4.6, -4.75);
  group.add(o.cut);
  // água barrenta minando do barranco (aparece com a chuva)
  const seepTex = canvasTex(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(110,80,45,0)');
    g.addColorStop(0.25, 'rgba(110,80,45,0.95)');
    g.addColorStop(1, 'rgba(95,70,40,0.95)');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.25, 0, w * 0.5, h);
  }, true);
  seepTex.wrapT = THREE.RepeatWrapping;
  o.seepTex = seepTex;
  o.seep = new THREE.Group();
  for (const [x, w] of [
    [-4.4, 0.35],
    [-3.6, 0.22],
  ]) {
    // a face do barranco é inclinada ~26° em relação à vertical: a água escorre rente a ela
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), new THREE.MeshBasicMaterial({ map: seepTex, transparent: true, depthWrite: false }));
    s.position.set(x, 4.6, -4.77);
    s.rotation.x = -Math.atan2(1.6, 3.2);
    o.seep.add(s);
  }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), mat(0x6e5232));
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(1.6, 0.7, 1);
  puddle.position.set(-4.0, 3.02, -3.35);
  o.seep.add(puddle);
  hitProxy(o.seep, 2.2, 2.4, 1.2, -4.0, 4.0, -3.7);
  group.add(o.seep);

  // lixo e entulho na encosta (risco)
  o.trash = new THREE.Group();
  const tx = -2.8;
  const tz = -6.7;
  const ty = G(tx, tz);
  for (let i = 0; i < 9; i++) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.28 + Math.random() * 0.12, 8, 6), mat(i % 3 ? 0x1f2937 : 0x334155, { flatShading: true }));
    bag.scale.y = 0.75;
    bag.position.set(tx + (Math.random() - 0.5) * 2, ty + 0.2, tz + (Math.random() - 0.5) * 1.2);
    o.trash.add(bag);
  }
  for (let i = 0; i < 6; i++) {
    const b = box(o.trash, 0.3, 0.12, 0.18, 0xb45309, tx + (Math.random() - 0.5) * 1.6, ty + 0.05, tz + 0.4 + Math.random() * 0.6);
    b.rotation.set(Math.random(), Math.random(), Math.random());
  }
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), mat(0x111111));
  tire.position.set(tx + 0.9, ty + 0.15, tz - 0.3);
  tire.rotation.x = 1.2;
  o.trash.add(tire);
  hitProxy(o.trash, 2.8, 1.2, 2.0, tx, ty + 0.4, tz);
  group.add(o.trash);

  // bananeiras na encosta (risco)
  o.bananas = new THREE.Group();
  const leafM = mat(0x4d9a3a, { side: THREE.DoubleSide });
  for (const [x, z] of [
    [-5.4, -7.6],
    [-4.3, -9.2],
    [2.6, -8.1],
  ]) {
    const b = new THREE.Group();
    cyl(b, 0.13, 0.17, 2.6, 0x6b8e3a, 0, 0, 0, 8);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 1.8), leafM);
      leaf.position.y = 2.6;
      leaf.rotation.set(0.9 + Math.random() * 0.5, (i / 7) * Math.PI * 2, 0);
      leaf.translateY(0.8);
      b.add(leaf);
    }
    b.position.set(x, G(x, z) - 0.1, z);
    o.bananas.add(b);
  }
  hitProxy(o.bananas, 9.5, 3.5, 2.8, -1.4, G(-1.4, -8.3) + 1.6, -8.3);
  group.add(o.bananas);

  // grama plantada (boa prática)
  o.grass = new THREE.Group();
  const gx = 5.8;
  const gz = -7.6;
  const grassM = mat(0x3f9a3a);
  for (let i = 0; i < 40; i++) {
    const x = gx + (Math.random() - 0.5) * 3.6;
    const z = gz + (Math.random() - 0.5) * 2.4;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), grassM);
    tuft.position.set(x, G(x, z) + 0.12, z);
    o.grass.add(tuft);
  }
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6), mat(0x3f8f37));
  patch.rotation.x = -Math.PI / 2 + 0.5;
  patch.position.set(gx, G(gx, gz) + 0.06, gz);
  o.grass.add(patch);
  hitProxy(o.grass, 4, 1.2, 2.8, gx, G(gx, gz) + 0.3, gz);
  group.add(o.grass);

  // árvore na encosta — inclina com a chuva
  o.tree = new THREE.Group();
  cyl(o.tree, 0.14, 0.2, 3.6, 0x6b4a2f, 0, 0, 0, 8);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), mat(0x3c7a36, { flatShading: true }));
  crown.position.y = 4.0;
  o.tree.add(crown);
  hitProxy(o.tree, 2.6, 5.4, 2.6, 0, 2.7, 0);
  o.tree.position.set(-0.6, G(-0.6, -8.4) - 0.1, -8.4);
  group.add(o.tree);

  // massa de terra que vai deslizar (no começo parece parte da encosta)
  o.slide = [];
  const soilM = mat(0x6e4a2c, { flatShading: true });
  const soilM2 = mat(0x5a7a35, { flatShading: true });
  for (let i = 0; i < 18; i++) {
    const x = -6 + Math.random() * 8;
    const z = -6.6 - Math.random() * 3.2;
    const r = 0.5 + Math.random() * 0.7;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i % 3 ? soilM : soilM2);
    m.scale.y = 0.55;
    m.position.set(x, G(x, z) - r * 0.25, z);
    m.userData.start = m.position.clone();
    // terra acumula mais alto junto ao barranco e contra a casa (visível também lá da rua)
    m.userData.end = new THREE.Vector3(x * 0.9 + 0.5, 3.7 + Math.random() * 1.2, -3.6 + Math.random() * 3.4);
    group.add(m);
    o.slide.push(m);
  }
  // lama que se acumula no quintal e contra a casa
  // rampa de lama: alta junto ao barranco, mais baixa na frente (inclinada em X)
  o.mud = new THREE.Mesh(new THREE.BoxGeometry(9.4, 2.6, 4.6), mat(0x5e4027, { flatShading: true }));
  o.mud.position.set(-1.4, 3, -1.7);
  o.mud.rotation.x = 0.35;
  o.mud.visible = false;
  group.add(o.mud);

  // ---------------------------------------------------------------- Escadaria até a rua
  for (let i = 0; i < 12; i++) {
    const z = 4 + (i + 0.5) * 0.667;
    const top = 3 - (i + 1) * 0.25;
    box(group, 1.3, Math.max(0.25, top + 0.3), 0.67, 0x9ca3af, -2.9, -0.3, z).position.y = (top - 0.3) / 2;
  }
  for (const x of [-3.6, -2.2]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 8.6, 6), mat(0x374151));
    rail.position.set(x, 2.4, 8);
    rail.rotation.x = Math.PI / 2 + Math.atan2(3, 8); // desce 3 m em 8 m, acompanhando a escada
    group.add(rail);
  }

  // ---------------------------------------------------------------- Casa da vizinha (no meio da descida)
  const nb = new THREE.Group();
  box(nb, 4.6, 2.4, 4.2, 0xa8a29e, 0, 0, 0); // base/arrimo
  box(nb, 4.6, 2.5, 4.2, 0xd6c3a5, 0, 2.4, 0);
  box(nb, 4.9, 0.16, 4.5, 0x9ca3af, 0, 4.9, 0);
  nb.position.set(-7.8, -0.4, 8.4);
  group.add(nb);
  o.neighborDoor = new THREE.Group();
  box(o.neighborDoor, 0.06, 2.0, 0.9, 0x1e3a8a, 0, 0, 0);
  hitProxy(o.neighborDoor, 0.6, 2.2, 1.4, 0.2, 1.1, 0);
  o.neighborDoor.position.set(-5.47, 2.0, 8.6);
  group.add(o.neighborDoor);
  box(group, 2.2, 0.2, 1.4, 0x9ca3af, -4.4, 1.8, 8.6); // patamar até a escada

  // ---------------------------------------------------------------- Ponto de apoio (escola) e sinalização
  const school = new THREE.Group();
  box(school, 9, 4.2, 6, 0xf1e3b3, 0, 0, 0);
  box(school, 9.4, 0.25, 6.4, 0xb45309, 0, 4.2, 0);
  for (let i = 0; i < 4; i++) box(school, 1.2, 1.1, 0.05, 0x7dd3fc, -3.2 + i * 2.1, 2.2, -3.02);
  box(school, 1.8, 2.4, 0.06, 0x7c5c3e, 0, 0, -3.03);
  school.position.set(-17, 0, 22);
  group.add(school);
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture(['PONTO DE APOIO', 'Escola Municipal'], { bg: '#15803d', w: 1024, h: 256 }), toneMapped: false });
  const schoolSign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), signMat);
  schoolSign.position.set(-17, 3.4, 18.95);
  schoolSign.rotation.y = Math.PI;
  group.add(schoolSign);
  if (logoPromise)
    logoPromise.then((logo) => {
      signMat.map = signTexture(['PONTO DE APOIO', 'Escola Municipal'], { bg: '#15803d', w: 1024, h: 256, logo });
      signMat.needsUpdate = true;
    });
  schoolSign.rotation.y = Math.PI; // a fachada da escola fica voltada para a rua (-z)
  schoolSign.position.z = 18.95;

  const post = (x, z, tex, rotY, h = 2.2) => {
    const s = new THREE.Group();
    cyl(s, 0.04, 0.04, h, 0x6b7280, 0, 0, 0, 8);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    p.position.y = h + 0.1;
    s.add(p);
    s.position.set(x, G(x, z), z);
    s.rotation.y = rotY;
    group.add(s);
    return s;
  };
  post(-4.0, 12.7, signTexture(['ROTA DE FUGA', 'Ponto de apoio'], { arrow: 'left' }), 0);
  post(-10, 13.2, signTexture(['ROTA DE FUGA', 'Ponto de apoio'], { arrow: 'left' }), 0);
  post(8.4, 13.2, signTexture(['ATALHO', 'beira do córrego'], { bg: '#475569', arrow: 'right' }), 0);
  post(-1.6, 3.8, signTexture(['ÁREA DE RISCO', 'Defesa Civil'], { bg: '#f97316' }), 0); // legível de quem sobe pela escada

  // ---------------------------------------------------------------- API
  const hill = {
    group,
    o,
    h: G,
    /** Ponto de mundo sobre o terreno (dy = altura acima do chão). */
    w(x, z, dy = 0) {
      return new THREE.Vector3(HILL_POS.x + x, HILL_POS.y + G(x, z) + dy, HILL_POS.z + z);
    },
    /** Ponto de mundo a partir de coordenadas locais completas. */
    wp(x, y, z) {
      return new THREE.Vector3(HILL_POS.x + x, HILL_POS.y + y, HILL_POS.z + z);
    },
    reset() {
      hill.setRainy(false);
      for (const m of o.slide) {
        m.position.copy(m.userData.start);
        m.rotation.set(0, 0, 0);
      }
      o.mud.visible = false;
      o.mud.scale.set(1, 1, 1);
      o.tree.visible = true;
      o.bananas.visible = true;
      o.trash.visible = true;
    },
    /** Liga os sinais de alerta que aparecem com a chuva forte. */
    setRainy(on) {
      o.wallCrack.visible = on;
      o.groundCrack.visible = on;
      o.seep.visible = on;
      o.tree.rotation.set(on ? 0.28 : 0, 0, on ? -0.08 : 0);
      o.wall.rotation.z = on ? 0.09 : 0;
      o.wallSegs[1].position.x = on ? 0.16 : 0; // muro embarrigado
      o.wallSegs[1].rotation.z = on ? -0.05 : 0;
      o.stream.scale.x = on ? 1.5 : 1;
    },
    /** Anima o deslizamento do barranco sobre o quintal e os fundos da casa. */
    async slide(tweens, seconds = 3) {
      o.mud.visible = true;
      const movers = [...o.slide];
      const extra = [o.tree, o.bananas, o.trash].map((obj) => ({ obj, from: obj.position.clone(), rot: obj.rotation.clone() }));
      await tweens.play({
        duration: seconds,
        ease: (t) => t * t * (3 - 2 * t),
        update: (t) => {
          movers.forEach((m, i) => {
            const k = Math.min(1, Math.max(0, t * 1.25 - (i % 5) * 0.05));
            m.position.lerpVectors(m.userData.start, m.userData.end, k);
            m.position.y += Math.sin(k * Math.PI) * 0.6;
            m.rotation.set(k * 2.4, k * (i % 2 ? 1.5 : -1.5), k * 0.8);
          });
          for (const e of extra) {
            e.obj.position.copy(e.from).add(new THREE.Vector3(0, -t * 4.4, t * 4.8)); // desce do topo do barranco até o quintal
            e.obj.rotation.x = e.rot.x + t * 0.9;
          }
          o.mud.scale.set(1, Math.max(0.01, t), 1);
          o.mud.position.y = 2.7 + 1.0 * t; // topo final ≈ 5 m (cobre a porta, chega perto da laje)
        },
      });
    },
    update(dt, t) {
      o.seepTex.offset.y = -t * 0.8;
      waterTex.offset.y = -t * 0.6;
    },
  };
  hill.reset();
  return hill;
}
