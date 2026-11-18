// Sons sintetizados com Web Audio (nenhum arquivo de áudio: funciona 100% offline).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.fireLevel = 0;
    this.alarmOn = false;
    this.alarmTimer = null;
    this.crackleTimer = null;
  }

  /** Precisa ser chamado a partir de um gesto do usuário (clique / entrar no VR). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        // buffer de ruído branco reaproveitado
        const len = this.ctx.sampleRate * 2;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('Áudio indisponível', e);
    }
  }

  get ok() {
    return !!this.ctx;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(1400, 0.05, 'square', 0.04);
  }
  good() {
    this.tone(660, 0.15, 'sine', 0.22);
    this.tone(990, 0.25, 'sine', 0.22, 0.12);
  }
  bad() {
    this.tone(200, 0.35, 'sawtooth', 0.12);
    this.tone(150, 0.45, 'sawtooth', 0.12, 0.15);
  }
  info() {
    this.tone(880, 0.12, 'triangle', 0.15);
  }

  /** Rajada de fogo (bola de fogo / porta aberta). */
  whoosh(strength = 1) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(150, t0);
    f.frequency.exponentialRampToValueAtTime(2500, t0 + 0.25);
    f.frequency.exponentialRampToValueAtTime(120, t0 + 1.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.6 * strength, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + 2);
  }

  /** Som contínuo de fogo. level 0 = desligado, 1 = normal, >1 = forte. */
  setFire(level) {
    this.fireLevel = level;
    if (!this.ok) return;
    if (!this.fireGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 0.6;
      this.fireGain = this.ctx.createGain();
      this.fireGain.gain.value = 0;
      src.connect(f).connect(this.fireGain).connect(this.master);
      src.start();
    }
    this.fireGain.gain.setTargetAtTime(Math.min(0.35, level * 0.12), this.ctx.currentTime, 0.4);
    if (level > 0 && !this.crackleTimer) {
      this.crackleTimer = setInterval(() => this._crackle(), 70);
    } else if (level <= 0 && this.crackleTimer) {
      clearInterval(this.crackleTimer);
      this.crackleTimer = null;
    }
  }

  _crackle() {
    if (!this.ok || this.fireLevel <= 0) return;
    if (Math.random() > 0.35 * Math.min(1.5, this.fireLevel)) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500 + Math.random() * 2500;
    const g = this.ctx.createGain();
    const v = (0.05 + Math.random() * 0.12) * Math.min(1.5, this.fireLevel);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03 + Math.random() * 0.05);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + 0.1);
  }

  /** Alarme de fumaça no padrão T3 (3 bipes + pausa). */
  setAlarm(on, volume = 0.05) {
    this.alarmVolume = volume;
    if (on === this.alarmOn) return;
    this.alarmOn = on;
    if (this.alarmTimer) {
      clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
    if (!on) return;
    const cycle = () => {
      if (!this.ok || !this.alarmOn) return;
      for (let i = 0; i < 3; i++) this._beep(i * 1.0, 0.5);
    };
    cycle();
    this.alarmTimer = setInterval(cycle, 4000);
  }

  _beep(delay, dur) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 3100;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(this.alarmVolume, t0 + 0.01);
    g.gain.setValueAtTime(this.alarmVolume, t0 + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** Tosse simples (ruído filtrado em pulsos) para quando a pessoa está na fumaça. */
  cough() {
    if (!this.ok) return;
    for (let i = 0; i < 2; i++) {
      const t0 = this.ctx.currentTime + i * 0.28;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 450;
      f.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0, Math.random());
      src.stop(t0 + 0.3);
    }
  }

  /** Chiado contínuo do extintor enquanto dispara. */
  setSpray(on) {
    if (!this.ok) return;
    if (!this.sprayGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1800;
      this.sprayGain = this.ctx.createGain();
      this.sprayGain.gain.value = 0;
      src.connect(f).connect(this.sprayGain).connect(this.master);
      src.start();
    }
    this.sprayGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05);
  }

  /** Descarga elétrica (curto-circuito / choque). */
  zap() {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t0);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 37;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    o.connect(g).connect(this.master);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 1);
    lfo.stop(t0 + 1);
    for (let i = 0; i < 6; i++) this.tone(2000 + Math.random() * 3000, 0.04, 'square', 0.08, Math.random() * 0.6);
  }

  /** Chuva contínua (0 = sem chuva, 1 = forte). */
  setRain(level) {
    if (!this.ok) return;
    if (!this.rainGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.master);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(Math.min(0.3, level * 0.16), this.ctx.currentTime, 0.8);
  }

  /** Ronco grave da terra se movendo (estalos / deslizamento). */
  rumble(strength = 1, seconds = 3) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 140;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.9 * strength, t0 + seconds * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + seconds + 0.1);
    // estalos
    for (let i = 0; i < 5 * strength; i++) this.tone(80 + Math.random() * 120, 0.12, 'square', 0.12 * strength, Math.random() * seconds * 0.7);
  }

  /** Sirene de alerta (sobe e desce). */
  setSiren(on, volume = 0.07) {
    if (!this.ok) return;
    if (on && !this.siren) {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.25;
      const lg = this.ctx.createGain();
      lg.gain.value = 350;
      lfo.connect(lg).connect(o.frequency);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(volume, t0 + 1);
      o.connect(f).connect(g).connect(this.master);
      o.start();
      lfo.start();
      this.siren = { o, lfo, g };
    } else if (!on && this.siren) {
      const { o, lfo, g } = this.siren;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      o.stop(this.ctx.currentTime + 1.5);
      lfo.stop(this.ctx.currentTime + 1.5);
      this.siren = null;
    } else if (on && this.siren) {
      this.siren.g.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.5);
    }
  }

  stopAll() {
    this.setAlarm(false);
    this.setFire(0);
    this.setSpray(false);
    this.setRain(0);
    this.setSiren(false);
  }
}
