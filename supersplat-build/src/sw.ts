import { version as appVersion } from '../package.json';

// export default null
declare let self: ServiceWorkerGlobalScope;

const cacheName = `superSplat-v${appVersion}`;

const cacheUrls = [
    './',
    './index.css',
    './index.html',
    './index.js',
    './index.js.map',
    './jszip.js',
    './manifest.json',
    './static/icons/logo-192.png',
    './static/icons/logo-512.png',
    './static/images/screenshot-narrow.jpg',
    './static/images/screenshot-wide.jpg',
    './static/lib/lodepng/lodepng.js',
    './static/lib/lodepng/lodepng.wasm'
];

self.addEventListener('install', (event) => {
    console.log(`installing v${appVersion}`);

    // create cache for current version
    event.waitUntil(
        caches.open(cacheName)
        .then((cache) => {
            // Use Promise.allSettled to handle individual failures gracefully
            return Promise.allSettled(
                cacheUrls.map(url => cache.add(url))
            ).then(results => {
                // Log any failed requests for debugging
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.warn(`Failed to cache: ${cacheUrls[index]}`, result.reason);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Service worker install failed:', error);
        })
    );
});

self.addEventListener('activate', () => {
    console.log(`activating v${appVersion}`);

    // delete the old caches once this one is activated
    caches.keys().then((names) => {
        for (const name of names) {
            if (name !== cacheName) {
                caches.delete(name);
            }
        }
    });
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response ?? fetch(event.request))
    );
});
