// sw.js (Service Worker)
// 🌟 캐시 버전을 v3.754로 올려 브라우저가 새로운 서비스 워커를 설치하도록 유도
const CACHE_NAME = 'sp3-offline-cache-v3.754';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // 이전 버전의 찌꺼기 캐시를 완벽하게 삭제
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

    // HTML 문서(새로고침)는 항상 최신 버전(네트워크)을 먼저 확인하도록 변경 (Network First 전략)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then(response => {
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
                return response;
            }).catch(() => {
                // 🌟 인터넷이 끊겼을 때 캐시에서 HTML 꺼내오기
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || new Response('오프라인 상태이며 저장된 페이지가 없습니다. 인터넷을 연결해주세요.', { 
                        status: 503, 
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
                    });
                });
            })
        );
        return;
    }

    // 🌟 JS, CSS 등 정적 자원도 항상 네트워크 우선 (Network First 전략)
    // 네트워크 연결 시 항상 최신 코드를 로드하여 F5 새로고침 시에도 최신 버전이 즉시 반영되며, 오프라인 시에만 캐시 사용
    event.respondWith(
        fetch(event.request).then(response => {
            if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
                const clonedResponse = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clonedResponse);
                });
            }
            return response;
        }).catch(() => {
            // 오프라인 또는 네트워크 장애 시 캐시에서 꺼내 반환
            return caches.match(event.request).then(cachedResponse => {
                return cachedResponse || new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});