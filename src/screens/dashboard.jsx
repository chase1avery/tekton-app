import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';
import { NotificationOptIn } from '../components/NotificationOptIn';

const DashboardScreen = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [wod, setWod] = useState(null);
  const [results, setResults] = useState([]);
  const [myPrs, setMyPrs] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]);
  useEffect(() => { (async () => {
    const td = today();
    const [allMembers, allSessions, wods, allResults, myPrsData] = await Promise.all([
      services.members.getAll(),
      services.sessions.getAll(),
      services.workouts.getAll(),
      services.results.getAll(),
      services.prs.getByField("memberId", user.id),
    ]);
    setMembersCache(allMembers);
    // Calculate streaks for all members
    allMembers.forEach(m => { setStreakCache(m.id, calcStreak(allSessions, m.id)); });
    setSessions(allSessions.filter(s => s.date === td));
    setAllWorkouts(wods);
    setWod(wods.find(w => w.date.startsWith(td)) || null);
    setResults(allResults.slice(0, 4));
    setMyPrs(myPrsData.slice(0, 3));
  })(); }, [user.id]);
  const greet = () => { const h=new Date().getHours(); return h<12?"Morning":h<17?"Afternoon":"Evening"; };
  const mName = (id) => { const m=membersCache.find(x=>x.id===id); return m?`${m.firstName} ${m.lastName.charAt(0)}.`:"?"; };
  const coach = (id) => { const m=membersCache.find(x=>x.id===id); return m?m.firstName:"Coach"; };
  return (
    <div style={S.screen}>
      <div style={{marginBottom:THEME.spacing.xl}}>
        <div style={{color:THEME.colors.textMuted,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"3px"}}>Good {greet()}</div>
        <div style={S.greeting}>{user.firstName}</div>
        <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginTop:"6px"}}>
          <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary}}>{user.role}</div>
          <span style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{GYM_CONFIG.name}</span>
        </div>
      </div>
      <AnnouncementBanner />
      <NotificationOptIn />
      <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
        <div style={S.statBox}><div style={S.statVal}>{sessions.reduce((a,s)=>a+(s.signups.includes(user.id)?1:0),0)}</div><div style={S.statLbl}>Classes Today</div></div>
        <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.accent}}>{myPrs.length}</div><div style={S.statLbl}>Recent PRs</div></div>
        <div style={S.statBox}>
          {getStreak(user.id).current > 0 ? (
            <div style={{display:"flex",justifyContent:"center"}}><FlameStreak count={getStreak(user.id).current} size="md" /></div>
          ) : (
            <div style={{...S.statVal,color:THEME.colors.textMuted}}>0</div>
          )}
          <div style={S.statLbl}>Streak</div>
        </div>
      </div>
      {wod&&<div style={{...S.card,borderLeft:`3px solid ${THEME.colors.primary}`}}>
        <div style={S.cardLbl}>Today's WOD</div>
        <div style={{fontFamily:THEME.fonts.display,fontSize:"26px",marginBottom:"2px"}}>{wod.title}</div>
        <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,marginBottom:THEME.spacing.sm}}>{wod.type}{wod.timeCap?` · ${wod.timeCap} min cap`:""}</div>
        <div style={{color:THEME.colors.textSecondary,fontSize:"14px",marginBottom:THEME.spacing.sm}}>{wod.description}</div>

        {/* Warmup */}
        {wod.warmup&&<div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.warning,marginBottom:"4px"}}>🔥 Warmup</div>
          <div style={{fontSize:"13px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{wod.warmup}</div>
        </div>}

        {/* Strength */}
        {wod.strength&&<div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.accent,marginBottom:"4px"}}>🏋️ Strength</div>
          <div style={{fontSize:"13px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{wod.strength}</div>
        </div>}

        {/* WOD Movements */}
        {wod.movements.length>0&&<div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.primary,marginBottom:"4px"}}>⏱️ WOD</div>
          {wod.movements.map((m,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontWeight:"600",fontSize:"14px"}}>{m.name}</span><span style={{color:THEME.colors.textSecondary,fontSize:"14px",fontFamily:THEME.fonts.mono}}>{m.reps}{m.weight?` @ ${m.weight}`:""}</span></div>)}
        </div>}

        {/* Accessory */}
        {wod.accessory&&<div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textSecondary,marginBottom:"4px"}}>💪 Accessory</div>
          <div style={{fontSize:"13px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{wod.accessory}</div>
        </div>}

        {wod.notes&&<div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textMuted,marginBottom:"4px"}}>📝 Notes</div>
          <div style={{fontSize:"13px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{wod.notes}</div>
        </div>}
      </div>}
      <div style={S.card}>
        <div style={S.cardLbl}>Today's Classes</div>
        {sessions.length===0&&<div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No classes today</div>}
        {sessions.slice(0,4).map((s,i)=><div key={s.id} style={{...S.sRow,borderBottom:i===Math.min(3,sessions.length-1)?"none":S.sRow.borderBottom}}>
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
            <div style={{width:"3px",height:"36px",borderRadius:"2px",background:s.signups.includes(user.id)?THEME.colors.primary:THEME.colors.border}} />
            <div><div style={{fontWeight:"600",fontSize:"15px"}}>{s.title}</div><div style={{color:THEME.colors.textSecondary,fontSize:"12px"}}>{fmtTime(s.startTime)}–{fmtTime(s.endTime)} · Coach {coach(s.coachId)}</div></div>
          </div>
          <div style={{textAlign:"right"}}><div style={{fontSize:"14px",fontWeight:"600"}}><span style={{color:s.signups.length>=s.capacity?THEME.colors.error:THEME.colors.primary}}>{s.signups.length}</span><span style={{color:THEME.colors.textMuted}}>/{s.capacity}</span></div>
          {s.signups.includes(user.id)&&<div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px",marginTop:"2px"}}>Signed Up</div>}</div>
        </div>)}
        {sessions.length>4&&<div style={{color:THEME.colors.textMuted,fontSize:"12px",textAlign:"center",marginTop:THEME.spacing.sm}}>+{sessions.length-4} more classes</div>}
      </div>
      <div style={S.card}>
        <div style={S.cardLbl}>Recent Results</div>
        {results.map((r,i)=><div key={r.id} style={{padding:"10px 0",borderBottom:i<results.length-1?`1px solid ${THEME.colors.border}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}><div style={S.avatar}>{mName(r.memberId).charAt(0)}</div><div><div style={{fontWeight:"600",fontSize:"14px"}}>{mName(r.memberId)}</div><div style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{allWorkouts.find(w=>w.id===r.workoutId)?.title||"WOD"}</div></div></div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:THEME.fonts.mono,fontSize:"20px",fontWeight:"700",color:THEME.colors.primary}}>{r.score}</div>{r.rx&&<div style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"9px"}}>Rx</div>}</div>
          </div>
          {r.notes&&<div style={{color:THEME.colors.textMuted,fontSize:"12px",marginTop:"4px",marginLeft:"52px",fontStyle:"italic"}}>{r.notes}</div>}
        </div>)}
      </div>
    </div>
  );
};

export default DashboardScreen;
