// Elementos do cenário de vazamento químico, montados sobre a casa (world.js).
// Caminhão-tanque tombado na rua em frente à casa, com painel de segurança e rótulo de risco.
// O vento sopra para -z (a nuvem segue pela rua nesse sentido).
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

/** Painel de segurança laranja: número de risco em cima, número ONU embaixo. */
function orangePanel(top, bottom) {
  return canvasTex(400, 280, (ctx, w, h) => {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.beginPath();
    ctx.moveTo(7, h / 2);
    ctx.lineTo(w - 7, h / 2);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 104px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(top, w / 2, h * 0.27);
    ctx.fillText(bottom, w / 2, h * 0.74);
  });
}

/** Rótulo de risco (losango) de gás tóxico, classe 2. */
function toxicLabel() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-86, -86, 172, 172);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 6;
    ctx.strokeRect(-78, -78, 156, 156);
    ctx.restore();
    // caveira simplificada
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(128, 84, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(110, 100, 36, 22);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(116, 82, 8, 0, Math.PI * 2);
    ctx.arc(140, 82, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(96, 132);
    ctx.lineTo(160, 156);
    ctx.moveTo(160, 132);
    ctx.lineTo(96, 156);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GÁS TÓXICO', 128, 188);
    ctx.font = 'bold 30px Arial';
    ctx.fillText('2', 128, 222);
  });
}

