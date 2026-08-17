// sw.js (Service Worker)
const CACHE_NAME = 'sp3-offline-cache-v1';

// 설치 시 즉시 활성화
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// 화면이나 코드(JS, CSS)를 요청할 때 중간에서 가로채기
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 파이어베이스 DB 통신이나 구글 API는 가로채지 않고 패스! (순수 데이터이므로)
    if (url.includes('firestore') || url.includes('googleapis') || url.includes('googleusercontent')) {
        return;
    }

    // 인터넷이 연결되어 있으면 새 파일을 받아와서 캐시에 저장하고, 인터넷이 끊겼으면 저장된 캐시를 꺼내줍니다.
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 성공적으로 받아오면 복사본을 캐시에 저장
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            })
            .catch(() => {
                // 인터넷이 끊겼을 때 (오프라인)
                return caches.match(event.request);
            })
    );
});