import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';
import { VideoModal, useVideoLibrary, MovementName } from '../components/VideoModal';

const ScheduleScreen = () => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today());
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [viewingWod, setViewingWod] = useState(null);
  const { getVideoUrl } = useVideoLibrary();
  const [playingVideo, setPlayingVideo] = useState(null);
  const [waitlists, setWaitlists] = useState({}); // { sessionId: [{ memberId, position }] }

  const weekDates = getWeekDates(weekStart);

  const loadSessions = useCallback(async () => {
    const [all, wods] = await Promise.all([
      services.sessions.getAll(),
      services.workouts.getAll(),
    ]);
    setAllSessions(all);
    setAllWorkouts(wods);
    const daySessions = all.filter(s => s.date === selectedDate);
    setSessions(daySessions);
    // Load waitlists for visible sessions
    const wlMap = {};
    await Promise.all(daySessions.map(async (s) => {
      wlMap[s.id] = await services.waitlist.getForSession(s.id);
    }));
    setWaitlists(wlMap);
  }, [selectedDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleSignup = async (sessionId) => {
    setActioningId(sessionId);
    const s = allSessions.find(x => x.id === sessionId);
    if (!s || s.signups.includes(user.id) || s.signups.length >= s.capacity) { setActioningId(null); return; }
    await services.sessions.signup(sessionId, user.id);
    await loadSessions();
    setActioningId(null);
  };

  const handleCancel = async (sessionId) => {
    setActioningId(sessionId);
    const s = allSessions.find(x => x.id === sessionId);
    if (!s) { setActioningId(null); return; }
    await services.sessions.cancel(sessionId, user.id);
    // Auto-promote first person on waitlist if class was full
    if (s.signups.length >= s.capacity) {
      await services.waitlist.promoteFirst(sessionId);
    }
    await loadSessions();
    setActioningId(null);
  };

  const handleJoinWaitlist = async (sessionId) => {
    setActioningId(sessionId);
    await services.waitlist.join(sessionId, user.id);
    await loadSessions();
    setActioningId(null);
  };

  const handleLeaveWaitlist = async (sessionId) => {
    setActioningId(sessionId);
    await services.waitlist.leave(sessionId, user.id);
    await loadSessions();
    setActioningId(null);
  };

  const shiftWeek = (dir) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d);
    const newWeek = getWeekDates(d);
    setSelectedDate(newWeek[0]);
  };

  const coach = (id) => { const m = membersCache.find(x => x.id === id); return m ? m.firstName : "Coach"; };
  const coachObj = (id) => membersCache.find(x => x.id === id);
  const [coachPopup, setCoachPopup] = useState(null); // { coach, x, y }
  const isToday = selectedDate === today();
  const isPast = (date, time) => {
    const now = new Date();
    const sessionTime = new Date(`${date}T${time}:00`);
    return sessionTime < now;
  };

  const myWeekSignups = allSessions.filter(s => weekDates.includes(s.date) && s.signups.includes(user.id)).length;

  // Find a workout for a given date
  const getWodForDate = (date) => allWorkouts.find(w => w.date.startsWith(date));

  // ===== WOD DETAIL VIEW =====
  if (viewingWod) {
    const w = viewingWod;
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(w.date).getDay()];
    const dateStr = new Date(w.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    return (
      <div style={S.screen}>
        {/* Back button */}
        <button onClick={() => setViewingWod(null)} style={{
          display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",
          cursor:"pointer",padding:"0",marginBottom:THEME.spacing.lg,
        }}>
          <I.chevL size={20} color={THEME.colors.primary} />
          <span style={{fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"1.5px",color:THEME.colors.primary}}>Back to Schedule</span>
        </button>

        {/* Header */}
        <div style={{marginBottom:THEME.spacing.xl}}>
          <div style={{color:THEME.colors.textMuted,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"3px",marginBottom:"4px"}}>{dayName}</div>
          <div style={{fontFamily:THEME.fonts.display,fontSize:"34px",letterSpacing:"1px",lineHeight:"1.1"}}>{w.title}</div>
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginTop:"8px",flexWrap:"wrap"}}>
            <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"11px",padding:"4px 12px"}}>{w.type}</div>
            {w.timeCap && <div style={{...S.badge,background:THEME.colors.surfaceLight,color:THEME.colors.textSecondary,fontSize:"11px",padding:"4px 12px"}}>{w.timeCap} min cap</div>}
            <span style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{dateStr}</span>
          </div>
          {w.description && <div style={{color:THEME.colors.textSecondary,fontSize:"15px",marginTop:THEME.spacing.sm,lineHeight:"1.5"}}>{w.description}</div>}
        </div>

        {/* Warmup Section */}
        {w.warmup && (
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.warning}`,marginBottom:THEME.spacing.md}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"18px"}}>🔥</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.warning}}>Warmup</div>
            </div>
            <div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.warmup}</div>
          </div>
        )}

        {/* Strength Section */}
        {w.strength && (
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.accent}`,marginBottom:THEME.spacing.md}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"18px"}}>🏋️</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.accent}}>Strength</div>
            </div>
            <div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.strength}</div>
          </div>
        )}

        {/* WOD Movements Section */}
        {w.movements && w.movements.length > 0 && (
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.primary}`,marginBottom:THEME.spacing.md}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <span style={{fontSize:"18px"}}>⏱️</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.primary}}>WOD</div>
              {w.timeCap && <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"10px",marginLeft:"auto"}}>{w.timeCap} min</div>}
            </div>
            {w.movements.map((m, i) => (
              <div key={i} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"10px 0",
                borderBottom: i < w.movements.length - 1 ? `1px solid ${THEME.colors.border}` : "none",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <div style={{
                    width:"28px",height:"28px",borderRadius:THEME.radius.sm,
                    background:THEME.colors.surfaceLight,display:"flex",alignItems:"center",justifyContent:"center",
                    fontFamily:THEME.fonts.display,fontSize:"13px",color:THEME.colors.textMuted,flexShrink:0,
                  }}>{i + 1}</div>
                  <div>
                    <MovementName name={m.name} videoUrl={getVideoUrl(m.name)} onPlay={(n,u)=>setPlayingVideo({name:n,url:u})} />
                    {m.notes && <div style={{color:THEME.colors.textMuted,fontSize:"11px",marginTop:"2px"}}>{m.notes}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:THEME.fonts.mono,fontSize:"15px",fontWeight:"600",color:THEME.colors.primary}}>{m.reps}</div>
                  {m.weight && <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{m.weight}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accessory Section */}
        {w.accessory && (
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.textSecondary}`,marginBottom:THEME.spacing.md}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"18px"}}>💪</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textSecondary}}>Accessory Work</div>
            </div>
            <div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.accessory}</div>
          </div>
        )}

        {/* Notes */}
        {w.notes && (
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.border}`,marginBottom:THEME.spacing.md}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"18px"}}>📝</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textMuted}}>Coach Notes</div>
            </div>
            <div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.notes}</div>
          </div>
        )}

        {/* No programming message */}
        {!w.warmup && !w.strength && (!w.movements || w.movements.length === 0) && !w.accessory && !w.notes && (
          <div style={{...S.card,textAlign:"center",padding:THEME.spacing.xl}}>
            <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No detailed programming has been posted for this workout yet.</div>
          </div>
        )}

        {/* Coach attribution */}
        {w.createdBy && (
          <div style={{textAlign:"center",padding:THEME.spacing.md,color:THEME.colors.textMuted,fontSize:"12px"}}>
            Programmed by Coach {(() => { const m = membersCache.find(x => x.id === w.createdBy); return m ? m.firstName : "Staff"; })()}
          </div>
        )}
      </div>
    );
  }

  // ===== SCHEDULE LIST VIEW =====
  return (
    <div style={S.screen}>
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Schedule</div>
      <AnnouncementBanner />

      {/* Week Navigation */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.md}}>
        <button onClick={()=>shiftWeek(-1)} style={{background:"none",border:"none",cursor:"pointer",padding:"8px"}}><I.chevL size={20} color={THEME.colors.textSecondary}/></button>
        <div style={{fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"2px",color:THEME.colors.textSecondary}}>
          {fmtLong(weekDates[0]).split(",")[0]} – {fmtLong(weekDates[6]).split(",")[0]}
        </div>
        <button onClick={()=>shiftWeek(1)} style={{background:"none",border:"none",cursor:"pointer",padding:"8px"}}><I.chevR size={20} color={THEME.colors.textSecondary}/></button>
      </div>

      {/* Day Selector */}
      <div style={{display:"flex",gap:"4px",marginBottom:THEME.spacing.lg}}>
        {weekDates.map(date => {
          const {day, num} = fmt(date);
          const isSelected = date === selectedDate;
          const isT = date === today();
          const hasSessions = allSessions.some(s => s.date === date);
          const isSunday = new Date(date + "T12:00:00").getDay() === 0;
          return (
            <button key={date} onClick={() => !isSunday && setSelectedDate(date)} style={{
              flex: 1, padding: "10px 2px", borderRadius: THEME.radius.md, border: "none", cursor: isSunday ? "default" : "pointer",
              background: isSelected ? THEME.colors.primary : "transparent",
              opacity: isSunday ? 0.3 : 1, transition: "all 0.2s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
            }}>
              <span style={{fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",color:isSelected?THEME.colors.white:THEME.colors.textMuted}}>{day}</span>
              <span style={{fontFamily:THEME.fonts.display,fontSize:"20px",color:isSelected?THEME.colors.white:isT?THEME.colors.primary:THEME.colors.text}}>{num}</span>
              {hasSessions && !isSelected && <div style={{width:"4px",height:"4px",borderRadius:"50%",background:THEME.colors.primary}} />}
            </button>
          );
        })}
      </div>

      {/* Week stats bar */}
      <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
        <div style={{...S.statBox,padding:"10px"}}>
          <div style={{...S.statVal,fontSize:"18px",color:THEME.colors.primary}}>{myWeekSignups}</div>
          <div style={S.statLbl}>My Classes This Week</div>
        </div>
        <div style={{...S.statBox,padding:"10px"}}>
          <div style={{...S.statVal,fontSize:"18px"}}>{sessions.length}</div>
          <div style={S.statLbl}>Classes {isToday ? "Today" : fmt(selectedDate).day}</div>
        </div>
      </div>

      {/* Date Header + View WOD button */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.md}}>
        <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textSecondary}}>
          {isToday ? "Today" : fmtLong(selectedDate)}
        </div>
        {getWodForDate(selectedDate) && (
          <button onClick={() => setViewingWod(getWodForDate(selectedDate))} style={{
            display:"flex",alignItems:"center",gap:"6px",
            padding:"8px 16px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
            background:THEME.colors.primarySubtle,
          }}>
            <span style={{fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1.5px",color:THEME.colors.primary}}>View WOD</span>
            <I.chevR size={14} color={THEME.colors.primary} />
          </button>
        )}
      </div>

      {/* Session List */}
      {sessions.length === 0 && (
        <div style={{...S.card,textAlign:"center"}}>
          <div style={{color:THEME.colors.textMuted,fontSize:"14px",padding:THEME.spacing.lg}}>
            {new Date(selectedDate+"T12:00:00").getDay() === 0 ? "Gym closed on Sundays" : "No classes scheduled"}
          </div>
        </div>
      )}

      {sessions.map(s => {
        const signedUp = s.signups.includes(user.id);
        const full = s.signups.length >= s.capacity;
        const past = isPast(s.date, s.startTime);
        const actioning = actioningId === s.id;
        const spotsLeft = s.capacity - s.signups.length;
        const sessionWod = s.workoutId ? allWorkouts.find(w => w.id === s.workoutId) : getWodForDate(s.date);
        const wl = waitlists[s.id] || [];
        const onWaitlist = wl.find(w => w.memberId === user.id);
        const myWaitlistPos = onWaitlist ? onWaitlist.position : null;

        return (
          <div key={s.id} style={{
            ...S.card,
            borderLeft: `3px solid ${signedUp ? THEME.colors.primary : onWaitlist ? THEME.colors.warning : past ? THEME.colors.border : THEME.colors.surfaceLight}`,
            opacity: past ? 0.5 : 1,
            marginBottom: THEME.spacing.sm,
            padding: THEME.spacing.md,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:"4px"}}>
                  <span style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{s.title}</span>
                  {signedUp && <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px"}}>Signed Up</div>}
                  {onWaitlist && <div style={{...S.badge,background:"rgba(243,156,18,0.12)",color:THEME.colors.warning,fontSize:"9px"}}>Waitlist #{myWaitlistPos}</div>}
                </div>
                <div style={{color:THEME.colors.textSecondary,fontSize:"13px",display:"flex",alignItems:"center",gap:"12px"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><I.clock size={13} color={THEME.colors.textMuted}/> {fmtTime(s.startTime)} – {fmtTime(s.endTime)}</span>
                  <span onClick={(e)=>{e.stopPropagation();const c=coachObj(s.coachId);if(c?.avatar){const rect=e.target.getBoundingClientRect();setCoachPopup({coach:c,x:rect.left,y:rect.bottom+8});}}} style={{cursor:coachObj(s.coachId)?.avatar?"pointer":"default",textDecoration:coachObj(s.coachId)?.avatar?"underline":"none",textUnderlineOffset:"3px",textDecorationColor:THEME.colors.border}}>Coach {coach(s.coachId)}</span>
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:"55px"}}>
                <div style={{fontFamily:THEME.fonts.mono,fontSize:"16px",fontWeight:"700"}}>
                  <span style={{color: full ? THEME.colors.error : THEME.colors.primary}}>{s.signups.length}</span>
                  <span style={{color:THEME.colors.textMuted}}>/{s.capacity}</span>
                </div>
                <div style={{fontSize:"11px",color: full ? THEME.colors.error : THEME.colors.textMuted}}>
                  {full ? (wl.length > 0 ? `${wl.length} waiting` : "Full") : `${spotsLeft} spots`}
                </div>
              </div>
            </div>

            {/* View WOD button per session */}
            {sessionWod && (
              <button onClick={() => setViewingWod(sessionWod)} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
                marginTop:THEME.spacing.sm,padding:"8px 12px",borderRadius:THEME.radius.md,
                background:THEME.colors.surfaceLight,border:"none",cursor:"pointer",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <span style={{fontSize:"14px"}}>⏱️</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontFamily:THEME.fonts.display,fontSize:"13px",color:THEME.colors.text,letterSpacing:"1px"}}>{sessionWod.title}</div>
                    <div style={{fontSize:"11px",color:THEME.colors.textMuted}}>{sessionWod.type}{sessionWod.timeCap ? ` · ${sessionWod.timeCap} min` : ""}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <span style={{fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1.5px",color:THEME.colors.primary}}>View</span>
                  <I.chevR size={14} color={THEME.colors.primary} />
                </div>
              </button>
            )}

            {/* Action Button */}
            {!past && (
              <div style={{marginTop:THEME.spacing.sm}}>
                {signedUp ? (
                  <button onClick={()=>handleCancel(s.id)} disabled={actioning} style={{
                    width:"100%",padding:"10px",borderRadius:THEME.radius.md,border:`1px solid ${THEME.colors.border}`,
                    background:"transparent",color:THEME.colors.textSecondary,fontFamily:THEME.fonts.display,
                    fontSize:"13px",letterSpacing:"2px",cursor:"pointer",opacity:actioning?0.5:1,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  }}>
                    <I.x size={14} color={THEME.colors.textSecondary}/> {actioning?"Cancelling...":"Cancel Reservation"}
                  </button>
                ) : onWaitlist ? (
                  <button onClick={()=>handleLeaveWaitlist(s.id)} disabled={actioning} style={{
                    width:"100%",padding:"10px",borderRadius:THEME.radius.md,border:`1px solid rgba(243,156,18,0.3)`,
                    background:"rgba(243,156,18,0.08)",color:THEME.colors.warning,fontFamily:THEME.fonts.display,
                    fontSize:"13px",letterSpacing:"2px",cursor:"pointer",opacity:actioning?0.5:1,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  }}>
                    <I.x size={14} color={THEME.colors.warning}/> {actioning?"Leaving...":"Leave Waitlist"}
                  </button>
                ) : full ? (
                  <button onClick={()=>handleJoinWaitlist(s.id)} disabled={actioning} style={{
                    width:"100%",padding:"10px",borderRadius:THEME.radius.md,border:"none",
                    background:`linear-gradient(135deg,${THEME.colors.warning},${darkenHex(THEME.colors.warning)})`,
                    color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",
                    cursor:"pointer",opacity:actioning?0.5:1,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  }}>
                    {actioning ? "Joining..." : <><I.clock size={14} color={THEME.colors.white}/> Join Waitlist {wl.length > 0 ? `(${wl.length} waiting)` : ""}</>}
                  </button>
                ) : (
                  <button onClick={()=>handleSignup(s.id)} disabled={actioning} style={{
                    width:"100%",padding:"10px",borderRadius:THEME.radius.md,border:"none",
                    background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                    color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",
                    cursor:"pointer",opacity:actioning?0.5:1,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  }}>
                    {actioning ? "Signing Up..." : <><I.check size={14} color={THEME.colors.white}/> Sign Up</>}
                  </button>
                )}
              </div>
            )}

            {past && (
              <div style={{marginTop:THEME.spacing.sm,textAlign:"center",color:THEME.colors.textMuted,fontSize:"12px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>
                Completed
              </div>
            )}
          </div>
        );
      })}

      {/* Coach Avatar Tooltip */}
      {coachPopup && coachPopup.coach.avatar && (
        <>
          <div onClick={()=>setCoachPopup(null)} style={{position:"fixed",inset:0,zIndex:9998}} />
          <div style={{
            position:"fixed",left:Math.min(coachPopup.x, window.innerWidth - 180),top:coachPopup.y,
            zIndex:9999,
            background:THEME.colors.surface,border:`1px solid ${THEME.colors.border}`,
            borderRadius:THEME.radius.lg,padding:"12px",
            display:"flex",alignItems:"center",gap:"10px",
            boxShadow:"0 8px 24px rgba(0,0,0,0.4)",
            maxWidth:"220px",
          }}>
            <img src={coachPopup.coach.avatar} alt="" style={{
              width:"48px",height:"48px",borderRadius:THEME.radius.full,objectFit:"cover",
              border:`2px solid ${THEME.colors.primary}`,flexShrink:0,
            }} />
            <div>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"15px",color:THEME.colors.text,letterSpacing:"0.5px"}}>
                {coachPopup.coach.firstName} {coachPopup.coach.lastName}
              </div>
              <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px",marginTop:"3px"}}>
                {coachPopup.coach.role}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Video Playback Modal */}
      {playingVideo && (
        <VideoModal movement={playingVideo.name} videoUrl={playingVideo.url} onClose={()=>setPlayingVideo(null)} />
      )}
    </div>
  );
};

export default ScheduleScreen;
