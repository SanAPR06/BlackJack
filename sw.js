/* Service worker: permite instalar el juego como app y abrirlo sin conexión.
   Estrategia: primero la red (así siempre llega la versión más reciente) y, si no hay conexión, la copia guardada.
   Cambia VERSION cuando agregues o quites archivos de la lista SHELL, para que los dispositivos renueven su copia. */
const VERSION='v3';
const CACHE = 'blackjack-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/datos.js', 'js/audio.js', 'js/musica.js', 'js/persistencia.js', 'js/premios.js',
  'js/interfaz.js', 'js/estrategia.js', 'js/pantallas.js', 'js/ronda.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match('index.html')))
  );
});
