// Service worker do CRM Prosystem (app instalado): recebe as notificações (Web Push),
// atualiza a bolinha com o número no ícone e abre a tela certa ao tocar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: 'CRM Prosystem', corpo: event.data ? event.data.text() : '' }; }
  const titulo = d.titulo || 'CRM Prosystem';
  const tarefas = [
    self.registration.showNotification(titulo, {
      body: d.corpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || '/whatsapp' },
    }),
  ];
  if (typeof d.badge === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    tarefas.push(d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tarefas).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/whatsapp';
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) { try { await c.navigate(url); } catch {} } return; }
    }
    await self.clients.openWindow(url);
  })());
});
