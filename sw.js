// sw.js (Service Worker)
const CACHE_NAME = 'sp3-offline-cache-v3';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 🌟 [수정 1] http나 https로 시작하는 정상적인 웹 요청만 처리 (크롬 익스텐션 에러 원천 차단)
    if (!url.startsWith('http')) {
        return;
    }

    // 파이어베이스 DB 통신이나 구글 API는 가로채지 않고 패스!
    if (url.includes('firestore') || url.includes('googleapis') || url.includes('googleusercontent')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(response => {
                // 🌟 [수정 2] 정상적인 응답(200 OK)이 올 때만 캐시에 저장
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            }).catch(() => {
                // 인터넷이 끊겼을 때 캐시된 응답이 없다면 무시
            });
        })
    );
});
