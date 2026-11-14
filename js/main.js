// Simulador VR — Defesa Civil de Cubatão
// Ponto de entrada: renderização, sessão VR, entrada por mãos/controles/mouse e controle do cenário.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { Effects, Emitter } from './effects.js';
import { Tweens, Run, Aborted, clamp } from './util.js';
import { runIncendio, FASES_INCENDIO } from './scenario-incendio.js';

// Seletor “Começar pela fase” na tela inicial (para palestras com pouco tempo)
const phaseSelect = document.getElementById('phase');
FASES_INCENDIO.forEach((nome, i) => {
  const opt = document.createElement('option');
  opt.value = String(i + 1);
  opt.textContent = i === 0 ? `Simulação completa (começa em: ${nome})` : `Começar pela fase ${i + 1}: ${nome}`;
  phaseSelect.appendChild(opt);
});
try {
  phaseSelect.value = localStorage.getItem('fase-inicial') || '1';
} catch (e) {}
phaseSelect.addEventListener('change', () => {
  try {
    localStorage.setItem('fase-inicial', phaseSelect.value);
  } catch (e) {}
});

// ---------------------------------------------------------------- Renderização
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 150);
camera.rotation.order = 'YXZ';
const rig = new THREE.Group(); // “corpo” do jogador: mover o rig = teletransportar
rig.add(camera);
scene.add(rig);

const sfx = new Sfx();
const tweens = new Tweens();
const world = buildWorld(scene);
const fx = new Effects(scene);
const ui = new UI(scene, camera, sfx);

// Esfera preta para transições e esfera cinza para quando a cabeça está dentro da fumaça
function overlaySphere(color, order) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false })
  );
  m.renderOrder = order;
  m.visible = false;
  m.frustumCulled = false;
  camera.add(m);
  return m;
}
const fadeMesh = overlaySphere(0x000000, 3000);
const smokeMesh = overlaySphere(0x3b3b3b, 900);
let smokeTarget = 0;
function setFade(v) {
  fadeMesh.material.opacity = v;
  fadeMesh.visible = v > 0.001;
}

// ---------------------------------------------------------------- Jogador
const DESK = { yaw: 0, pitch: 0, crouch: false };
function applyDesk() {
  camera.position.set(0, DESK.crouch ? 0.85 : 1.6, 0);
  camera.rotation.set(DESK.pitch, DESK.yaw, 0, 'YXZ');
}
applyDesk();

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const player = {
  lastPose: { x: 0, z: 0, yaw: 0 },
  headWorld(v = new THREE.Vector3()) {
    rig.updateMatrixWorld(true);
    return camera.getWorldPosition(v);
  },
  headHeight() {
    return this.headWorld(_v).y - rig.position.y;
  },
  headYaw() {
    camera.getWorldDirection(_d);
    return Math.atan2(-_d.x, -_d.z);
  },
  /** Posiciona a cabeça do jogador em (x, z) olhando na direção yaw. */
  setPose(x, z, yaw) {
    this.lastPose = { x, z, yaw };
    if (!renderer.xr.isPresenting) {
      DESK.yaw = 0;
      DESK.pitch = -0.18; // levemente para baixo: mostra melhor os objetos no projetor
      applyDesk();
      rig.rotation.set(0, yaw, 0);
      rig.position.set(x, 0, z);
      rig.updateMatrixWorld(true);
    } else {
      rig.updateMatrixWorld(true);
      rig.rotation.y += yaw - this.headYaw();
      rig.updateMatrixWorld(true);
      const h = this.headWorld(_v);
      rig.position.x += x - h.x;
      rig.position.z += z - h.z;
      rig.updateMatrixWorld(true);
    }
    ui.update(0, true);
  },
};

// ---------------------------------------------------------------- Objetos interativos
const interact = {
  items: new Set(),
  /** Torna um objeto selecionável. Retorna função que remove. */
  add(obj, { label, onSelect }) {
    obj.userData.interact = {
      label,
      onSelect,
      enabled: true,
      setHover: (h) => highlight(obj, h),
    };
    this.items.add(obj);
    return () => this.remove(obj);
  },
  remove(obj) {
    if (obj.userData.interact) obj.userData.interact.setHover(false);
    delete obj.userData.interact;
    this.items.delete(obj);
  },
  clear() {
    for (const o of [...this.items]) this.remove(o);
  },
};

