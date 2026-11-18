// Campo de treinamento ao ar livre (cenário do extintor) e modelos de extintores.
//
// Áreas (coordenadas locais; o grupo fica em TRAIN_POS):
//   x = -9  → abrigo com 3 extintores para inspeção
//   x =  0  → três focos: lixeira (classe A), bandeja com líquido (B), painel elétrico (C)
//   x = +9  → bandeja de prática com biruta (vento soprando para -z)
//   z = -9  → depósito (contêiner) com incêndio grande — quando NÃO combater
import * as THREE from 'three';

export const TRAIN_POS = new THREE.Vector3(300, 0, 0);

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(parent, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function cyl(parent, rt, rb, h, color, x, y, z, seg = 18, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function rod(parent, a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat(color));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}
function hitProxy(parent, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function textPlane(parent, text, w, h, { bg = '#ffffff', fg = '#111827', font = 'bold 64px Arial', px = 512, border = null } = {}) {
  const ph = Math.round((px * h) / w);
  const t = canvasTex(px, ph, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, px, ph);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, px - 14, ph - 14);
    }
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.15;
    lines.forEach((l, i) => ctx.fillText(l, px / 2, ph / 2 + (i - (lines.length - 1) / 2) * lh));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  parent.add(m);
  return m;
}

// ------------------------------------------------------------------ Extintores
export const EXT_TYPES = {
  agua: { nome: 'Água pressurizada', label: 'ÁGUA\nPRESSURIZADA', classes: 'A', gauge: true },
  co2: { nome: 'Gás carbônico (CO2)', label: 'GÁS\nCARBÔNICO\nCO2', classes: 'B C', gauge: false }, // CO2 não tem manômetro (é verificado por pesagem)
  po_bc: { nome: 'Pó químico BC', label: 'PÓ\nQUÍMICO\nBC', classes: 'B C', gauge: true },
  po_abc: { nome: 'Pó químico ABC', label: 'PÓ\nQUÍMICO\nABC', classes: 'A B C', gauge: true },
};

function gaugeTexture(ok) {
  return canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    const arc = (a0, a1, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(64, 70, 42, a0, a1);
      ctx.stroke();
    };
    // faixa: vermelho (descarregado) | verde (operação) | vermelho (sobrecarga)
    arc(Math.PI * 1.0, Math.PI * 1.33, '#dc2626');
    arc(Math.PI * 1.33, Math.PI * 1.67, '#16a34a');
    arc(Math.PI * 1.67, Math.PI * 2.0, '#dc2626');
    const a = ok ? Math.PI * 1.5 : Math.PI * 1.08;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 70);
    ctx.lineTo(64 + Math.cos(a) * 40, 70 + Math.sin(a) * 40);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(64, 70, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Modelo de extintor portátil (origem na base). opts: { gaugeOk = true, sealed = true, tag = null }
 * O frente do rótulo fica voltada para +Z.
 */
export function makeExtinguisher(type, { gaugeOk = true, sealed = true, tag = null } = {}) {
  const info = EXT_TYPES[type];
  const g = new THREE.Group();
  const red = mat(0xc81e1e);
  const isCO2 = type === 'co2';
  const r = isCO2 ? 0.075 : 0.08;
  const h = isCO2 ? 0.5 : 0.42;
  cyl(g, r, r, h, red, 0, 0, 0, 22);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = h;
  g.add(dome);
  cyl(g, 0.022, 0.026, 0.05, 0x9ca3af, 0, h + r * 0.8, 0, 12); // pescoço
  const top = h + r * 0.8 + 0.05;
  box(g, 0.06, 0.05, 0.05, 0x4b5563, 0, top, 0); // cabeça da válvula
  // gatilho (alavanca) e alça
  const lever = box(g, 0.16, 0.012, 0.035, 0x1f2937, 0.03, top + 0.06, 0);
  lever.rotation.z = 0.18;
  box(g, 0.14, 0.012, 0.035, 0x374151, 0.02, top + 0.02, 0);
  // pino e lacre
  const pin = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16), mat(0xd1d5db));
  ring.position.set(0, top + 0.03, 0.045);
  pin.add(ring);
  const seal = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), mat(0xf59e0b));
  seal.position.set(0.018, top + 0.012, 0.045);
  pin.add(seal);
  pin.visible = sealed;
  g.add(pin);
  g.userData.pin = pin;
  // manômetro (CO2 não tem)
  if (info.gauge) {
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.028, 24), new THREE.MeshBasicMaterial({ map: gaugeTexture(gaugeOk), toneMapped: false }));
    gauge.position.set(-0.045, top + 0.03, 0.028);
    g.add(gauge);
  }
  // mangueira e bico / difusor
  const hoseTop = new THREE.Vector3(0.035, top + 0.01, 0);
  const hoseMid = new THREE.Vector3(r + 0.03, top - 0.1, 0.02);
  const hoseEnd = new THREE.Vector3(r + 0.02, h * 0.35, 0.03);
  rod(g, hoseTop, hoseMid, 0.009, 0x111111);
  rod(g, hoseMid, hoseEnd, 0.009, 0x111111);
  if (isCO2) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 14, 1, true), mat(0x111111, { side: THREE.DoubleSide }));
    horn.position.set(hoseEnd.x, hoseEnd.y - 0.08, hoseEnd.z);
    horn.rotation.x = Math.PI;
    g.add(horn);
  } else {
    cyl(g, 0.012, 0.01, 0.05, 0x111111, hoseEnd.x, hoseEnd.y - 0.05, hoseEnd.z, 8);
  }
  // rótulo
  const lbl = canvasTex(256, 320, (ctx, w, hh) => {
    ctx.fillStyle = '#fefce8';
    ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = info.label.split('\n');
    ctx.font = 'bold 40px Arial';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 70 + i * 44 - (lines.length - 2) * 14));
    // letras das classes
    const cls = info.classes.split(' ');
    const colors = { A: '#16a34a', B: '#dc2626', C: '#2563eb' };
    cls.forEach((c, i) => {
      const x = w / 2 + (i - (cls.length - 1) / 2) * 70;
      ctx.fillStyle = colors[c];
      ctx.beginPath();
      ctx.arc(x, 236, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Arial';
      ctx.fillText(c, x, 238);
    });
    if (tag) {
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(tag, w / 2, 296);
    }
  });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.002, r + 0.002, h * 0.62, 22, 1, true, -0.75, 1.5), new THREE.MeshBasicMaterial({ map: lbl, toneMapped: false }));
  label.position.y = h * 0.45;
  g.add(label);
  g.userData.top = top;
  g.userData.type = type;
  hitProxy(g, 0.28, top + 0.12, 0.26, 0.02, (top + 0.12) / 2, 0.02);
  return g;
}

