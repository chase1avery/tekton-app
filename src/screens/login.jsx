import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';

const LoginScreen = ({ onSwitch, onLogin }) => {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => { setErr(""); setBusy(true); try { onLogin(await services.auth.login(email, pw)); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <div style={S.authWrap}>
      <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
      <div style={S.gymTitle}>{GYM_CONFIG.shortName}</div>
      <div style={S.gymSub}>{GYM_CONFIG.tagline} {GYM_CONFIG.subtitle}</div>
      <div style={S.inpGrp}><label style={S.lbl}>Email</label><input style={S.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
      <div style={S.inpGrp}><label style={S.lbl}>Password</label><input style={S.inp} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
      {err&&<div style={S.err}>{err}</div>}
      <button style={{...S.btn1,opacity:busy?0.6:1}} onClick={go} disabled={busy}>{busy?"Signing In...":"Sign In"}</button>
      <button style={S.btn2} onClick={onSwitch}>Create Account</button>
      <div style={{textAlign:"center",marginTop:THEME.spacing.lg,color:THEME.colors.textMuted,fontSize:"12px"}}>{GYM_CONFIG.name} · {GYM_CONFIG.location}</div>
    </div>
  );
};

export default LoginScreen;
