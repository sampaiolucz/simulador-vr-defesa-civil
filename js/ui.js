// Interface dentro do VR: painéis de diálogo, HUD que acompanha o olhar, avisos (toasts) e rótulos.
// Tudo é desenhado em <canvas> e aplicado como textura em planos 3D.
import * as THREE from 'three';

const PPM = 800; // pixels de textura por metro
const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const TONES = {
  brand: '#f97316',
  info: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

const measureCtx = document.createElement('canvas').getContext('2d');

/** Cria um plano com textura de canvas. draw(ctx, w, h) desenha o conteúdo. */
function canvasPlane(wPx, hPx, draw, { order = 1000, overlay = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d');
  draw(ctx, wPx, hPx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: !overlay,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wPx / PPM, hPx / PPM), mat);
  mesh.renderOrder = order;
  mesh.userData.redraw = (fn = draw) => {
    ctx.clearRect(0, 0, wPx, hPx);
    fn(ctx, wPx, hPx);
    tex.needsUpdate = true;
  };
  mesh.userData.dispose = () => {
    tex.dispose();
    mat.dispose();
    mesh.geometry.dispose();
  };
  return mesh;
}

function drawMark(ctx, x, y, r, ok) {
  ctx.fillStyle = ok ? TONES.success : TONES.danger;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (ok) {
    ctx.moveTo(x - r * 0.45, y + r * 0.02);
    ctx.lineTo(x - r * 0.1, y + r * 0.38);
    ctx.lineTo(x + r * 0.5, y - r * 0.35);
  } else {
    ctx.moveTo(x - r * 0.38, y - r * 0.38);
    ctx.lineTo(x + r * 0.38, y + r * 0.38);
    ctx.moveTo(x + r * 0.38, y - r * 0.38);
    ctx.lineTo(x - r * 0.38, y + r * 0.38);
  }
  ctx.stroke();
}

/** Botão interativo. */
function createButton(label, wPx, hPx, tone, onSelect) {
  let hover = false;
  const color = TONES[tone] || tone || TONES.info;
  const draw = (ctx, w, h) => {
    roundRect(ctx, 4, 4, w - 8, h - 8, 22);
    ctx.fillStyle = hover ? color : 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.lineWidth = hover ? 6 : 4;
    ctx.strokeStyle = hover ? '#ffffff' : color;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 36;
    ctx.font = `600 ${size}px ${FONT}`;
    let lines = wrapText(ctx, label, w - 40);
    if (lines.length > 2) {
      size = 30;
      ctx.font = `600 ${size}px ${FONT}`;
      lines = wrapText(ctx, label, w - 36);
    }
    const lh = size * 1.18;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
  };
  const mesh = canvasPlane(wPx, hPx, draw, { order: 1002 });
  mesh.userData.interact = {
    ui: true,
    label: null,
    enabled: true,
    onSelect,
    setHover(h) {
      if (h === hover) return;
      hover = h;
      mesh.userData.redraw();
    },
  };
  return mesh;
}

/**
 * Painel com título, texto, itens (lista com ✓/✗) e botões.
 * buttons: [{ label, value, tone }]
 */
export function createPanel({ title = '', body = '', items = null, buttons = [], tone = 'brand', width = 1.2, columns, onChoose }) {
  const W = Math.round(width * PPM);
  const pad = 52;
  const inner = W - pad * 2;
  const accent = TONES[tone] || tone;

  measureCtx.font = `700 52px ${FONT}`;
  const titleLines = title ? wrapText(measureCtx, title, inner) : [];
  measureCtx.font = `400 38px ${FONT}`;
  const bodyLines = body ? wrapText(measureCtx, body, inner) : [];
  const itemLines = [];
  if (items) {
    measureCtx.font = `400 34px ${FONT}`;
    for (const it of items) itemLines.push({ ok: it.ok, lines: wrapText(measureCtx, it.text, inner - 70) });
  }

  const n = buttons.length;
  const cols = columns ?? (n >= 3 ? 2 : n === 2 ? 2 : 1);
  const rows = Math.ceil(n / cols);
  const btnH = 104;
  const gap = 22;

  const TL = 64;
  const BL = 52;
  const IL = 44;
  let H = pad + 12;
  H += titleLines.length * TL;
  if (bodyLines.length) H += 18 + bodyLines.length * BL;
  for (const it of itemLines) H += 14 + it.lines.length * IL;
  if (items) H += 10;
  if (n) H += 34 + rows * btnH + (rows - 1) * gap;
  H += pad;

  const bg = canvasPlane(W, H, (ctx, w, h) => {
    roundRect(ctx, 0, 0, w, h, 36);
    ctx.fillStyle = 'rgba(17,22,33,0.94)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    roundRect(ctx, pad, 22, 140, 10, 5);
    ctx.fill();
    let y = pad + 12;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 52px ${FONT}`;
    for (const l of titleLines) {
      ctx.fillText(l, pad, y);
      y += TL;
    }
    if (bodyLines.length) {
      y += 18;
      ctx.font = `400 38px ${FONT}`;
      ctx.fillStyle = '#dbe2ee';
      for (const l of bodyLines) {
        ctx.fillText(l, pad, y);
        y += BL;
      }
    }
    if (items) {
      ctx.font = `400 34px ${FONT}`;
      for (const it of itemLines) {
        y += 14;
        drawMark(ctx, pad + 22, y + 20, 20, it.ok);
        ctx.fillStyle = '#e8edf5';
        for (const l of it.lines) {
          ctx.fillText(l, pad + 64, y);
          y += IL;
        }
      }
    }
  });

  const group = new THREE.Group();
  group.add(bg);
  group.userData.buttons = [];
  group.userData.height = H / PPM;

  if (n) {
    const btnW = (inner - (cols - 1) * gap) / cols;
    const top = H - pad - rows * btnH - (rows - 1) * gap;
    buttons.forEach((b, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // centraliza a última linha incompleta
      const inRow = Math.min(cols, n - r * cols);
      const rowW = inRow * btnW + (inRow - 1) * gap;
      const x0 = (W - rowW) / 2;
      const px = x0 + c * (btnW + gap) + btnW / 2;
      const py = top + r * (btnH + gap) + btnH / 2;
      const btn = createButton(b.label, Math.round(btnW), btnH, b.tone || tone, () => onChoose && onChoose(b.value ?? b.label));
      btn.position.set((px - W / 2) / PPM, (H / 2 - py) / PPM, 0.003);
      group.add(btn);
      group.userData.buttons.push(btn);
    });
  }
  group.userData.dispose = () => {
    group.traverse((o) => o.userData.dispose && o !== group && o.userData.dispose());
  };
  return group;
}

/** Rótulo de texto simples (usado no HUD e em avisos). */
function createLabel(wPx, hPx) {
  let state = { lines: [], tone: 'brand', big: false };
  const draw = (ctx, w, h) => {
    if (!state.lines.length) return;
    const accent = TONES[state.tone] || state.tone;
    ctx.font = `700 48px ${FONT}`;
    const l0 = wrapText(ctx, state.lines[0] || '', w - 80);
    ctx.font = `400 40px ${FONT}`;
    const rest = state.lines.slice(1).flatMap((l) => wrapText(ctx, l, w - 80));
    const hh = 34 + l0.length * 58 + rest.length * 50 + 26;
    const y0 = (h - hh) / 2;
    roundRect(ctx, 4, y0, w - 8, hh, 26);
    ctx.fillStyle = 'rgba(17,22,33,0.88)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let y = y0 + 26;
    ctx.fillStyle = accent === TONES.brand ? '#ffd8b5' : '#ffffff';
    ctx.font = `700 48px ${FONT}`;
    for (const l of l0) {
      ctx.fillText(l, w / 2, y);
      y += 58;
    }
    ctx.fillStyle = '#e5ebf3';
    ctx.font = `400 40px ${FONT}`;
    for (const l of rest) {
      ctx.fillText(l, w / 2, y);
      y += 50;
    }
  };
  const mesh = canvasPlane(wPx, hPx, draw, { order: 1001 });
  mesh.userData.set = (lines, tone = 'brand') => {
    state = { lines: lines.filter((l) => l != null && l !== ''), tone };
    mesh.userData.redraw();
    mesh.visible = state.lines.length > 0;
  };
  mesh.visible = false;
  return mesh;
}

/** Sprite de texto que aparece sobre objetos quando a pessoa aponta para eles. */
function createTooltip() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false })
  );
  sprite.renderOrder = 1500;
  sprite.scale.set(0.42, 0.105, 1);
  sprite.visible = false;
  let current = null;
  sprite.userData.show = (text) => {
    if (text !== current) {
      current = text;
      ctx.clearRect(0, 0, 512, 128);
      ctx.font = `600 46px ${FONT}`;
      const tw = Math.min(490, ctx.measureText(text).width + 50);
      roundRect(ctx, 256 - tw / 2, 20, tw, 88, 44);
      ctx.fillStyle = 'rgba(17,22,33,0.9)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = TONES.brand;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 66, 460);
      tex.needsUpdate = true;
    }
    sprite.visible = true;
  };
  return sprite;
}

/** Ícone de “risco encontrado” (sprite com ✓). */
export function createCheckSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  drawMark(ctx, 64, 64, 52, true);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false }));
  s.renderOrder = 50;
  s.scale.set(0.16, 0.16, 1);
  return s;
}

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

export class UI {
  constructor(scene, camera, sfx) {
    this.scene = scene;
    this.camera = camera;
    this.sfx = sfx;
    this.dialog = null;
    this.dialogCancel = null;

    // HUD que acompanha o olhar, com botão opcional
    this.hud = new THREE.Group();
    this.hudLabel = createLabel(1100, 300);
    this.hudLabel.scale.setScalar(0.8);
    this.hud.add(this.hudLabel);
    this.hudButton = null;
    this.toast = createLabel(1100, 260);
    this.toast.scale.setScalar(0.8);
    this.toast.position.y = 0.26;
    this.hud.add(this.toast);
    this.toastTimer = 0;
    scene.add(this.hud);
    this.hudReady = false;

    this.tooltip = createTooltip();
    scene.add(this.tooltip);
  }

  get modalOpen() {
    return !!this.dialog;
  }

  /** Alvos de UI para o raycast (botões do diálogo e do HUD). */
  targets() {
    const t = [];
    if (this.dialog) t.push(...this.dialog.userData.buttons);
    else if (this.hudButton && this.hudButton.visible) t.push(this.hudButton);
    return t;
  }

  _headPose() {
    this.camera.getWorldPosition(_v);
    this.camera.getWorldDirection(_d);
    _d.y = 0;
    if (_d.lengthSq() < 1e-6) _d.set(0, 0, -1);
    _d.normalize();
    return { pos: _v.clone(), dir: _d.clone() };
  }

  _placeInFront(obj, dist = 1.35, dy = -0.05) {
    const { pos, dir } = this._headPose();
    obj.position.copy(pos).addScaledVector(dir, dist);
    obj.position.y = pos.y + dy;
    obj.lookAt(pos.x, obj.position.y, pos.z);
  }

  /**
   * Mostra um diálogo e espera a escolha. Retorna o value do botão escolhido.
   * run: execução atual (para cancelar ao reiniciar).
   */
  ask(run, opts) {
    return run.promise((resolve) => {
      this.closeDialog();
      const panel = createPanel({
        ...opts,
        onChoose: (v) => {
          this.sfx.click();
          this.closeDialog();
          resolve(v);
        },
      });
      this.dialog = panel;
      this._placeInFront(panel, opts.distance ?? 1.35, opts.dy ?? -0.05);
      this.scene.add(panel);
      if (opts.sound !== false) {
        if (opts.tone === 'danger') this.sfx.bad();
        else if (opts.tone === 'success') this.sfx.good();
        else this.sfx.info();
      }
      return () => this.closeDialog();
    });
  }

  /** Diálogo simples com um botão. */
  say(run, title, body, opts = {}) {
    return this.ask(run, { title, body, buttons: [{ label: opts.button || 'Continuar' }], ...opts });
  }

  closeDialog() {
    if (!this.dialog) return;
    this.scene.remove(this.dialog);
    this.dialog.userData.dispose();
    this.dialog = null;
  }

  setHud(lines, tone = 'brand') {
    this.hudLabel.userData.set(lines, tone);
  }

  setHudButton(label, onSelect) {
    if (this.hudButton) {
      this.hud.remove(this.hudButton);
      this.hudButton.userData.dispose();
      this.hudButton = null;
    }
    if (!label) return;
    this.hudButton = createButton(label, 460, 96, 'brand', () => {
      this.sfx.click();
      onSelect();
    });
    this.hudButton.position.y = -0.2;
    this.hud.add(this.hudButton);
  }

  showToast(text, tone = 'info', seconds = 3.5) {
    const lines = Array.isArray(text) ? text : [text];
    this.toast.userData.set(lines, tone);
    this.toastTimer = seconds;
  }

  showTooltip(text, point) {
    if (!text) {
      this.tooltip.visible = false;
      return;
    }
    this.tooltip.userData.show(text);
    this.camera.getWorldPosition(_v);
    _d.copy(_v).sub(point).normalize();
    this.tooltip.position.copy(point).addScaledVector(_d, 0.15);
    this.tooltip.position.y += 0.1;
  }

  /** Recoloca diálogo e HUD na frente do jogador (ao entrar no VR ou recentralizar). */
  recenter() {
    if (this.dialog) this._placeInFront(this.dialog, 1.35, -0.05);
    this.update(0, true);
  }

  reset() {
    this.closeDialog();
    this.setHud([]);
    this.setHudButton(null);
    this.toast.userData.set([]);
    this.tooltip.visible = false;
  }

  /** Mantém o HUD na parte de baixo do campo de visão, seguindo o olhar com suavidade. */
  update(dt, snap = false) {
    this.hud.visible = !this.dialog; // com diálogo aberto, o HUD sai da frente
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.userData.set([]);
    }
    const { pos, dir } = this._headPose();
    const target = pos.clone().addScaledVector(dir, 1.25);
    target.y = pos.y - 0.42;
    if (!this.hudReady || snap) {
      this.hud.position.copy(target);
      this.hudReady = true;
    } else {
      // só reposiciona quando o olhar se afasta bastante (evita "grudar" no rosto)
      const cur = this.hud.position.clone().sub(pos);
      cur.y = 0;
      const ang = cur.angleTo(dir);
      const dist = this.hud.position.distanceTo(target);
      if (ang > 0.45 || dist > 0.5 || this._following) {
        this._following = this.hud.position.distanceTo(target) > 0.03;
        this.hud.position.lerp(target, Math.min(1, dt * 4));
      }
    }
    this.hud.lookAt(pos.x, this.hud.position.y, pos.z);
  }
}
