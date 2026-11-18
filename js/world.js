// Construção da casa e do ambiente externo (geometria simples, sem arquivos externos).
//
// Planta (vista de cima, metros). Eixo X para a direita, Z para "baixo" na planta:
//
//   z=-4 ┌───────────── COZINHA ─────────────┬───────────── SALA ──────────────┐
//        │ [geladeira]  fogão  bancada        │  TV        janela+cortina+vela │
//        │                                    ═ passagem (z -3.2..-1.6)        │
//   z=0  ├──── porta A ───────────────────────┤        mesa de centro          ║ porta da frente (x=6)
//        │                                    ║ porta B (z 1.5..2.5)    sofá   │        → rua
//   z=4  └───────────── QUARTO ───────────────┴─────────────────────────────────┘
//      x=-5                                  x=0                              x=6
import * as THREE from 'three';

const H = 2.7; // pé-direito
const T = 0.12; // espessura das paredes
const DOOR_H = 2.1;

const mats = [];
function mat(color, opts = {}) {
  const m = new THREE.MeshLambertMaterial({ color, ...opts });
  mats.push(m);
  return m;
}

function box(parent, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

function cyl(parent, rTop, rBot, h, color, x, y, z, seg = 20, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

/** Haste cilíndrica entre dois pontos (fios, mangueiras). */
function rod(parent, a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat(color));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}

/** Caixa invisível que facilita acertar objetos pequenos com o raio. */
function hitProxy(parent, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  m.userData.proxy = true;
  parent.add(m);
  return m;
}

function textTexture(text, { w = 256, h = 128, bg = '#ffffff', fg = '#1d4ed8', font = 'bold 54px Arial', border = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.15;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileTexture(c1, c2, n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const s = 256 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? c1 : c2;
      ctx.fillRect(i * s, j * s, s, s);
    }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, 256);
    ctx.moveTo(0, i * s);
    ctx.lineTo(256, i * s);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function woodTexture(base = '#a9744f') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + (i % 3) * 0.03})`;
    ctx.fillRect(0, i * 32, 256, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, i * 32 + 30, 256, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const occluders = []; // paredes e portas: bloqueiam o raio de seleção
  const o = {}; // objetos nomeados

  // ---------- Luzes e céu ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9bba6, 2.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
  sun.position.set(6, 10, 4);
  scene.add(sun);
  // Sem luzes pontuais nos cômodos (custo alto no Quest 2): a hemisférica + direcional bastam.
  const roomLights = [];
  for (const [x, z] of [
    [-2.5, -2],
    [3, 0],
    [-2.5, 2],
  ]) {
    const lamp = cyl(root, 0.18, 0.2, 0.05, 0xffffff, x, H - 0.06, z);
    lamp.material = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  }

  // ---------- Terreno externo ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(0x6a9a4a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  root.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(7, 90), mat(0x4a4d52));
  street.rotation.x = -Math.PI / 2;
  street.position.set(17.5, -0.01, 0);
  root.add(street);
  for (let z = -40; z < 40; z += 4) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(17.5, 0, z);
    root.add(stripe);
  }
  box(root, 2.4, 0.12, 90, 0xbdb6aa, 12.8, -0.02, 0); // calçada
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), mat(0xbdb6aa));
  path.rotation.x = -Math.PI / 2;
  path.position.set(8.9, -0.005, 0);
  root.add(path);

  // árvores
  for (const [x, z, s] of [
    [9, -6, 1],
    [10.5, 6.5, 1.2],
    [-8, 6, 1.1],
    [-7.5, -6.5, 0.9],
    [22, -8, 1.3],
    [22, 9, 1],
  ]) {
    cyl(root, 0.12 * s, 0.16 * s, 1.6 * s, 0x6b4a2f, x, 0, z, 8);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), mat(0x3f7d3a, { flatShading: true }));
    crown.position.set(x, 2.2 * s, z);
    root.add(crown);
  }

  // placa de ponto de encontro
  const sign = new THREE.Group();
  cyl(sign, 0.04, 0.04, 2.0, 0x888888, 0, 0, 0, 8);
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.55),
    new THREE.MeshBasicMaterial({ map: textTexture('PONTO DE\nENCONTRO', { w: 512, h: 256, bg: '#15803d', fg: '#ffffff', font: 'bold 64px Arial', border: '#ffffff' }) })
  );
  signFace.position.set(0, 2.0, 0.03);
  sign.add(signFace);
  sign.position.set(11.6, 0, 2.6);
  sign.rotation.y = -Math.PI / 2;
  root.add(sign);

  // ---------- Pisos ----------
  const kitchenFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshLambertMaterial({ map: (() => { const t = tileTexture('#e8e4dc', '#cfc8bb'); t.repeat.set(2.5, 2); return t; })() }));
  kitchenFloor.rotation.x = -Math.PI / 2;
  kitchenFloor.position.set(-2.5, 0.001, -2);
  root.add(kitchenFloor);
  const wood = woodTexture();
  wood.repeat.set(3, 4);
  const livingFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshLambertMaterial({ map: wood }));
  livingFloor.rotation.x = -Math.PI / 2;
  livingFloor.position.set(3, 0.001, 0);
  root.add(livingFloor);
  const wood2 = woodTexture('#b8875e');
  wood2.repeat.set(2.5, 2);
  const bedFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshLambertMaterial({ map: wood2 }));
  bedFloor.rotation.x = -Math.PI / 2;
  bedFloor.position.set(-2.5, 0.001, 2);
  root.add(bedFloor);
  box(root, 11.3, 0.08, 8.3, 0x9a9488, 0.5, -0.08, 0); // base da casa

  // ---------- Teto / telhado ----------
  const roofMat = mat(0xa0522d);
  const ceilMat = mat(0xf5f3ee, { emissive: 0x4a4740 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.15, 8.4), [roofMat, roofMat, roofMat, ceilMat, roofMat, roofMat]);
  roof.position.set(0.5, H + 0.075, 0);
  root.add(roof);

  // ---------- Paredes ----------
  const wallMat = mat(0xefe6d8);
  const wallMatKitchen = mat(0xf3efe2);
  const wallMatBed = mat(0xdcd6ec);
  const outsideMat = mat(0xe9d7b9);

  function wallX(z, x0, x1, gaps = [], m = wallMat) {
    // parede ao longo de X (z constante). gaps: [a, b, topoDaAbertura]
    let cur = x0;
    const segs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top = DOOR_H] of segs) {
      if (a > cur) occluders.push(box(root, a - cur, H, T, m, (cur + a) / 2, 0, z));
      occluders.push(box(root, b - a, H - top, T, m, (a + b) / 2, top, z));
      cur = b;
    }
    if (x1 > cur) occluders.push(box(root, x1 - cur, H, T, m, (cur + x1) / 2, 0, z));
  }
  function wallZ(x, z0, z1, gaps = [], m = wallMat) {
    let cur = z0;
    const segs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top = DOOR_H] of segs) {
      if (a > cur) occluders.push(box(root, T, H, a - cur, m, x, 0, (cur + a) / 2));
      occluders.push(box(root, T, H - top, b - a, m, x, top, (a + b) / 2));
      cur = b;
    }
    if (z1 > cur) occluders.push(box(root, T, H, z1 - cur, m, x, 0, (cur + z1) / 2));
  }

  wallX(-4, -5.06, 6.06, [], outsideMat); // fundos
  wallX(4, -5.06, 6.06, [], outsideMat); // frente lateral
  wallZ(-5, -4, 4, [], outsideMat); // lateral esquerda
  wallZ(6, -4, 4, [[-0.5, 0.5]], outsideMat); // porta da frente
  wallZ(0, -4, 4, [
    [-3.2, -1.6],
    [1.5, 2.5],
  ]); // cozinha/quarto | sala
  wallX(0, -5, 0, [[-3.5, -2.5]], wallMatBed); // cozinha | quarto

  // faixas de cor interna (rodapé) para dar leitura de ambiente
  box(root, 4.9, 0.1, 0.02, 0x8b7a66, -2.5, 0, -3.93);

  // ---------- Portas ----------
  function makeDoor(hx, hz, base, color, name) {
    const pivot = new THREE.Group();
    pivot.position.set(hx, 0, hz);
    pivot.rotation.y = base;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.06, 0.05), mat(color));
    panel.position.set(0.5, 1.03, 0);
    pivot.add(panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(0xd4af37));
    knob.position.set(0.86, 1.0, 0.05);
    pivot.add(knob);
    const knob2 = knob.clone();
    knob2.position.z = -0.05;
    pivot.add(knob2);
    root.add(pivot);
    occluders.push(panel);
    const door = {
      name,
      pivot,
      panel,
      base,
      angle: 0,
      setAngle(a) {
        door.angle = a;
        pivot.rotation.y = base + a;
      },
      animate(tweens, to, duration = 0.9) {
        const from = door.angle;
        return tweens.play({ duration, update: (t) => door.setAngle(from + (to - from) * t) });
      },
    };
    return door;
  }
  o.doorA = makeDoor(-3.5, 0, 0, 0x8d6748, 'A'); // cozinha ↔ quarto
  o.doorB = makeDoor(0, 2.5, Math.PI / 2, 0x8d6748, 'B'); // quarto ↔ sala
  o.doorFront = makeDoor(6, 0.5, Math.PI / 2, 0x5b3a24, 'frente');
  o.doorOpenAngle = -1.45;

  // brilho alaranjado sob a porta quente (fase de fuga)
  o.hotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 }));
  o.hotGlow.position.set(-3.0, 0.03, 0.075);
  o.hotGlow.visible = false;
  root.add(o.hotGlow);

  // ---------- COZINHA ----------
  const kitchen = new THREE.Group();
  root.add(kitchen);
  const counterTop = mat(0x55585c);
  // bancadas
  box(kitchen, 1.75, 0.88, 0.6, 0xf1efe9, -4.125, 0, -3.7);
  box(kitchen, 1.75, 0.04, 0.62, counterTop, -4.125, 0.88, -3.69);
  box(kitchen, 2.05, 0.88, 0.6, 0xf1efe9, -1.525, 0, -3.7);
  box(kitchen, 2.05, 0.04, 0.62, counterTop, -1.525, 0.88, -3.69);
  // armários aéreos
  box(kitchen, 1.6, 0.7, 0.35, 0xd9cbb3, -4.15, 1.6, -3.82);
  box(kitchen, 1.2, 0.7, 0.35, 0xd9cbb3, -1.0, 1.6, -3.82);
  // fogão
  const stove = new THREE.Group();
  kitchen.add(stove);
  box(stove, 0.7, 0.88, 0.62, 0xf7f7f7, -2.9, 0, -3.69);
  box(stove, 0.7, 0.03, 0.62, 0x1d1d1f, -2.9, 0.88, -3.69);
  box(stove, 0.56, 0.42, 0.01, 0x2b2b2e, -2.9, 0.18, -3.375); // porta do forno
  for (const [dx, dz] of [
    [-0.16, 0.14],
    [0.16, 0.14],
    [-0.16, -0.14],
    [0.16, -0.14],
  ])
    cyl(stove, 0.06, 0.06, 0.02, 0x3a3a3a, -2.9 + dx, 0.91, -3.69 + dz, 16);
  // chama azul do queimador
  o.burnerFlame = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 20), new THREE.MeshBasicMaterial({ color: 0x4aa8ff }));
  o.burnerFlame.rotation.x = Math.PI / 2;
  o.burnerFlame.position.set(-3.06, 0.935, -3.55);
  o.burnerFlame.visible = false;
  kitchen.add(o.burnerFlame);
  // botões do fogão
  o.knobs = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 14), mat(0x222222));
    k.rotation.x = Math.PI / 2;
    k.position.set(-3.15 + i * 0.1, 0.78, -3.37);
    o.knobs.add(k);
  }
  hitProxy(o.knobs, 0.5, 0.14, 0.14, -3.0, 0.78, -3.34);
  kitchen.add(o.knobs);

  // panela com cabo para fora (risco)
  o.pan = new THREE.Group();
  cyl(o.pan, 0.13, 0.12, 0.08, 0x3b3b3e, 0, 0, 0, 24);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), mat(0xc9a227));
  oil.rotation.x = -Math.PI / 2;
  oil.position.y = 0.06;
  o.pan.add(oil);
  box(o.pan, 0.035, 0.025, 0.26, 0x1a1a1a, 0, 0.05, 0.25);
  hitProxy(o.pan, 0.32, 0.18, 0.5, 0, 0.06, 0.1);
  o.pan.position.set(-3.06, 0.92, -3.55);
  kitchen.add(o.pan);
  o.panFirePos = new THREE.Vector3(-3.06, 1.0, -3.55);

  // tampa (usada na fase do fogo)
  o.lid = new THREE.Group();
  cyl(o.lid, 0.14, 0.145, 0.015, 0xb8bcc2, 0, 0, 0, 24);
  cyl(o.lid, 0.02, 0.02, 0.03, 0x111111, 0, 0.015, 0, 10);
  hitProxy(o.lid, 0.32, 0.12, 0.32, 0, 0.03, 0);
  o.lid.position.set(-2.05, 0.92, -3.66);
  kitchen.add(o.lid);
  o.lidHome = o.lid.position.clone();

  // jarra d'água (escolha errada)
  o.jug = new THREE.Group();
  cyl(o.jug, 0.07, 0.065, 0.22, new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45 }), 0, 0, 0, 18);
  cyl(o.jug, 0.06, 0.058, 0.15, new THREE.MeshLambertMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6 }), 0, 0.01, 0, 18);
  box(o.jug, 0.02, 0.12, 0.05, 0xbfe6ff, 0.085, 0.06, 0);
  hitProxy(o.jug, 0.2, 0.3, 0.2, 0, 0.12, 0);
  o.jug.position.set(-1.7, 0.92, -3.62);
  kitchen.add(o.jug);
  o.jugHome = o.jug.position.clone();

  // álcool perto do fogão (risco)
  o.alcohol = new THREE.Group();
  cyl(o.alcohol, 0.045, 0.045, 0.2, 0xf8fafc, 0, 0, 0, 14);
  cyl(o.alcohol, 0.02, 0.025, 0.05, 0x2563eb, 0, 0.2, 0, 10);
  const alcLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.08), new THREE.MeshBasicMaterial({ map: textTexture('ÁLCOOL\n70%', { w: 128, h: 128, font: 'bold 34px Arial' }) }));
  alcLabel.position.set(0, 0.1, 0.047);
  o.alcohol.add(alcLabel);
  hitProxy(o.alcohol, 0.16, 0.3, 0.16, 0, 0.13, 0);
  o.alcohol.position.set(-2.42, 0.92, -3.62);
  kitchen.add(o.alcohol);

  // benjamim / T sobrecarregado (risco)
  o.outlet = new THREE.Group();
  box(o.outlet, 0.08, 0.12, 0.02, 0xffffff, -1.25, 1.09, -3.93);
  box(o.outlet, 0.1, 0.07, 0.06, 0xf4f4f4, -1.25, 1.115, -3.89);
  box(o.outlet, 0.06, 0.05, 0.05, 0xeeeeee, -1.25, 1.06, -3.86); // segundo adaptador
  const tPoint = new THREE.Vector3(-1.25, 1.12, -3.86);
  // aparelhos
  cyl(kitchen, 0.075, 0.085, 0.2, 0x9ca3af, -1.4, 0.92, -3.66, 16); // chaleira
  box(kitchen, 0.25, 0.18, 0.15, 0xc0c4ca, -1.08, 0.92, -3.66); // torradeira
  box(kitchen, 0.4, 0.27, 0.33, 0x2f3237, -0.72, 0.92, -3.7); // micro-ondas
  box(kitchen, 0.26, 0.17, 0.005, 0x111214, -0.77, 0.97, -3.53); // vidro micro-ondas
  rod(o.outlet, tPoint, new THREE.Vector3(-1.4, 1.05, -3.74), 0.007, 0x111111);
  rod(o.outlet, tPoint, new THREE.Vector3(-1.1, 1.02, -3.74), 0.007, 0x111111);
  rod(o.outlet, tPoint, new THREE.Vector3(-0.8, 1.12, -3.86), 0.007, 0x111111);
  rod(o.outlet, new THREE.Vector3(-1.25, 1.06, -3.84), new THREE.Vector3(-1.6, 0.93, -3.84), 0.007, 0x111111);
  hitProxy(o.outlet, 0.4, 0.3, 0.25, -1.25, 1.1, -3.82);
  kitchen.add(o.outlet);

  // botijão de gás com mangueira (risco)
  o.gas = new THREE.Group();
  cyl(o.gas, 0.18, 0.18, 0.4, 0x3d6fb6, 0, 0.03, 0, 20);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3d6fb6));
  dome.position.y = 0.43;
  o.gas.add(dome);
  cyl(o.gas, 0.17, 0.17, 0.03, 0x2a2a2a, 0, 0, 0, 20);
  cyl(o.gas, 0.03, 0.03, 0.06, 0x999999, 0, 0.58, 0, 10); // registro
  hitProxy(o.gas, 0.45, 0.7, 0.45, 0, 0.32, 0);
  o.gas.position.set(-4.6, 0, -2.85);
  kitchen.add(o.gas);
  rod(o.gas, new THREE.Vector3(0, 0.64, 0), new THREE.Vector3(0.6, 0.35, -0.35), 0.012, 0x6b5b3a);
  rod(o.gas, new THREE.Vector3(0.6, 0.35, -0.35), new THREE.Vector3(1.35, 0.3, -0.5), 0.012, 0x6b5b3a);

  // geladeira (objeto neutro)
  o.fridge = new THREE.Group();
  box(o.fridge, 0.7, 1.8, 0.68, 0xe9eef2, 0, 0, 0);
  box(o.fridge, 0.03, 0.4, 0.03, 0x9aa3ad, 0.25, 1.1, 0.35);
  o.fridge.position.set(-4.6, 0, -1.1);
  o.fridge.rotation.y = Math.PI / 2;
  kitchen.add(o.fridge);

  // pontos do fogo se espalhando pela cozinha
  o.kitchenFireSpots = [
    new THREE.Vector3(-3.06, 1.0, -3.55),
    new THREE.Vector3(-3.9, 0.92, -3.65),
    new THREE.Vector3(-4.1, 1.7, -3.7),
    new THREE.Vector3(-2.2, 0.92, -3.65),
  ];

  // ---------- SALA ----------
  const living = new THREE.Group();
  root.add(living);
  // TV
  o.tv = new THREE.Group();
  box(o.tv, 1.4, 0.5, 0.4, 0x6b4f3a, 0, 0, 0);
  box(o.tv, 1.1, 0.64, 0.05, 0x111111, 0, 0.62, -0.05);
  box(o.tv, 1.04, 0.58, 0.005, 0x1e293b, 0, 0.65, -0.022);
  o.tv.position.set(2.2, 0, -3.72);
  living.add(o.tv);

  // janela + cortina + vela (risco)
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ color: 0x9fd3f0 }));
  windowPane.position.set(4.9, 1.55, -3.935);
  living.add(windowPane);
  o.windowPane = windowPane;
  box(living, 1.4, 0.06, 0.08, 0xffffff, 4.9, 0.97, -3.92);
  box(living, 1.4, 0.06, 0.08, 0xffffff, 4.9, 2.1, -3.92);
  o.candleSet = new THREE.Group();
  const curtainMat = mat(0xb91c1c);
  for (let i = 0; i < 4; i++) box(o.candleSet, 0.1, 2.1, 0.06, curtainMat, 3.98 + i * 0.09, 0.25, -3.83 + (i % 2) * 0.04);
  for (let i = 0; i < 4; i++) box(living, 0.1, 2.1, 0.06, curtainMat, 5.55 + i * 0.09, 0.25, -3.83 + (i % 2) * 0.04);
  box(o.candleSet, 0.4, 0.6, 0.4, 0x7a5a3d, 4.35, 0, -3.5);
  cyl(o.candleSet, 0.035, 0.035, 0.14, 0xfff7e6, 4.25, 0.6, -3.52, 12);
  o.candleFlame = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffc04d }));
  o.candleFlame.position.set(4.25, 0.77, -3.52);
  o.candleSet.add(o.candleFlame);
  hitProxy(o.candleSet, 0.6, 0.6, 0.5, 4.25, 0.75, -3.55);
  living.add(o.candleSet);

  // tapete, sofá, mesa de centro
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), mat(0x7c8ea8));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(2.8, 0.004, 0.9);
  living.add(rug);
  o.sofa = new THREE.Group();
  box(o.sofa, 2.1, 0.45, 0.85, 0x52606d, 0, 0, 0);
  box(o.sofa, 2.1, 0.5, 0.22, 0x46525e, 0, 0.4, 0.32);
  box(o.sofa, 0.18, 0.62, 0.85, 0x46525e, -1.05, 0, 0);
  box(o.sofa, 0.18, 0.62, 0.85, 0x46525e, 1.05, 0, 0);
  o.sofa.position.set(2.8, 0, 2.6);
  living.add(o.sofa);
  box(living, 1.1, 0.4, 0.6, 0x8b5e3c, 2.8, 0, 0.9);

  // isqueiro e fósforos na mesa baixa + brinquedo (risco)
  o.lighter = new THREE.Group();
  box(o.lighter, 0.08, 0.014, 0.026, 0xdc2626, 2.45, 0.4, 0.95);
  box(o.lighter, 0.055, 0.016, 0.038, 0xfacc15, 2.6, 0.4, 0.85);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), mat(0x22c55e));
  ball.position.set(2.0, 0.09, 0.35);
  living.add(ball);
  box(living, 0.12, 0.12, 0.12, 0x3b82f6, 1.85, 0, 0.6); // bloquinho de brinquedo
  hitProxy(o.lighter, 0.4, 0.15, 0.3, 2.52, 0.43, 0.9);
  living.add(o.lighter);

  // bolsa e documentos (tentação durante a fuga)
  o.bag = new THREE.Group();
  box(o.bag, 0.32, 0.22, 0.12, 0x7c4a24, 0, 0, 0);
  box(o.bag, 0.2, 0.02, 0.13, 0x5a3418, 0, 0.22, 0);
  box(o.bag, 0.12, 0.012, 0.09, 0x1e3a8a, 0.26, 0, 0.02);
  hitProxy(o.bag, 0.5, 0.35, 0.3, 0.08, 0.12, 0);
  o.bag.position.set(3.05, 0.4, 0.85);
  living.add(o.bag);

  // planta perto da porta
  cyl(living, 0.18, 0.14, 0.35, 0x9a6b4f, 5.5, 0, 3.4, 14);
  const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat(0x3f8f45, { flatShading: true }));
  plant.position.set(5.5, 0.65, 3.4);
  living.add(plant);

  // ---------- QUARTO ----------
  const bedroom = new THREE.Group();
  root.add(bedroom);
  box(bedroom, 1.6, 0.45, 2.0, 0x6b4f3a, -3.6, 0, 2.95);
  box(bedroom, 1.5, 0.15, 1.9, 0xf3f4f6, -3.6, 0.45, 2.95);
  box(bedroom, 1.52, 0.08, 1.2, 0x2563eb, -3.6, 0.6, 2.55);
  box(bedroom, 0.6, 0.12, 0.35, 0xffffff, -3.6, 0.6, 3.6);
  box(bedroom, 1.6, 0.9, 0.08, 0x5a4030, -3.6, 0.2, 3.95);
  box(bedroom, 0.45, 0.5, 0.4, 0x7a5a3d, -2.5, 0, 3.7); // criado-mudo
  cyl(bedroom, 0.08, 0.1, 0.3, 0xfef3c7, -2.5, 0.5, 3.7, 12);
  box(bedroom, 0.6, 2.0, 1.2, 0x9b7653, -4.68, 0, 0.9); // guarda-roupa
  o.smokeAlarm = cyl(bedroom, 0.08, 0.08, 0.04, 0xf8fafc, -1.5, H - 0.04, 1.5, 16);
  o.alarmLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x330000 }));
  o.alarmLed.position.set(-1.5, H - 0.045, 1.5);
  bedroom.add(o.alarmLed);

  // ---------- Fumaça interna (camada que desce do teto) ----------
  o.smokeLayer = new THREE.Mesh(
    new THREE.BoxGeometry(10.9, 1, 7.9),
    new THREE.MeshBasicMaterial({ color: 0x2d2d2d, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide })
  );
  o.smokeLayer.position.set(0.5, 2, 0);
  o.smokeLayer.visible = false;
  o.smokeLayer.renderOrder = 5;
  root.add(o.smokeLayer);
  o.smokeBottom = 3;

  // ---------- API ----------
  const world = {
    root,
    occluders,
    o,
    setSmoke(bottom) {
      o.smokeBottom = bottom;
      if (bottom >= H) {
        o.smokeLayer.visible = false;
        return;
      }
      o.smokeLayer.visible = true;
      o.smokeLayer.scale.y = H - bottom;
      o.smokeLayer.position.y = (H + bottom) / 2;
    },
    /** Céu e luz personalizados (ex.: tempo nublado ou tempestade). world.reset() volta ao dia claro. */
    setSky({ bg, hemi: hemiI, sun: sunI }) {
      if (bg !== undefined) scene.background = new THREE.Color(bg);
      if (hemiI !== undefined) hemi.intensity = hemiI;
      if (sunI !== undefined) sun.intensity = sunI;
    },
    setGas(on) {
      o.burnerFlame.visible = on;
    },
    setNight(night) {
      scene.background = new THREE.Color(night ? 0x0b1222 : 0x9fd3f0);
      hemi.intensity = night ? 0.6 : 2.6;
      ceilMat.emissive.setHex(night ? 0x0a0a0a : 0x4a4740);
      sun.intensity = night ? 0.12 : 1.6;
      for (const l of roomLights) l.intensity = night ? 0.5 : 3;
      windowPane.material.color.set(night ? 0x1c2a44 : 0x9fd3f0);
      o.candleFlame.visible = !night;
    },
    reset() {
      o.doorA.setAngle(0);
      o.doorB.setAngle(0);
      o.doorFront.setAngle(0);
      o.lid.position.copy(o.lidHome);
      o.lid.rotation.set(0, 0, 0);
      o.jug.position.copy(o.jugHome);
      o.jug.rotation.set(0, 0, 0);
      o.bag.visible = true;
      o.hotGlow.visible = false;
      o.alarmLed.material.color.set(0x330000);
      world.setGas(false);
      world.setSmoke(3);
      world.setNight(false);
    },
  };
  world.reset();
  return world;
}

/** Marcador de teletransporte no chão (círculo azul com feixe de luz). */
export function makeWaypoint(x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  g.add(disc);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1.0, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 0.5;
  g.add(beam);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = 0.55;
  g.add(proxy);
  g.position.set(x, 0, z);
  g.userData.hoverFx = (h) => {
    ring.material.color.set(h ? 0xffffff : 0x38bdf8);
    beam.material.opacity = h ? 0.32 : 0.16;
  };
  g.userData.animate = (t) => {
    ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
  };
  return g;
}
