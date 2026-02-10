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

function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export default function NotificationButton() {
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [unsupportedReason, setUnsupportedReason] = useState('');
  const vapidKeyRef = useRef(null);

  useEffect(() => {
    initPush();
  }, []);

  const initPush = async () => {
    // Vérifier le support du navigateur
    if (!('serviceWorker' in navigator)) {
      setUnsupportedReason('Service Worker non supporté');
      return;
    }
    if (!('PushManager' in window)) {
      // Sur iOS hors PWA, PushManager n'est pas disponible
      if (isIOS() && !isStandalone()) {
        setUnsupportedReason('ios-not-installed');
      } else if (isIOS() && isStandalone()) {
        // iOS en mode standalone mais PushManager absent = iOS < 16.4
        setUnsupportedReason('ios-too-old');
      } else {
        setUnsupportedReason('PushManager non supporté par ce navigateur');
      }
      return;
    }
    if (!('Notification' in window)) {
      setUnsupportedReason('Notifications non supportées');
      return;
    }

    setPermission(Notification.permission);

    // Pré-enregistrer le service worker pour qu'il soit prêt
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn('SW registration failed:', err);
    }

    // Charger la clé VAPID depuis l'API
    try {
      const res = await fetch('/api/push/vapid-key');
      const data = await res.json();
      if (data.publicKey) {
        vapidKeyRef.current = data.publicKey;
        setPushSupported(true);
        checkSubscription();
      } else {
        setUnsupportedReason('Clé VAPID non configurée sur le serveur');
      }
    } catch (err) {
      setUnsupportedReason('Impossible de contacter le serveur');
    }
  };

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
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
      if (unsupportedReason === 'ios-not-installed') {
        toast((t) => (
          <div>
            <p className="font-semibold mb-1">Installer l&apos;application</p>
            <p className="text-sm">Pour recevoir les notifications sur iPhone/iPad :</p>
            <ol className="text-sm mt-1 ml-4 list-decimal">
              <li>Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche)</li>
              <li>Faites défiler et choisissez <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong></li>
              <li>Appuyez sur <strong>Ajouter</strong></li>
              <li>Ouvrez l&apos;app depuis votre écran d&apos;accueil</li>
              <li>Cliquez à nouveau sur la cloche</li>
            </ol>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="mt-2 text-xs text-blue-600 font-medium"
            >
              Compris
            </button>
          </div>
        ), { duration: 15000 });
      } else if (unsupportedReason === 'ios-too-old') {
        toast.error('Votre version d\'iOS ne supporte pas les notifications. Mettez à jour vers iOS 16.4 ou plus récent.', { duration: 6000 });
      } else if (isAndroid() && !isStandalone()) {
        // Sur Android hors PWA, proposer d'installer
        toast((t) => (
          <div>
            <p className="font-semibold mb-1">Installer l&apos;application</p>
            <p className="text-sm">Pour de meilleures notifications sur Android :</p>
            <ol className="text-sm mt-1 ml-4 list-decimal">
              <li>Appuyez sur le menu <strong>⋮</strong> (3 points)</li>
              <li>Choisissez <strong>&quot;Installer l&apos;application&quot;</strong> ou <strong>&quot;Ajouter à l&apos;écran d&apos;accueil&quot;</strong></li>
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
        // Réessayer une fois avant d'afficher l'erreur
        initPush().then(() => {
          if (!vapidKeyRef.current) {
            toast.error(`Notifications non disponibles : ${unsupportedReason || 'navigateur incompatible'}. Essayez avec Chrome ou Safari.`, { duration: 5000 });
          } else {
            subscribe();
          }
        });
        return;
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
      // Vérifier si les permissions ont déjà été refusées
      if (Notification.permission === 'denied') {
        if (isIOS()) {
          toast((t) => (
            <div>
              <p className="font-semibold mb-1">Notifications bloquées</p>
              <p className="text-sm">Pour les réactiver :</p>
              <ol className="text-sm mt-1 ml-4 list-decimal">
                <li>Allez dans <strong>Réglages</strong> &gt; <strong>Notifications</strong></li>
                <li>Trouvez <strong>Portail Agent</strong></li>
                <li>Activez <strong>Autoriser les notifications</strong></li>
              </ol>
              <button onClick={() => toast.dismiss(t.id)} className="mt-2 text-xs text-blue-600 font-medium">Compris</button>
            </div>
          ), { duration: 10000 });
        } else {
          toast((t) => (
            <div>
              <p className="font-semibold mb-1">Notifications bloquées</p>
              <p className="text-sm">Pour les réactiver :</p>
              <ol className="text-sm mt-1 ml-4 list-decimal">
                <li>Appuyez sur le <strong>cadenas</strong> (ou icône) dans la barre d&apos;adresse</li>
                <li>Changez <strong>Notifications</strong> en <strong>Autoriser</strong></li>
                <li>Rechargez la page</li>
              </ol>
              <button onClick={() => toast.dismiss(t.id)} className="mt-2 text-xs text-blue-600 font-medium">Compris</button>
            </div>
          ), { duration: 10000 });
        }
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Notifications refusées. Activez-les dans les paramètres de votre navigateur.', { duration: 5000 });
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
      if (error.name === 'NotAllowedError') {
        toast.error('Les notifications ont été bloquées. Vérifiez les paramètres de votre navigateur.', { duration: 5000 });
      } else {
        toast.error('Erreur : ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
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
            : unsupportedReason === 'ios-not-installed'
              ? 'Installer l\'app pour activer les notifications'
              : unsupportedReason === 'ios-too-old'
                ? 'Mettez à jour iOS pour les notifications'
                : 'Notifications non disponibles'
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