export function buildChemProps(world) {
  const group = new THREE.Group();
  group.visible = false;
  world.root.add(group);
  const o = {};

  // ---------------------------------------------------------------- Caminhão-tanque tombado
  const truck = new THREE.Group();
  // cavalo (cabine) ainda em pé, um pouco virado
  const cab = new THREE.Group();
  box(cab, 2.3, 1.2, 2.2, 0xdc2626, 0, 0.5, 0);
  box(cab, 2.3, 1.0, 1.6, 0xb91c1c, 0, 1.7, -0.3);
  box(cab, 2.0, 0.6, 0.05, 0x93c5fd, 0, 1.9, 0.5);
  for (const x of [-1.1, 1.1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), mat(0x111111));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.5, 0);
    cab.add(w);
  }
  cab.position.set(0.6, 0, 4.0);
  cab.rotation.y = 0.35;
  truck.add(cab);
  // tanque tombado de lado
  const tank = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 8, 24), mat(0xe5e7eb));
  shell.rotation.x = Math.PI / 2;
  tank.add(shell);
  for (const z of [-4, 4]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 10), mat(0xd1d5db));
    cap.scale.z = 0.3;
    cap.position.z = z;
    tank.add(cap);
  }
  tank.position.set(-0.3, 1.1, -1.2);
  tank.rotation.z = 0.1;
  truck.add(tank);
  // painel de segurança (traseira) e rótulo de risco (lateral do tanque, voltado para a casa = -x)
  o.panelTex = orangePanel('268', '1005');
  o.plate = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.42), new THREE.MeshBasicMaterial({ map: o.panelTex, toneMapped: false }));
  plate.position.set(-1.45, 1.3, 1.6);
  plate.rotation.y = -Math.PI / 2;
  o.plate.add(plate);
  hitProxy(o.plate, 0.8, 1.2, 1.4, -1.5, 1.3, 1.6);
  truck.add(o.plate);
  o.label = new THREE.Group();
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: toxicLabel(), transparent: true, toneMapped: false }));
  lbl.position.set(-1.42, 1.2, -1.8);
  lbl.rotation.y = -Math.PI / 2;
  o.label.add(lbl);
  hitProxy(o.label, 0.8, 1.4, 1.4, -1.5, 1.2, -1.8);
  truck.add(o.label);
  // poça do vazamento
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), mat(0xc9d48a, { transparent: true, opacity: 0.6 }));
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(1, 1.6, 1);
  puddle.position.set(-0.6, 0.02, -2.2);
  truck.add(puddle);
  truck.position.set(17.6, 0, -6);
  group.add(truck);
  o.truck = truck;
  o.leak = new THREE.Vector3(17.2, 1.3, -6.8); // origem da nuvem (mundo)

  // cones e faixa de isolamento (aparecem depois que o socorro chega)
  o.cordon = new THREE.Group();
  for (const [x, z] of [
    [14.6, 2.5],
    [16.2, 2.8],
    [17.8, 3.0],
    [19.4, 2.8],
    [20.8, 2.5],
  ]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 12), mat(0xf97316));
    c.position.set(x, 0.225, z);
    o.cordon.add(c);
  }
  o.cordon.visible = false;
  group.add(o.cordon);

  // biruta perto da calçada: aponta para -z (para onde o vento vai)
  const pole = new THREE.Group();
  cyl(pole, 0.04, 0.05, 3.4, 0xe5e7eb, 0, 0, 0, 8);
  o.sock = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 - (i + 1) * 0.022, 0.16 - i * 0.022, 0.18, 14, 1, true),
      mat(i % 2 ? 0xffffff : 0xf97316, { side: THREE.DoubleSide })
    );
    seg.rotation.x = -Math.PI / 2;
    seg.position.z = -0.09 - i * 0.18;
    o.sock.add(seg);
  }
  o.sock.position.y = 3.3;
  pole.add(o.sock);
  pole.position.set(11.4, 0, 3.4); // ao lado, sem tapar a vista do caminhão
  group.add(pole);

  // placa de rota de fuga (seta para +z, lado de onde vem o vento)
  const sign = new THREE.Group();
  cyl(sign, 0.04, 0.04, 2.2, 0x6b7280, 0, 0, 0, 8);
  const st = canvasTex(512, 256, (ctx, w) => {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, 256);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, 240);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Arial';
    ctx.fillText('ROTA DE FUGA', w / 2, 82);
    ctx.font = 'bold 34px Arial';
    ctx.fillText('Ponto de encontro', w / 2, 132);
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
  sign.position.set(12.3, 0, 4.6);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  // ---------------------------------------------------------------- Dentro de casa (abrigar-se)
  // ventilador ligado na sala
  o.fan = new THREE.Group();
  cyl(o.fan, 0.16, 0.2, 0.05, 0x374151, 0, 0, 0, 16);
  cyl(o.fan, 0.025, 0.025, 1.0, 0x6b7280, 0, 0.05, 0, 8);
  o.fanHead = new THREE.Group();
  o.fanHead.position.set(0, 1.15, 0);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), mat(0x374151));
  motor.rotation.x = Math.PI / 2;
  o.fanHead.add(motor);
  o.blades = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.22), mat(0x93c5fd, { side: THREE.DoubleSide }));
    b.position.y = 0.13;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    holder.add(b);
    o.blades.add(holder);
  }
  o.blades.position.z = 0.1;
  o.fanHead.add(o.blades);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.01, 6, 24), mat(0x9ca3af));
  guard.position.z = 0.1;
  o.fanHead.add(guard);
  o.fan.add(o.fanHead);
  hitProxy(o.fan, 0.7, 1.5, 0.7, 0, 0.75, 0);
  o.fan.position.set(1.0, 0, 2.2);
  o.fan.rotation.y = 0.6;
  group.add(o.fan);
  o.fanOn = true;

  // janela da sala aberta (vidro de correr) — fecha ao selecionar
  o.window = new THREE.Group();
  // folha fixa (lado esquerdo) + folha de correr; aberta = as duas sobrepostas à esquerda
  const fixed = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.05), new THREE.MeshLambertMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  fixed.position.set(4.58, 1.55, -3.915);
  o.window.add(fixed);
  o.sash = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.05), new THREE.MeshLambertMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  o.sash.position.set(4.55, 1.55, -3.9);
  o.window.add(o.sash);
  o.sashOpenX = 4.62;
  o.sashClosedX = 5.22;
  hitProxy(o.window, 1.5, 1.3, 0.5, 4.9, 1.55, -3.75);
  group.add(o.window);

  // pano molhado para vedar a fresta da porta
  o.towel = new THREE.Group();
  box(o.towel, 0.5, 0.06, 0.35, 0x60a5fa, 0, 0, 0);
  box(o.towel, 0.3, 0.3, 0.3, 0x9ca3af, 0.45, 0, 0); // balde
  hitProxy(o.towel, 1.0, 0.5, 0.6, 0.2, 0.2, 0);
  o.towel.position.set(5.2, 0, 1.6);
  o.towelHome = o.towel.position.clone();
  group.add(o.towel);
  o.towelDoor = new THREE.Vector3(5.85, 0, 0); // junto à porta, no chão

  // rádio no quarto (cômodo interno)
  o.radio = new THREE.Group();
  box(o.radio, 0.32, 0.18, 0.12, 0x1f2937, 0, 0, 0);
  const grill = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), mat(0x6b7280));
  grill.position.set(-0.07, 0.09, 0.061);
  o.radio.add(grill);
  cyl(o.radio, 0.006, 0.006, 0.3, 0x9ca3af, 0.12, 0.18, 0, 6);
  hitProxy(o.radio, 0.6, 0.5, 0.5, 0, 0.2, 0);
  o.radio.position.set(-2.2, 0.5, 3.65);
  group.add(o.radio);

  const chem = {
    group,
    o,
    setFan(on) {
      o.fanOn = on;
    },
    setWindow(closed) {
      o.sash.position.x = closed ? o.sashClosedX : o.sashOpenX;
    },
    reset() {
      group.visible = false;
      o.fanOn = true;
      chem.setWindow(false);
      o.towel.position.copy(o.towelHome);
      o.cordon.visible = false;
    },
    update(dt, t) {
      if (o.fanOn) o.blades.rotation.z += dt * 14;
      o.fanHead.rotation.y = o.fanOn ? Math.sin(t * 0.8) * 0.6 : o.fanHead.rotation.y;
      o.sock.rotation.y = Math.sin(t * 2.1) * 0.08;
    },
  };
  chem.reset();
  return chem;
}
