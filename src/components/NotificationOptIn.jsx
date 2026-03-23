import { useState, useEffect } from 'react';
import { THEME, S, I, useAuth } from '../config/shared';
import { isPushSupported, isSubscribed, getPermissionStatus, subscribeToPush, unsubscribeFromPush, sendTestNotification } from '../config/push';

// Notification opt-in banner — shows on Dashboard if not subscribed
export const NotificationOptIn = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | show | subscribed | denied | unsupported | dismissed
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isPushSupported()) { setStatus('unsupported'); return; }
      if (getPermissionStatus() === 'denied') { setStatus('denied'); return; }

      const subbed = await isSubscribed();
      if (subbed) { setStatus('subscribed'); return; }

      // Check if user has dismissed the banner before (localStorage)
      const dismissed = localStorage.getItem('push-dismissed');
      if (dismissed) { setStatus('dismissed'); return; }

      setStatus('show');
    })();
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await subscribeToPush(user.id);
      setStatus('subscribed');
    } catch (e) {
      if (e.message === 'Permission denied') setStatus('denied');
      else console.error('Push subscribe error:', e);
    }
    setSubscribing(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('push-dismissed', 'true');
    setStatus('dismissed');
  };

  if (status !== 'show') return null;

  return (
    <div style={{
      background: THEME.colors.primarySubtle,
      border: `1px solid ${THEME.colors.primary}44`,
      borderRadius: THEME.radius.lg, padding: THEME.spacing.md,
      marginBottom: THEME.spacing.md,
      display: "flex", alignItems: "flex-start", gap: THEME.spacing.sm,
    }}>
      <span style={{ fontSize: "24px", flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: THEME.fonts.display, fontSize: "15px", letterSpacing: "0.5px", marginBottom: "4px" }}>
          Enable Notifications
        </div>
        <div style={{ fontSize: "13px", color: THEME.colors.textSecondary, lineHeight: "1.4", marginBottom: THEME.spacing.sm }}>
          Get reminded 30 minutes before your classes, see when coaches post new WODs, and receive high fives from teammates.
        </div>
        <div style={{ display: "flex", gap: THEME.spacing.sm }}>
          <button onClick={handleSubscribe} disabled={subscribing} style={{
            padding: "8px 16px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${THEME.colors.primary}, ${THEME.colors.primaryDark})`,
            color: THEME.colors.white, fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
            opacity: subscribing ? 0.5 : 1,
          }}>
            {subscribing ? "Enabling..." : "Enable"}
          </button>
          <button onClick={handleDismiss} style={{
            padding: "8px 16px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
            background: "transparent", color: THEME.colors.textMuted,
            fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
          }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

// Notification toggle for Profile/Settings — shows current status with toggle
export const NotificationToggle = () => {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    isSubscribed().then(s => { setSubscribed(s); setLoading(false); });
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    if (subscribed) {
      await unsubscribeFromPush(user.id);
      setSubscribed(false);
    } else {
      try {
        await subscribeToPush(user.id);
        setSubscribed(true);
      } catch (e) {
        console.error('Toggle error:', e);
      }
    }
    setToggling(false);
  };

  const handleTest = async () => {
    await sendTestNotification();
  };

  if (!supported) {
    return (
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: THEME.spacing.sm }}>
        <span style={{ fontSize: "18px" }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "600", fontSize: "14px" }}>Push Notifications</div>
          <div style={{ fontSize: "12px", color: THEME.colors.textMuted, marginTop: "2px" }}>
            Not supported on this device. Add the app to your home screen first.
          </div>
        </div>
      </div>
    );
  }

  if (getPermissionStatus() === 'denied') {
    return (
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: THEME.spacing.sm }}>
        <span style={{ fontSize: "18px" }}>🔕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "600", fontSize: "14px" }}>Push Notifications</div>
          <div style={{ fontSize: "12px", color: THEME.colors.error, marginTop: "2px" }}>
            Notifications blocked. Enable them in your browser/device settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: THEME.spacing.sm }}>
      <span style={{ fontSize: "18px" }}>{subscribed ? "🔔" : "🔕"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "600", fontSize: "14px" }}>Push Notifications</div>
        <div style={{ fontSize: "12px", color: THEME.colors.textMuted, marginTop: "2px" }}>
          {subscribed ? "You'll receive class reminders and updates" : "Enable to get class reminders"}
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {subscribed && (
          <button onClick={handleTest} style={{
            padding: "6px 10px", borderRadius: THEME.radius.sm, border: "none", cursor: "pointer",
            background: THEME.colors.surfaceLight, color: THEME.colors.textMuted,
            fontSize: "10px", fontFamily: THEME.fonts.display, letterSpacing: "1px",
          }}>Test</button>
        )}
        <button onClick={handleToggle} disabled={loading || toggling} style={{
          width: "48px", height: "28px", borderRadius: "14px", border: "none", cursor: "pointer",
          background: subscribed ? THEME.colors.primary : THEME.colors.surfaceLight,
          position: "relative", transition: "background 0.2s",
          opacity: (loading || toggling) ? 0.5 : 1,
        }}>
          <div style={{
            width: "22px", height: "22px", borderRadius: "11px",
            background: THEME.colors.white, position: "absolute", top: "3px",
            left: subscribed ? "23px" : "3px", transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </button>
      </div>
    </div>
  );
};
