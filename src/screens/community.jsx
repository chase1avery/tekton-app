import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';

const CommunityScreen = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("feed"); // "feed" | "leaderboard"
  const [results, setResults] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [members, setMembers] = useState([]);
  const [selWod, setSelWod] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, w, m, s] = await Promise.all([
      services.results.getAll(),
      services.workouts.getAll(),
      services.members.getAll(),
      services.sessions.getAll(),
    ]);
    setResults(r.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setWorkouts(w);
    setMembers(m);
    // Update streak cache
    m.forEach(mb => { setStreakCache(mb.id, calcStreak(s, mb.id)); });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getMember = (id) => members.find(m => m.id === id);
  const mName = (id) => { const m = getMember(id); return m ? `${m.firstName} ${m.lastName.charAt(0)}.` : "?"; };
  const mFull = (id) => { const m = getMember(id); return m ? `${m.firstName} ${m.lastName}` : "?"; };
  const getWod = (id) => workouts.find(w => w.id === id);

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const handleHighFive = async (resultId) => {
    const r = results.find(x => x.id === resultId);
    if (!r) return;
    const fives = r.highFives || [];
    const newFives = fives.includes(user.id)
      ? fives.filter(id => id !== user.id)
      : [...fives, user.id];
    await services.results.update(resultId, { highFives: newFives });
    await load();
  };

  // Leaderboard data
  const leaderboardWods = workouts.filter(w => results.some(r => r.workoutId === w.id));
  const filteredResults = selWod === "all" ? results : results.filter(r => r.workoutId === selWod);

  const getLeaderboard = (wodId) => {
    const wodResults = results.filter(r => r.workoutId === wodId);
    const wod = getWod(wodId);
    // Sort: ForTime = lowest time first, AMRAP/rounds = highest first
    return wodResults.sort((a, b) => {
      if (wod?.type === "ForTime") {
        const toSec = (s) => { const p = s.split(":"); return p.length === 2 ? Number(p[0])*60+Number(p[1]) : Number(s); };
        return toSec(a.score) - toSec(b.score);
      }
      // AMRAP / rounds+reps: parse "4+15" format
      const toVal = (s) => { const p = s.split("+"); return p.length === 2 ? Number(p[0])*100+Number(p[1]) : Number(s); };
      return toVal(b.score) - toVal(a.score);
    });
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: "10px 4px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: tab === id ? THEME.colors.primary : THEME.colors.surfaceLight,
      color: tab === id ? THEME.colors.white : THEME.colors.textSecondary,
      fontFamily: THEME.fonts.display, fontSize: "13px", letterSpacing: "1.5px",
    }}>{label}</button>
  );

  return (
    <div style={S.screen}>
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Community</div>
      <AnnouncementBanner />

      <div style={{display:"flex",gap:"6px",marginBottom:THEME.spacing.lg}}>
        <TabBtn id="feed" label="Activity Feed" />
        <TabBtn id="leaderboard" label="Leaderboard" />
      </div>

      {/* ===== ACTIVITY FEED ===== */}
      {tab === "feed" && (
        <>
          {/* Gym pulse stats */}
          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.lg}}>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.primary}}>{results.length}</div>
              <div style={S.statLbl}>Results Posted</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.accent}}>{results.reduce((a,r)=>(a+(r.highFives||[]).length),0)}</div>
              <div style={S.statLbl}>High Fives</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px"}}>{new Set(results.map(r=>r.memberId)).size}</div>
              <div style={S.statLbl}>Athletes</div>
            </div>
          </div>

          {/* Milestone Celebrations */}
          {(() => {
            const milestones = [];
            members.forEach(m => {
              const s = getStreak(m.id);
              if (s.totalSessions > 0 && s.totalSessions % 50 === 0) {
                milestones.push({ member: m, sessions: s.totalSessions, streak: s.current });
              }
            });
            if (milestones.length === 0) return null;
            return milestones.map(ms => (
              <div key={`milestone-${ms.member.id}`} style={{
                ...S.card, padding: THEME.spacing.md, marginBottom: "10px",
                borderLeft: `3px solid ${THEME.colors.accent}`,
                background: `linear-gradient(135deg, ${THEME.colors.surface}, ${subtleHex(THEME.colors.accent, 0.08)})`,
              }}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <div style={{
                    width:"48px",height:"48px",borderRadius:THEME.radius.full,
                    background:`linear-gradient(135deg,${THEME.colors.accent},${darkenHex(THEME.colors.accent)})`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",flexShrink:0,
                  }}>🏆</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:THEME.fonts.display,fontSize:"18px",letterSpacing:"0.5px",color:THEME.colors.accent}}>
                      Milestone!
                    </div>
                    <div style={{fontSize:"14px",color:THEME.colors.text,marginTop:"2px"}}>
                      <strong>{ms.member.firstName} {ms.member.lastName}</strong> hit <strong>{ms.sessions} sessions</strong>!
                    </div>
                    {ms.streak > 0 && (
                      <div style={{display:"flex",alignItems:"center",gap:"4px",marginTop:"4px"}}>
                        <FlameStreak count={ms.streak} size="sm" />
                        <span style={{fontSize:"12px",color:THEME.colors.textMuted}}>week streak active</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}

          {results.map(r => {
            const wod = getWod(r.workoutId);
            const fives = r.highFives || [];
            const iGaveFive = fives.includes(user.id);
            const isMe = r.memberId === user.id;

            return (
              <div key={r.id} style={{
                ...S.card, padding: THEME.spacing.md, marginBottom: "10px",
                borderLeft: isMe ? `3px solid ${THEME.colors.primary}` : `3px solid ${THEME.colors.border}`,
              }}>
                {/* Header: avatar + name + time */}
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
                  <div style={S.avatar}>{mName(r.memberId).charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontWeight:"600",fontSize:"14px"}}>{mName(r.memberId)}{isMe && <span style={{color:THEME.colors.textMuted,fontWeight:"400"}}> (you)</span>}</span>
                      <FlameStreak count={getStreak(r.memberId).current} size="sm" />
                    </div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{timeAgo(r.date)}</div>
                  </div>
                  {(() => {
                    const scale = r.scale || (r.rx ? "Rx" : "Scaled");
                    const scaleColors = { "Rx": THEME.colors.accent, "Rx+": THEME.colors.accent, "Mastered": "#9B59B6", "Scaled": THEME.colors.textMuted, "Foundation": THEME.colors.textMuted };
                    const scaleBg = { "Rx": THEME.colors.accentSubtle, "Rx+": THEME.colors.accentSubtle, "Mastered": "rgba(155,89,182,0.12)", "Scaled": "rgba(255,255,255,0.05)", "Foundation": "rgba(255,255,255,0.05)" };
                    return <div style={{...S.badge,background:scaleBg[scale]||scaleBg.Rx,color:scaleColors[scale]||scaleColors.Rx,fontSize:"9px"}}>{scale}</div>;
                  })()}
                </div>

                {/* Workout + Score */}
                <div style={{
                  background:THEME.colors.surfaceLight, borderRadius:THEME.radius.md,
                  padding:"12px 14px", marginBottom:THEME.spacing.sm,
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                }}>
                  <div>
                    <div style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{wod?.title || "Workout"}</div>
                    {wod && <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{wod.type}{wod.timeCap ? ` · ${wod.timeCap} min` : ""}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:THEME.fonts.mono,fontSize:"24px",fontWeight:"700",color:THEME.colors.primary}}>{r.score}</div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>{r.scoreType}</div>
                  </div>
                </div>

                {/* Notes */}
                {r.notes && (
                  <div style={{color:THEME.colors.textSecondary,fontSize:"13px",fontStyle:"italic",marginBottom:THEME.spacing.sm,paddingLeft:"2px"}}>
                    "{r.notes}"
                  </div>
                )}

                {/* High Five Bar */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:THEME.spacing.sm,borderTop:`1px solid ${THEME.colors.border}`}}>
                  <button onClick={() => handleHighFive(r.id)} style={{
                    display:"flex",alignItems:"center",gap:"6px",
                    background:"none",border:"none",cursor:"pointer",padding:"6px 12px",
                    borderRadius:THEME.radius.full,
                    transition:"all 0.2s",
                    ...(iGaveFive ? {background:THEME.colors.accentSubtle} : {}),
                  }}>
                    <span style={{fontSize:"18px",transition:"transform 0.2s",transform:iGaveFive?"scale(1.2)":"scale(1)"}}>🖐️</span>
                    <span style={{
                      fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"1px",
                      color:iGaveFive?THEME.colors.accent:THEME.colors.textMuted,
                    }}>
                      {fives.length > 0 ? fives.length : ""} {fives.length === 1 ? "High Five" : fives.length > 1 ? "High Fives" : "High Five"}
                    </span>
                  </button>

                  {/* Who high-fived (show first 3 avatars) */}
                  {fives.length > 0 && (
                    <div style={{display:"flex",alignItems:"center"}}>
                      {fives.slice(0, 3).map((fId, idx) => (
                        <div key={fId} style={{
                          width:"24px",height:"24px",borderRadius:"50%",
                          background:THEME.colors.primarySubtle,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontFamily:THEME.fonts.display,fontSize:"10px",color:THEME.colors.primary,
                          marginLeft: idx > 0 ? "-6px" : "0",
                          border:`2px solid ${THEME.colors.surface}`,
                          zIndex: 3 - idx,
                        }}>{mName(fId).charAt(0)}</div>
                      ))}
                      {fives.length > 3 && (
                        <span style={{color:THEME.colors.textMuted,fontSize:"11px",marginLeft:"4px"}}>+{fives.length-3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== LEADERBOARD ===== */}
      {tab === "leaderboard" && (
        <>
          {/* WOD filter */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:THEME.spacing.lg}}>
            {leaderboardWods.map(w => (
              <button key={w.id} onClick={() => setSelWod(selWod === w.id ? "all" : w.id)} style={{
                padding:"8px 16px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                background:selWod===w.id?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                color:selWod===w.id?THEME.colors.primary:THEME.colors.textSecondary,
                fontFamily:THEME.fonts.body,fontSize:"13px",
              }}>
                {w.title}
                <span style={{opacity:0.5,fontSize:"11px",marginLeft:"4px"}}>{w.type}</span>
              </button>
            ))}
          </div>

          {/* Leaderboard per WOD */}
          {(selWod === "all" ? leaderboardWods : leaderboardWods.filter(w=>w.id===selWod)).map(wod => {
            const ranked = getLeaderboard(wod.id);
            if (ranked.length === 0) return null;

            return (
              <div key={wod.id} style={{...S.card,marginBottom:THEME.spacing.md}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.md}}>
                  <div>
                    <div style={{fontFamily:THEME.fonts.display,fontSize:"22px"}}>{wod.title}</div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{wod.type}{wod.timeCap?` · ${wod.timeCap} min`:""} · {wod.description}</div>
                  </div>
                  <I.medal size={22} color={THEME.colors.accent} />
                </div>

                {ranked.map((r, idx) => {
                  const isMe = r.memberId === user.id;
                  const podium = idx < 3;
                  const medalColors = ["#FFD700","#C0C0C0","#CD7F32"];

                  return (
                    <div key={r.id} style={{
                      display:"flex",alignItems:"center",gap:THEME.spacing.sm,
                      padding:"10px 0",
                      borderBottom: idx < ranked.length - 1 ? `1px solid ${THEME.colors.border}` : "none",
                      background: isMe ? THEME.colors.primarySubtle : "transparent",
                      margin: isMe ? "0 -16px" : "0",
                      padding: isMe ? "10px 16px" : "10px 0",
                      borderRadius: isMe ? THEME.radius.md : "0",
                    }}>
                      {/* Rank */}
                      <div style={{
                        width:"30px",height:"30px",borderRadius:"50%",flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontFamily:THEME.fonts.display,fontSize: podium ? "16px":"14px",
                        background: podium ? `${medalColors[idx]}22` : "transparent",
                        color: podium ? medalColors[idx] : THEME.colors.textMuted,
                        fontWeight: podium ? "700" : "400",
                      }}>
                        {idx + 1}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        ...S.avatar,width:"34px",height:"34px",fontSize:"14px",
                        background: isMe ? THEME.colors.primary : THEME.colors.primarySubtle,
                        color: isMe ? THEME.colors.white : THEME.colors.primary,
                      }}>{mName(r.memberId).charAt(0)}</div>

                      {/* Name */}
                      <div style={{flex:1}}>
                        <div style={{fontWeight: isMe?"700":"500",fontSize:"14px"}}>
                          {mFull(r.memberId)}{isMe && <span style={{color:THEME.colors.textMuted,fontWeight:"400",fontSize:"12px"}}> (you)</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                          {(() => {
                            const scale = r.scale || (r.rx ? "Rx" : "Scaled");
                            const sc = { "Rx": THEME.colors.accent, "Rx+": THEME.colors.accent, "Mastered": "#9B59B6", "Scaled": THEME.colors.textMuted, "Foundation": THEME.colors.textMuted };
                            const sb = { "Rx": THEME.colors.accentSubtle, "Rx+": THEME.colors.accentSubtle, "Mastered": "rgba(155,89,182,0.12)", "Scaled": "rgba(255,255,255,0.05)", "Foundation": "rgba(255,255,255,0.05)" };
                            return <span style={{...S.badge,background:sb[scale]||sb.Rx,color:sc[scale]||sc.Rx,fontSize:"8px",padding:"1px 6px"}}>{scale}</span>;
                          })()}
                          {r.notes && <span style={{color:THEME.colors.textMuted,fontSize:"11px",fontStyle:"italic"}}>{r.notes}</span>}
                        </div>
                      </div>

                      {/* Score */}
                      <div style={{
                        fontFamily:THEME.fonts.mono,fontSize: podium?"20px":"16px",
                        fontWeight:"700",
                        color: idx===0?THEME.colors.accent: isMe?THEME.colors.primary:THEME.colors.text,
                      }}>{r.score}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {leaderboardWods.length === 0 && (
            <div style={{...S.card,textAlign:"center",padding:THEME.spacing.xl}}>
              <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No workout results yet. Post a result to start the leaderboard!</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityScreen;
