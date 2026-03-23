// ============================================================
// FORGE — CrossFit Gym Management PWA
// App Shell — Routes, Auth, Settings, Announcements, Messages
// ============================================================
import { useState, useEffect, useCallback, useContext } from "react";
import {
  GYM_CONFIG, THEME, S, I, services, supabase,
  AuthContext, SettingsContext, AnnouncementContext,
  applyGymSettings, globalCSS, membersCache, setMembersCache,
  calcStreak, streakCache, setStreakCache,
} from "./config/shared";

import LoginScreen from "./screens/login";
import SignupScreen from "./screens/signup";
import DashboardScreen from "./screens/dashboard";
import ScheduleScreen from "./screens/schedule";
import ProfileScreen from "./screens/profile";
import RecordsScreen from "./screens/records";
import CommunityScreen from "./screens/community";
import AdminScreen from "./screens/admin";
import MessagesScreen from "./screens/messages";

// Chat Icon
const ChatIcon = ({ size = 20, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

// ============================================================
// TAB BAR
// ============================================================
const TabBar = ({ active, setActive, isStaff }) => {
  const tabs = [
    { id: "home", l: "Home", ic: I.home },
    { id: "schedule", l: "Schedule", ic: I.cal },
    { id: "records", l: "Records", ic: I.trophy },
    { id: "community", l: "Feed", ic: I.activity },
    { id: "profile", l: "Profile", ic: I.user },
  ];
  if (isStaff) tabs.push({ id: "admin", l: "Admin", ic: I.users });
  return (
    <div style={S.tabBar}>
      {tabs.map(t => { const on = active === t.id; const Ic = t.ic; return (
        <button key={t.id} style={S.tabBtn} onClick={() => setActive(t.id)}>
          <Ic size={on ? 24 : 20} color={on ? THEME.colors.primary : THEME.colors.textMuted} />
          <span style={{ ...S.tabLbl, color: on ? THEME.colors.primary : THEME.colors.textMuted, fontWeight: on ? "700" : "400" }}>{t.l}</span>
          {on && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: THEME.colors.primary, marginTop: "1px" }} />}
        </button>
      ); })}
    </div>
  );
};

