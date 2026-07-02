// Import and configure the Firebase SDK (Compat version for Service Workers)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDZGtN7ACxYFrQJYvuB_xazbcnv7bg6InA",
  authDomain: "move-on-data.firebaseapp.com",
  projectId: "move-on-data",
  storageBucket: "move-on-data.firebasestorage.app",
  messagingSenderId: "529534749232",
  appId: "1:529534749232:web:cc90c3c11627cde6c2bbf5",
  measurementId: "G-CERYX601WB"
};

// Initialize Firebase App in service worker context
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || 'New Operation Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'A new task has been deployed in your workspace.',
    icon: '/logo.png',
    badge: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
