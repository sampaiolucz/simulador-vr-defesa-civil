// Utilitários gerais: animações (tweens), controle de execução do cenário e matemática.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Ângulo (yaw) para olhar na direção (dx, dz). Yaw 0 = olhando para -Z. */
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

/** Gerenciador simples de animações por tempo. */
export class Tweens {
  constructor() {
    this.list = [];
  }
  add({ duration = 0.5, update, done, ease = easeInOut }) {
    const tw = { t: 0, duration, update, done, ease, dead: false };
    this.list.push(tw);
    return tw;
  }
  /** Versão que retorna Promise. */
  play(opts) {
    return new Promise((resolve) => {
      const userDone = opts.done;
      this.add({
        ...opts,
        done: () => {
          if (userDone) userDone();
          resolve();
        },
      });
    });
  }
  update(dt) {
    for (const tw of this.list) {
      if (tw.dead) continue;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      tw.update(tw.ease(tw.t));
      if (tw.t >= 1) {
        tw.dead = true;
        if (tw.done) tw.done();
      }
    }
    this.list = this.list.filter((t) => !t.dead);
  }
  clear() {
    this.list = [];
  }
}

export class Aborted extends Error {
  constructor() {
    super('cenário interrompido');
  }
}

/**
 * Representa uma execução do cenário. Ao reiniciar, a execução antiga é abortada:
 * todas as esperas pendentes são rejeitadas com Aborted e os ganchos são removidos.
 */
export class Run {
  constructor(frameHooks) {
    this.aborted = false;
    this.cancels = new Set();
    this.cleanups = [];
    this.frameHooks = frameHooks; // Set compartilhado com o loop principal
    this.myHooks = new Set();
  }
  check() {
    if (this.aborted) throw new Aborted();
  }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    for (const c of [...this.cancels]) c();
    this.cancels.clear();
    for (const h of this.myHooks) this.frameHooks.delete(h);
    this.myHooks.clear();
    for (const c of this.cleanups.reverse()) {
      try {
        c();
      } catch (e) {
        console.warn(e);
      }
    }
    this.cleanups = [];
  }
  /** Registra uma função de limpeza executada ao abortar. Retorna a própria função. */
  onCleanup(fn) {
    this.cleanups.push(fn);
    return fn;
  }
  /** Cria uma promessa cancelável. */
  promise(executor) {
    this.check();
    return new Promise((resolve, reject) => {
      let cancel = null;
      const finish = (fn) => (v) => {
        if (cancel) this.cancels.delete(cancel);
        fn(v);
      };
      const res = finish(resolve);
      const rej = finish(reject);
      cancel = () => {
        if (extra) extra();
        reject(new Aborted());
      };
      this.cancels.add(cancel);
      let extra = null;
      extra = executor(res, rej) || null;
    });
  }
  wait(seconds) {
    return this.promise((resolve) => {
      const id = setTimeout(resolve, seconds * 1000);
      return () => clearTimeout(id);
    });
  }
  deferred() {
    let resolve;
    const p = this.promise((r) => {
      resolve = r;
    });
    let done = false;
    return {
      promise: p,
      resolve: (v) => {
        if (done) return;
        done = true;
        resolve(v);
      },
      get done() {
        return done;
      },
    };
  }
  /** Executa fn(dt, t) a cada quadro até ser removido ou o cenário ser abortado. */
  onFrame(fn) {
    this.frameHooks.add(fn);
    this.myHooks.add(fn);
    return () => {
      this.frameHooks.delete(fn);
      this.myHooks.delete(fn);
    };
  }
}
