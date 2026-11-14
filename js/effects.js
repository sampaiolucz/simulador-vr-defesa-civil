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
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.6) * (1.0 - vLife) * uOpacity;
  vec3 col = mix(vec3(1.0, 0.92, 0.55), vec3(1.0, 0.28, 0.03), smoothstep(0.0, 0.65, vLife));
  gl_FragColor = vec4(col, a);
}`;

const SMOKE_FRAG = /* glsl */ `
varying float vLife;
uniform float uOpacity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.3) * sin(vLife * 3.14159) * 0.5 * uOpacity;
  vec3 col = mix(vec3(0.16), vec3(0.3), vLife);
  gl_FragColor = vec4(col, a);
}`;

const shared = { uScale: { value: 500 } };

export class Emitter {
  constructor(kind, { pos, count = 60, radius = 0.15, height = 0.7, size = 0.22, lifespan = [0.5, 1.0], drift = null, wobble = 0.04 }) {
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
      uniforms: { uScale: shared.uScale, uOpacity: { value: 1 } },
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
    const e = new Emitter('fire', { pos, count: opts.count ?? 70, radius: opts.radius ?? 0.14, height: opts.height ?? 0.6, size: opts.size ?? 0.22, lifespan: [0.45, 0.95], wobble: 0.05 });
    this._add(e);
    if (opts.light) this.lightTarget = e;
    return e;
  }

  smoke(pos, opts = {}) {
    const e = new Emitter('smoke', { pos, count: opts.count ?? 40, radius: opts.radius ?? 0.2, height: opts.height ?? 1.2, size: opts.size ?? 0.45, lifespan: [2.2, 3.6], drift: opts.drift, wobble: 0.15 });
    this._add(e);
    return e;
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
