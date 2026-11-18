// Menu inicial em VR (lobby temático): plataforma ao entardecer com a Serra do Mar e o polo
// industrial no horizonte, painel com a logo da Defesa Civil e cartões para escolher a cena.
import * as THREE from 'three';
import { SCENES } from './scenes.js';
import { wrapText } from './ui.js';

export const LOBBY_POS = new THREE.Vector3(0, 0, 300); // longe da casa: o céu do lobby esconde o resto

const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';
const NAVY = '#0b1630';
const ORANGE = '#f97316';

function tex(canvas, { repeatX = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeatX !== 1) {
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = repeatX;
  }
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------------ Ícones (desenhados em canvas)
function drawIcon(ctx, icon, cx, cy, s, fg, bg) {
  ctx.save();
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (icon === 'fire') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.55);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.1, cx + s * 0.42, cy + s * 0.5, cx, cy + s * 0.5);
    ctx.bezierCurveTo(cx - s * 0.42, cy + s * 0.5, cx - s * 0.5, cy + s * 0.05, cx - s * 0.18, cy - s * 0.22);
    ctx.bezierCurveTo(cx - s * 0.16, cy - s * 0.02, cx - s * 0.05, cy + s * 0.02, cx - s * 0.02, cy - s * 0.12);
    ctx.bezierCurveTo(cx + s * 0.05, cy - s * 0.3, cx - s * 0.02, cy - s * 0.45, cx, cy - s * 0.55);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.05);
    ctx.bezierCurveTo(cx + s * 0.22, cy + s * 0.2, cx + s * 0.18, cy + s * 0.42, cx, cy + s * 0.42);
    ctx.bezierCurveTo(cx - s * 0.18, cy + s * 0.42, cx - s * 0.2, cy + s * 0.25, cx, cy + s * 0.05);
    ctx.fill();
  } else if (icon === 'landslide') {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.55, cy + s * 0.45);
    ctx.lineTo(cx - s * 0.55, cy - s * 0.35);
    ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.3, cx + s * 0.1, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.55, cy + s * 0.45);
    ctx.closePath();
    ctx.fill();
    for (const [dx, dy, r] of [
      [0.28, -0.05, 0.09],
      [0.42, 0.18, 0.07],
      [0.2, 0.25, 0.06],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + s * dx, cy + s * dy, s * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.12, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.22, cy - s * 0.18);
    ctx.moveTo(cx + s * 0.32, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.2);
    ctx.stroke();
  } else if (icon === 'flood') {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.32, cy - s * 0.05);
    ctx.lineTo(cx, cy - s * 0.42);
    ctx.lineTo(cx + s * 0.32, cy - s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - s * 0.24, cy - s * 0.08, s * 0.48, s * 0.3);
    ctx.lineWidth = s * 0.07;
    for (let i = 0; i < 2; i++) {
      const y = cy + s * (0.25 + i * 0.18);
      ctx.beginPath();
      for (let k = 0; k <= 4; k++) {
        const x = cx - s * 0.55 + (k * s * 1.1) / 4;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(x - s * 0.14, y + (k % 2 ? -s * 0.1 : s * 0.1), x, y);
      }
      ctx.stroke();
    }
  } else if (icon === 'chemical') {
    roundRect(ctx, cx - s * 0.3, cy - s * 0.45, s * 0.6, s * 0.9, s * 0.08);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.fillRect(cx - s * 0.3, cy - s * 0.25, s * 0.6, s * 0.04);
    ctx.fillRect(cx - s * 0.3, cy + s * 0.25, s * 0.6, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.17);
    ctx.lineTo(cx + s * 0.17, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.17, cy + s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillRect(cx - s * 0.018, cy - s * 0.07, s * 0.036, s * 0.12);
    ctx.fillRect(cx - s * 0.018, cy + s * 0.08, s * 0.036, s * 0.035);
  } else if (icon === 'extinguisher') {
    roundRect(ctx, cx - s * 0.17, cy - s * 0.25, s * 0.34, s * 0.75, s * 0.15);
    ctx.fill();
    ctx.fillRect(cx - s * 0.06, cy - s * 0.4, s * 0.12, s * 0.16);
    ctx.fillRect(cx - s * 0.06, cy - s * 0.45, s * 0.3, s * 0.07);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.06, cy - s * 0.38);
    ctx.quadraticCurveTo(cx - s * 0.42, cy - s * 0.3, cx - s * 0.36, cy + s * 0.15);
    ctx.stroke();
    ctx.fillStyle = bg;
    ctx.fillRect(cx - s * 0.12, cy, s * 0.24, s * 0.16);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Cartão de cena
const CARD_W = 0.5;
const CARD_H = 0.7;
const CPX = 512; // largura em pixels
const CPY = Math.round((CPX * CARD_H) / CARD_W);

function drawCard(ctx, sc, hover) {
  const w = CPX;
  const h = CPY;
  ctx.clearRect(0, 0, w, h);
  const avail = sc.available;
  const color = avail ? sc.color : '#475569';
  // sombra/brilho ao apontar
  if (hover) {
    ctx.shadowColor = avail ? sc.color : '#94a3b8';
    ctx.shadowBlur = 40;
  }
  roundRect(ctx, 16, 16, w - 32, h - 32, 34);
  ctx.fillStyle = '#0f1a33';
  ctx.fill();
  ctx.shadowBlur = 0;
  // cabeçalho colorido com ícone
  ctx.save();
  roundRect(ctx, 16, 16, w - 32, h - 32, 34);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 16, 0, 300);
  g.addColorStop(0, avail ? color : '#334155');
  g.addColorStop(1, avail ? shade(color, -0.35) : '#1e293b');
  ctx.fillStyle = g;
  ctx.fillRect(16, 16, w - 32, 290);
  // faixa zebrada laranja/azul na base do cabeçalho (identidade Defesa Civil)
  for (let x = -40; x < w; x += 40) {
    ctx.fillStyle = avail ? ORANGE : '#64748b';
    ctx.beginPath();
    ctx.moveTo(x, 306);
    ctx.lineTo(x + 20, 306);
    ctx.lineTo(x + 40, 318);
    ctx.lineTo(x + 20, 318);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawIcon(ctx, sc.icon, w / 2, 165, 210, avail ? '#ffffff' : '#94a3b8', avail ? shade(color, -0.15) : '#2b3748');

  // selo
  const badge = avail ? 'DISPONÍVEL' : 'EM BREVE';
  ctx.font = `800 24px ${FONT}`;
  const bw = ctx.measureText(badge).width + 30;
  roundRect(ctx, w - 36 - bw, 36, bw, 42, 21);
  ctx.fillStyle = avail ? '#16a34a' : '#0f172a';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, w - 36 - bw / 2, 58);

  // textos
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = 340;
  ctx.fillStyle = avail ? '#ffffff' : '#cbd5e1';
  ctx.font = `800 44px ${FONT}`;
  for (const l of wrapText(ctx, sc.title, w - 90)) {
    ctx.fillText(l, 45, y);
    y += 52;
  }
  y += 8;
  ctx.fillStyle = avail ? '#cbd5e1' : '#7c8aa0';
  ctx.font = `400 29px ${FONT}`;
  for (const l of wrapText(ctx, sc.desc, w - 90)) {
    ctx.fillText(l, 45, y);
    y += 38;
  }
  // rodapé
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = avail ? ORANGE : '#64748b';
  ctx.fillText(avail ? `Duração: ${sc.duration}` : 'Em desenvolvimento', 45, h - 92);

  // borda
  roundRect(ctx, 16, 16, w - 32, h - 32, 34);
  ctx.lineWidth = hover ? 12 : 6;
  ctx.strokeStyle = hover ? '#ffffff' : color;
  ctx.stroke();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + c * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function makeCard(sc) {
  const canvas = document.createElement('canvas');
  canvas.width = CPX;
  canvas.height = CPY;
  const ctx = canvas.getContext('2d');
  drawCard(ctx, sc, false);
  const t = tex(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.scene = sc;
  const base = sc.available ? 1.12 : 1; // cenas disponíveis em destaque
  group.scale.setScalar(base);
  group.userData.targetScale = base;
  group.userData.hoverFx = (h) => {
    drawCard(ctx, sc, h);
    t.needsUpdate = true;
    group.userData.targetScale = base * (h ? 1.07 : 1);
  };
  return group;
}

// ------------------------------------------------------------------ Ambiente
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#040a1c');
  g.addColorStop(0.3, '#0e1d4a');
  g.addColorStop(0.43, '#3b2a6b');
  g.addColorStop(0.48, '#c2410c');
  g.addColorStop(0.5, '#fb923c');
  g.addColorStop(0.52, '#1b1533');
  g.addColorStop(1, '#070b18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  return tex(c);
}

/** Silhueta da Serra do Mar com chaminés do polo industrial (referência a Cubatão). */
function skylineTexture() {
  const W = 4096;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const ridge = (seed, base, amp, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      const t = (x / W) * Math.PI * 2;
      const y =
        base -
        amp * (0.55 * Math.sin(t * 2 + seed) + 0.3 * Math.sin(t * 5 + seed * 2.1) + 0.15 * Math.sin(t * 13 + seed * 3.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  ridge(1.3, 250, 120, '#1a2452');
  ridge(4.1, 330, 90, '#111a3d');
  // polo industrial: chaminés, tanques e luzes
  ctx.fillStyle = '#0a1230';
  const baseY = 420;
  for (const [x, w, h] of [
    [1500, 18, 200],
    [1540, 14, 150],
    [1610, 22, 240],
    [1700, 16, 170],
    [3300, 20, 210],
    [3350, 14, 160],
  ]) {
    ctx.fillRect(x, baseY - h, w, h + 100);
  }
  for (const [x, r] of [
    [1760, 40],
    [1850, 34],
    [3420, 38],
  ]) {
    ctx.fillRect(x - r, baseY - r * 1.2, r * 2, r * 1.2 + 100);
  }
  ctx.fillRect(1450, baseY - 40, 500, 140);
  ctx.fillRect(3250, baseY - 40, 280, 140);
  ridge(2.2, 470, 25, '#080e24');
  ctx.fillStyle = '#ff3b30';
  for (const [x, w, h] of [
    [1500, 18, 200],
    [1610, 22, 240],
    [3300, 20, 210],
  ]) {
    ctx.beginPath();
    ctx.arc(x + w / 2, baseY - h - 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,200,120,0.9)';
  for (let i = 0; i < 40; i++) {
    const x = 1460 + Math.random() * 480;
    ctx.fillRect(x, baseY - 30 + Math.random() * 60, 3, 3);
  }
  return tex(c, { repeatX: 2 });
}

function floorTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = S / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, '#1a2b5c');
  g.addColorStop(0.7, '#101c3d');
  g.addColorStop(1, '#0a1228');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  // anéis
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 3;
  for (const k of [0.25, 0.45, 0.65]) {
    ctx.beginPath();
    ctx.arc(r, r, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // raios
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(r + Math.cos(a) * r * 0.27, r + Math.sin(a) * r * 0.27);
    ctx.lineTo(r + Math.cos(a) * r * 0.82, r + Math.sin(a) * r * 0.82);
    ctx.stroke();
  }
  // faixa zebrada na borda (laranja e azul)
  const segs = 72;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? '#1d4ed8' : ORANGE;
    ctx.beginPath();
    ctx.arc(r, r, r * 0.97, a0, a1);
    ctx.arc(r, r, r * 0.9, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  return tex(c);
}

function backdropCanvas(logo) {
  const W = 2048;
  const H = 760;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  roundRect(ctx, 8, 8, W - 16, H - 16, 60);
  ctx.fillStyle = 'rgba(8,15,36,0.9)';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = ORANGE;
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  roundRect(ctx, 80, 40, 260, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  roundRect(ctx, 360, 40, 120, 18, 9);
  ctx.fill();
  if (logo) ctx.drawImage(logo, 90, 150, 480, 480);
  const x = 640;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ORANGE;
  ctx.font = `800 58px ${FONT}`;
  ctx.fillText('SIMULADOR DE EMERGÊNCIAS', x, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 132px ${FONT}`;
  ctx.fillText('Defesa Civil', x, 250);
  ctx.font = `700 92px ${FONT}`;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('de Cubatão', x, 395);
  ctx.font = `400 46px ${FONT}`;
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('Escolha uma simulação abaixo: aponte e faça a pinça.', x, 540);
  return c;
}

export function buildLobby(scene) {
  const group = new THREE.Group();
  group.position.copy(LOBBY_POS);
  scene.add(group);
  group.updateMatrixWorld(true); // lookAt dos filhos usa coordenadas de mundo
  const W = (x, y, z) => new THREE.Vector3(LOBBY_POS.x + x, LOBBY_POS.y + y, LOBBY_POS.z + z);

  // céu
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, toneMapped: false }));
  sky.renderOrder = -10;
  group.add(sky);

  // estrelas
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 400; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = 0.15 + Math.random() * 1.1; // só na parte de cima
    pts.push(Math.cos(th) * Math.sin(ph) * 65, Math.cos(ph) * 65, Math.sin(th) * Math.sin(ph) * 65);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2, sizeAttenuation: false, toneMapped: false })));

  // horizonte: Serra do Mar + polo industrial
  const skyline = new THREE.Mesh(
    new THREE.CylinderGeometry(50, 50, 16, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: skylineTexture(), side: THREE.BackSide, transparent: true, alphaTest: 0.5, toneMapped: false })
  );
  skyline.position.y = 5;
  group.add(skyline);

  // água ao longe (estuário) refletindo o pôr do sol
  const water = new THREE.Mesh(new THREE.CircleGeometry(49, 48), new THREE.MeshBasicMaterial({ color: 0x0c1838, toneMapped: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  group.add(water);

  // plataforma
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshBasicMaterial({ map: floorTexture(), toneMapped: false }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.1, 0.5, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x0a1228, side: THREE.DoubleSide }));
  rim.position.y = -0.25;
  group.add(rim);

  // logo no piso (sob os pés) — preenchida por setLogo
  const floorLogo = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  floorLogo.rotation.x = -Math.PI / 2;
  floorLogo.position.y = 0.004;
  group.add(floorLogo);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.86, 64), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.005;
  group.add(floorRing);

  // painel de fundo com a logo
  const bdCanvas = backdropCanvas(null);
  const bdTex = tex(bdCanvas);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.6, (3.6 * 760) / 2048), new THREE.MeshBasicMaterial({ map: bdTex, transparent: true, toneMapped: false }));
  backdrop.position.set(0, 2.45, -4.2);
  group.add(backdrop);
  backdrop.updateMatrixWorld();
  backdrop.lookAt(W(0, 1.6, 0));
  // colunas laterais (laranja e azul)
  for (const [x, col] of [
    [-2.0, ORANGE],
    [2.0, '#1d4ed8'],
  ]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
    p.position.set(x, 1.7, -4.25);
    group.add(p);
  }

  // cartões em arco à frente
  const cards = [];
  const R = 2.0;
  const step = THREE.MathUtils.degToRad(17.5);
  // Disponíveis no centro; as “em breve” se espalham para os lados (centro, direita, esquerda...)
  const ordered = [...SCENES.filter((s) => s.available), ...SCENES.filter((s) => !s.available)];
  const n = ordered.length;
  const slotOf = (k) => (k === 0 ? 0 : k % 2 ? Math.ceil(k / 2) : -k / 2);
  ordered.forEach((sc, k) => {
    const card = makeCard(sc);
    const a = slotOf(k) * step + (n % 2 ? 0 : step / 2);
    const r = sc.available ? R - 0.15 : R;
    card.position.set(Math.sin(a) * r, 1.22, -Math.cos(a) * r);
    group.add(card);
    card.updateMatrixWorld();
    card.lookAt(W(0, 1.45, 0));
    cards.push(card);
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.82, 12), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
    ped.position.set(card.position.x, 0.41, card.position.z);
    group.add(ped);
  });

  const lobby = {
    group,
    cards,
    setLogo(canvas) {
      const t = tex(canvas);
      floorLogo.material.map = t;
      floorLogo.material.needsUpdate = true;
      const bd = backdropCanvas(canvas);
      bdTex.image = bd;
      bdTex.needsUpdate = true;
    },
    update(dt, t) {
      for (const c of cards) {
        const s = c.scale.x + (c.userData.targetScale - c.scale.x) * Math.min(1, dt * 10);
        c.scale.setScalar(s);
      }
      floorRing.material.color.setHSL(0.07, 0.95, 0.5 + Math.sin(t * 2) * 0.08);
    },
  };
  return lobby;
}

/** Mostra o lobby e espera a escolha. Retorna { sceneId, startPhase }. */
export async function runLobby(g, run, lobby) {
  const { ui, sfx } = g;
  lobby.group.visible = true;
  g.world.root.visible = false;
  run.onCleanup(() => {
    lobby.group.visible = false;
    g.world.root.visible = true;
  });
  g.player.setPose(LOBBY_POS.x, LOBBY_POS.z, 0);
  ui.setHud([]);
  run.onFrame((dt, t) => lobby.update(dt, t));

  const done = run.deferred();
  for (const card of lobby.cards) {
    const sc = card.userData.scene;
    const rm = g.interact.add(card, {
      label: null,
      onSelect: () =>
        Promise.resolve()
          .then(async () => {
            if (!sc.available) {
              sfx.info();
              ui.showToast([sc.title, 'Este cenário ainda está em desenvolvimento.'], 'warning', 3);
              return;
            }
            const buttons = [{ label: 'Simulação completa', value: 1 }];
            (sc.phases || []).slice(1).forEach((p, i) => buttons.push({ label: `Fase ${i + 2}: ${p}`, value: i + 2 }));
            buttons.push({ label: 'Voltar', value: 0 });
            const v = await ui.ask(run, {
              title: sc.title,
              body: `${sc.desc}\n\nDuração: ${sc.duration}. Por onde deseja começar?`,
              buttons,
              columns: 2,
            });
            if (v) done.resolve({ sceneId: sc.id, startPhase: v });
          })
          .catch(() => {}),
    });
    run.onCleanup(rm);
  }

  await g.fade(0, 0.6);
  const pick = await done.promise;
  for (const card of lobby.cards) g.interact.remove(card);
  await g.fade(1, 0.4);
  lobby.group.visible = false;
  g.world.root.visible = true;
  return pick;
}
