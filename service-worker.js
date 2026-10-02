const cacheName = "vitoria-regia-static-v1";
const staticAssets = [
  "/styles.css",
  "/login.js",
  "/install.js",
  "/brand-mark.svg",
  "/manifest.webmanifest",
  "/icons/app-192.png",
  "/icons/app-512.png",
  "/icons/app-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(staticAssets)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("vitoria-regia-") && key !== cacheName).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.mode === "navigate") return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});