// ============================================================
// PUSH NOTIFICATIONS — Subscribe, unsubscribe, check status
// ============================================================
import { supabase } from './shared';

const VAPID_PUBLIC_KEY = 'BM6NSI_J21_EkF9k3FovIUO5vOSufDLCRLxIyRm8bEjsFx21hPmmonvCCs_YZwvhrsPtKLQOGAJ6Fhoi1NTWIRE';

// Convert VAPID key from base64 to Uint8Array
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

// Check if push is supported
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

// Check if already subscribed
export const isSubscribed = async () => {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (e) {
    return false;
  }
};

// Get current permission status
export const getPermissionStatus = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default', 'granted', 'denied'
};

// Subscribe to push notifications
export const subscribeToPush = async (memberId) => {
  if (!isPushSupported()) throw new Error('Push not supported');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  const reg = await navigator.serviceWorker.ready;
  
  // Check for existing subscription
  let subscription = await reg.pushManager.getSubscription();
  
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();

  // Save to Supabase — upsert based on endpoint
  // First delete any existing subscriptions for this member (re-subscribe scenario)
  await supabase.from('push_subscriptions').delete().eq('member_id', memberId);
  
  await supabase.from('push_subscriptions').insert({
    member_id: memberId,
    subscription: subJson,
  });

  return subscription;
};

// Unsubscribe from push
export const unsubscribeFromPush = async (memberId) => {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    // Remove from database
    await supabase.from('push_subscriptions').delete().eq('member_id', memberId);
    return true;
  } catch (e) {
    console.error('Unsubscribe error:', e);
    return false;
  }
};

// Send a test notification (for admins)
export const sendTestNotification = async () => {
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification('Forge Fitness', {
    body: 'Push notifications are working!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
  });
};
