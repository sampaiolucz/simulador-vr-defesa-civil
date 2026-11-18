// Efeitos de fogo e fumaça com partículas leves (1 draw call por emissor — bom para o Quest 2).
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aLife;
attribute float aSize;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale * projectionMatrix[1][1] / max(-mv.z, 0.05);
}`;

const FIRE_FRAG = /* glsl */ `
varying float vLife;
uniform float uOpacity;
uniform vec3 uC0;
uniform vec3 uC1;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.6) * (1.0 - vLife) * uOpacity;
  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.65, vLife));
  gl_FragColor = vec4(col, a);
}`;

// Pó/gás do extintor: nuvem clara que se abre e some
const SPRAY_FRAG = /* glsl */ `
varying float vLife;
uniform float uOpacity;
uniform vec3 uC0;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.2) * (1.0 - vLife) * 0.55 * uOpacity;
  gl_FragColor = vec4(uC0, a);
}`;

const SMOKE_FRAG = /* glsl */ `
varying float vLife;
uniform float uOpacity;
uniform vec3 uC0;
uniform vec3 uC1;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.3) * sin(vLife * 3.14159) * 0.5 * uOpacity;
  vec3 col = mix(uC0, uC1, vLife);
  gl_FragColor = vec4(col, a);
}`;

const shared = { uScale: { value: 500 } };

export class Emitter {
  constructor(kind, { pos, count = 60, radius = 0.15, height = 0.7, size = 0.22, lifespan = [0.5, 1.0], drift = null, wobble = 0.04, colors = null }) {
    this.kind = kind;
    this.pos = pos.clone();
    this.count = count;
    this.radius = radius;
    this.height = height;
    this.size = size;
    this.drift = drift ? drift.clone() : new THREE.Vector3();
    this.wobble = wobble;
    this.intensity = 0;
    this.target = 0;
    this.speed = 1;

    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(count * 3);
    this.lifeArr = new Float32Array(count);
    this.sizeArr = new Float32Array(count);
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.lifeArr, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArr, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;

    this.ox = new Float32Array(count);
    this.oz = new Float32Array(count);
    this.span = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.alive = new Uint8Array(count);
    this.pScale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.span[i] = lifespan[0] + Math.random() * (lifespan[1] - lifespan[0]);
      this.phase[i] = Math.random() * 10;
      this.lifeArr[i] = Math.random();
      this._respawn(i);
      this.alive[i] = 0;
    }

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: shared.uScale,
        uOpacity: { value: 1 },
        uC0: { value: new THREE.Color(...(colors ? colors[0] : kind === 'fire' ? [1.0, 0.92, 0.55] : [0.16, 0.16, 0.16])) },
        uC1: { value: new THREE.Color(...(colors ? colors[1] : kind === 'fire' ? [1.0, 0.28, 0.03] : [0.3, 0.3, 0.3])) },
      },
      vertexShader: VERT,
      fragmentShader: kind === 'fire' ? FIRE_FRAG : SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind === 'fire' ? 20 : 10;
  }

  _respawn(i) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.radius;
    this.ox[i] = Math.cos(a) * r;
    this.oz[i] = Math.sin(a) * r;
    this.pScale[i] = 0.7 + Math.random() * 0.6;
  }

  /** Muda a intensidade (0 apaga, 1 normal, >1 maior) em `seconds` segundos. */
  setIntensity(v, seconds = 0.6) {
    this.target = v;
    this.rampTime = Math.max(0.01, seconds);
    this.rampFrom = this.intensity;
    this.rampT = 0;
  }

  update(dt, time) {
    if (this.rampTime) {
      this.rampT = Math.min(1, this.rampT + dt / this.rampTime);
      this.intensity = this.rampFrom + (this.target - this.rampFrom) * this.rampT;
      if (this.rampT >= 1) this.rampTime = 0;
    }
    const k = this.intensity;
    const sc = Math.max(0.0001, k);
    const fire = this.kind === 'fire';
    for (let i = 0; i < this.count; i++) {
      let life = this.lifeArr[i] + (dt / this.span[i]) * this.speed;
      if (life >= 1) {
        life -= 1;
        this._respawn(i);
        this.alive[i] = k > 0.02 ? 1 : 0;
      }
      this.lifeArr[i] = life;
      const spread = fire ? 1 - life * 0.75 : 1 + life * 1.8;
      const wob = Math.sin(time * 3 + this.phase[i]) * this.wobble * life;
      const radialScale = fire ? Math.sqrt(sc) : 1;
      const j = i * 3;
      this.posArr[j] = this.pos.x + this.ox[i] * spread * radialScale + wob + this.drift.x * life;
      this.posArr[j + 1] = this.pos.y + life * this.height * (fire ? sc : 1) * this.pScale[i] + this.drift.y * life;
      this.posArr[j + 2] = this.pos.z + this.oz[i] * spread * radialScale + Math.cos(time * 2.3 + this.phase[i]) * this.wobble * life + this.drift.z * life;
      const base = this.size * this.pScale[i] * (fire ? (1 - life * 0.45) * Math.sqrt(sc) : 0.55 + life * 1.7);
      this.sizeArr[i] = this.alive[i] ? base : 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    if (!fire) this.mat.uniforms.uOpacity.value = Math.min(1, k);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Jato direcional: partículas saem do bico na direção da mira, abrindo em cone. */
export class Spray {
  constructor(color, count = 160) {
    this.count = count;
    this.active = false;
    this.origin = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1);
    this.intensity = 1; // compatibilidade com Effects.update/light
    this.pos = this.origin;
    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(count * 3);
    this.lifeArr = new Float32Array(count).fill(1);
    this.sizeArr = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.lifeArr, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArr, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: shared.uScale, uOpacity: { value: 1 }, uC0: { value: new THREE.Color(...color) } },
      vertexShader: VERT,
      fragmentShader: SPRAY_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 25;
    this.next = 0;
    this.speed = 7; // m/s — alcance aproximado de 3,5 a 4 m
    this.lifespan = 0.55;
  }
  set(active, origin, dir) {
    this.active = active;
    if (origin) this.origin.copy(origin);
    if (dir) this.dir.copy(dir).normalize();
  }
  setIntensity() {}
  update(dt) {
    const spawn = this.active ? Math.ceil(this.count * (dt / this.lifespan)) : 0;
    const side = new THREE.Vector3();
    const up = new THREE.Vector3();
    if (spawn) {
      side.crossVectors(this.dir, Math.abs(this.dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      up.crossVectors(side, this.dir).normalize();
    }
    for (let s = 0; s < spawn; s++) {
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      const j = i * 3;
      const a = Math.random() * Math.PI * 2;
      const spread = Math.random() * 0.13; // abertura do cone
      const v = this.speed * (0.8 + Math.random() * 0.4);
      const dx = this.dir.x + (side.x * Math.cos(a) + up.x * Math.sin(a)) * spread;
      const dy = this.dir.y + (side.y * Math.cos(a) + up.y * Math.sin(a)) * spread;
      const dz = this.dir.z + (side.z * Math.cos(a) + up.z * Math.sin(a)) * spread;
      this.vel[j] = dx * v;
      this.vel[j + 1] = dy * v;
      this.vel[j + 2] = dz * v;
      this.posArr[j] = this.origin.x;
      this.posArr[j + 1] = this.origin.y;
      this.posArr[j + 2] = this.origin.z;
      this.lifeArr[i] = Math.random() * 0.05;
    }
    for (let i = 0; i < this.count; i++) {
      if (this.lifeArr[i] >= 1) {
        this.sizeArr[i] = 0;
        continue;
      }
      const j = i * 3;
      this.lifeArr[i] = Math.min(1, this.lifeArr[i] + dt / this.lifespan);
      const drag = 1 - dt * 2.2;
      this.vel[j] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * drag - 1.2 * dt;
      this.vel[j + 2] *= drag;
      this.posArr[j] += this.vel[j] * dt;
      this.posArr[j + 1] = Math.max(0.02, this.posArr[j + 1] + this.vel[j + 1] * dt);
      this.posArr[j + 2] += this.vel[j + 2] * dt;
      this.sizeArr[i] = 0.05 + this.lifeArr[i] * 0.5;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Chuva: riscos finos caindo numa caixa que acompanha o jogador (1 draw call). */
export class Rain {
  constructor(centerFn, { count = 900, size = 9, height = 7, speed = 9 } = {}) {
    this.centerFn = centerFn;
    this.count = count;
    this.size = size;
    this.height = height;
    this.speed = speed;
    this.intensity = 1;
    this.pos = new THREE.Vector3();
    this.drops = new Float32Array(count * 3); // posição relativa da gota
    for (let i = 0; i < count; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * size;
      this.drops[i * 3 + 1] = Math.random() * height;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * size;
    }
    const geo = new THREE.BufferGeometry();
    this.arr = new Float32Array(count * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.arr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.LineBasicMaterial({ color: 0xc9d6e3, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    this.points = new THREE.LineSegments(geo, this.mat); // nome “points” para reaproveitar o gerenciador
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
  }
  setIntensity(v) {
    this.intensity = v;
    this.mat.opacity = 0.45 * Math.min(1, v);
  }
  update(dt) {
    const c = this.centerFn();
    const fall = this.speed * dt;
    const len = 0.35;
    const wind = 0.12; // leve inclinação
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      this.drops[j + 1] -= fall;
      if (this.drops[j + 1] < 0) {
        this.drops[j + 1] += this.height;
        this.drops[j] = (Math.random() - 0.5) * this.size;
        this.drops[j + 2] = (Math.random() - 0.5) * this.size;
      }
      const x = c.x + this.drops[j];
      const y = c.y - 2.5 + this.drops[j + 1];
      const z = c.z + this.drops[j + 2];
      const k = i * 6;
      this.arr[k] = x;
      this.arr[k + 1] = y;
      this.arr[k + 2] = z;
      this.arr[k + 3] = x + wind * len;
      this.arr[k + 4] = y + len;
      this.arr[k + 5] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.points.visible = this.intensity > 0.01;
  }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.emitters = [];
    // Luz do fogo (uma só, para manter o desempenho)
    this.light = new THREE.PointLight(0xff8a3a, 0, 6, 2);
    this.light.position.set(0, 1, 0);
    scene.add(this.light);
    this.lightTarget = null;
  }

  fire(pos, opts = {}) {
    const e = new Emitter('fire', { pos, count: opts.count ?? 70, radius: opts.radius ?? 0.14, height: opts.height ?? 0.6, size: opts.size ?? 0.22, lifespan: opts.lifespan ?? [0.45, 0.95], wobble: opts.wobble ?? 0.05, colors: opts.colors });
    this._add(e);
    if (opts.light) this.lightTarget = e;
    return e;
  }

  smoke(pos, opts = {}) {
    const e = new Emitter('smoke', { pos, count: opts.count ?? 40, radius: opts.radius ?? 0.2, height: opts.height ?? 1.2, size: opts.size ?? 0.45, lifespan: opts.lifespan ?? [2.2, 3.6], drift: opts.drift, wobble: 0.15, colors: opts.colors });
    this._add(e);
    return e;
  }

  /** Faíscas elétricas (azuladas, rápidas). */
  sparks(pos, opts = {}) {
    return this.fire(pos, {
      count: 40,
      radius: opts.radius ?? 0.12,
      height: opts.height ?? 0.35,
      size: opts.size ?? 0.07,
      lifespan: [0.12, 0.3],
      wobble: 0.25,
      colors: [
        [0.9, 0.95, 1.0],
        [0.3, 0.55, 1.0],
      ],
    });
  }

  /** Chuva ao redor do ponto retornado por centerFn() (normalmente a cabeça do jogador). */
  rain(centerFn, opts) {
    const r = new Rain(centerFn, opts);
    this.emitters.push(r);
    this.group.add(r.points);
    return r;
  }

  /** Poeira/lama (fumaça marrom), usada no deslizamento. */
  dust(pos, opts = {}) {
    return this.smoke(pos, {
      ...opts,
      colors: [
        [0.33, 0.25, 0.16],
        [0.52, 0.44, 0.33],
      ],
    });
  }

  /** Jato do extintor (pó ou gás). Controlado por spray.set(ativo, origem, direção). */
  spray(color = [0.95, 0.95, 0.97]) {
    const s = new Spray(color);
    this.emitters.push(s);
    this.group.add(s.points);
    return s;
  }

  _add(e) {
    this.emitters.push(e);
    this.group.add(e.points);
  }

  remove(e) {
    this.group.remove(e.points);
    e.dispose();
    this.emitters = this.emitters.filter((x) => x !== e);
    if (this.lightTarget === e) this.lightTarget = null;
  }

  clear() {
    for (const e of [...this.emitters]) this.remove(e);
    this.light.intensity = 0;
  }

  update(dt, time, renderer) {
    // escala do tamanho das partículas conforme a resolução (tela ou óculos)
    let h = renderer.domElement.height;
    if (renderer.xr.isPresenting) {
      const layer = renderer.xr.getBaseLayer && renderer.xr.getBaseLayer();
      h = (layer && (layer.framebufferHeight || layer.textureHeight)) || 1600;
    }
    shared.uScale.value = h / 2;
    for (const e of this.emitters) e.update(dt, time);
    const t = this.lightTarget;
    if (t && t.intensity > 0.02) {
      this.light.position.set(t.pos.x, t.pos.y + 0.4, t.pos.z + 0.3);
      const flick = 0.75 + Math.sin(time * 17) * 0.12 + Math.sin(time * 7.3) * 0.13;
      this.light.intensity = 1.6 * Math.min(2.5, t.intensity) * flick;
    } else this.light.intensity = 0;
  }
}
