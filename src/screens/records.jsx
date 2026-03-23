import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';

// ============================================================
// RECORDS SCREEN (Phase 3 — NEW)
// ============================================================
const PR_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "lift", label: "Lifts" },
  { id: "benchmark", label: "Benchmarks" },
  { id: "gymnastics", label: "Gymnastics" },
  { id: "cardio", label: "Cardio" },
];

const COMMON_LIFTS = ["Back Squat","Front Squat","Overhead Squat","Deadlift","Clean","Clean & Jerk","Snatch","Bench Press","Strict Press","Push Press","Push Jerk"];
const COMMON_BENCHMARKS = ["Fran","Grace","Helen","Diane","Elizabeth","Murph","Jackie","Karen","Annie","Isabel","DT","Cindy","Mary","Nancy","Chelsea","Amanda","King Kong","The Chief","Filthy Fifty","Fight Gone Bad"];
const COMMON_GYMNASTICS = ["Max Pull-ups","Max Muscle-ups","Max HSPU","Max Pistols","Max Ring Dips","Max Toes-to-Bar","L-Sit Hold"];
const COMMON_CARDIO = ["500m Row","1000m Row","2000m Row","400m Run","1 Mile Run","5K Run","1000m Ski","2000m Bike"];

const RecordsScreen = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("prs"); // "prs" | "results" | "add"
  const [catFilter, setCatFilter] = useState("all");
  const [prs, setPrs] = useState([]);
  const [results, setResults] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add PR form
  const [prForm, setPrForm] = useState({ category: "lift", name: "", value: "", unit: "lbs", notes: "" });
  const [prSaving, setPrSaving] = useState(false);
  const [prSaved, setPrSaved] = useState(false);

  // Post Result form
  const [resForm, setResForm] = useState({ workoutId: "", score: "", scoreType: "time", rx: true, notes: "" });
  const [resSaving, setResSaving] = useState(false);
  const [resSaved, setResSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, r, w] = await Promise.all([
      services.prs.getByField("memberId", user.id),
      services.results.getByField("memberId", user.id),
      services.workouts.getAll(),
    ]);
    setPrs(p.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setResults(r.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setAllWorkouts(w);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const filteredPrs = catFilter === "all" ? prs : prs.filter(p => p.category === catFilter);

  // Group PRs by name (show best only)
  const bestPrs = {};
  prs.forEach(p => {
    if (!bestPrs[p.name]) bestPrs[p.name] = p;
  });
  const bestPrsList = Object.values(bestPrs);

  const handleAddPr = async () => {
    if (!prForm.name || !prForm.value) return;
    setPrSaving(true);
    await services.prs.create({
      memberId: user.id, category: prForm.category,
      name: prForm.name, value: prForm.value, unit: prForm.unit,
      date: new Date().toISOString(), notes: prForm.notes || null,
    });
    setPrSaving(false);
    setPrSaved(true);
    setPrForm({ category: "lift", name: "", value: "", unit: "lbs", notes: "" });
    await load();
    setTimeout(() => { setPrSaved(false); setTab("prs"); }, 1000);
  };

  const handlePostResult = async () => {
    if (!resForm.score) return;
    setResSaving(true);
    await services.results.create({
      memberId: user.id, workoutId: resForm.workoutId || null,
      sessionId: null, score: resForm.score, scoreType: resForm.scoreType,
      rx: resForm.rx, notes: resForm.notes || null,
      date: new Date().toISOString(),
    });
    setResSaving(false);
    setResSaved(true);
    setResForm({ workoutId: "", score: "", scoreType: "time", rx: true, notes: "" });
    await load();
    setTimeout(() => { setResSaved(false); setTab("results"); }, 1000);
  };

  const getSuggestions = () => {
    switch (prForm.category) {
      case "lift": return COMMON_LIFTS;
      case "benchmark": return COMMON_BENCHMARKS;
      case "gymnastics": return COMMON_GYMNASTICS;
      case "cardio": return COMMON_CARDIO;
      default: return [];
    }
  };

  const getDefaultUnit = (cat) => {
    switch (cat) { case "lift": return "lbs"; case "benchmark": case "cardio": return "time"; case "gymnastics": return "reps"; default: return "lbs"; }
  };

  const catIcon = (cat) => {
    switch(cat) {
      case "lift": return "🏋️";
      case "benchmark": return "⏱️";
      case "gymnastics": return "🤸";
      case "cardio": return "🚣";
      default: return "📊";
    }
  };

  const TabButton = ({ id, label, count }) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: "10px 4px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: tab === id ? THEME.colors.primary : THEME.colors.surfaceLight,
      color: tab === id ? THEME.colors.white : THEME.colors.textSecondary,
      fontFamily: THEME.fonts.display, fontSize: "13px", letterSpacing: "1.5px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    }}>
      {label}
      {count !== undefined && <span style={{
        fontSize: "10px", padding: "1px 6px", borderRadius: THEME.radius.full,
        background: tab === id ? "rgba(255,255,255,0.2)" : THEME.colors.border,
      }}>{count}</span>}
    </button>
  );

  return (
    <div style={S.screen}>
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Records</div>
      <AnnouncementBanner />

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:"6px",marginBottom:THEME.spacing.lg}}>
        <TabButton id="prs" label="My PRs" count={bestPrsList.length} />
        <TabButton id="results" label="Results" count={results.length} />
        <TabButton id="add" label="+ Log" />
      </div>

      {/* ===== MY PRs TAB ===== */}
      {tab === "prs" && (
        <>
          {/* Category Filter */}
          <div style={{display:"flex",gap:"6px",marginBottom:THEME.spacing.md,overflowX:"auto",paddingBottom:"4px"}}>
            {PR_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCatFilter(c.id)} style={{
                padding: "6px 14px", borderRadius: THEME.radius.full, border: "none", cursor: "pointer",
                background: catFilter === c.id ? THEME.colors.primarySubtle : "transparent",
                color: catFilter === c.id ? THEME.colors.primary : THEME.colors.textMuted,
                fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>{c.label}</button>
            ))}
          </div>

          {/* PR Stats Summary */}
          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
            <div style={S.statBox}>
              <div style={{...S.statVal,color:THEME.colors.accent}}>{bestPrsList.filter(p=>p.category==="lift").length}</div>
              <div style={S.statLbl}>Lifts</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,color:THEME.colors.primary}}>{bestPrsList.filter(p=>p.category==="benchmark").length}</div>
              <div style={S.statLbl}>Benchmarks</div>
            </div>
            <div style={S.statBox}>
              <div style={S.statVal}>{prs.length}</div>
              <div style={S.statLbl}>Total Entries</div>
            </div>
          </div>

          {/* PR List */}
          {filteredPrs.length === 0 && (
            <div style={{...S.card,textAlign:"center",padding:THEME.spacing.xl}}>
              <div style={{color:THEME.colors.textMuted,fontSize:"14px",marginBottom:THEME.spacing.md}}>
                {catFilter === "all" ? "No PRs logged yet" : `No ${catFilter} PRs yet`}
              </div>
              <button onClick={() => setTab("add")} style={{
                padding:"10px 24px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",
              }}>Log Your First PR</button>
            </div>
          )}

          {filteredPrs.map((pr, i) => {
            const isBest = bestPrs[pr.name]?.id === pr.id;
            return (
              <div key={pr.id} style={{
                ...S.card, padding:THEME.spacing.md, marginBottom:"8px",
                borderLeft: isBest ? `3px solid ${THEME.colors.accent}` : `3px solid ${THEME.colors.border}`,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                      <span style={{fontSize:"16px"}}>{catIcon(pr.category)}</span>
                      <span style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{pr.name}</span>
                      {isBest && <div style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"9px"}}>Best</div>}
                    </div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"12px",marginTop:"4px"}}>
                      {new Date(pr.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      {pr.notes && <span style={{fontStyle:"italic"}}> · {pr.notes}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:THEME.fonts.mono,fontSize:"22px",fontWeight:"700",color:isBest?THEME.colors.accent:THEME.colors.text}}>
                      {pr.value}
                    </div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>
                      {pr.unit}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== RESULTS TAB ===== */}
      {tab === "results" && (
        <>
          {results.length === 0 && (
            <div style={{...S.card,textAlign:"center",padding:THEME.spacing.xl}}>
              <div style={{color:THEME.colors.textMuted,fontSize:"14px",marginBottom:THEME.spacing.md}}>No workout results posted yet</div>
              <button onClick={() => setTab("add")} style={{
                padding:"10px 24px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",
              }}>Post a Result</button>
            </div>
          )}

          {results.map(r => {
            const wod = allWorkouts.find(w => w.id === r.workoutId);
            return (
              <div key={r.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                      <span style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{wod?.title || "Workout"}</span>
                      {r.rx && <div style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"9px"}}>Rx</div>}
                      {!r.rx && <div style={{...S.badge,background:"rgba(255,255,255,0.05)",color:THEME.colors.textMuted,fontSize:"9px"}}>Scaled</div>}
                    </div>
                    {wod && <div style={{color:THEME.colors.textSecondary,fontSize:"12px",marginTop:"2px"}}>{wod.type}{wod.timeCap ? ` · ${wod.timeCap} min` : ""}</div>}
                    <div style={{color:THEME.colors.textMuted,fontSize:"12px",marginTop:"4px"}}>
                      {new Date(r.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      {r.notes && <span style={{fontStyle:"italic"}}> · {r.notes}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:THEME.fonts.mono,fontSize:"24px",fontWeight:"700",color:THEME.colors.primary}}>{r.score}</div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>{r.scoreType}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== ADD / LOG TAB ===== */}
      {tab === "add" && (
        <>
          {/* Log a PR */}
          <div style={S.card}>
            <div style={S.cardLbl}>Log a Personal Record</div>

            {/* Category Selector */}
            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Category</label>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {[{id:"lift",l:"Lift 🏋️"},{id:"benchmark",l:"Benchmark ⏱️"},{id:"gymnastics",l:"Gymnastics 🤸"},{id:"cardio",l:"Cardio 🚣"}].map(c=>(
                  <button key={c.id} onClick={()=>{setPrForm(f=>({...f,category:c.id,name:"",unit:getDefaultUnit(c.id)}))}} style={{
                    padding:"8px 14px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                    background:prForm.category===c.id?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                    color:prForm.category===c.id?THEME.colors.primary:THEME.colors.textSecondary,
                    fontFamily:THEME.fonts.body,fontSize:"13px",
                  }}>{c.l}</button>
                ))}
              </div>
            </div>

            {/* Movement Name — Quick Select or Custom */}
            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Movement / WOD</label>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>
                {getSuggestions().slice(0, 8).map(name => (
                  <button key={name} onClick={() => setPrForm(f => ({ ...f, name }))} style={{
                    padding:"6px 12px",borderRadius:THEME.radius.full,border:"none",cursor:"pointer",
                    background: prForm.name === name ? THEME.colors.primary : THEME.colors.surfaceLight,
                    color: prForm.name === name ? THEME.colors.white : THEME.colors.textSecondary,
                    fontSize:"12px",fontFamily:THEME.fonts.body,
                  }}>{name}</button>
                ))}
              </div>
              <input style={S.inp} value={prForm.name} onChange={e=>setPrForm(f=>({...f,name:e.target.value}))}
                placeholder="Or type custom name..." onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            {/* Value + Unit */}
            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:2}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Value</label>
                <input style={S.inp} value={prForm.value} onChange={e=>setPrForm(f=>({...f,value:e.target.value}))}
                  placeholder={prForm.unit==="time"?"e.g. 3:42":"e.g. 315"}
                  onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Unit</label>
                <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                  {(prForm.category==="lift"?["lbs","kg"]:prForm.category==="benchmark"||prForm.category==="cardio"?["time","reps"]:["reps","time"]).map(u=>(
                    <button key={u} onClick={()=>setPrForm(f=>({...f,unit:u}))} style={{
                      padding:"10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:prForm.unit===u?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                      color:prForm.unit===u?THEME.colors.primary:THEME.colors.textMuted,
                      fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1px",
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={S.inpGrp}>
              <label style={{...S.lbl,fontSize:"11px"}}>Notes (optional)</label>
              <input style={S.inp} value={prForm.notes} onChange={e=>setPrForm(f=>({...f,notes:e.target.value}))}
                placeholder="e.g. Belt + sleeves, Competition, etc."
                onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            <button onClick={handleAddPr} disabled={prSaving||!prForm.name||!prForm.value} style={{
              ...S.btn1,marginTop:THEME.spacing.sm,
              opacity:(!prForm.name||!prForm.value||prSaving)?0.5:1,
            }}>
              {prSaved ? "PR Logged!" : prSaving ? "Saving..." : "Log PR"}
            </button>
          </div>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.md,margin:`${THEME.spacing.md} 0`}}>
            <div style={{flex:1,height:"1px",background:THEME.colors.border}} />
            <span style={{fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"2px",color:THEME.colors.textMuted}}>Or</span>
            <div style={{flex:1,height:"1px",background:THEME.colors.border}} />
          </div>

          {/* Post a Workout Result */}
          <div style={S.card}>
            <div style={S.cardLbl}>Post Workout Result</div>

            {/* Workout Selector */}
            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Workout</label>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {allWorkouts.map(w => (
                  <button key={w.id} onClick={() => setResForm(f => ({ ...f, workoutId: w.id }))} style={{
                    padding:"8px 14px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                    background:resForm.workoutId===w.id?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                    color:resForm.workoutId===w.id?THEME.colors.primary:THEME.colors.textSecondary,
                    fontFamily:THEME.fonts.body,fontSize:"13px",
                  }}>{w.title} <span style={{opacity:0.5,fontSize:"11px"}}>{w.type}</span></button>
                ))}
              </div>
            </div>

            {/* Score */}
            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:2}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Score</label>
                <input style={S.inp} value={resForm.score} onChange={e=>setResForm(f=>({...f,score:e.target.value}))}
                  placeholder={resForm.scoreType==="time"?"e.g. 8:42":"e.g. 5+12"}
                  onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Type</label>
                <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                  {["time","reps","rounds+reps","weight"].map(t=>(
                    <button key={t} onClick={()=>setResForm(f=>({...f,scoreType:t}))} style={{
                      padding:"7px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:resForm.scoreType===t?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                      color:resForm.scoreType===t?THEME.colors.primary:THEME.colors.textMuted,
                      fontFamily:THEME.fonts.display,fontSize:"10px",letterSpacing:"1px",
                    }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rx Toggle */}
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <button onClick={()=>setResForm(f=>({...f,rx:!f.rx}))} style={{
                width:"44px",height:"26px",borderRadius:THEME.radius.full,border:"none",cursor:"pointer",
                background:resForm.rx?THEME.colors.primary:THEME.colors.surfaceLight,
                position:"relative",transition:"background 0.2s",
              }}>
                <div style={{
                  width:"20px",height:"20px",borderRadius:"50%",background:THEME.colors.white,
                  position:"absolute",top:"3px",transition:"left 0.2s",
                  left:resForm.rx?"21px":"3px",
                }} />
              </button>
              <span style={{fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"1px",color:resForm.rx?THEME.colors.primary:THEME.colors.textMuted}}>
                {resForm.rx ? "Rx" : "Scaled"}
              </span>
            </div>

            {/* Notes */}
            <div style={S.inpGrp}>
              <label style={{...S.lbl,fontSize:"11px"}}>Notes (optional)</label>
              <input style={S.inp} value={resForm.notes} onChange={e=>setResForm(f=>({...f,notes:e.target.value}))}
                placeholder="e.g. Broke up pull-ups 11/10..."
                onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            <button onClick={handlePostResult} disabled={resSaving||!resForm.score} style={{
              ...S.btn1,marginTop:THEME.spacing.sm,
              opacity:(!resForm.score||resSaving)?0.5:1,
            }}>
              {resSaved ? "Result Posted!" : resSaving ? "Posting..." : "Post Result"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RecordsScreen;