function highlight(obj, h) {
  if (obj.userData.hoverFx) return obj.userData.hoverFx(h);
  obj.traverse((m) => {
    if (!m.isMesh || !m.material || !m.material.emissive) return;
    if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.material.emissive.getHex();
    m.material.emissive.setHex(h ? 0x6a3a10 : m.userData.baseEmissive);
  });
}

function findInteract(obj) {
  while (obj) {
    if (obj.userData.interact) return obj;
    obj = obj.parent;
  }
  return null;
}
function visibleChain(obj) {
  while (obj) {
    if (!obj.visible) return false;
    obj = obj.parent;
  }
  return true;
}

const raycaster = new THREE.Raycaster();
raycaster.far = 30;
function pick() {
  const uiTargets = ui.targets();
  if (uiTargets.length) {
    const hits = raycaster.intersectObjects(uiTargets, false).filter((h) => visibleChain(h.object));
    if (hits.length) return { target: hits[0].object, point: hits[0].point, ui: true, distance: hits[0].distance };
  }
  if (ui.modalOpen) return null; // com diálogo aberto, só os botões respondem
  const hits = raycaster.intersectObjects([...interact.items, ...world.occluders], true);
  for (const h of hits) {
    if (!visibleChain(h.object)) continue;
    const t = findInteract(h.object);
    if (t && t.userData.interact.enabled !== false) return { target: t, point: h.point, distance: h.distance };
    return { target: null, point: h.point, distance: h.distance };
  }
  return null;
}

// ---------------------------------------------------------------- Entradas (mãos, controles, mouse)
const inputs = [];
const tmpMat = new THREE.Matrix4();
const jointGeo = new THREE.SphereGeometry(1, 8, 6);
const handMat = new THREE.MeshLambertMaterial({ color: 0xf0c6a4 });
const tipMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });

function controllerModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
  body.rotation.x = Math.PI / 2 - 0.5;
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 20), new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
  ring.position.set(0, 0.02, -0.03);
  ring.rotation.x = 0.6;
  g.add(ring);
  return g;
}

for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  rig.add(controller);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })
  );
  line.scale.z = 3;
  controller.add(line);
  const reticle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
  reticle.renderOrder = 1600;
  reticle.visible = false;
  scene.add(reticle);
  const grip = renderer.xr.getControllerGrip(i);
  const model = controllerModel();
  grip.add(model);
  rig.add(grip);
  const hand = renderer.xr.getHand(i);
  rig.add(hand);

  const input = { kind: 'xr', controller, grip, model, hand, line, reticle, source: null, lastSelect: 0, hit: null };
  controller.addEventListener('connected', (e) => {
    input.source = e.data;
    model.visible = !e.data.hand;
  });
  controller.addEventListener('disconnected', () => {
    input.source = null;
    reticle.visible = false;
  });
  controller.addEventListener('select', () => onSelect(input));
  inputs.push(input);
}

const mouse = { kind: 'mouse', ndc: new THREE.Vector2(), active: false, lastSelect: 0, hit: null };
inputs.push(mouse);

