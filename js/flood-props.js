// Elementos do cenário de enchente, montados sobre a casa do cenário de incêndio (world.js).
// Ficam escondidos nos outros cenários (flood.reset()).
//
// Referências da casa (world.js): sala x 0..6, cozinha x -5..0 (z -4..0), porta da frente em x = 6,
// calçada x 11,6..14, rua x 14..21.
import * as THREE from 'three';

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
function rod(parent, a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), mat(color));
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
  return t;
}

export function buildFloodProps(world) {
  const group = new THREE.Group();
  group.visible = false;
  world.root.add(group);
  const o = {};

  // ---------------------------------------------------------------- Água da enchente
  const waterTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6f5c3c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(210,190,150,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 6, x + 30, y);
      ctx.stroke();
    }
  });
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(10, 8);
  o.water = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 34),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.82, depthWrite: false })
  );
  o.water.rotation.x = -Math.PI / 2;
  o.water.position.set(7, 0, 0);
  o.water.renderOrder = 8;
  o.water.visible = false;
  group.add(o.water);
  o.level = 0;

  // ---------------------------------------------------------------- Dentro de casa
  // quadro de luz (disjuntores) na parede da frente da sala
  o.panel = new THREE.Group();
  box(o.panel, 0.08, 0.45, 0.35, 0x9ca3af, 0, 0, 0);
  box(o.panel, 0.02, 0.38, 0.28, 0x4b5563, -0.05, 0.035, 0);
  o.breaker = box(o.panel, 0.04, 0.08, 0.05, 0xdc2626, -0.07, 0.25, 0.05);
  o.breaker.rotation.z = 0;
  hitProxy(o.panel, 0.4, 0.7, 0.6, -0.1, 0.22, 0);
  o.panel.position.set(5.9, 1.35, -2.4);
  group.add(o.panel);

  // extensão (benjamim) no chão, ao lado da TV
  o.strip = new THREE.Group();
  box(o.strip, 0.35, 0.04, 0.08, 0xf5f5f4, 0, 0, 0);
  rod(o.strip, new THREE.Vector3(0.15, 0.03, 0), new THREE.Vector3(0.6, 0.02, -0.4), 0.008, 0x111111);
  rod(o.strip, new THREE.Vector3(-0.1, 0.03, 0), new THREE.Vector3(-0.1, 0.5, -0.45), 0.008, 0x111111);
  rod(o.strip, new THREE.Vector3(0.05, 0.03, 0), new THREE.Vector3(-0.6, 0.02, 0.5), 0.008, 0x111111);
  hitProxy(o.strip, 0.9, 0.35, 0.8, 0, 0.12, 0);
  o.strip.position.set(1.3, 0.005, -3.1);
  o.stripHome = o.strip.position.clone();
  group.add(o.strip);

  // prateleira alta (para os documentos)
  box(group, 0.9, 0.04, 0.3, 0x8b5e3c, 0.9, 1.85, -3.8);
  o.shelfSpot = new THREE.Vector3(0.9, 1.89, -3.8);

  // mochila para o kit de emergência (sobre o sofá)
  o.kit = new THREE.Group();
  box(o.kit, 0.36, 0.45, 0.2, 0xea580c, 0, 0, 0);
  box(o.kit, 0.28, 0.16, 0.06, 0xc2410c, 0, 0.08, 0.12);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI), mat(0x7c2d12));
  strap.position.set(0, 0.45, 0);
  o.kit.add(strap);
  hitProxy(o.kit, 0.5, 0.65, 0.45, 0, 0.3, 0);
  o.kit.position.set(3.5, 0.45, 2.45);
  group.add(o.kit);

  // lama e marca da água (depois da enchente)
  o.mud = new THREE.Group();
  // lama acinzentada (contrasta com o piso de madeira) com manchas
  const mudTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d6a4f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const v = Math.random() * 25;
      ctx.fillStyle = `rgba(${95 - v},${80 - v},${58 - v},0.22)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 22, 4 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  mudTex.wrapS = mudTex.wrapT = THREE.RepeatWrapping;
  mudTex.repeat.set(3, 3);
  const mudM = new THREE.MeshLambertMaterial({ map: mudTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const [x, z, w, d] of [
    [3, 0, 5.8, 7.8], // sala
    [-2.5, -2, 4.8, 3.8], // cozinha
    [-2.5, 2, 4.8, 3.8], // quarto
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mudM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    o.mud.add(m);
  }
  const lineM = mat(0x6b4f2f);
  box(o.mud, 0.02, 0.05, 7.8, lineM, 5.93, 0.42, 0);
  box(o.mud, 0.02, 0.05, 7.8, lineM, 0.07, 0.42, 1.0);
  box(o.mud, 5.8, 0.05, 0.02, lineM, 3, 0.42, -3.93);
  box(o.mud, 5.8, 0.05, 0.02, lineM, 3, 0.42, 3.93);
  box(o.mud, 4.8, 0.05, 0.02, lineM, -2.5, 0.42, -3.93);
  hitProxy(o.mud, 5, 0.25, 6, 3, 0.12, 0.4);
  o.mud.visible = false;
  group.add(o.mud);

  // ---------------------------------------------------------------- Na rua
  // bueiro entupido de lixo na calçada
  o.drain = new THREE.Group();
  const grate = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0d0d0d';
    for (let x = 8; x < w; x += 16) ctx.fillRect(x, 6, 7, h - 12);
  });
  const grateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshLambertMaterial({ map: grate }));
  grateMesh.rotation.x = -Math.PI / 2;
  grateMesh.position.set(0, 0.105, 0);
  o.drain.add(grateMesh);
  for (let i = 0; i < 7; i++) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.08, 8, 6), mat(i % 2 ? 0x1f2937 : 0x374151, { flatShading: true }));
    bag.scale.y = 0.7;
    bag.position.set((Math.random() - 0.5) * 0.9, 0.18, (Math.random() - 0.5) * 0.5);
    o.drain.add(bag);
  }
  for (let i = 0; i < 4; i++) {
    const bottle = cyl(o.drain, 0.035, 0.035, 0.22, 0x60a5fa, (Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.4, 8, { transparent: true, opacity: 0.7 });
    bottle.rotation.z = Math.PI / 2;
  }
  o.drainTrash = o.drain.children.slice(1);
  hitProxy(o.drain, 1.3, 0.6, 1.0, 0, 0.3, 0);
  o.drain.position.set(13.5, 0, 1.6);
  group.add(o.drain);

  // carro preso na rua alagada
  o.car = new THREE.Group();
  box(o.car, 1.8, 0.65, 4.1, 0x2563eb, 0, 0.3, 0);
  box(o.car, 1.6, 0.55, 2.1, 0x1e40af, 0, 0.95, -0.2);
  box(o.car, 1.62, 0.4, 1.9, 0x93c5fd, 0, 1.0, -0.2, { transparent: true, opacity: 0.8 });
  for (const [x, z] of [
    [-0.9, 1.3],
    [0.9, 1.3],
    [-0.9, -1.3],
    [0.9, -1.3],
  ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14), mat(0x111111));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.33, z);
    o.car.add(w);
  }
  o.car.position.set(18.6, -0.1, -5.5);
  o.car.rotation.y = 0.25;
  group.add(o.car);

  // poste com fio caído na água
  o.wire = new THREE.Group();
  cyl(o.wire, 0.1, 0.13, 7, 0x9ca3af, 0, 0, 0, 10);
  box(o.wire, 1.4, 0.1, 0.1, 0x6b7280, 0, 6.5, 0);
  rod(o.wire, new THREE.Vector3(0.6, 6.5, 0), new THREE.Vector3(1.6, 3.5, 0.6), 0.02, 0x111111);
  rod(o.wire, new THREE.Vector3(1.6, 3.5, 0.6), new THREE.Vector3(2.3, 0.4, 1.3), 0.02, 0x111111);
  hitProxy(o.wire, 2.6, 7, 2.2, 1.0, 3.5, 0.6);
  o.wire.position.set(14.2, 0, -8.4);
  group.add(o.wire);
  o.wireEnd = new THREE.Vector3(14.2 + 2.3, 0.45, -8.4 + 1.3);

  // redemoinho (bueiro destampado escondido pela água)
  const swirlTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(128, 128, 5, 128, 128, 126);
    g.addColorStop(0, 'rgba(20,14,8,0.95)');
    g.addColorStop(0.5, 'rgba(70,55,35,0.6)');
    g.addColorStop(1, 'rgba(110,92,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(220,200,160,0.55)';
    ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.1) {
        const r = 8 + a * 9;
        const x = 128 + Math.cos(a + k * 2.1) * r;
        const y = 128 + Math.sin(a + k * 2.1) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  o.swirl = new THREE.Group();
  o.swirlDisc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, depthWrite: false }));
  o.swirlDisc.rotation.x = -Math.PI / 2;
  o.swirlDisc.renderOrder = 9;
  o.swirl.add(o.swirlDisc);
  hitProxy(o.swirl, 2, 0.6, 2, 0, 0.1, 0);
  o.swirl.position.set(16.3, 0, 2.8);
  group.add(o.swirl);

  // placa da rota de fuga
  const sign = new THREE.Group();
  cyl(sign, 0.04, 0.04, 2.2, 0x6b7280, 0, 0, 0, 8);
  const st = canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Arial';
    ctx.fillText('ROTA DE FUGA', w / 2, 82);
    ctx.font = 'bold 34px Arial';
    ctx.fillText('Abrigo — área alta', w / 2, 132);
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 200);
    ctx.lineTo(w * 0.72, 200);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.8, 200);
    ctx.lineTo(w * 0.7, 176);
    ctx.lineTo(w * 0.7, 224);
    ctx.closePath();
    ctx.fill();
  });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: st, toneMapped: false, side: THREE.DoubleSide }));
  sp.position.y = 2.3;
  sign.add(sp);
  sign.position.set(12.3, 0, 5.2);
  sign.rotation.y = -Math.PI / 2; // de frente para quem sai da casa (olhando para +x); a seta aponta para +z
  group.add(sign);

  const flood = {
    group,
    o,
    /** Disjuntor geral: ligado (vermelho, para cima) ou desligado (cinza, para baixo). */
    setBreaker(off) {
      o.breaker.material.color.set(off ? 0x6b7280 : 0xdc2626);
      o.breaker.position.y = off ? 0.13 : 0.29;
    },
    setLevel(y) {
      o.level = y;
      o.water.visible = y > 0.005;
      o.water.position.y = y;
      o.swirl.position.y = y + 0.01;
    },
    reset() {
      group.visible = false;
      flood.setLevel(0);
      o.mud.visible = false;
      o.strip.position.copy(o.stripHome);
      o.strip.visible = true;
      o.kit.visible = true;
      flood.setBreaker(false);
      o.drainTrash.forEach((m) => (m.visible = true));
      o.car.visible = false;
      o.wire.visible = false;
      o.swirl.visible = false;
    },
    update(dt, t) {
      waterTex.offset.x = -t * 0.12; // a correnteza corre para -x... e um pouco de lado
      waterTex.offset.y = t * 0.03;
      o.swirlDisc.rotation.z = t * 2.5;
    },
  };
  flood.reset();
  return flood;
}
