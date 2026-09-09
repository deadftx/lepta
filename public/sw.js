// Lepta System - Service Worker de Notificações Web Push (PC e Mobile)
// Permite recepção de notificações mesmo com o site fechado ou em segundo plano

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener de Fetch para conformidade com critérios PWA e instalabilidade (Chrome, Edge, Samsung Internet, Safari)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Listener de eventos de Push vindos do servidor via VAPID
self.addEventListener('push', (event) => {
  let data = {
    title: 'Lepta Capital',
    body: 'Você recebeu uma nova notificação no sistema.',
    icon: '/logo2.png',
    badge: '/logo2.png',
    link: '/dashboard',
    tipo: 'GERAL',
    tag: `lepta-notif-${Date.now()}`
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  const title = data.title || 'Lepta Capital';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo2.png',
    badge: data.badge || '/logo2.png',
    tag: data.tag || `lepta-${Date.now()}`,
    vibrate: [250, 100, 250, 100, 250],
    renotify: true,
    requireInteraction: false,
    data: {
      link: data.link || '/dashboard',
      tipo: data.tipo || 'GERAL',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Abrir no Sistema' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener de clique na notificação nativa (Windows Action Center e Mobile)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetLink = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Se já houver uma aba aberta do sistema, navega e foca nela
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetLink);
            return client.focus();
          }
        }
      }
      // 2. Se não houver aba aberta, abre uma nova janela com a rota da notificação
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetLink);
      }
    })
  );
});