function setRayFrom(input) {
  if (input.kind === 'mouse') {
    raycaster.setFromCamera(input.ndc, camera);
  } else {
    tmpMat.identity().extractRotation(input.controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(input.controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMat);
  }
}

function onSelect(input) {
  const now = performance.now();
  if (now - input.lastSelect < 350) return; // evita duplo disparo
  input.lastSelect = now;
  sfx.unlock();
  setRayFrom(input);
  const r = pick();
  if (r && r.target && r.target.userData.interact) {
    try {
      r.target.userData.interact.onSelect();
    } catch (e) {
      if (!(e instanceof Aborted)) console.error(e);
    }
  }
}

let hovered = new Set();
function updateInputs() {
  const now = new Set();
  let tip = null;
  const xr = renderer.xr.isPresenting;
  for (const input of inputs) {
    input.hit = null;
    if (input.kind === 'mouse') {
      if (xr || !input.active) continue;
    } else {
      if (!xr || !input.source || !input.controller.visible) {
        input.reticle.visible = false;
        continue;
      }
    }
    setRayFrom(input);
    const r = pick();
    input.hit = r;
    if (r && r.target) {
      now.add(r.target);
      const label = r.target.userData.interact && r.target.userData.interact.label;
      if (label && !tip) tip = { label, point: r.point };
    }
    if (input.kind === 'xr') {
      const len = r ? r.distance : 3;
      input.line.scale.z = Math.max(0.05, len);
      input.line.material.color.set(r && r.target ? 0xf97316 : 0xffffff);
      input.reticle.visible = !!r;
      if (r) input.reticle.position.copy(r.point);
    }
  }
  for (const o of hovered) if (!now.has(o) && o.userData.interact) o.userData.interact.setHover(false);
  for (const o of now) if (!hovered.has(o)) o.userData.interact.setHover(true);
  hovered = now;
  if (tip) ui.showTooltip(tip.label, tip.point);
  else ui.showTooltip(null);
  renderer.domElement.style.cursor = now.size ? 'pointer' : 'grab';
}

function updateHands() {
  for (const input of inputs) {
    if (!input.hand) continue;
    const joints = input.hand.joints;
    if (!joints) continue;
    for (const name in joints) {
      const j = joints[name];
      if (!j.userData.sphere) {
        const s = new THREE.Mesh(jointGeo, name.endsWith('tip') ? tipMat : handMat);
        j.add(s);
        j.userData.sphere = s;
      }
      j.userData.sphere.scale.setScalar(Math.max(0.006, (j.jointRadius || 0.008) * 0.95));
    }
  }
}

// Mouse / toque (modo computador)
const canvas = renderer.domElement;
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting) return;
  drag = { x: e.clientX, y: e.clientY, moved: false, yaw: DESK.yaw, pitch: DESK.pitch };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  mouse.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.active = true;
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
  if (drag.moved) {
    DESK.yaw = drag.yaw + dx * 0.0045;
    DESK.pitch = clamp(drag.pitch + dy * 0.0045, -1.3, 1.3);
    applyDesk();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) {
    mouse.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    onSelect(mouse);
  }
  drag = null;
});
canvas.addEventListener('pointerleave', () => (mouse.active = false));
window.addEventListener('keydown', (e) => {
  if (renderer.xr.isPresenting) return;
  const k = e.key.toLowerCase();
  if (k === 'c') {
    DESK.crouch = !DESK.crouch;
    applyDesk();
  } else if (k === 'r') {
    startScenario();
  } else if (k === 'arrowleft') {
    DESK.yaw += 0.15;
    applyDesk();
  } else if (k === 'arrowright') {
    DESK.yaw -= 0.15;
    applyDesk();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- Cenário
const frameHooks = new Set();
let currentRun = null;

const game = {
  scene,
  camera,
  renderer,
  world,
  fx,
  ui,
  sfx,
  tweens,
  interact,
  player,
  get isXR() {
    return renderer.xr.isPresenting;
  },
  fade(to, seconds = 0.4) {
    const from = fadeMesh.material.opacity;
    return tweens.play({ duration: seconds, update: (t) => setFade(from + (to - from) * t) });
  },
  async teleport(x, z, yaw) {
    await game.fade(1, 0.15);
    player.setPose(x, z, yaw);
    await game.fade(0, 0.2);
  },
  /** Opacidade da “névoa” na frente dos olhos (0..1). */
  setSmokeOverlay(v) {
    smokeTarget = v;
  },
  restart: () => startScenario(),
};

async function startScenario() {
  if (currentRun) currentRun.abort();
  const run = new Run(frameHooks);
  currentRun = run;
  ui.reset();
  fx.clear();
  tweens.clear();
  interact.clear();
  sfx.stopAll();
  world.reset();
  smokeTarget = 0;
  setFade(0);
  try {
    await runIncendio(game, run, { startPhase: Number(phaseSelect.value) || 1 });
  } catch (e) {
    if (!(e instanceof Aborted)) console.error(e);
  }
}

// ---------------------------------------------------------------- Loop principal
const clock = new THREE.Clock();
let time = 0;
let reposeFrames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // Ao entrar no VR (ou recentralizar), reposiciona o jogador quando a pose da cabeça já existe
  if (reposeFrames > 0 && renderer.xr.isPresenting) {
    reposeFrames--;
    if (reposeFrames === 0) {
      const p = player.lastPose;
      player.setPose(p.x, p.z, p.yaw);
      ui.recenter();
    }
  }

  tweens.update(dt);
  for (const h of [...frameHooks]) h(dt, time);
  updateInputs();
  updateHands();
  fx.update(dt, time, renderer);
  ui.update(dt);
  const so = smokeMesh.material.opacity + (smokeTarget - smokeMesh.material.opacity) * Math.min(1, dt * 4);
  smokeMesh.material.opacity = so;
  smokeMesh.visible = so > 0.01;
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------- Tela inicial / sessão VR
const overlay = document.getElementById('overlay');
const btnVR = document.getElementById('btn-vr');
const btnDesk = document.getElementById('btn-desktop');
const btnRestart = document.getElementById('btn-restart');
const statusEl = document.getElementById('status');
const helpEl = document.getElementById('help');
const offlineEl = document.getElementById('offline');
let started = false;

function setStatus(msg) {
  statusEl.textContent = msg;
}

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((ok) => {
      btnVR.disabled = !ok;
      setStatus(ok ? 'Óculos VR detectado. Toque em “Entrar no VR”.' : 'VR não disponível neste aparelho. Use “Testar no computador”.');
    })
    .catch(() => setStatus('VR não disponível neste aparelho.'));
} else {
  btnVR.disabled = true;
  setStatus(window.isSecureContext ? 'Este navegador não tem suporte a VR (WebXR). Use “Testar no computador”.' : 'Para o VR funcionar, abra por https:// ou http://localhost.');
}

btnVR.addEventListener('click', async () => {
  sfx.unlock();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    await renderer.xr.setSession(session);
    overlay.classList.add('hidden');
    helpEl.classList.add('hidden');
    reposeFrames = 3;
    const ref = renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', () => (reposeFrames = 2));
    session.addEventListener('end', () => {
      applyDesk();
      const p = player.lastPose;
      player.setPose(p.x, p.z, p.yaw);
      overlay.classList.remove('hidden');
      btnVR.textContent = 'Voltar ao VR';
      btnRestart.classList.remove('hidden');
    });
    if (!started) {
      started = true;
      startScenario();
    }
  } catch (e) {
    console.error(e);
    setStatus('Não foi possível iniciar o VR: ' + (e.message || e));
  }
});

btnDesk.addEventListener('click', () => {
  sfx.unlock();
  overlay.classList.add('hidden');
  helpEl.classList.remove('hidden');
  if (!started) {
    started = true;
    startScenario();
  }
});

btnRestart.addEventListener('click', () => {
  sfx.unlock();
  startScenario();
});

document.getElementById('btn-menu').addEventListener('click', () => {
  overlay.classList.remove('hidden');
  btnRestart.classList.remove('hidden');
  btnDesk.textContent = 'Continuar no computador';
});

// Funcionamento offline (service worker)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      offlineEl.textContent = '✔ Pronto para funcionar sem internet neste aparelho';
      offlineEl.classList.add('ok');
    })
    .catch((e) => {
      offlineEl.textContent = 'Modo offline indisponível: ' + e.message;
    });
} else {
  offlineEl.textContent = 'Modo offline indisponível (abra por https:// ou localhost)';
}

// Cena de fundo da tela inicial
player.setPose(8.5, 3.5, Math.atan2(8, 3.5)); // olhando para a casa

// Pré-compila os shaders (inclusive fogo e fumaça) para não travar na primeira vez que aparecem.
// Os emissores de aquecimento ficam escondidos sob o chão e mantêm os programas na memória.
{
  const warmFire = new Emitter('fire', { pos: new THREE.Vector3(0, -50, 0), count: 1 });
  const warmSmoke = new Emitter('smoke', { pos: new THREE.Vector3(0, -50, 0), count: 1 });
  scene.add(warmFire.points, warmSmoke.points);
  fx.light.intensity = 0.001; // garante a variante do shader com luz pontual
  try {
    renderer.compile(scene, camera);
  } catch (e) {
    console.warn(e);
  }
}
window.__game = game; // para depuração no console
