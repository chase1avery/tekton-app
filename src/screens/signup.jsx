import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';

const SignupScreen = ({ onSwitch, onLogin }) => {
  const [f, sF] = useState({firstName:"",lastName:"",email:"",password:"",confirmPassword:""});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const u = (k,v) => sF(o=>({...o,[k]:v}));
  const go = async () => {
    setErr("");
    if(!f.firstName||!f.lastName||!f.email||!f.password) return setErr("All fields required");
    if(f.password!==f.confirmPassword) return setErr("Passwords don't match");
    if(f.password.length<6) return setErr("Min 6 characters");
    setBusy(true); try { onLogin(await services.auth.signup(f)); } catch(e) { setErr(e.message); } setBusy(false);
  };
  const fields=[{k:"firstName",l:"First Name",t:"text",p:"John"},{k:"lastName",l:"Last Name",t:"text",p:"Doe"},{k:"email",l:"Email",t:"email",p:"your@email.com"},{k:"password",l:"Password",t:"password",p:"••••••••"},{k:"confirmPassword",l:"Confirm",t:"password",p:"••••••••"}];
  return (
    <div style={S.authWrap}>
      <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
      <div style={S.gymTitle}>{GYM_CONFIG.shortName}</div>
      <div style={{...S.gymSub,marginBottom:THEME.spacing.xl}}>Create your account</div>
      {fields.map(x=><div key={x.k} style={S.inpGrp}><label style={S.lbl}>{x.l}</label><input style={S.inp} type={x.t} value={f[x.k]} onChange={e=>u(x.k,e.target.value)} placeholder={x.p} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>)}
      {err&&<div style={S.err}>{err}</div>}
      <button style={{...S.btn1,opacity:busy?0.6:1}} onClick={go} disabled={busy}>{busy?"Creating...":"Create Account"}</button>
      <div style={{textAlign:"center",marginTop:THEME.spacing.lg}}><span style={{color:THEME.colors.textMuted,fontSize:"14px"}}>Already a member? </span><button style={S.lnk} onClick={onSwitch}>Sign In</button></div>
    </div>
  );
};

export default SignupScreen;
