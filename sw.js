const CACHE_NAME = 'forge-pro-cache-v16';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './js/forge-plan.js',
  './css/app.css',
  './js/firebase.js',
  './js/app/core.js',
  './js/app/plans.js',
  './js/app/storage.js',
  './js/app/home.js',
  './js/app/session.js',
  './js/app/stats.js',
  './js/app/sheets.js',
  './js/app/editor.js',
  './js/app/history.js',
  './js/app/wiki.js',
  './js/app/ui.js',
  './js/app/main.js',
  './manifest.json',
  './favicon.ico',
  './favicon-16.png',
  './favicon-32.png',
  './logo-120.png',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700;800&display=swap'
];

function canCacheResponse(response){
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
}

// Instalacja i zapisanie aplikacji w pamięci offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Aktywacja i czyszczenie starych wersji
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Strategia: Sieć najpierw, w razie braku zasięgu serwuj z pamięci podręcznej (offline)
self.addEventListener('fetch', (event) => {
  // Ignoruj zapytania do bazy danych Firestore / Google Auth (one mają własny mechanizm offline)
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit') ||
    event.request.url.includes('sheets.googleapis.com') ||
    event.request.url.includes('accounts.google.com')
  ) {
    return;
  }

  // Pliki aplikacji pobieramy z pominięciem cache przeglądarki (z rewalidacją),
  // żeby po wdrożeniu nowa wersja była widoczna od razu na każdym urządzeniu.
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  const networkFetch = sameOrigin
    ? fetch(event.request, { cache: 'no-cache' })
    : fetch(event.request);

  event.respondWith(
    networkFetch
      .then((response) => {
        // Kopiuj świeżą wersję do cache
        if (canCacheResponse(response)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Brak internetu – zwróć wersję z pamięci podręcznej
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        });
      })
  );
});
