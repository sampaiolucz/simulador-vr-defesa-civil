// Service worker: guarda todos os arquivos no aparelho para funcionar sem internet.
// Ao adicionar arquivos novos, inclua-os na lista ARQUIVOS e aumente a VERSÃO.
const VERSAO = 'simulador-v4';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three.module.min.js',
  './js/main.js',
  './js/util.js',
  './js/audio.js',
  './js/ui.js',
  './js/effects.js',
  './js/world.js',
  './js/scenario-incendio.js',
  './js/scenes.js',
  './js/lobby.js',
  './js/logo.js',
  './js/results.js',
  './js/training-yard.js',
  './js/scenario-extintor.js',
  // img/logo-defesa-civil.png (logo oficial, opcional) é guardada automaticamente na 1ª visita
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (sempre pega a versão mais nova quando há internet) e, se não houver
// conexão — ou ela demorar mais de 3 s —, usa a cópia guardada no aparelho.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSAO);
      try {
        const res = await Promise.race([
          fetch(e.request, { cache: 'no-store' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
        ]);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })()
  );
});
