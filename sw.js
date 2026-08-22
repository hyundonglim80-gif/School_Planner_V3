// sw.js (Service Worker)
// 🌟 캐시 버전을 v5로 올려 브라우저가 새로운 서비스 워커를 설치하도록 유도
const CACHE_NAME = 'sp3-offline-cache-v5';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // 🌟 [핵심 수정 1] 이전 버전의 찌꺼기 캐시(v3, v4)를 완벽하게 삭제하여 F5 새로고침 문제 해결
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('구버전 캐시 삭제 완료:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // http나 https로 시작하는 정상적인 웹 요청만 처리
    if (!url.startsWith('http')) return;

    // 파이어베이스 DB 통신이나 구글 API는 가로채지 않고 패스!
    if (url.includes('firestore') || url.includes('googleapis') || url.includes('googleusercontent')) return;

    // 🌟 [핵심 수정 2] HTML 문서(새로고침)는 항상 최신 버전(네트워크)을 먼저 확인하도록 변경 (Network First 전략)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then(response => {
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            }).catch(() => {
                // 인터넷이 끊겼을 때(오프라인)만 캐시에서 HTML 꺼내오기
                return caches.match(event.request);
            })
        );
        return;
    }

    // 나머지 파일(JS, CSS, 이미지 등)은 속도를 위해 기존처럼 캐시 우선 (Cache First 전략)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            }).catch(() => {
                // 인터넷이 끊겼을 때 무시
            });
        })
    );
});