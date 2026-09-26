const CACHE_NAME = 'forge-pro-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
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

  event.respondWith(
    fetch(event.request)
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
