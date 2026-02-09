'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export default function NotificationButton() {
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const vapidKeyRef = useRef(null);

  useEffect(() => {
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = hasSW && 'PushManager' in window && 'Notification' in window;

    if (hasPush) {
      setPermission(Notification.permission);
      // Charger la clé VAPID depuis l'API
      fetch('/api/push/vapid-key')
        .then(res => res.json())
        .then(data => {
          if (data.publicKey) {
            vapidKeyRef.current = data.publicKey;
            setPushSupported(true);
            checkSubscription();
          }
        })
        .catch(() => {});
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setSubscribed(!!subscription);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleClick = () => {
    if (!pushSupported) {
      if (isIOS() && !isStandalone()) {
        toast((t) => (
          <div>
            <p className="font-semibold mb-1">Installer l'application</p>
            <p className="text-sm">Pour recevoir les notifications sur iPhone :</p>
            <ol className="text-sm mt-1 ml-4 list-decimal">
              <li>Appuyez sur le bouton <strong>Partager</strong></li>
              <li>Choisissez <strong>"Sur l'écran d'accueil"</strong></li>
              <li>Ouvrez l'app depuis l'écran d'accueil</li>
            </ol>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="mt-2 text-xs text-blue-600 font-medium"
            >
              Compris
            </button>
          </div>
        ), { duration: 10000 });
      } else {
        toast.error('Les notifications ne sont pas encore disponibles. Essayez de recharger la page ou d\'utiliser Chrome.');
      }
      return;
    }

    if (subscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Notifications refusées. Activez-les dans les paramètres de votre navigateur.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKeyRef.current)
      });

      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSubscribed(true);
      toast.success('Notifications activées !');
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error('Erreur lors de l\'activation des notifications');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();

          await fetch('/api/push', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint })
          });
        }
      }
      setSubscribed(false);
      toast.success('Notifications désactivées');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Erreur lors de la désactivation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`p-2 rounded-lg transition relative ${
        subscribed
          ? 'text-blue-600 hover:bg-blue-50'
          : pushSupported
            ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
      }`}
      title={
        subscribed
          ? 'Notifications activées - Cliquer pour désactiver'
          : pushSupported
            ? 'Activer les notifications'
            : 'Installer l\'app pour les notifications'
      }
    >
      {loading ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      ) : (
        <>
          <svg className="w-5 h-5" fill={subscribed ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {!subscribed && pushSupported && permission === 'default' && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
          )}
          {!pushSupported && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white"></span>
          )}
        </>
      )}
    </button>
  );
}
