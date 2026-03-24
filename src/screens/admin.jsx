import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';
import { VideoModal, MovementName } from '../components/VideoModal';


const AdminScreen = () => {
  const { user } = useAuth();
  const settingsCtx = useContext(SettingsContext);
  const [tab, setTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded WODs in published list
  const [expandedWods, setExpandedWods] = useState({});
  const toggleWodExpand = (id) => setExpandedWods(p => ({ ...p, [id]: !p[id] }));

  // Removal modal
  const [removeModal, setRemoveModal] = useState(null); // { member, reason }
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const handleRemoveMember = async () => {
    if (!removeModal || !removeReason.trim()) return;
    setRemoving(true);
    await services.members.delete(removeModal.id);
    await load();
    setRemoving(false);
    setRemoveModal(null);
    setRemoveReason("");
  };

  // Settings
  const [settingsForm, setSettingsForm] = useState({
    name: GYM_CONFIG.name, shortName: GYM_CONFIG.shortName,
    primaryColor: GYM_CONFIG.colors.primary, logoUrl: GYM_CONFIG.logoUrl || "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Announcements
  const { reload: reloadAnnouncements } = useAnnouncements();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementDays, setAnnouncementDays] = useState("3");
  const [announcementPosting, setAnnouncementPosting] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);

  // Video Library
  const [videoLibrary, setVideoLibrary] = useState({}); // { movementName: url }
  const [videoSearch, setVideoSearch] = useState("");
  const [editingVideo, setEditingVideo] = useState(null); // movement name being edited
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [videoSaving, setVideoSaving] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null); // { name, url }

  const loadVideoLibrary = useCallback(async () => {
    const { data } = await supabase.from('movement_videos').select('*').eq('gym_id', GYM_CONFIG.id);
    const map = {};
    (data || []).forEach(v => { map[v.movement_name] = v.video_url; });
    setVideoLibrary(map);
  }, []);

  const saveVideoUrl = async (movementName) => {
    if (!editVideoUrl.trim()) {
      // Delete
      await supabase.from('movement_videos').delete().eq('gym_id', GYM_CONFIG.id).eq('movement_name', movementName);
    } else {
      await supabase.from('movement_videos').upsert({
        gym_id: GYM_CONFIG.id, movement_name: movementName, video_url: editVideoUrl.trim(),
      }, { onConflict: 'gym_id,movement_name' });
    }
    setEditingVideo(null); setEditVideoUrl("");
    await loadVideoLibrary();
  };

  const loadAnnouncements = useCallback(async () => {
    const active = await services.announcements.getActive();
    setActiveAnnouncements(active);
  }, []);

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setAnnouncementPosting(true);
    const days = Math.max(1, Number(announcementDays) || 3);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    await services.announcements.create({
      gymId: GYM_CONFIG.id, message: announcementText.trim(),
      createdBy: user.id, expiresAt: expiresAt.toISOString(),
    });
    setAnnouncementPosting(false);
    setShowAnnouncementModal(false);
    setAnnouncementText(""); setAnnouncementDays("3");
    await loadAnnouncements();
    reloadAnnouncements();
  };

  // WOD Builder
  const [wodForm, setWodForm] = useState({ title:"", type:"ForTime", description:"", timeCap:"", warmup:"", strength:"", accessory:"", notes:"", date:today(), targetTime:"", movements:[] });
  const [newMov, setNewMov] = useState({ name:"", reps:"", weights:{Rx:"",["Rx+"]:"",Mastered:"",Scaled:"",Foundation:""}, notes:"" });
  const [wodSaving, setWodSaving] = useState(false);
  const [wodSaved, setWodSaved] = useState(false);
  const [movSearch, setMovSearch] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  // Schedule Builder
  const [schedForm, setSchedForm] = useState({ title:"CrossFit", date:today(), startTime:"05:00", endTime:"06:00", capacity:"16", coachId:user.id });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);
  const [schedWodMode, setSchedWodMode] = useState("none"); // "none" | "existing" | "new"
  const [schedSelWodId, setSchedSelWodId] = useState(""); // selected existing workout ID
  const [schedNewWod, setSchedNewWod] = useState({ title:"", type:"ForTime", description:"", timeCap:"", warmup:"", strength:"", accessory:"", movements:[] });
  const [schedNewMov, setSchedNewMov] = useState({ name:"", reps:"", weight:"" });
  const [schedMovSearch, setSchedMovSearch] = useState("");

  // Roster filter
  const [rosterFilter, setRosterFilter] = useState("all");
  const [adminViewWod, setAdminViewWod] = useState(null);
  const [wodSearch, setWodSearch] = useState("");
  const [wodTypeFilter, setWodTypeFilter] = useState("all");
  const [wodMovFilter, setWodMovFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [m, s, w, r] = await Promise.all([
      services.members.getAll(), services.sessions.getAll(),
      services.workouts.getAll(), services.results.getAll(),
    ]);
    setMembers(m); setSessions(s); setWorkouts(w); setResults(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadAnnouncements(); loadVideoLibrary(); }, [load, loadAnnouncements, loadVideoLibrary]);

  const coaches = members.filter(m => m.role === "coach" || m.role === "admin");
  const coachName = (id) => { const m = members.find(x => x.id === id); return m ? m.firstName : "?"; };
  const todaySessions = sessions.filter(s => s.date === today());
  const todayAttendance = todaySessions.reduce((a, s) => a + s.signups.length, 0);
  const activeMembers = members.filter(m => m.membershipStatus === "active");
  const filteredRoster = rosterFilter === "all" ? members : members.filter(m => m.role === rosterFilter);

  // WOD builder
  const addMovement = () => {
    if (!newMov.name || !newMov.reps) return;
    const weights = {};
    WEIGHT_LEVELS.forEach(l => { if (newMov.weights[l]) weights[l] = newMov.weights[l]; });
    setWodForm(f => ({ ...f, movements: [...f.movements, { name: newMov.name, reps: newMov.reps, weights, weight: weights.Rx || Object.values(weights)[0] || null, notes: newMov.notes || null }] }));
    setNewMov({ name: "", reps: "", weights:{Rx:"",["Rx+"]:"",Mastered:"",Scaled:"",Foundation:""}, notes: "" });
    setMovSearch("");
  };
  const removeMovement = (idx) => {
    setWodForm(f => ({ ...f, movements: f.movements.filter((_, i) => i !== idx) }));
  };
  const handlePublishWod = async () => {
    if (!wodForm.title) return;
    // Prevent creating WODs before current date
    if (wodForm.date < today()) { alert("Cannot create a WOD for a past date."); return; }
    setWodSaving(true);
    await services.workouts.create({
      gymId: GYM_CONFIG.id, createdBy: user.id,
      date: wodForm.date + "T00:00:00Z", title: wodForm.title,
      type: wodForm.type, description: wodForm.description,
      warmup: wodForm.warmup || null,
      strength: wodForm.strength || null,
      accessory: wodForm.accessory || null,
      notes: wodForm.notes || null,
      movements: wodForm.movements,
      timeCap: wodForm.timeCap ? Number(wodForm.timeCap) : null,
      targetTime: wodForm.targetTime || null,
      rounds: null,
    });
    setWodSaving(false); setWodSaved(true);
    setWodForm({ title: "", type: "ForTime", description: "", timeCap: "", warmup: "", strength: "", accessory: "", notes: "", date: today(), targetTime: "", movements: [] });
    await load();
    setTimeout(() => setWodSaved(false), 1500);
  };

  // CSV Import handler
  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { setCsvResult({ ok: false, msg: "CSV needs a header row and at least one data row." }); setCsvImporting(false); return; }
        const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
        const rows = lines.slice(1).map(line => {
          const vals = []; let cur = "", inQ = false;
          for (const ch of line) { if (ch === '"') { inQ = !inQ; } else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ""; } else { cur += ch; } }
          vals.push(cur.trim());
          const obj = {};
          header.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^['"]|['"]$/g, ""); });
          return obj;
        });
        let imported = 0;
        for (const row of rows) {
          const title = row.title || row.name || "";
          if (!title) continue;
          const date = row.date || today();
          const movements = (row.movements || "").split(";").filter(Boolean).map(m => {
            const p = m.split(":").map(s => s.trim());
            return { name: p[0] || "", reps: p[1] || "", weight: p[2] || null, notes: null };
          }).filter(m => m.name);
          await services.workouts.create({
            gymId: GYM_CONFIG.id, createdBy: user.id,
            date: date.includes("T") ? date : date + "T00:00:00Z",
            title, type: row.type || "ForTime",
            description: row.description || row.desc || "",
            warmup: row.warmup || null, strength: row.strength || null, accessory: row.accessory || null,
            movements, timeCap: row.timecap ? Number(row.timecap) : null, rounds: null,
          });
          imported++;
        }
        await load();
        setCsvResult({ ok: true, msg: `Imported ${imported} WOD${imported !== 1 ? "s" : ""}.` });
      } catch (err) {
        setCsvResult({ ok: false, msg: "Error parsing CSV: " + err.message });
      }
      setCsvImporting(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Schedule builder
  const handleAddSession = async () => {
    if (!schedForm.title || !schedForm.date || !schedForm.startTime) return;
    setSchedSaving(true);

    let workoutId = null;

    // If linking an existing workout
    if (schedWodMode === "existing" && schedSelWodId) {
      workoutId = schedSelWodId;
    }

    // If creating a new workout inline
    if (schedWodMode === "new" && schedNewWod.title) {
      const newWod = await services.workouts.create({
        gymId: GYM_CONFIG.id, createdBy: schedForm.coachId,
        date: schedForm.date + "T00:00:00Z", title: schedNewWod.title,
        type: schedNewWod.type, description: schedNewWod.description,
        warmup: schedNewWod.warmup || null,
        strength: schedNewWod.strength || null,
        accessory: schedNewWod.accessory || null,
        movements: schedNewWod.movements,
        timeCap: schedNewWod.timeCap ? Number(schedNewWod.timeCap) : null, rounds: null,
      });
      workoutId = newWod.id;
    }

    await services.sessions.create({
      gymId: GYM_CONFIG.id, coachId: schedForm.coachId,
      title: schedForm.title, date: schedForm.date,
      startTime: schedForm.startTime, endTime: schedForm.endTime,
      capacity: Number(schedForm.capacity) || 16,
      signups: [], workoutId,
    });
    setSchedSaving(false); setSchedSaved(true);
    setSchedWodMode("none"); setSchedSelWodId("");
    setSchedNewWod({ title:"", type:"ForTime", description:"", timeCap:"", warmup:"", strength:"", accessory:"", movements:[] });
    setSchedNewMov({ name:"", reps:"", weight:"" });
    await load();
    setTimeout(() => setSchedSaved(false), 1500);
  };

  // Schedule WOD builder helpers
  const addSchedMovement = () => {
    if (!schedNewMov.name || !schedNewMov.reps) return;
    setSchedNewWod(f => ({ ...f, movements: [...f.movements, { ...schedNewMov, weight: schedNewMov.weight || null, notes: null }] }));
    setSchedNewMov({ name: "", reps: "", weight: "" });
    setSchedMovSearch("");
  };
  const removeSchedMovement = (idx) => {
    setSchedNewWod(f => ({ ...f, movements: f.movements.filter((_, i) => i !== idx) }));
  };
  const schedFilteredMovements = schedMovSearch
    ? MOVEMENT_LIBRARY.filter(m => m.toLowerCase().includes(schedMovSearch.toLowerCase()))
    : [];

  const deleteSession = async (id) => {
    await services.sessions.delete(id);
    await load();
  };

  const filteredMovements = movSearch
    ? MOVEMENT_LIBRARY.filter(m => m.toLowerCase().includes(movSearch.toLowerCase()))
    : [];

  const adminTabs = [
    { section: "Dashboard" },
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "roster", label: "Roster", icon: "📋" },
    { section: "Content" },
    { id: "wod", label: "Program", icon: "🏋️" },
    { id: "videos", label: "Videos", icon: "🎬" },
    { id: "schedule", label: "Schedule", icon: "📅" },
    ...(user.role === "admin" ? [{ section: "System" }, { id: "settings", label: "Settings", icon: "⚙️" }] : []),
  ];

  const selectTab = (id) => { setTab(id); setSidebarOpen(false); };

  return (
    <div style={S.screen}>
      {/* WOD Detail View */}
      {adminViewWod && (() => {
        const w = adminViewWod;
        const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(w.date).getDay()];
        return (
          <>
            <button onClick={() => setAdminViewWod(null)} style={{display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",cursor:"pointer",padding:"0",marginBottom:THEME.spacing.lg}}>
              <I.chevL size={20} color={THEME.colors.primary} /><span style={{fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"1.5px",color:THEME.colors.primary}}>Back to Admin</span>
            </button>
            <div style={{marginBottom:THEME.spacing.xl}}>
              <div style={{color:THEME.colors.textMuted,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"3px",marginBottom:"4px"}}>{dayName}</div>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"34px",letterSpacing:"1px",lineHeight:"1.1"}}>{w.title}</div>
              <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginTop:"8px",flexWrap:"wrap"}}>
                <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"11px",padding:"4px 12px"}}>{w.type}</div>
                {w.timeCap && <div style={{...S.badge,background:THEME.colors.surfaceLight,color:THEME.colors.textSecondary,fontSize:"11px",padding:"4px 12px"}}>{w.timeCap} min cap</div>}
              </div>
              {w.description && <div style={{color:THEME.colors.textSecondary,fontSize:"15px",marginTop:THEME.spacing.sm,lineHeight:"1.5"}}>{w.description}</div>}
            </div>
            {w.warmup && <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.warning}`}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}><span style={{fontSize:"18px"}}>🔥</span><div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.warning}}>Warmup</div></div><div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.warmup}</div></div>}
            {w.strength && <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.accent}`}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}><span style={{fontSize:"18px"}}>🏋️</span><div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.accent}}>Strength</div></div><div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.strength}</div></div>}
            {w.movements && w.movements.length > 0 && <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.primary}`}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}><span style={{fontSize:"18px"}}>⏱️</span><div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.primary}}>WOD</div></div>{w.movements.map((m,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<w.movements.length-1?`1px solid ${THEME.colors.border}`:"none"}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}><div style={{width:"28px",height:"28px",borderRadius:THEME.radius.sm,background:THEME.colors.surfaceLight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:THEME.fonts.display,fontSize:"13px",color:THEME.colors.textMuted}}>{i+1}</div><span style={{fontWeight:"600",fontSize:"15px"}}>{m.name}</span></div><div style={{textAlign:"right"}}><div style={{fontFamily:THEME.fonts.mono,fontSize:"15px",fontWeight:"600",color:THEME.colors.primary}}>{m.reps}</div>{m.weight&&<div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{m.weight}</div>}</div></div>)}</div>}
            {w.accessory && <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.textSecondary}`}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}><span style={{fontSize:"18px"}}>💪</span><div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textSecondary}}>Accessory</div></div><div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.accessory}</div></div>}
            {w.notes && <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.border}`}}><div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}><span style={{fontSize:"18px"}}>📝</span><div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textMuted}}>Coach Notes</div></div><div style={{color:THEME.colors.textSecondary,fontSize:"14px",whiteSpace:"pre-line",lineHeight:"1.7"}}>{w.notes}</div></div>}
          </>
        );
      })()}

      {!adminViewWod && (<>
      {/* Admin Header with Hamburger */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.lg}}>
        <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",display:"flex",flexDirection:"column",gap:"4px"}}>
            <div style={{width:"20px",height:"2px",background:THEME.colors.text,borderRadius:"1px"}} />
            <div style={{width:"16px",height:"2px",background:THEME.colors.text,borderRadius:"1px"}} />
            <div style={{width:"20px",height:"2px",background:THEME.colors.text,borderRadius:"1px"}} />
          </button>
          <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px"}}>Admin</div>
        </div>
        <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"10px",padding:"4px 10px"}}>
          {adminTabs.find(t=>t.id===tab)?.label || "Overview"}
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(3px)"}} />
          <div style={{
            position:"fixed",top:0,left:0,bottom:0,width:"280px",maxWidth:"80vw",
            zIndex:9999,background:THEME.colors.surface,
            borderRight:`1px solid ${THEME.colors.border}`,
            display:"flex",flexDirection:"column",
            animation:"slideIn 0.2s ease",
          }}>
            {/* Sidebar Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 20px 16px"}}>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"22px",letterSpacing:"2px",color:THEME.colors.primary}}>Admin</div>
              <button onClick={()=>setSidebarOpen(false)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px"}}>
                <I.x size={20} color={THEME.colors.textMuted} />
              </button>
            </div>

            {/* Sidebar Items */}
            <div style={{flex:1,overflowY:"auto",padding:"0 12px"}}>
              {adminTabs.map((item, idx) => {
                if (item.section) {
                  return (
                    <div key={`section-${idx}`} style={{
                      fontFamily:THEME.fonts.display,fontSize:"10px",letterSpacing:"2px",
                      color:THEME.colors.textMuted,padding:"16px 8px 6px",
                      borderTop:idx>0?`1px solid ${THEME.colors.border}`:"none",
                      marginTop:idx>0?"8px":"0",
                    }}>{item.section}</div>
                  );
                }
                const active = tab === item.id;
                return (
                  <button key={item.id} onClick={()=>selectTab(item.id)} style={{
                    display:"flex",alignItems:"center",gap:"12px",width:"100%",
                    padding:"12px 12px",marginBottom:"2px",borderRadius:THEME.radius.md,
                    border:"none",cursor:"pointer",textAlign:"left",
                    background:active?THEME.colors.primarySubtle:"transparent",
                    transition:"background 0.15s",
                  }}>
                    <span style={{fontSize:"18px",width:"24px",textAlign:"center"}}>{item.icon}</span>
                    <span style={{
                      fontFamily:THEME.fonts.display,fontSize:"15px",letterSpacing:"1px",
                      color:active?THEME.colors.primary:THEME.colors.text,
                      fontWeight:active?"700":"400",
                    }}>{item.label}</span>
                    {active && <div style={{marginLeft:"auto",width:"4px",height:"4px",borderRadius:"50%",background:THEME.colors.primary}} />}
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer */}
            <div style={{padding:"16px 20px",borderTop:`1px solid ${THEME.colors.border}`,fontSize:"11px",color:THEME.colors.textMuted}}>
              {GYM_CONFIG.name}
            </div>
          </div>
        </>
      )}

      {/* ===== OVERVIEW ===== */}
      {tab === "overview" && (
        <>
          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
            <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.primary}}>{activeMembers.length}</div><div style={S.statLbl}>Active Members</div></div>
            <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.accent}}>{coaches.length}</div><div style={S.statLbl}>Coaches</div></div>
            <div style={S.statBox}><div style={S.statVal}>{members.length}</div><div style={S.statLbl}>Total</div></div>
          </div>

          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.lg}}>
            <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.primary}}>{todaySessions.length}</div><div style={S.statLbl}>Classes Today</div></div>
            <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.accent}}>{todayAttendance}</div><div style={S.statLbl}>Signups Today</div></div>
            <div style={S.statBox}><div style={S.statVal}>{workouts.length}</div><div style={S.statLbl}>WODs Created</div></div>
          </div>

          {/* Today's classes quick view */}
          <div style={S.card}>
            <div style={S.cardLbl}>Today's Classes</div>
            {todaySessions.length === 0 && <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No classes today</div>}
            {todaySessions.map((s, i) => (
              <div key={s.id} style={{...S.sRow,borderBottom:i===todaySessions.length-1?"none":S.sRow.borderBottom}}>
                <div>
                  <div style={{fontWeight:"600",fontSize:"14px"}}>{s.title}</div>
                  <div style={{color:THEME.colors.textSecondary,fontSize:"12px"}}>{fmtTime(s.startTime)}–{fmtTime(s.endTime)} · {coachName(s.coachId)}</div>
                </div>
                <div style={{fontFamily:THEME.fonts.mono,fontSize:"16px",fontWeight:"600"}}>
                  <span style={{color:s.signups.length>=s.capacity?THEME.colors.error:THEME.colors.primary}}>{s.signups.length}</span>
                  <span style={{color:THEME.colors.textMuted}}>/{s.capacity}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Membership breakdown */}
          <div style={S.card}>
            <div style={S.cardLbl}>Membership Breakdown</div>
            {["active","paused","cancelled"].map(status => {
              const count = members.filter(m => m.membershipStatus === status).length;
              const pct = members.length > 0 ? Math.round(count / members.length * 100) : 0;
              const colors = { active: THEME.colors.primary, paused: THEME.colors.warning, cancelled: THEME.colors.error };
              return (
                <div key={status} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <span style={{fontSize:"13px",textTransform:"capitalize"}}>{status}</span>
                    <span style={{fontFamily:THEME.fonts.mono,fontSize:"13px",color:colors[status]}}>{count} ({pct}%)</span>
                  </div>
                  <div style={{height:"6px",background:THEME.colors.surfaceLight,borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:colors[status],borderRadius:"3px",transition:"width 0.3s"}} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent WODs */}
          <div style={S.card}>
            <div style={S.cardLbl}>Recent WODs</div>
            {workouts.slice(0, 5).map((w, i) => (
              <div key={w.id} style={{padding:"8px 0",borderBottom:i<Math.min(4,workouts.length-1)?`1px solid ${THEME.colors.border}`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <span style={{fontFamily:THEME.fonts.display,fontSize:"16px"}}>{w.title}</span>
                    <span style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px",marginLeft:"8px"}}>{w.type}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{results.filter(r=>r.workoutId===w.id).length} results</span>
                    <button onClick={()=>setAdminViewWod(w)} style={{
                      display:"flex",alignItems:"center",gap:"4px",padding:"4px 10px",borderRadius:THEME.radius.sm,
                      border:"none",cursor:"pointer",background:THEME.colors.primarySubtle,
                    }}>
                      <span style={{fontFamily:THEME.fonts.display,fontSize:"10px",letterSpacing:"1px",color:THEME.colors.primary}}>View</span>
                      <I.chevR size={12} color={THEME.colors.primary} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== USERS ===== */}
      {tab === "users" && (
        <>
          {/* Admin Users */}
          <div style={{marginBottom:THEME.spacing.lg}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"12px",padding:"5px 14px"}}>
                Admins & Coaches ({members.filter(m => m.role === "admin" || m.role === "coach").length})
              </div>
            </div>
            {members.filter(m => m.role === "admin" || m.role === "coach").map(m => (
              <div key={m.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <div style={{
                    ...S.avatar,
                    background: m.role==="admin" ? `linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})` : THEME.colors.accentSubtle,
                    color: m.role==="admin" ? THEME.colors.white : THEME.colors.accent,
                  }}>{m.firstName.charAt(0)}{m.lastName.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"600",fontSize:"15px"}}>{m.firstName} {m.lastName}</div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"12px",marginTop:"2px"}}>{m.email}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
                    <div style={{...S.badge,fontSize:"10px",
                      background:m.role==="admin"?THEME.colors.primarySubtle:THEME.colors.accentSubtle,
                      color:m.role==="admin"?THEME.colors.primary:THEME.colors.accent,
                    }}>{m.role}</div>
                    {/* Role toggle buttons */}
                    {m.id !== user.id && (
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                        {m.role !== "admin" && (
                          <button onClick={async ()=>{await services.members.update(m.id,{role:"admin"});await load();}} style={{
                            padding:"4px 8px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                            background:THEME.colors.primarySubtle,color:THEME.colors.primary,
                            fontSize:"9px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                          }}>Make Admin</button>
                        )}
                        {m.role !== "coach" && (
                          <button onClick={async ()=>{await services.members.update(m.id,{role:"coach"});await load();}} style={{
                            padding:"4px 8px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                            background:THEME.colors.accentSubtle,color:THEME.colors.accent,
                            fontSize:"9px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                          }}>Make Coach</button>
                        )}
                        <button onClick={async ()=>{await services.members.update(m.id,{role:"member"});await load();}} style={{
                          padding:"4px 8px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                          background:THEME.colors.surfaceLight,color:THEME.colors.textMuted,
                          fontSize:"9px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                        }}>Demote</button>
                        <button onClick={()=>setRemoveModal(m)} style={{
                          padding:"4px 8px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                          background:"rgba(231,76,60,0.12)",color:THEME.colors.error,
                          fontSize:"9px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                        }}>Remove</button>
                      </div>
                    )}
                    {m.id === user.id && <span style={{fontSize:"9px",color:THEME.colors.textMuted,fontStyle:"italic"}}>You</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Regular Members */}
          <div>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{...S.badge,background:THEME.colors.surfaceLight,color:THEME.colors.textSecondary,fontSize:"12px",padding:"5px 14px"}}>
                Members ({members.filter(m => m.role === "member").length})
              </div>
            </div>
            {members.filter(m => m.role === "member").length === 0 && (
              <div style={{...S.card,textAlign:"center",padding:THEME.spacing.lg}}>
                <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No regular members yet</div>
              </div>
            )}
            {members.filter(m => m.role === "member").map(m => (
              <div key={m.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <div style={{...S.avatar}}>{m.firstName.charAt(0)}{m.lastName.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"600",fontSize:"15px"}}>{m.firstName} {m.lastName}</div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"2px"}}>
                      <span style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{m.email}</span>
                      <div style={{
                        ...S.badge,fontSize:"8px",
                        background:m.membershipStatus==="active"?THEME.colors.primarySubtle:THEME.colors.accentSubtle,
                        color:m.membershipStatus==="active"?THEME.colors.primary:THEME.colors.warning,
                      }}>{m.membershipStatus}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                    <button onClick={async ()=>{await services.members.update(m.id,{role:"coach"});await load();}} style={{
                      padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:THEME.colors.accentSubtle,color:THEME.colors.accent,
                      fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                    }}>Make Coach</button>
                    <button onClick={async ()=>{await services.members.update(m.id,{role:"admin"});await load();}} style={{
                      padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:THEME.colors.primarySubtle,color:THEME.colors.primary,
                      fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                    }}>Make Admin</button>
                    <button onClick={()=>setRemoveModal(m)} style={{
                      padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:"rgba(231,76,60,0.12)",color:THEME.colors.error,
                      fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                    }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== MEMBER ROSTER ===== */}
      {tab === "roster" && (
        <>
          <div style={{display:"flex",gap:"6px",marginBottom:THEME.spacing.md}}>
            {["all","admin","coach","member"].map(f => (
              <button key={f} onClick={() => setRosterFilter(f)} style={{
                padding:"6px 14px",borderRadius:THEME.radius.full,border:"none",cursor:"pointer",
                background:rosterFilter===f?THEME.colors.primarySubtle:"transparent",
                color:rosterFilter===f?THEME.colors.primary:THEME.colors.textMuted,
                fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1px",textTransform:"capitalize",
              }}>{f} {f!=="all"?`(${members.filter(m=>m.role===f).length})`:`(${members.length})`}</button>
            ))}
          </div>

          {filteredRoster.map(m => (
            <div key={m.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px",display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
              <div style={{
                ...S.avatar,
                background: m.role==="admin" ? `linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})` : m.role==="coach" ? THEME.colors.accentSubtle : THEME.colors.primarySubtle,
                color: m.role==="admin" ? THEME.colors.white : m.role==="coach" ? THEME.colors.accent : THEME.colors.primary,
              }}>{m.firstName.charAt(0)}{m.lastName.charAt(0)}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:"600",fontSize:"14px"}}>{m.firstName} {m.lastName}</div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
                  <span style={{...S.badge,fontSize:"9px",
                    background: m.role==="admin"?THEME.colors.primarySubtle:m.role==="coach"?THEME.colors.accentSubtle:"rgba(255,255,255,0.05)",
                    color: m.role==="admin"?THEME.colors.primary:m.role==="coach"?THEME.colors.accent:THEME.colors.textMuted,
                  }}>{m.role}</span>
                  <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{m.email}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{
                  ...S.badge,fontSize:"9px",
                  background:m.membershipStatus==="active"?THEME.colors.primarySubtle:m.membershipStatus==="paused"?THEME.colors.accentSubtle:"rgba(231,76,60,0.12)",
                  color:m.membershipStatus==="active"?THEME.colors.primary:m.membershipStatus==="paused"?THEME.colors.warning:THEME.colors.error,
                }}>{m.membershipStatus}</div>
                <div style={{color:THEME.colors.textMuted,fontSize:"10px",marginTop:"2px"}}>{m.membershipType}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ===== WOD PROGRAMMER ===== */}
      {tab === "wod" && (
        <>
          <div style={S.card}>
            <div style={S.cardLbl}>Program a WOD</div>

            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:2}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Title</label>
                <input style={S.inp} value={wodForm.title} onChange={e=>setWodForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. FRAN, Hero WOD, etc."
                  onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Type</label>
                <div style={{display:"flex",flexDirection:"column",gap:"3px"}}>
                  {["ForTime","AMRAP","EMOM","Strength","Custom"].map(t=>(
                    <button key={t} onClick={()=>setWodForm(f=>({...f,type:t}))} style={{
                      padding:"6px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:wodForm.type===t?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                      color:wodForm.type===t?THEME.colors.primary:THEME.colors.textMuted,
                      fontFamily:THEME.fonts.display,fontSize:"10px",letterSpacing:"1px",
                    }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:2}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Description</label>
                <textarea style={{...S.inp,minHeight:"48px",resize:"none",overflow:"hidden",lineHeight:"1.6",fontFamily:THEME.fonts.body,fontSize:"14px"}}
                  value={wodForm.description} onChange={e=>{setWodForm(f=>({...f,description:e.target.value}));autoResize(e);}}
                  placeholder="e.g. 21-15-9 for time 💪" onFocus={e=>{e.target.style.borderColor=THEME.colors.primary;autoResize(e);}} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Time Cap (min)</label>
                <input style={S.inp} value={wodForm.timeCap} onChange={e=>setWodForm(f=>({...f,timeCap:e.target.value}))}
                  placeholder="e.g. 12" type="number" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>
            </div>

            {/* DATE PICKER */}
            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Scheduled Day</label>
              <div style={{display:"flex",gap:THEME.spacing.sm,alignItems:"center"}}>
                <input style={{...S.inp,flex:1}} type="date" value={wodForm.date} min={today()} onChange={e=>setWodForm(f=>({...f,date:e.target.value}))}
                  onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                <div style={{
                  padding:"14px 16px",borderRadius:THEME.radius.md,
                  background:THEME.colors.primarySubtle,color:THEME.colors.primary,
                  fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"1px",
                  minWidth:"50px",textAlign:"center",
                }}>{wodForm.date ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(wodForm.date+"T12:00:00").getDay()] : "—"}</div>
              </div>
              {/* Quick day buttons for this week */}
              <div style={{display:"flex",gap:"4px",marginTop:"8px"}}>
                {(() => {
                  const wk = getWeekDates(new Date());
                  return wk.map(d => {
                    const {day, num} = fmt(d);
                    const isSun = new Date(d+"T12:00:00").getDay() === 0;
                    const sel = wodForm.date === d;
                    return (
                      <button key={d} onClick={()=>!isSun&&setWodForm(f=>({...f,date:d}))} style={{
                        flex:1,padding:"6px 2px",borderRadius:THEME.radius.sm,border:"none",cursor:isSun?"default":"pointer",
                        background:sel?THEME.colors.primary:"transparent",opacity:isSun?0.3:1,
                        display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",
                      }}>
                        <span style={{fontFamily:THEME.fonts.display,fontSize:"9px",letterSpacing:"1px",color:sel?THEME.colors.white:THEME.colors.textMuted}}>{day}</span>
                        <span style={{fontFamily:THEME.fonts.display,fontSize:"14px",color:sel?THEME.colors.white:THEME.colors.text}}>{num}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* WARMUP SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.warning}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>🔥</span>
              <div style={S.cardLbl}>Warmup</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"48px", resize:"none", lineHeight:"1.6", overflow:"hidden",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.warmup} onChange={e=>{setWodForm(f=>({...f,warmup:e.target.value}));autoResize(e);}}
              placeholder={"e.g.\n2 Rounds:\n400m Run\n10 Inchworms\n10 Air Squats\n10 PVC Pass-throughs\n\nThen: 2x5 Empty Bar Thrusters"}
              onFocus={e=>{e.target.style.borderColor=THEME.colors.warning;autoResize(e);}} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* STRENGTH SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.accent}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>🏋️</span>
              <div style={S.cardLbl}>Strength</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"48px", resize:"none", lineHeight:"1.6", overflow:"hidden",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.strength} onChange={e=>{setWodForm(f=>({...f,strength:e.target.value}));autoResize(e);}}
              placeholder={"e.g.\nBack Squat\n5 @ 65%\n5 @ 75%\n3 @ 85%\n1 @ 90%\n1 @ 95%\n\nRest 2 min between sets"}
              onFocus={e=>{e.target.style.borderColor=THEME.colors.accent;autoResize(e);}} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* PRESCRIBED WOD SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.primary}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>⏱️</span>
              <div style={S.cardLbl}>Prescribed WOD</div>
            </div>

            {/* Target Time */}
            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Target Time</label>
              <input style={S.inp} value={wodForm.targetTime} onChange={e=>setWodForm(f=>({...f,targetTime:e.target.value}))}
                placeholder="e.g. 8-12 minutes" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            {/* Movement list */}
            {wodForm.movements.length > 0 && (
              <div style={{marginBottom:THEME.spacing.sm}}>
                {wodForm.movements.map((m, idx) => (
                  <div key={idx} style={{padding:"8px 0",borderBottom:`1px solid ${THEME.colors.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                      <span style={{fontFamily:THEME.fonts.display,fontSize:"14px",color:THEME.colors.textMuted,width:"20px"}}>{idx+1}</span>
                      <div style={{flex:1}}>
                        <span style={{fontWeight:"600",fontSize:"14px"}}>{m.name}</span>
                        <span style={{color:THEME.colors.textSecondary,fontSize:"12px",marginLeft:"8px"}}>{m.reps}</span>
                      </div>
                      <button onClick={()=>removeMovement(idx)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px"}}>
                        <I.trash size={14} color={THEME.colors.error} />
                      </button>
                    </div>
                    {/* Weight levels display */}
                    {m.weights && Object.keys(m.weights).length > 0 && (
                      <div style={{display:"flex",gap:"6px",marginTop:"4px",marginLeft:"28px",flexWrap:"wrap"}}>
                        {Object.entries(m.weights).map(([level, wt]) => (
                          <span key={level} style={{fontSize:"10px",padding:"2px 8px",borderRadius:THEME.radius.full,
                            background: level==="Rx"?THEME.colors.primarySubtle:level==="Rx+"?THEME.colors.accentSubtle:"rgba(255,255,255,0.05)",
                            color: level==="Rx"?THEME.colors.primary:level==="Rx+"?THEME.colors.accent:THEME.colors.textMuted,
                            fontFamily:THEME.fonts.display,letterSpacing:"0.5px",
                          }}>{level}: {wt}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add movement */}
            <div style={{background:THEME.colors.surfaceLight,borderRadius:THEME.radius.md,padding:THEME.spacing.md}}>
              <div style={{marginBottom:THEME.spacing.sm,position:"relative"}}>
                <label style={{...S.lbl,fontSize:"10px"}}>Movement Name</label>
                <input style={S.inp} value={newMov.name || movSearch} onChange={e=>{setMovSearch(e.target.value);setNewMov(f=>({...f,name:e.target.value}));}}
                  placeholder="Search or type..." onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>{setTimeout(()=>setMovSearch(""),200);e.target.style.borderColor=THEME.colors.border;}} />
                {filteredMovements.length > 0 && movSearch && (
                  <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:THEME.colors.surface,border:`1px solid ${THEME.colors.border}`,borderRadius:THEME.radius.md,maxHeight:"150px",overflowY:"auto"}}>
                    {filteredMovements.slice(0,6).map(m=>(
                      <button key={m} onClick={()=>{setNewMov(f=>({...f,name:m}));setMovSearch("");}} style={{
                        display:"block",width:"100%",padding:"8px 12px",background:"none",border:"none",
                        textAlign:"left",cursor:"pointer",color:THEME.colors.text,fontSize:"13px",
                        borderBottom:`1px solid ${THEME.colors.border}`,
                      }}>{m}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{marginBottom:THEME.spacing.sm}}>
                <label style={{...S.lbl,fontSize:"10px"}}>Reps</label>
                <input style={{...S.inp,padding:"10px 12px",fontSize:"14px"}} value={newMov.reps} onChange={e=>setNewMov(f=>({...f,reps:e.target.value}))} placeholder="21-15-9" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
              </div>

              {/* Weight levels */}
              <label style={{...S.lbl,fontSize:"10px"}}>Weight by Level</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:THEME.spacing.sm}}>
                {WEIGHT_LEVELS.map(level => (
                  <div key={level} style={{flex:"1 1 45%",minWidth:"120px"}}>
                    <div style={{fontSize:"9px",fontFamily:THEME.fonts.display,letterSpacing:"1px",marginBottom:"3px",
                      color: level==="Rx"?THEME.colors.primary:level==="Rx+"?THEME.colors.accent:THEME.colors.textMuted,
                    }}>{level}</div>
                    <input style={{...S.inp,padding:"8px 10px",fontSize:"13px"}} value={newMov.weights[level]}
                      onChange={e=>setNewMov(f=>({...f,weights:{...f.weights,[level]:e.target.value}}))}
                      placeholder={`${level} weight`}
                      onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                  </div>
                ))}
              </div>

              <button onClick={addMovement} disabled={!newMov.name||!newMov.reps} style={{
                width:"100%",padding:"10px 16px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                background:(!newMov.name||!newMov.reps)?THEME.colors.surfaceHover:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                color:(!newMov.name||!newMov.reps)?THEME.colors.textMuted:THEME.colors.white,
                fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1px",
              }}>Add Movement</button>
            </div>
          </div>

          {/* ACCESSORY SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.textSecondary}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>💪</span>
              <div style={S.cardLbl}>Accessory Work</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"48px", resize:"none", lineHeight:"1.6", overflow:"hidden",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.accessory} onChange={e=>{setWodForm(f=>({...f,accessory:e.target.value}));autoResize(e);}}
              placeholder={"e.g.\n3x12 Dumbbell Rows (each arm)\n3x15 GHD Hip Extensions\n3x20 Banded Pull-aparts\n\nFoam roll and stretch 5 min"}
              onFocus={e=>{e.target.style.borderColor=THEME.colors.textSecondary;autoResize(e);}} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* NOTES SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>📝</span>
              <div style={S.cardLbl}>Coach Notes</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"48px", resize:"none", lineHeight:"1.6", overflow:"hidden",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.notes} onChange={e=>{setWodForm(f=>({...f,notes:e.target.value}));autoResize(e);}}
              placeholder={"e.g.\nRemind athletes to focus on depth on squats\nScale options: banded pull-ups or ring rows\nCool down with 5 min easy row"}
              onFocus={e=>{e.target.style.borderColor=THEME.colors.textMuted;autoResize(e);}} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* CSV IMPORT — now after Notes, before Publish */}
          <div style={{...S.card,background:THEME.colors.surfaceLight,border:`1px dashed ${THEME.colors.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>📄</span>
              <div style={S.cardLbl}>Import WODs from CSV</div>
            </div>
            <div style={{color:THEME.colors.textMuted,fontSize:"12px",marginBottom:THEME.spacing.md,lineHeight:"1.6"}}>
              Upload a CSV with columns: <span style={{fontFamily:THEME.fonts.mono,fontSize:"11px",color:THEME.colors.textSecondary}}>date, title, type, description, timecap, warmup, strength, accessory, movements</span>
              <br/>Movements format: <span style={{fontFamily:THEME.fonts.mono,fontSize:"11px",color:THEME.colors.textSecondary}}>Name:Reps:Weight;Name:Reps:Weight</span>
            </div>
            <label style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
              padding:"12px",borderRadius:THEME.radius.md,cursor:"pointer",
              background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
              color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",
              opacity:csvImporting?0.5:1,
            }}>
              <I.plus size={16} color={THEME.colors.white} />
              {csvImporting ? "Importing..." : "Choose CSV File"}
              <input type="file" accept=".csv" onChange={handleCsvImport} disabled={csvImporting} style={{display:"none"}} />
            </label>
            {csvResult && (
              <div style={{
                marginTop:THEME.spacing.sm,padding:"10px 14px",borderRadius:THEME.radius.md,fontSize:"13px",
                background:csvResult.ok?THEME.colors.primarySubtle:"rgba(231,76,60,0.12)",
                color:csvResult.ok?THEME.colors.primary:THEME.colors.error,
              }}>{csvResult.msg}</div>
            )}
          </div>

          {/* PUBLISH BUTTON */}
          <button onClick={handlePublishWod} disabled={wodSaving||!wodForm.title} style={{
            ...S.btn1,marginBottom:THEME.spacing.lg,
            opacity:(!wodForm.title||wodSaving)?0.5:1,
          }}>
            {wodSaved?"WOD Published!":wodSaving?"Publishing...":"Publish WOD"}
          </button>

          {/* Existing WODs */}
          <div style={{...S.cardLbl,marginBottom:THEME.spacing.sm}}>Published WODs ({workouts.length})</div>

          {/* Search bar */}
          <div style={{marginBottom:THEME.spacing.sm}}>
            <input style={{...S.inp,padding:"10px 14px",fontSize:"14px"}} value={wodSearch} onChange={e=>setWodSearch(e.target.value)}
              placeholder="🔍 Search WODs by name..."
              onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* Type filter */}
          <div style={{display:"flex",gap:"5px",marginBottom:THEME.spacing.sm,flexWrap:"wrap"}}>
            {["all","ForTime","AMRAP","EMOM","Strength","Custom"].map(t=>(
              <button key={t} onClick={()=>setWodTypeFilter(t)} style={{
                padding:"5px 12px",borderRadius:THEME.radius.full,border:"none",cursor:"pointer",
                background:wodTypeFilter===t?THEME.colors.primarySubtle:"transparent",
                color:wodTypeFilter===t?THEME.colors.primary:THEME.colors.textMuted,
                fontFamily:THEME.fonts.display,fontSize:"10px",letterSpacing:"1px",
              }}>{t === "all" ? "All Types" : t}</button>
            ))}
          </div>

          {/* Movement filter */}
          <div style={{marginBottom:THEME.spacing.md}}>
            <input style={{...S.inp,padding:"8px 12px",fontSize:"13px"}} value={wodMovFilter} onChange={e=>setWodMovFilter(e.target.value)}
              placeholder="Filter by movement (e.g. Thrusters, Pull-ups)..."
              onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* Filtered WOD list */}
          {(() => {
            let filtered = [...workouts].sort((a,b)=>new Date(b.date)-new Date(a.date));
            if (wodSearch) filtered = filtered.filter(w => w.title.toLowerCase().includes(wodSearch.toLowerCase()));
            if (wodTypeFilter !== "all") filtered = filtered.filter(w => w.type === wodTypeFilter);
            if (wodMovFilter) filtered = filtered.filter(w => w.movements.some(m => m.name.toLowerCase().includes(wodMovFilter.toLowerCase())));

            if (filtered.length === 0) return (
              <div style={{...S.card,textAlign:"center",padding:THEME.spacing.lg}}>
                <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No WODs match your filters</div>
              </div>
            );

            return filtered.map(w => {
              const expanded = expandedWods[w.id];
              return (
                <div key={w.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
                  {/* Header — always visible */}
                  <div onClick={()=>toggleWodExpand(w.id)} style={{cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{w.title}</div>
                        <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
                          <span style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px"}}>{w.type}</span>
                          {w.timeCap && <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.timeCap} min</span>}
                          <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.movements.length} mov</span>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:THEME.fonts.display,fontSize:"13px",color:THEME.colors.primary}}>
                            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(w.date).getDay()]}
                          </div>
                          <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{new Date(w.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                        </div>
                        <div style={{transform:expanded?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
                          <I.chevR size={16} color={THEME.colors.textMuted} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Movements — always visible */}
                  {w.movements.length > 0 && (
                    <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`,marginTop:"8px"}}>
                      <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.primary,marginBottom:"4px"}}>⏱️ WOD</div>
                      {w.movements.map((m,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:"12px",color:THEME.colors.textSecondary}}>
                          <span>{m.name}</span><span style={{fontFamily:THEME.fonts.mono,fontSize:"11px"}}>{m.reps}{m.weight?` @ ${m.weight}`:""}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded details — warmup, strength, accessory, notes */}
                  {expanded && (
                    <div style={{marginTop:"4px"}}>
                      {w.warmup && (
                        <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.warning,marginBottom:"4px"}}>🔥 Warmup</div>
                          <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.warmup}</div>
                        </div>
                      )}
                      {w.strength && (
                        <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.accent,marginBottom:"4px"}}>🏋️ Strength</div>
                          <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.strength}</div>
                        </div>
                      )}
                      {w.accessory && (
                        <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textSecondary,marginBottom:"4px"}}>💪 Accessory</div>
                          <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.accessory}</div>
                        </div>
                      )}
                      {w.notes && (
                        <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                          <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textMuted,marginBottom:"4px"}}>📝 Notes</div>
                          <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.notes}</div>
                        </div>
                      )}
                      {!w.warmup && !w.strength && !w.accessory && !w.notes && (
                        <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`,color:THEME.colors.textMuted,fontSize:"12px",fontStyle:"italic"}}>No additional details</div>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </>
      )}

      {/* ===== VIDEO LIBRARY ===== */}
      {tab === "videos" && (
        <>
          <div style={{marginBottom:THEME.spacing.md}}>
            <input style={{...S.inp,padding:"10px 14px",fontSize:"14px"}} value={videoSearch} onChange={e=>setVideoSearch(e.target.value)}
              placeholder="🔍 Search movements..."
              onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.primary}}>{Object.keys(videoLibrary).length}</div>
              <div style={S.statLbl}>Videos Added</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.textMuted}}>{MOVEMENT_LIBRARY.length - Object.keys(videoLibrary).length}</div>
              <div style={S.statLbl}>Without Video</div>
            </div>
          </div>

          {MOVEMENT_LIBRARY
            .filter(m => !videoSearch || m.toLowerCase().includes(videoSearch.toLowerCase()))
            .map(movName => {
              const hasVideo = !!videoLibrary[movName];
              const isEditing = editingVideo === movName;
              return (
                <div key={movName} style={{
                  ...S.card, padding:THEME.spacing.md, marginBottom:"6px",
                  borderLeft: `3px solid ${hasVideo ? THEME.colors.primary : THEME.colors.border}`,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,flex:1}}>
                      {hasVideo && <span style={{fontSize:"14px",color:THEME.colors.primary}}>▶</span>}
                      {!hasVideo && <span style={{fontSize:"14px",color:THEME.colors.textMuted}}>○</span>}
                      <span style={{fontWeight:"600",fontSize:"14px"}}>{movName}</span>
                    </div>
                    <div style={{display:"flex",gap:"4px"}}>
                      {hasVideo && (
                        <button onClick={()=>setPlayingVideo({name:movName,url:videoLibrary[movName]})} style={{
                          padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                          background:THEME.colors.primarySubtle,color:THEME.colors.primary,
                          fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                        }}>Watch</button>
                      )}
                      <button onClick={()=>{setEditingVideo(isEditing?null:movName);setEditVideoUrl(videoLibrary[movName]||"");}} style={{
                        padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                        background:THEME.colors.surfaceLight,color:THEME.colors.textMuted,
                        fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                      }}>{isEditing ? "Cancel" : hasVideo ? "Edit" : "Add"}</button>
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{marginTop:THEME.spacing.sm,display:"flex",gap:THEME.spacing.sm}}>
                      <input style={{...S.inp,flex:1,padding:"10px 12px",fontSize:"13px"}}
                        value={editVideoUrl} onChange={e=>setEditVideoUrl(e.target.value)}
                        placeholder="Paste YouTube URL..."
                        onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                      <button onClick={()=>saveVideoUrl(movName)} style={{
                        padding:"10px 16px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                        background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                        color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",flexShrink:0,
                      }}>Save</button>
                      {hasVideo && (
                        <button onClick={async()=>{setEditVideoUrl("");await saveVideoUrl(movName);}} style={{
                          padding:"10px 12px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                          background:"rgba(231,76,60,0.12)",color:THEME.colors.error,
                          fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",flexShrink:0,
                        }}>Remove</button>
                      )}
                    </div>
                  )}

                  {hasVideo && !isEditing && (
                    <div style={{marginTop:"4px",fontSize:"11px",color:THEME.colors.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {videoLibrary[movName]}
                    </div>
                  )}
                </div>
              );
            })}
        </>
      )}

      {/* Video Playback Modal */}
      {playingVideo && (
        <VideoModal movement={playingVideo.name} videoUrl={playingVideo.url} onClose={()=>setPlayingVideo(null)} />
      )}

      {/* ===== SCHEDULE BUILDER ===== */}
      {tab === "schedule" && (
        <>
          {/* Announcement Section */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.md}}>
            <div style={{fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"2px",color:THEME.colors.textMuted}}>
              📢 Announcements ({activeAnnouncements.length} active)
            </div>
            <button onClick={()=>setShowAnnouncementModal(true)} style={{
              display:"flex",alignItems:"center",gap:"6px",
              padding:"8px 14px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
              background:THEME.colors.primarySubtle,color:THEME.colors.primary,
              fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",
            }}>
              <I.plus size={14} color={THEME.colors.primary} /> Announcement
            </button>
          </div>

          {/* Active announcements list */}
          {activeAnnouncements.length > 0 && (
            <div style={{marginBottom:THEME.spacing.md}}>
              {activeAnnouncements.map(a => (
                <div key={a.id} style={{
                  ...S.card,padding:"12px 16px",marginBottom:"6px",
                  borderLeft:`3px solid ${THEME.colors.primary}`,
                  display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px",
                }}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"13px",color:THEME.colors.text,lineHeight:"1.4",whiteSpace:"pre-line"}}>{a.message}</div>
                    <div style={{fontSize:"10px",color:THEME.colors.textMuted,marginTop:"4px"}}>
                      Expires {new Date(a.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </div>
                  </div>
                  <button onClick={async ()=>{await services.announcements.delete(a.id);await loadAnnouncements();reloadAnnouncements();}} style={{
                    background:"none",border:"none",cursor:"pointer",padding:"4px",flexShrink:0,
                  }}>
                    <I.trash size={14} color={THEME.colors.error} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={S.card}>
            <div style={S.cardLbl}>Add a Class Session</div>

            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:"11px"}}>Class Type</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                  {GYM_CONFIG.classTypes.slice(0,4).map(ct=>(
                    <button key={ct} onClick={()=>setSchedForm(f=>({...f,title:ct}))} style={{
                      padding:"6px 10px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                      background:schedForm.title===ct?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                      color:schedForm.title===ct?THEME.colors.primary:THEME.colors.textMuted,
                      fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                    }}>{ct}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:1}}><label style={{...S.lbl,fontSize:"11px"}}>Date</label><input style={S.inp} type="date" value={schedForm.date} onChange={e=>setSchedForm(f=>({...f,date:e.target.value}))} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
              <div style={{flex:1}}><label style={{...S.lbl,fontSize:"11px"}}>Capacity</label><input style={S.inp} type="number" value={schedForm.capacity} onChange={e=>setSchedForm(f=>({...f,capacity:e.target.value}))} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
            </div>

            <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <div style={{flex:1}}><label style={{...S.lbl,fontSize:"11px"}}>Start</label><input style={S.inp} type="time" value={schedForm.startTime} onChange={e=>setSchedForm(f=>({...f,startTime:e.target.value}))} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
              <div style={{flex:1}}><label style={{...S.lbl,fontSize:"11px"}}>End</label><input style={S.inp} type="time" value={schedForm.endTime} onChange={e=>setSchedForm(f=>({...f,endTime:e.target.value}))} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
            </div>

            <div style={{marginBottom:THEME.spacing.md}}>
              <label style={{...S.lbl,fontSize:"11px"}}>Coach</label>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {coaches.map(c=>(
                  <button key={c.id} onClick={()=>setSchedForm(f=>({...f,coachId:c.id}))} style={{
                    padding:"8px 14px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                    background:schedForm.coachId===c.id?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                    color:schedForm.coachId===c.id?THEME.colors.primary:THEME.colors.textSecondary,
                    fontSize:"13px",fontFamily:THEME.fonts.body,
                  }}>{c.firstName} {c.lastName.charAt(0)}.</button>
                ))}
              </div>
            </div>
          </div>

          {/* WORKOUT ASSIGNMENT */}
          <div style={S.card}>
            <div style={S.cardLbl}>Assign Workout</div>

            {/* Mode selector */}
            <div style={{display:"flex",gap:"6px",marginBottom:THEME.spacing.md}}>
              {[{id:"none",l:"No Workout"},{id:"existing",l:"Existing WOD"},{id:"new",l:"+ Create New"}].map(m=>(
                <button key={m.id} onClick={()=>{setSchedWodMode(m.id);setSchedSelWodId("");}} style={{
                  flex:1,padding:"10px 4px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                  background:schedWodMode===m.id?THEME.colors.primary:THEME.colors.surfaceLight,
                  color:schedWodMode===m.id?THEME.colors.white:THEME.colors.textSecondary,
                  fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",
                }}>{m.l}</button>
              ))}
            </div>

            {/* EXISTING WOD SELECTOR */}
            {schedWodMode === "existing" && (
              <div>
                <label style={{...S.lbl,fontSize:"11px"}}>Select a Workout</label>
                {workouts.length === 0 && <div style={{color:THEME.colors.textMuted,fontSize:"13px",padding:"8px 0"}}>No workouts created yet. Create one in the Program tab first.</div>}
                <div style={{maxHeight:"400px",overflowY:"auto"}}>
                  {[...workouts].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(w => {
                    const sel = schedSelWodId === w.id;
                    return (
                      <button key={w.id} onClick={()=>setSchedSelWodId(sel?"":w.id)} style={{
                        display:"block",width:"100%",textAlign:"left",padding:"12px",marginBottom:"6px",
                        borderRadius:THEME.radius.md,cursor:"pointer",
                        background:sel?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                        border:sel?`2px solid ${THEME.colors.primary}`:`2px solid transparent`,
                        transition:"all 0.15s",
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",color:sel?THEME.colors.primary:THEME.colors.text}}>{w.title}</div>
                            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"3px"}}>
                              <span style={{...S.badge,background:sel?THEME.colors.primary+"22":THEME.colors.border,color:sel?THEME.colors.primary:THEME.colors.textMuted,fontSize:"9px"}}>{w.type}</span>
                              {w.timeCap && <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.timeCap} min</span>}
                              <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.movements.length} mov</span>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontFamily:THEME.fonts.display,fontSize:"12px",color:sel?THEME.colors.primary:THEME.colors.textMuted}}>
                              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(w.date).getDay()]}
                            </div>
                            <div style={{color:THEME.colors.textMuted,fontSize:"10px"}}>{new Date(w.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                          </div>
                        </div>
                        {/* Always show strength + movements */}
                        {(w.strength || w.movements.length > 0) && (
                          <div style={{marginTop:"8px",paddingTop:"8px",borderTop:`1px solid ${THEME.colors.border}`}}>
                            {w.strength && (
                              <div style={{marginBottom:w.movements.length > 0 ? "8px" : "0"}}>
                                <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.accent,marginBottom:"3px"}}>🏋️ Strength</div>
                                <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.4"}}>{w.strength}</div>
                              </div>
                            )}
                            {w.movements.length > 0 && (
                              <div>
                                <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.primary,marginBottom:"3px"}}>⏱️ WOD</div>
                                {w.movements.map((m,mi) => (
                                  <div key={mi} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:"12px"}}>
                                    <span style={{color:THEME.colors.text,fontWeight:"500"}}>{m.name}</span>
                                    <span style={{color:THEME.colors.textMuted,fontFamily:THEME.fonts.mono,fontSize:"11px"}}>{m.reps}{m.weight ? ` @ ${m.weight}` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Show warmup/accessory labels when selected */}
                        {sel && (w.warmup || w.accessory) && (
                          <div style={{marginTop:"6px",paddingTop:"6px",borderTop:`1px solid ${THEME.colors.border}`,display:"flex",gap:"8px",flexWrap:"wrap"}}>
                            {w.warmup && <span style={{fontSize:"10px",color:THEME.colors.warning}}>🔥 Warmup included</span>}
                            {w.accessory && <span style={{fontSize:"10px",color:THEME.colors.textMuted}}>💪 Accessory included</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CREATE NEW WOD INLINE */}
            {schedWodMode === "new" && (
              <div>
                {/* Title + Type */}
                <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
                  <div style={{flex:2}}>
                    <label style={{...S.lbl,fontSize:"11px"}}>WOD Title</label>
                    <input style={S.inp} value={schedNewWod.title} onChange={e=>setSchedNewWod(f=>({...f,title:e.target.value}))}
                      placeholder="e.g. FRAN, Hero WOD..." onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                  </div>
                  <div style={{flex:1}}>
                    <label style={{...S.lbl,fontSize:"11px"}}>Type</label>
                    <div style={{display:"flex",flexDirection:"column",gap:"3px"}}>
                      {["ForTime","AMRAP","EMOM","Strength","Custom"].map(t=>(
                        <button key={t} onClick={()=>setSchedNewWod(f=>({...f,type:t}))} style={{
                          padding:"5px",borderRadius:THEME.radius.sm,border:"none",cursor:"pointer",
                          background:schedNewWod.type===t?THEME.colors.primarySubtle:THEME.colors.surfaceLight,
                          color:schedNewWod.type===t?THEME.colors.primary:THEME.colors.textMuted,
                          fontFamily:THEME.fonts.display,fontSize:"9px",letterSpacing:"1px",
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description + Time Cap */}
                <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
                  <div style={{flex:2}}>
                    <label style={{...S.lbl,fontSize:"11px"}}>Description</label>
                    <input style={S.inp} value={schedNewWod.description} onChange={e=>setSchedNewWod(f=>({...f,description:e.target.value}))}
                      placeholder="e.g. 21-15-9 for time" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                  </div>
                  <div style={{flex:1}}>
                    <label style={{...S.lbl,fontSize:"11px"}}>Time Cap</label>
                    <input style={S.inp} value={schedNewWod.timeCap} onChange={e=>setSchedNewWod(f=>({...f,timeCap:e.target.value}))}
                      placeholder="min" type="number" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                  </div>
                </div>

                {/* Warmup */}
                <div style={{marginBottom:THEME.spacing.md}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                    <span style={{fontSize:"14px"}}>🔥</span>
                    <label style={{...S.lbl,fontSize:"11px",marginBottom:0}}>Warmup</label>
                  </div>
                  <textarea style={{...S.inp,minHeight:"48px",resize:"none",overflow:"hidden",lineHeight:"1.5",fontFamily:THEME.fonts.body,fontSize:"13px"}}
                    value={schedNewWod.warmup} onChange={e=>{setSchedNewWod(f=>({...f,warmup:e.target.value}));autoResize(e);}}
                    placeholder="2 Rounds: 400m Run, 10 Air Squats..."
                    onFocus={e=>(e.target.style.borderColor=THEME.colors.warning)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                </div>

                {/* Strength */}
                <div style={{marginBottom:THEME.spacing.md}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                    <span style={{fontSize:"14px"}}>🏋️</span>
                    <label style={{...S.lbl,fontSize:"11px",marginBottom:0}}>Strength</label>
                  </div>
                  <textarea style={{...S.inp,minHeight:"48px",resize:"none",overflow:"hidden",lineHeight:"1.5",fontFamily:THEME.fonts.body,fontSize:"13px"}}
                    value={schedNewWod.strength} onChange={e=>{setSchedNewWod(f=>({...f,strength:e.target.value}));autoResize(e);}}
                    placeholder="Back Squat 5x5 @ 80%..."
                    onFocus={e=>(e.target.style.borderColor=THEME.colors.accent)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                </div>

                {/* WOD Movements */}
                <div style={{marginBottom:THEME.spacing.md}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                    <span style={{fontSize:"14px"}}>⏱️</span>
                    <label style={{...S.lbl,fontSize:"11px",marginBottom:0}}>WOD Movements ({schedNewWod.movements.length})</label>
                  </div>

                  {schedNewWod.movements.map((m, idx) => (
                    <div key={idx} style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,padding:"6px 0",borderBottom:`1px solid ${THEME.colors.border}`}}>
                      <span style={{fontFamily:THEME.fonts.display,fontSize:"12px",color:THEME.colors.textMuted,width:"18px"}}>{idx+1}</span>
                      <div style={{flex:1}}>
                        <span style={{fontWeight:"600",fontSize:"13px"}}>{m.name}</span>
                        <span style={{color:THEME.colors.textSecondary,fontSize:"11px",marginLeft:"6px"}}>{m.reps}{m.weight?` @ ${m.weight}`:""}</span>
                      </div>
                      <button onClick={()=>removeSchedMovement(idx)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px"}}>
                        <I.trash size={12} color={THEME.colors.error} />
                      </button>
                    </div>
                  ))}

                  {/* Add movement inline */}
                  <div style={{background:THEME.colors.surfaceLight,borderRadius:THEME.radius.md,padding:THEME.spacing.sm,marginTop:"6px"}}>
                    <div style={{marginBottom:"6px",position:"relative"}}>
                      <input style={{...S.inp,padding:"10px 12px",fontSize:"13px"}} value={schedNewMov.name || schedMovSearch}
                        onChange={e=>{setSchedMovSearch(e.target.value);setSchedNewMov(f=>({...f,name:e.target.value}));}}
                        placeholder="Movement name..."
                        onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)}
                        onBlur={e=>{setTimeout(()=>setSchedMovSearch(""),200);e.target.style.borderColor=THEME.colors.border;}} />
                      {schedFilteredMovements.length > 0 && schedMovSearch && (
                        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:THEME.colors.surface,border:`1px solid ${THEME.colors.border}`,borderRadius:THEME.radius.md,maxHeight:"120px",overflowY:"auto"}}>
                          {schedFilteredMovements.slice(0,5).map(m=>(
                            <button key={m} onClick={()=>{setSchedNewMov(f=>({...f,name:m}));setSchedMovSearch("");}} style={{
                              display:"block",width:"100%",padding:"7px 10px",background:"none",border:"none",
                              textAlign:"left",cursor:"pointer",color:THEME.colors.text,fontSize:"12px",
                              borderBottom:`1px solid ${THEME.colors.border}`,
                            }}>{m}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:"6px"}}>
                      <input style={{...S.inp,flex:1,padding:"8px 10px",fontSize:"13px"}} value={schedNewMov.reps}
                        onChange={e=>setSchedNewMov(f=>({...f,reps:e.target.value}))} placeholder="Reps"
                        onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                      <input style={{...S.inp,flex:1,padding:"8px 10px",fontSize:"13px"}} value={schedNewMov.weight}
                        onChange={e=>setSchedNewMov(f=>({...f,weight:e.target.value}))} placeholder="Weight"
                        onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                      <button onClick={addSchedMovement} disabled={!schedNewMov.name||!schedNewMov.reps} style={{
                        padding:"8px 14px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                        background:(!schedNewMov.name||!schedNewMov.reps)?THEME.colors.surfaceHover:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                        color:(!schedNewMov.name||!schedNewMov.reps)?THEME.colors.textMuted:THEME.colors.white,
                        fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",flexShrink:0,
                      }}>Add</button>
                    </div>
                  </div>
                </div>

                {/* Accessory */}
                <div style={{marginBottom:THEME.spacing.sm}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                    <span style={{fontSize:"14px"}}>💪</span>
                    <label style={{...S.lbl,fontSize:"11px",marginBottom:0}}>Accessory</label>
                  </div>
                  <textarea style={{...S.inp,minHeight:"48px",resize:"none",overflow:"hidden",lineHeight:"1.5",fontFamily:THEME.fonts.body,fontSize:"13px"}}
                    value={schedNewWod.accessory} onChange={e=>{setSchedNewWod(f=>({...f,accessory:e.target.value}));autoResize(e);}}
                    placeholder="3x12 DB Rows, 3x15 GHD Extensions..."
                    onFocus={e=>(e.target.style.borderColor=THEME.colors.textSecondary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                </div>
              </div>
            )}

            {/* No workout message */}
            {schedWodMode === "none" && (
              <div style={{color:THEME.colors.textMuted,fontSize:"13px",fontStyle:"italic",padding:"4px 0"}}>
                Session will be created without an assigned workout.
              </div>
            )}
          </div>

          {/* ADD SESSION BUTTON */}
          <button onClick={handleAddSession} disabled={schedSaving || (schedWodMode==="new" && !schedNewWod.title)} style={{
            ...S.btn1,marginBottom:THEME.spacing.lg,
            opacity:(schedSaving || (schedWodMode==="new" && !schedNewWod.title))?0.5:1,
          }}>
            {schedSaved ? "Session Added!" : schedSaving ? "Creating..." : schedWodMode==="new" ? "Create WOD & Add Session" : "Add Session"}
          </button>

          {/* Today's schedule */}
          <div style={{...S.cardLbl,marginBottom:THEME.spacing.sm}}>Today's Schedule ({todaySessions.length} classes)</div>
          {todaySessions.map(s => {
            const linkedWod = s.workoutId ? workouts.find(w=>w.id===s.workoutId) : null;
            return (
              <div key={s.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
                  <div style={{width:"3px",height:"40px",borderRadius:"2px",background:THEME.colors.primary,flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"600",fontSize:"14px"}}>{s.title}</div>
                    <div style={{color:THEME.colors.textSecondary,fontSize:"12px"}}>{fmtTime(s.startTime)}–{fmtTime(s.endTime)} · {coachName(s.coachId)}</div>
                    {linkedWod && (
                      <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"4px"}}>
                        <span style={{fontSize:"12px"}}>⏱️</span>
                        <span style={{fontFamily:THEME.fonts.display,fontSize:"12px",color:THEME.colors.primary,letterSpacing:"0.5px"}}>{linkedWod.title}</span>
                        <span style={{...S.badge,fontSize:"8px",background:THEME.colors.primarySubtle,color:THEME.colors.primary}}>{linkedWod.type}</span>
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",marginRight:"8px"}}>
                    <div style={{fontFamily:THEME.fonts.mono,fontSize:"14px"}}>{s.signups.length}/{s.capacity}</div>
                  </div>
                  <button onClick={()=>deleteSession(s.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px"}}>
                    <I.trash size={14} color={THEME.colors.error} />
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== SETTINGS (Admin only) ===== */}
      {tab === "settings" && user.role === "admin" && (
        <>
          <div style={S.card}>
            <div style={S.cardLbl}>Gym Branding</div>

            {/* Gym Name */}
            <div style={S.inpGrp}>
              <label style={{...S.lbl,fontSize:"11px"}}>Gym Name</label>
              <input style={S.inp} value={settingsForm.name} onChange={e=>setSettingsForm(f=>({...f,name:e.target.value}))}
                placeholder="e.g. Tekton Fitness" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            <div style={S.inpGrp}>
              <label style={{...S.lbl,fontSize:"11px"}}>Short Name (tab bar, header)</label>
              <input style={S.inp} value={settingsForm.shortName} onChange={e=>setSettingsForm(f=>({...f,shortName:e.target.value}))}
                placeholder="e.g. TEKTON" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
            </div>

            {/* Primary Color */}
            <div style={S.inpGrp}>
              <label style={{...S.lbl,fontSize:"11px"}}>Primary Color</label>
              <div style={{display:"flex",gap:THEME.spacing.sm,alignItems:"center"}}>
                <input type="color" value={settingsForm.primaryColor} onChange={e=>setSettingsForm(f=>({...f,primaryColor:e.target.value}))}
                  style={{width:"48px",height:"48px",border:`2px solid ${THEME.colors.border}`,borderRadius:THEME.radius.md,cursor:"pointer",background:"none",padding:"2px"}} />
                <input style={{...S.inp,flex:1}} value={settingsForm.primaryColor} onChange={e=>setSettingsForm(f=>({...f,primaryColor:e.target.value}))}
                  placeholder="#2D8C4E" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
                <div style={{width:"48px",height:"48px",borderRadius:THEME.radius.md,background:settingsForm.primaryColor,flexShrink:0}} />
              </div>
              {/* Quick color presets */}
              <div style={{display:"flex",gap:"6px",marginTop:THEME.spacing.sm,flexWrap:"wrap"}}>
                {["#2D8C4E","#E74C3C","#3498DB","#9B59B6","#E67E22","#1ABC9C","#F39C12","#2C3E50","#E91E63","#00BCD4"].map(c=>(
                  <button key={c} onClick={()=>setSettingsForm(f=>({...f,primaryColor:c}))} style={{
                    width:"32px",height:"32px",borderRadius:THEME.radius.sm,border:settingsForm.primaryColor===c?`3px solid ${THEME.colors.white}`:`2px solid ${THEME.colors.border}`,
                    background:c,cursor:"pointer",transition:"all 0.15s",
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div style={S.card}>
            <div style={S.cardLbl}>Gym Logo</div>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.lg}}>
              {settingsForm.logoUrl ? (
                <img src={settingsForm.logoUrl} alt="" style={{width:"72px",height:"72px",borderRadius:THEME.radius.lg,objectFit:"contain",background:THEME.colors.surfaceLight,padding:"4px"}} />
              ) : (
                <div style={{
                  width:"72px",height:"72px",borderRadius:THEME.radius.lg,
                  background:`linear-gradient(135deg,${settingsForm.primaryColor},${darkenHex(settingsForm.primaryColor)})`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:THEME.fonts.display,fontSize:"28px",color:THEME.colors.white,
                }}>{settingsForm.shortName?.charAt(0) || "G"}</div>
              )}
              <div style={{flex:1}}>
                <label style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
                  padding:"10px",borderRadius:THEME.radius.md,cursor:"pointer",
                  border:`1px dashed ${THEME.colors.border}`,color:THEME.colors.textSecondary,
                  fontSize:"13px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                }}>
                  <I.plus size={14} color={THEME.colors.textSecondary} /> Upload Logo
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split(".").pop();
                    const path = `logos/${GYM_CONFIG.id}.${ext}`;
                    await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                    setSettingsForm(f => ({ ...f, logoUrl: urlData.publicUrl + "?t=" + Date.now() }));
                  }} />
                </label>
                {settingsForm.logoUrl && (
                  <button onClick={()=>setSettingsForm(f=>({...f,logoUrl:""}))} style={{
                    marginTop:"6px",background:"none",border:"none",cursor:"pointer",
                    color:THEME.colors.error,fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1px",
                  }}>Remove Logo</button>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div style={S.card}>
            <div style={S.cardLbl}>Preview</div>
            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:THEME.spacing.md,background:THEME.colors.bg,borderRadius:THEME.radius.md}}>
              {settingsForm.logoUrl ? (
                <img src={settingsForm.logoUrl} alt="" style={{width:"32px",height:"32px",borderRadius:"8px",objectFit:"contain"}} />
              ) : (
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:`linear-gradient(135deg,${settingsForm.primaryColor},${darkenHex(settingsForm.primaryColor)})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontFamily:THEME.fonts.display,color:"#fff",fontWeight:"700"}}>{settingsForm.shortName?.charAt(0) || "G"}</div>
              )}
              <span style={{fontFamily:THEME.fonts.display,fontSize:"16px",color:settingsForm.primaryColor,letterSpacing:"3px"}}>{settingsForm.shortName || "GYM"}</span>
            </div>
            <div style={{marginTop:THEME.spacing.sm,display:"flex",gap:"6px"}}>
              <div style={{padding:"8px 16px",borderRadius:THEME.radius.md,background:`linear-gradient(135deg,${settingsForm.primaryColor},${darkenHex(settingsForm.primaryColor)})`,color:"#fff",fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px"}}>Primary Button</div>
              <div style={{padding:"8px 16px",borderRadius:THEME.radius.md,background:subtleHex(settingsForm.primaryColor),color:settingsForm.primaryColor,fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px"}}>Subtle Button</div>
            </div>
          </div>

          {/* Save */}
          <button onClick={async () => {
            setSettingsSaving(true);
            // Save to Supabase gym_settings table
            await supabase.from("gym_settings").upsert({
              gym_id: GYM_CONFIG.id,
              name: settingsForm.name, short_name: settingsForm.shortName,
              primary_color: settingsForm.primaryColor,
              logo_url: settingsForm.logoUrl || null,
            }, { onConflict: "gym_id" });
            // Apply immediately
            applyGymSettings({ name: settingsForm.name, shortName: settingsForm.shortName, primaryColor: settingsForm.primaryColor, logoUrl: settingsForm.logoUrl || null });
            settingsCtx.refresh();
            setSettingsSaving(false); setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 1500);
          }} disabled={settingsSaving} style={{
            ...S.btn1,marginBottom:THEME.spacing.lg,
            background:`linear-gradient(135deg,${settingsForm.primaryColor},${darkenHex(settingsForm.primaryColor)})`,
            opacity:settingsSaving?0.5:1,
          }}>
            {settingsSaved ? "Settings Saved!" : settingsSaving ? "Saving..." : "Save Settings"}
          </button>
        </>
      )}

      </>)}

      {/* ===== ANNOUNCEMENT MODAL ===== */}
      {showAnnouncementModal && (
        <>
          <div onClick={()=>{setShowAnnouncementModal(false);setAnnouncementText("");setAnnouncementDays("3");}} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}} />
          <div style={{
            position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            zIndex:9999,width:"90%",maxWidth:"400px",
            background:THEME.colors.surface,border:`1px solid ${THEME.colors.border}`,
            borderRadius:THEME.radius.lg,padding:THEME.spacing.lg,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
              <span style={{fontSize:"20px"}}>📢</span>
              <div style={{fontFamily:THEME.fonts.display,fontSize:"20px",letterSpacing:"1px"}}>New Announcement</div>
            </div>

            <label style={{...S.lbl,fontSize:"11px"}}>Announcement Message</label>
            <textarea style={{...S.inp,minHeight:"100px",resize:"none",overflow:"hidden",lineHeight:"1.5",fontFamily:THEME.fonts.body,fontSize:"14px",marginBottom:THEME.spacing.md}}
              value={announcementText} onChange={e=>{setAnnouncementText(e.target.value);autoResize(e);}}
              placeholder={"e.g. Gym closed this Saturday for maintenance.\n\nLinks: paste a URL or use [click here](https://example.com)"}
              onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />

            <div style={{fontSize:"11px",color:THEME.colors.textMuted,marginBottom:THEME.spacing.md,lineHeight:"1.5"}}>
              💡 To add a link, paste a URL directly or use: <span style={{fontFamily:THEME.fonts.mono,fontSize:"10px",color:THEME.colors.textSecondary}}>[link text](https://url.com)</span>
            </div>

            <label style={{...S.lbl,fontSize:"11px"}}>Display for how many days?</label>
            <input style={{...S.inp,marginBottom:THEME.spacing.lg}} type="number" min="1" value={announcementDays}
              onChange={e=>setAnnouncementDays(e.target.value)} placeholder="e.g. 3"
              onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />

            <div style={{display:"flex",gap:THEME.spacing.sm}}>
              <button onClick={()=>{setShowAnnouncementModal(false);setAnnouncementText("");setAnnouncementDays("3");}} style={{...S.btn2,flex:1,marginTop:0}}>Cancel</button>
              <button onClick={handlePostAnnouncement} disabled={!announcementText.trim()||announcementPosting} style={{
                ...S.btn1,flex:1,marginTop:0,
                opacity:(!announcementText.trim()||announcementPosting)?0.5:1,
              }}>
                {announcementPosting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== REMOVAL MODAL ===== */}
      {removeModal && (
        <>
          <div onClick={()=>{setRemoveModal(null);setRemoveReason("");}} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}} />
          <div style={{
            position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            zIndex:9999,width:"90%",maxWidth:"380px",
            background:THEME.colors.surface,border:`1px solid ${THEME.colors.border}`,
            borderRadius:THEME.radius.lg,padding:THEME.spacing.lg,
          }}>
            <div style={{fontFamily:THEME.fonts.display,fontSize:"20px",letterSpacing:"1px",marginBottom:THEME.spacing.sm,color:THEME.colors.error}}>Remove Member</div>
            <div style={{fontSize:"14px",color:THEME.colors.textSecondary,marginBottom:THEME.spacing.md,lineHeight:"1.5"}}>
              Are you sure you want to remove <strong style={{color:THEME.colors.text}}>{removeModal.firstName} {removeModal.lastName}</strong> from {GYM_CONFIG.name}? This action cannot be undone.
            </div>

            <label style={{...S.lbl,fontSize:"11px"}}>Reason for removing member <span style={{color:THEME.colors.error}}>*</span></label>
            <textarea style={{...S.inp,minHeight:"80px",resize:"none",overflow:"hidden",lineHeight:"1.5",fontFamily:THEME.fonts.body,fontSize:"14px",marginBottom:THEME.spacing.md}}
              value={removeReason} onChange={e=>{setRemoveReason(e.target.value);autoResize(e);}}
              placeholder="e.g. Violated gym policies, requested account deletion..."
              onFocus={e=>(e.target.style.borderColor=THEME.colors.error)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />

            <div style={{display:"flex",gap:THEME.spacing.sm}}>
              <button onClick={()=>{setRemoveModal(null);setRemoveReason("");}} style={{...S.btn2,flex:1,marginTop:0}}>Cancel</button>
              <button onClick={handleRemoveMember} disabled={!removeReason.trim()||removing} style={{
                flex:1,padding:"14px",border:"none",borderRadius:THEME.radius.md,cursor:"pointer",
                background:(!removeReason.trim()||removing)?"rgba(231,76,60,0.3)":"#E74C3C",
                color:THEME.colors.white,fontFamily:THEME.fonts.display,fontSize:"14px",letterSpacing:"2px",
                opacity:removing?0.5:1,
              }}>
                {removing ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminScreen;