// ------------------------------------------------------------------ Campo de treinamento
export function buildYard(scene, logoCanvasPromise) {
  const group = new THREE.Group();
  group.position.copy(TRAIN_POS);
  group.visible = false;
  scene.add(group);
  const o = {};

  // chão
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat(0x5f8f45));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  group.add(grass);
  const concrete = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 26),
    new THREE.MeshLambertMaterial({
      map: canvasTex(512, 512, (ctx) => {
        ctx.fillStyle = '#b9b5ad';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 2500; i++) {
          ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
          ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 3;
        for (let k = 0; k <= 512; k += 128) {
          ctx.beginPath();
          ctx.moveTo(k, 0);
          ctx.lineTo(k, 512);
          ctx.moveTo(0, k);
          ctx.lineTo(512, k);
          ctx.stroke();
        }
      }),
    })
  );
  concrete.material.map.wrapS = concrete.material.map.wrapT = THREE.RepeatWrapping;
  concrete.material.map.repeat.set(4, 3);
  concrete.rotation.x = -Math.PI / 2;
  concrete.position.set(0, 0, -2);
  group.add(concrete);

  // faixas amarelas delimitando as áreas
  const stripe = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.003, z);
    group.add(m);
  };
  for (const x of [-4.6, 4.6]) stripe(x, 0.5, 0.08, 8);
  stripe(0, -5.2, 30, 0.08);

  // cerca no perímetro
  for (let x = -16; x <= 16; x += 2) {
    cyl(group, 0.03, 0.03, 1.2, 0x9ca3af, x, 0, -15, 6);
    cyl(group, 0.03, 0.03, 1.2, 0x9ca3af, x, 0, 11, 6);
  }
  for (const z of [-15, 11]) {
    rod(group, new THREE.Vector3(-16, 1.1, z), new THREE.Vector3(16, 1.1, z), 0.015, 0x9ca3af);
    rod(group, new THREE.Vector3(-16, 0.6, z), new THREE.Vector3(16, 0.6, z), 0.015, 0x9ca3af);
  }
  // cones
  for (const [x, z] of [
    [-4.6, 4.6],
    [4.6, 4.6],
    [-4.6, -3.6],
    [4.6, -3.6],
    [12.5, 3],
    [5.5, -2],
  ]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 12), mat(0xf97316));
    cone.position.set(x, 0.225, z);
    group.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.07, 12), mat(0xffffff));
    band.position.set(x, 0.24, z);
    group.add(band);
  }

  // painel do campo com a logo
  const banner = new THREE.Group();
  cyl(banner, 0.06, 0.06, 3.2, 0x6b7280, -1.9, 0, 0, 8);
  cyl(banner, 0.06, 0.06, 3.2, 0x6b7280, 1.9, 0, 0, 8);
  const bannerMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), bannerMat);
  bannerMesh.position.set(0, 2.45, 0.07);
  banner.add(bannerMesh);
  banner.position.set(0, 0, -14.2);
  group.add(banner);
  const drawBanner = (logo) => {
    bannerMat.map = canvasTex(1292, 400, (ctx, w, h) => {
      ctx.fillStyle = '#0b1630';
      ctx.fillRect(0, 0, w, h);
      for (let x = -40; x < w + 40; x += 40) {
        ctx.fillStyle = (x / 40) % 2 ? '#f97316' : '#1d4ed8';
        ctx.fillRect(x, 0, 40, 18);
        ctx.fillRect(x, h - 18, 40, 18);
      }
      if (logo) ctx.drawImage(logo, 40, 60, 280, 280);
      ctx.fillStyle = '#f97316';
      ctx.font = '800 54px Arial';
      ctx.fillText('CAMPO DE TREINAMENTO', 350, 140);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 76px Arial';
      ctx.fillText('Defesa Civil de Cubatão', 350, 230);
      ctx.fillStyle = '#93c5fd';
      ctx.font = '400 40px Arial';
      ctx.fillText('Uso correto de extintores', 350, 300);
    });
    bannerMat.needsUpdate = true;
  };
  drawBanner(null);
  if (logoCanvasPromise) logoCanvasPromise.then(drawBanner);

  // placas das áreas
  const areaSign = (text, x, z, color) => {
    const s = new THREE.Group();
    cyl(s, 0.03, 0.03, 1.6, 0x6b7280, 0, 0, 0, 8);
    const p = textPlane(s, text, 0.9, 0.32, { bg: color, fg: '#ffffff', font: 'bold 68px Arial', border: '#ffffff' });
    p.position.set(0, 1.75, 0.03);
    s.position.set(x, 0, z);
    group.add(s);
    return s;
  };

  // ---------- Área 1: abrigo de extintores (inspeção)
  const shelter = new THREE.Group();
  box(shelter, 1.9, 1.9, 0.12, 0xb91c1c, 0, 0.15, -0.06);
  box(shelter, 1.75, 1.6, 0.02, 0xf3f4f6, 0, 0.3, 0.01);
  const shTitle = textPlane(shelter, 'INSPECIONE ANTES DE USAR', 1.7, 0.2, { bg: '#b91c1c', fg: '#ffffff', font: 'bold 54px Arial', px: 1024 });
  shTitle.position.set(0, 1.95, 0.005);
  group.add(shelter);
  shelter.position.set(-9, 0, 0);
  o.inspect = [];
  const yearNow = new Date().getFullYear();
  const insp = [
    { gaugeOk: false, sealed: true, tag: `Manutenção válida até 08/${yearNow + 1}` },
    { gaugeOk: true, sealed: false, tag: `Manutenção VENCIDA em 03/${yearNow - 1}` },
    { gaugeOk: true, sealed: true, tag: `Manutenção válida até 08/${yearNow + 1}` },
  ];
  insp.forEach((cfg, i) => {
    const e = makeExtinguisher('po_abc', cfg);
    e.position.set(-0.55 + i * 0.55, 0.75, 0.1);
    shelter.add(e);
    cyl(shelter, 0.012, 0.012, 0.06, 0x374151, -0.55 + i * 0.55, 1.35, 0.06, 6); // gancho
    const num = textPlane(shelter, String(i + 1), 0.16, 0.16, { bg: '#111827', fg: '#ffffff', font: 'bold 90px Arial', px: 128 });
    num.position.set(-0.55 + i * 0.55, 0.5, 0.025);
    e.userData.cfg = cfg;
    o.inspect.push(e);
  });

  // ---------- Área 2: três focos de incêndio (classes A, B, C)
  // A: lixeira com papel
  o.bin = new THREE.Group();
  cyl(o.bin, 0.22, 0.18, 0.55, 0x52525b, 0, 0, 0, 18, { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), mat(0xf5f5f4, { side: THREE.DoubleSide }));
    paper.position.set((Math.random() - 0.5) * 0.2, 0.55 + Math.random() * 0.06, (Math.random() - 0.5) * 0.2);
    paper.rotation.set(Math.random(), Math.random() * 3, Math.random());
    o.bin.add(paper);
  }
  hitProxy(o.bin, 0.6, 1.4, 0.6, 0, 0.7, 0);
  o.bin.position.set(-2.4, 0, 0);
  group.add(o.bin);
  // B: bandeja com líquido inflamável + galão
  o.tray = new THREE.Group();
  cyl(o.tray, 0.45, 0.45, 0.12, 0x3f3f46, 0, 0, 0, 28, { side: THREE.DoubleSide });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), mat(0x3b2f1e));
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.09;
  o.tray.add(liquid);
  box(o.tray, 0.2, 0.3, 0.12, 0xdc2626, 0.75, 0, 0.1); // galão
  const gal = textPlane(o.tray, 'INFLAMÁVEL', 0.18, 0.07, { bg: '#facc15', fg: '#111827', font: 'bold 60px Arial', px: 512 });
  gal.position.set(0.75, 0.18, 0.165);
  hitProxy(o.tray, 1.3, 1.2, 1.0, 0.15, 0.6, 0);
  o.tray.position.set(0, 0, 0);
  group.add(o.tray);
  // C: painel elétrico energizado
  o.panel = new THREE.Group();
  box(o.panel, 0.7, 1.3, 0.3, 0x9ca3af, 0, 0.3, 0);
  box(o.panel, 0.64, 1.2, 0.02, 0x6b7280, 0, 0.35, 0.16);
  const warn = canvasTex(256, 224, (ctx) => {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(128, 14);
    ctx.lineTo(244, 210);
    ctx.lineTo(12, 210);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(140, 60);
    ctx.lineTo(96, 140);
    ctx.lineTo(126, 140);
    ctx.lineTo(112, 196);
    ctx.lineTo(164, 112);
    ctx.lineTo(134, 112);
    ctx.closePath();
    ctx.fill();
  });
  const warnMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.21), new THREE.MeshBasicMaterial({ map: warn, transparent: true, toneMapped: false }));
  warnMesh.position.set(0, 1.25, 0.175);
  o.panel.add(warnMesh);
  rod(o.panel, new THREE.Vector3(0.2, 1.6, -0.05), new THREE.Vector3(0.2, 2.6, -0.05), 0.02, 0x111111); // eletroduto
  hitProxy(o.panel, 0.9, 1.8, 0.6, 0, 0.9, 0.1);
  o.panel.position.set(2.4, 0, -0.1);
  group.add(o.panel);

  o.fireSpots = {
    A: new THREE.Vector3(-2.4, 0.55, 0),
    B: new THREE.Vector3(0, 0.1, 0),
    C: new THREE.Vector3(2.4, 0.95, 0.12),
  };
  areaSign('CLASSE A', -2.4, -0.9, '#16a34a');
  areaSign('CLASSE B', 0, -0.9, '#dc2626');
  areaSign('CLASSE C', 2.4, -0.9, '#2563eb');

  // bancada com os 4 tipos de extintor (referência visual)
  const bench = new THREE.Group();
  box(bench, 1.6, 0.06, 0.5, 0x8b5e3c, 0, 0.55, 0);
  for (const x of [-0.75, 0.75]) box(bench, 0.06, 0.55, 0.45, 0x6b4f3a, x, 0, 0);
  ['agua', 'co2', 'po_bc', 'po_abc'].forEach((t, i) => {
    const e = makeExtinguisher(t);
    e.position.set(-0.57 + i * 0.38, 0.61, 0);
    bench.add(e);
  });
  bench.position.set(-4.1, 0, 2.4);
  bench.rotation.y = 0.9;
  group.add(bench);

  // ---------- Área 3: prática com bandeja e biruta
  o.practiceTray = new THREE.Group();
  cyl(o.practiceTray, 0.65, 0.65, 0.14, 0x3f3f46, 0, 0, 0, 32, { side: THREE.DoubleSide });
  const liq2 = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), mat(0x2f2618));
  liq2.rotation.x = -Math.PI / 2;
  liq2.position.y = 0.1;
  o.practiceTray.add(liq2);
  o.practiceTray.position.set(9, 0, -0.5);
  group.add(o.practiceTray);
  o.practiceBase = new THREE.Vector3(9, 0.12, -0.5); // base das chamas (local)
  // biruta: o vento sopra de +z para -z
  const sockPole = new THREE.Group();
  cyl(sockPole, 0.04, 0.05, 3.2, 0xe5e7eb, 0, 0, 0, 8);
  o.sock = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    // após girar -90° em X, o topo do cilindro aponta para -z: topo = ponta mais fina (sentido do vento)
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - (i + 1) * 0.022, 0.16 - i * 0.022, 0.18, 14, 1, true), mat(i % 2 ? 0xffffff : 0xf97316, { side: THREE.DoubleSide }));
    seg.rotation.x = -Math.PI / 2;
    seg.position.z = -0.09 - i * 0.18;
    o.sock.add(seg);
  }
  o.sock.position.y = 3.1;
  sockPole.add(o.sock);
  sockPole.position.set(11.3, 0, -0.5);
  group.add(sockPole);
  areaSign('PRÁTICA', 11.3, 2.2, '#f97316');
  // suporte com o extintor de pó ABC para pegar
  o.stand = new THREE.Group();
  box(o.stand, 0.5, 0.7, 0.4, 0x374151, 0, 0, 0);
  o.practiceExt = makeExtinguisher('po_abc');
  o.practiceExt.position.set(0, 0.7, 0);
  o.stand.add(o.practiceExt);
  o.stand.position.set(7.9, 0, 4.6);
  group.add(o.stand);
  // marcadores de posição (pontos de partida para o combate)
  o.spots = {
    certo: new THREE.Vector3(9, 0, 2.2), // ~2,7 m, vento pelas costas
    contraVento: new THREE.Vector3(9, 0, -3.2), // ~2,7 m, mas a favor da fumaça (vento no rosto)
    pertoDemais: new THREE.Vector3(9.55, 0, 0.45), // ~1,1 m
  };

  // ---------- Área 4: depósito (contêiner) em chamas
  const cont = new THREE.Group();
  const cMat = mat(0x1e40af);
  box(cont, 6, 2.6, 0.08, cMat, 0, 0, -1.25); // fundo
  box(cont, 0.08, 2.6, 2.5, cMat, -3, 0, 0);
  box(cont, 0.08, 2.6, 2.5, cMat, 3, 0, 0);
  box(cont, 6.1, 0.08, 2.6, cMat, 0, 2.6, 0); // teto
  box(cont, 1.9, 2.6, 0.08, cMat, -2.05, 0, 1.25); // frente (com abertura no meio)
  box(cont, 1.9, 2.6, 0.08, cMat, 2.05, 0, 1.25);
  box(cont, 2.2, 0.5, 0.08, cMat, 0, 2.1, 1.25);
  for (let x = -2.8; x <= 2.8; x += 0.35) box(cont, 0.05, 2.5, 0.03, 0x1e3a8a, x, 0.05, -1.2);
  // caixas e paletes dentro
  box(cont, 1, 0.8, 0.8, 0xa16207, -1.6, 0, -0.5);
  box(cont, 0.8, 0.6, 0.8, 0xa16207, -1.5, 0.8, -0.5);
  box(cont, 1.2, 1.0, 0.9, 0x92400e, 1.4, 0, -0.4);
  const contSign = textPlane(cont, 'DEPÓSITO', 1.4, 0.35, { bg: '#ffffff', fg: '#111827', font: 'bold 84px Arial', border: '#111827' });
  contSign.position.set(-2.05, 2.1, 1.3);
  cont.position.set(0, 0, -9);
  group.add(cont);
  o.containerFires = [new THREE.Vector3(-1.6, 0.3, -9.6), new THREE.Vector3(1.3, 0.3, -9.4), new THREE.Vector3(0, 0.2, -9.2), new THREE.Vector3(0, 1.9, -9.3)];

  const yard = {
    group,
    o,
    /** Converte coordenada local do campo para coordenada de mundo. */
    w(x, y, z) {
      return new THREE.Vector3(TRAIN_POS.x + x, TRAIN_POS.y + y, TRAIN_POS.z + z);
    },
    wv(v) {
      return v.clone().add(TRAIN_POS);
    },
    reset() {
      o.inspect.forEach((e) => (e.visible = true));
      o.practiceExt.visible = true;
      if (o.practiceExt.userData.pin) o.practiceExt.userData.pin.visible = true;
    },
    update(dt, t) {
      // biruta tremulando
      o.sock.rotation.y = Math.sin(t * 2.3) * 0.08;
      o.sock.rotation.x = Math.sin(t * 3.1) * 0.05;
    },
  };
  return yard;
}
