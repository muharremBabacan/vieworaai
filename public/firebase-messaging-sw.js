// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/9.1.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.1.1/firebase-messaging-compat.js");

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Initialize Firebase with your actual config from .env.local 
// Note: In production, these should be securely injected.
firebase.initializeApp({
  apiKey: "AIzaSyCIyLeBksCYIYDkUdq522hlMnvSKBq3VZw", // Same as in .env.local
  projectId: "studio-8632782825-fce99",
  messagingSenderId: "1093513393552",
  appId: "1:1093513393552:web:73dcc66ac9684e5237ef15"
});

const messaging = firebase.messaging();

// 1. Background Notification Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background Message Received:', payload);
  
  const notificationTitle = payload.notification.title || 'Viewora AI';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: payload.data?.url || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification Clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If the site is already open, focus it and redirect
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