// ============================================================
// MAIN APP SHELL
// ============================================================
const MainApp = () => {
  const { user, logout } = useContext(AuthContext);
  const settingsCtx = useContext(SettingsContext);
  const [tab, setTab] = useState("home");
  const [showMessages, setShowMessages] = useState(false);
  const [, forceUpdate] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isStaff = user.role === "admin" || user.role === "coach";

  const screens = {
    home: DashboardScreen, schedule: ScheduleScreen, records: RecordsScreen,
    community: CommunityScreen, profile: ProfileScreen, admin: AdminScreen,
  };
  const Sc = screens[tab] || DashboardScreen;

  const loadAnnouncements = useCallback(async () => {
    const active = await services.announcements.getActive();
    setAnnouncements(active);
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data: convos } = await supabase.from('conversations').select('id').or(`member_id.eq.${user.id},coach_id.eq.${user.id}`);
      if (!convos || convos.length === 0) { setUnreadCount(0); return; }
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).in('conversation_id', convos.map(c => c.id)).neq('sender_id', user.id).is('read_at', null);
      setUnreadCount(count || 0);
    } catch (e) { setUnreadCount(0); }
  }, [user.id]);

  useEffect(() => { forceUpdate(v => v + 1); }, [settingsCtx.version]);
  useEffect(() => { loadAnnouncements(); loadUnreadCount(); }, [loadAnnouncements, loadUnreadCount]);

  // Realtime unread badge
  useEffect(() => {
    const channel = supabase.channel('unread-badge').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { loadUnreadCount(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadUnreadCount]);

  if (showMessages) {
    return (
      <AnnouncementContext.Provider value={{ announcements, reload: loadAnnouncements }}>
        <MessagesScreen onBack={() => { setShowMessages(false); loadUnreadCount(); }} />
        <TabBar active={tab} setActive={(t) => { setShowMessages(false); setTab(t); }} isStaff={isStaff} />
      </AnnouncementContext.Provider>
    );
  }

  return (
    <AnnouncementContext.Provider value={{ announcements, reload: loadAnnouncements }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `14px ${THEME.spacing.md} 0`, position: "sticky", top: 0, zIndex: 50, background: THEME.colors.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {GYM_CONFIG.logoUrl ? (
            <img src={GYM_CONFIG.logoUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "contain" }} />
          ) : (
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontFamily: THEME.fonts.display, color: THEME.colors.white, fontWeight: "700" }}>{GYM_CONFIG.shortName.charAt(0)}</div>
          )}
          <span style={{ fontFamily: THEME.fonts.display, fontSize: "16px", color: THEME.colors.primary, letterSpacing: "3px" }}>{GYM_CONFIG.shortName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={() => setShowMessages(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", position: "relative" }}>
            <ChatIcon size={20} color={THEME.colors.textMuted} />
            {unreadCount > 0 && (
              <div style={{ position: "absolute", top: "2px", right: "2px", minWidth: "16px", height: "16px", borderRadius: "8px", background: THEME.colors.error, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.fonts.display, fontSize: "9px", color: THEME.colors.white, padding: "0 4px", border: `2px solid ${THEME.colors.bg}` }}>{unreadCount > 9 ? "9+" : unreadCount}</div>
            )}
          </button>
          <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}><I.out size={18} color={THEME.colors.textMuted} /></button>
        </div>
      </div>
      <Sc />
      <TabBar active={tab} setActive={setTab} isStaff={isStaff} />
    </AnnouncementContext.Provider>
  );
};

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [loading, setLoading] = useState(true);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const login = useCallback((u) => setUser(u), []);
  const logout = useCallback(async () => { await services.auth.logout(); setUser(null); setView("login"); }, []);

  const loadGymSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from("gym_settings").select("*").eq("gym_id", GYM_CONFIG.id).single();
      if (data) applyGymSettings({ name: data.name, shortName: data.short_name, primaryColor: data.primary_color, logoUrl: data.logo_url });
    } catch (e) { /* defaults */ }
  }, []);

  const refreshSettings = useCallback(() => { loadGymSettings().then(() => setSettingsVersion(v => v + 1)); }, [loadGymSettings]);

  useEffect(() => {
    (async () => {
      await loadGymSettings();
      try {
        const member = await services.auth.getSession();
        if (member) {
          setUser(member);
          const allMembers = await services.members.getAll();
          setMembersCache(allMembers);
          const allSessions = await services.sessions.getAll();
          allMembers.forEach(m => { setStreakCache(m.id, calcStreak(allSessions, m.id)); });
        }
      } catch (e) { console.log("No existing session"); }
      setLoading(false);
    })();
  }, [loadGymSettings]);

  if (loading) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');*{margin:0;padding:0;box-sizing:border-box;}body{background:#000;}`}</style>
        <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ textAlign: "center" }}>
            <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
            <div style={{ fontFamily: THEME.fonts.display, fontSize: "24px", color: THEME.colors.text, letterSpacing: "3px", marginTop: "16px" }}>{GYM_CONFIG.shortName}</div>
            <div style={{ color: THEME.colors.textMuted, fontSize: "13px", marginTop: "8px" }}>Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <SettingsContext.Provider value={{ refresh: refreshSettings, version: settingsVersion }}>
      <style>{globalCSS(THEME)}</style>
      <div style={S.app}>
        <AuthContext.Provider value={{ user, login, logout }}>
          {!user ? (view === "login" ? <LoginScreen onSwitch={() => setView("signup")} onLogin={login} /> : <SignupScreen onSwitch={() => setView("login")} onLogin={login} />) : <MainApp />}
        </AuthContext.Provider>
      </div>
    </SettingsContext.Provider>
  );
}
