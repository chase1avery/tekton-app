import { useState, useEffect, useCallback } from 'react';
import { THEME, S, I, services, supabase, useAuth, getWeekDates, today, darkenHex } from '../config/shared';

const AnalyticsScreen = ({ onBack }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState("attendance"); // attendance | prs | volume | nutrition
  const [loading, setLoading] = useState(true);

  // Data
  const [sessionHistory, setSessionHistory] = useState([]); // all sessions user signed up for
  const [prs, setPrs] = useState([]);
  const [prFilter, setPrFilter] = useState("all");
  const [targets, setTargets] = useState(null);
  const [mealData, setMealData] = useState([]); // weekly macro adherence

  const todayStr = today();

  const load = useCallback(async () => {
    setLoading(true);
    const [allSessions, allPrs] = await Promise.all([
      services.sessions.getAll(),
      services.prs.getByField("memberId", user.id),
    ]);

    // Filter sessions where user is signed up
    const mySessions = allSessions.filter(s => s.signups && s.signups.includes(user.id));
    setSessionHistory(mySessions);
    setPrs(allPrs.sort((a, b) => new Date(b.date) - new Date(a.date)));

    // Load nutrition data
    try {
      const { data: t } = await supabase.from("nutrition_targets").select("*").eq("member_id", user.id).single();
      if (t) setTargets({ calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat });

      const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const { data: meals } = await supabase.from("meal_logs").select("*").eq("member_id", user.id).gte("date", fourWeeksAgo.toISOString().split("T")[0]);
      setMealData(meals || []);
    } catch (e) { /* no nutrition */ }

    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // ---- ATTENDANCE HEATMAP DATA (12 weeks) ----
  const heatmapData = (() => {
    const weeks = [];
    const now = new Date();
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (w * 7) - now.getDay() + 1); // Monday
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        const dateStr = date.toISOString().split("T")[0];
        const count = sessionHistory.filter(s => s.date === dateStr).length;
        const isFuture = date > now;
        days.push({ date: dateStr, count, isFuture, dayName: ["M","T","W","T","F","S","S"][d] });
      }
      weeks.push(days);
    }
    return weeks;
  })();

  const totalSessionsAll = sessionHistory.length;
  const last12WeekSessions = sessionHistory.filter(s => {
    const d = new Date(s.date); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 84);
    return d >= cutoff;
  }).length;

  // ---- WORKOUT VOLUME DATA (8 weeks) ----
  const volumeData = (() => {
    const weeks = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (w * 7) - now.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split("T")[0];
      const endStr = weekEnd.toISOString().split("T")[0];
      const count = sessionHistory.filter(s => s.date >= startStr && s.date <= endStr).length;
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeks.push({ label, count, startStr });
    }
    return weeks;
  })();

  const avgPerWeek = volumeData.length > 0 ? (volumeData.reduce((a, w) => a + w.count, 0) / volumeData.length).toFixed(1) : 0;
  const thisMonthSessions = sessionHistory.filter(s => {
    const d = new Date(s.date); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lastMonthSessions = sessionHistory.filter(s => {
    const d = new Date(s.date); const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }).length;

  // ---- PR DATA ----
  const prCategories = [
    { id: "all", label: "All" }, { id: "lift", label: "Lifts" },
    { id: "benchmark", label: "Benchmarks" }, { id: "gymnastics", label: "Gymnastics" },
    { id: "cardio", label: "Cardio" },
  ];
  const filteredPrs = prFilter === "all" ? prs : prs.filter(p => p.category === prFilter);

  // Group PRs by name to find improvements
  const prGroups = {};
  prs.forEach(p => {
    if (!prGroups[p.name]) prGroups[p.name] = [];
    prGroups[p.name].push(p);
  });
  const prNames = Object.keys(prGroups);
  const totalPrCount = prs.length;
  const mostRecentPr = prs.length > 0 ? prs[0] : null;

  // ---- MACRO ADHERENCE DATA (4 weeks) ----
  const macroAdherence = (() => {
    if (!targets) return null;
    const weeks = [];
    const now = new Date();
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (w * 7) - now.getDay() + 1);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split("T")[0];
      const endStr = weekEnd.toISOString().split("T")[0];

      // Group meals by day
      const dayTotals = {};
      mealData.filter(m => m.date >= startStr && m.date <= endStr).forEach(m => {
        if (!dayTotals[m.date]) dayTotals[m.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        dayTotals[m.date].calories += m.calories || 0;
        dayTotals[m.date].protein += m.protein || 0;
        dayTotals[m.date].carbs += m.carbs || 0;
        dayTotals[m.date].fat += m.fat || 0;
      });

      const daysLogged = Object.keys(dayTotals).length;
      const calHit = Object.values(dayTotals).filter(d => d.calories >= targets.calories * 0.9 && d.calories <= targets.calories * 1.1).length;
      const proHit = Object.values(dayTotals).filter(d => d.protein >= targets.protein * 0.9).length;
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

      weeks.push({
        label, daysLogged,
        calPct: daysLogged > 0 ? Math.round((calHit / daysLogged) * 100) : 0,
        proPct: daysLogged > 0 ? Math.round((proHit / daysLogged) * 100) : 0,
      });
    }
    return weeks;
  })();

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: "10px 4px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: tab === id ? THEME.colors.primary : THEME.colors.surfaceLight,
      color: tab === id ? THEME.colors.white : THEME.colors.textSecondary,
      fontFamily: THEME.fonts.display, fontSize: "11px", letterSpacing: "1px",
    }}>{label}</button>
  );

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm, marginBottom: THEME.spacing.lg }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
          <I.chevL size={22} color={THEME.colors.primary} />
        </button>
        <div style={{ fontFamily: THEME.fonts.display, fontSize: "28px", letterSpacing: "1px" }}>Analytics</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: THEME.spacing.lg }}>
        <TabBtn id="attendance" label="Attendance" />
        <TabBtn id="prs" label="PRs" />
        <TabBtn id="volume" label="Volume" />
        {targets && <TabBtn id="nutrition" label="Macros" />}
      </div>

      {loading && <div style={{ textAlign: "center", color: THEME.colors.textMuted, padding: THEME.spacing.xl }}>Loading...</div>}

      {/* ===== ATTENDANCE HEATMAP ===== */}
      {!loading && tab === "attendance" && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.primary }}>{last12WeekSessions}</div>
              <div style={S.statLbl}>Last 12 Weeks</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.accent }}>{totalSessionsAll}</div>
              <div style={S.statLbl}>All Time</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px" }}>{avgPerWeek}</div>
              <div style={S.statLbl}>Avg / Week</div>
            </div>
          </div>

          {/* Heatmap */}
          <div style={S.card}>
            <div style={S.cardLbl}>12-Week Attendance</div>
            {/* Day labels */}
            <div style={{ display: "flex", gap: "3px", marginBottom: "6px" }}>
              <div style={{ width: "22px" }} />
              {heatmapData[0]?.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "9px", fontFamily: THEME.fonts.display, color: THEME.colors.textMuted, letterSpacing: "0.5px" }}>{d.dayName}</div>
              ))}
            </div>
            {/* Grid */}
            {heatmapData.map((week, wi) => (
              <div key={wi} style={{ display: "flex", gap: "3px", marginBottom: "3px", alignItems: "center" }}>
                <div style={{ width: "22px", fontSize: "8px", fontFamily: THEME.fonts.mono, color: THEME.colors.textMuted, textAlign: "right", paddingRight: "4px" }}>
                  {wi === 0 || wi === 4 || wi === 8 ? `W${wi + 1}` : ""}
                </div>
                {week.map((day, di) => {
                  const intensity = day.isFuture ? 0 : day.count === 0 ? 0 : day.count === 1 ? 1 : 2;
                  const colors = [THEME.colors.surfaceLight, THEME.colors.primary + "66", THEME.colors.primary];
                  return (
                    <div key={di} style={{
                      flex: 1, aspectRatio: "1", borderRadius: "3px",
                      background: day.isFuture ? "transparent" : colors[intensity],
                      border: day.date === todayStr ? `1.5px solid ${THEME.colors.accent}` : "none",
                      minHeight: "12px",
                    }} title={`${day.date}: ${day.count} session${day.count !== 1 ? "s" : ""}`} />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div style={{ display: "flex", gap: THEME.spacing.md, justifyContent: "center", marginTop: THEME.spacing.md }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: THEME.colors.surfaceLight }} />
                <span style={{ fontSize: "9px", color: THEME.colors.textMuted }}>None</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: THEME.colors.primary + "66" }} />
                <span style={{ fontSize: "9px", color: THEME.colors.textMuted }}>1 class</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: THEME.colors.primary }} />
                <span style={{ fontSize: "9px", color: THEME.colors.textMuted }}>2+ classes</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== PR TIMELINE ===== */}
      {!loading && tab === "prs" && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.primary }}>{totalPrCount}</div>
              <div style={S.statLbl}>Total PRs</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.accent }}>{prNames.length}</div>
              <div style={S.statLbl}>Movements</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "14px", color: THEME.colors.text }}>
                {mostRecentPr ? mostRecentPr.name : "—"}
              </div>
              <div style={S.statLbl}>Latest PR</div>
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ display: "flex", gap: "4px", marginBottom: THEME.spacing.md, flexWrap: "wrap" }}>
            {prCategories.map(c => (
              <button key={c.id} onClick={() => setPrFilter(c.id)} style={{
                padding: "6px 12px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
                background: prFilter === c.id ? THEME.colors.primarySubtle : THEME.colors.surfaceLight,
                color: prFilter === c.id ? THEME.colors.primary : THEME.colors.textMuted,
                fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1px",
              }}>{c.label}</button>
            ))}
          </div>

          {/* PR List with Progression */}
          {filteredPrs.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: THEME.spacing.xl }}>
              <div style={{ color: THEME.colors.textMuted, fontSize: "14px" }}>
                {prFilter === "all" ? "No PRs logged yet" : `No ${prFilter} PRs logged`}
              </div>
            </div>
          )}

          {filteredPrs.map((pr, idx) => {
            // Check if this PR improved on a previous one
            const sameNamePrs = prGroups[pr.name] || [];
            const prevPr = sameNamePrs.find(p => new Date(p.date) < new Date(pr.date) && p.id !== pr.id);
            const prDate = new Date(pr.date + "T12:00:00");

            return (
              <div key={pr.id} style={{
                ...S.card, padding: THEME.spacing.md, marginBottom: "6px",
                borderLeft: `3px solid ${THEME.colors.accent}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "15px" }}>{pr.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span style={{ fontFamily: THEME.fonts.mono, fontSize: "18px", fontWeight: "700", color: THEME.colors.primary }}>
                        {pr.value} {pr.unit}
                      </span>
                      {prevPr && (
                        <span style={{ fontSize: "11px", color: THEME.colors.success, fontFamily: THEME.fonts.mono }}>
                          ↑ from {prevPr.value}
                        </span>
                      )}
                    </div>
                    {pr.notes && <div style={{ fontSize: "12px", color: THEME.colors.textMuted, fontStyle: "italic", marginTop: "4px" }}>{pr.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ ...S.badge, background: THEME.colors.accentSubtle, color: THEME.colors.accent, fontSize: "9px" }}>{pr.category}</div>
                    <div style={{ fontSize: "11px", color: THEME.colors.textMuted, marginTop: "4px" }}>
                      {prDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== WORKOUT VOLUME ===== */}
      {!loading && tab === "volume" && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.primary }}>{thisMonthSessions}</div>
              <div style={S.statLbl}>This Month</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, fontSize: "20px", color: THEME.colors.accent }}>{lastMonthSessions}</div>
              <div style={S.statLbl}>Last Month</div>
            </div>
            <div style={S.statBox}>
              <div style={{
                ...S.statVal, fontSize: "20px",
                color: thisMonthSessions > lastMonthSessions ? THEME.colors.success : thisMonthSessions < lastMonthSessions ? THEME.colors.error : THEME.colors.text,
              }}>
                {thisMonthSessions > lastMonthSessions ? "↑" : thisMonthSessions < lastMonthSessions ? "↓" : "="}{" "}
                {Math.abs(thisMonthSessions - lastMonthSessions)}
              </div>
              <div style={S.statLbl}>Trend</div>
            </div>
          </div>

          {/* Bar Chart */}
          <div style={S.card}>
            <div style={S.cardLbl}>Sessions Per Week (8 Weeks)</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "140px", marginBottom: THEME.spacing.sm }}>
              {volumeData.map((w, i) => {
                const maxCount = Math.max(...volumeData.map(x => x.count), 1);
                const pct = w.count / maxCount;
                const isThisWeek = i === volumeData.length - 1;
                const meetsStreak = w.count >= 4;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div style={{ fontSize: "11px", fontFamily: THEME.fonts.mono, color: THEME.colors.textMuted, fontWeight: "600" }}>
                      {w.count > 0 ? w.count : ""}
                    </div>
                    <div style={{
                      width: "100%", borderRadius: "4px 4px 2px 2px",
                      height: `${Math.max(pct * 100, 4)}px`,
                      background: meetsStreak
                        ? `linear-gradient(180deg, ${THEME.colors.primary}, ${darkenHex(THEME.colors.primary)})`
                        : w.count > 0 ? THEME.colors.primary + "66" : THEME.colors.surfaceLight,
                      opacity: isThisWeek ? 1 : 0.8,
                      transition: "height 0.3s",
                    }} />
                    <div style={{
                      fontSize: "9px", fontFamily: THEME.fonts.display, letterSpacing: "0.5px",
                      color: isThisWeek ? THEME.colors.primary : THEME.colors.textMuted,
                      fontWeight: isThisWeek ? "700" : "400",
                    }}>{w.label}</div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: THEME.spacing.md, justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: THEME.colors.primary }} />
                <span style={{ fontSize: "9px", color: THEME.colors.textMuted }}>4+ (streak)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: THEME.colors.primary + "66" }} />
                <span style={{ fontSize: "9px", color: THEME.colors.textMuted }}>1-3 sessions</span>
              </div>
            </div>
          </div>

          {/* Weekly Average */}
          <div style={S.card}>
            <div style={S.cardLbl}>Weekly Average</div>
            <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.md }}>
              <div style={{ fontFamily: THEME.fonts.mono, fontSize: "36px", fontWeight: "700", color: THEME.colors.primary }}>{avgPerWeek}</div>
              <div>
                <div style={{ fontSize: "14px", color: THEME.colors.text }}>sessions per week</div>
                <div style={{ fontSize: "12px", color: THEME.colors.textMuted, marginTop: "2px" }}>
                  {Number(avgPerWeek) >= 4 ? "🔥 Maintaining streak pace!" : Number(avgPerWeek) >= 3 ? "Almost at streak pace (4/week)" : "Build towards 4/week for a streak"}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== MACRO ADHERENCE ===== */}
      {!loading && tab === "nutrition" && targets && (
        <>
          {/* Current Targets */}
          <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
            {[
              { l: "Calories", v: targets.calories, c: THEME.colors.primary, u: "" },
              { l: "Protein", v: targets.protein + "g", c: "#E74C3C", u: "" },
              { l: "Carbs", v: targets.carbs + "g", c: "#3498DB", u: "" },
              { l: "Fat", v: targets.fat + "g", c: "#F39C12", u: "" },
            ].map(x => (
              <div key={x.l} style={S.statBox}>
                <div style={{ ...S.statVal, fontSize: "16px", color: x.c }}>{x.v}</div>
                <div style={S.statLbl}>{x.l}</div>
              </div>
            ))}
          </div>

          {/* Adherence Chart */}
          <div style={S.card}>
            <div style={S.cardLbl}>4-Week Adherence</div>
            {macroAdherence && macroAdherence.map((wk, i) => (
              <div key={i} style={{
                padding: "12px 0",
                borderBottom: i < macroAdherence.length - 1 ? `1px solid ${THEME.colors.border}` : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{
                    fontFamily: THEME.fonts.display, fontSize: "13px",
                    color: i === macroAdherence.length - 1 ? THEME.colors.primary : THEME.colors.textMuted,
                    fontWeight: i === macroAdherence.length - 1 ? "700" : "400",
                  }}>Week of {wk.label}</span>
                  <span style={{ fontSize: "11px", color: THEME.colors.textMuted }}>{wk.daysLogged} days logged</span>
                </div>
                {/* Calorie adherence bar */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontSize: "10px", color: THEME.colors.textMuted }}>Calories</span>
                    <span style={{ fontSize: "10px", fontFamily: THEME.fonts.mono, color: wk.calPct >= 70 ? THEME.colors.success : wk.calPct >= 40 ? THEME.colors.warning : THEME.colors.error }}>{wk.calPct}%</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", background: THEME.colors.surfaceLight, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "3px", width: `${wk.calPct}%`,
                      background: wk.calPct >= 70 ? THEME.colors.success : wk.calPct >= 40 ? THEME.colors.warning : THEME.colors.error,
                      transition: "width 0.5s",
                    }} />
                  </div>
                </div>
                {/* Protein adherence bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontSize: "10px", color: THEME.colors.textMuted }}>Protein</span>
                    <span style={{ fontSize: "10px", fontFamily: THEME.fonts.mono, color: wk.proPct >= 70 ? THEME.colors.success : wk.proPct >= 40 ? THEME.colors.warning : THEME.colors.error }}>{wk.proPct}%</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", background: THEME.colors.surfaceLight, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "3px", width: `${wk.proPct}%`,
                      background: wk.proPct >= 70 ? THEME.colors.success : wk.proPct >= 40 ? THEME.colors.warning : THEME.colors.error,
                      transition: "width 0.5s",
                    }} />
                  </div>
                </div>
              </div>
            ))}
            {(!macroAdherence || macroAdherence.every(w => w.daysLogged === 0)) && (
              <div style={{ textAlign: "center", padding: THEME.spacing.lg, color: THEME.colors.textMuted, fontSize: "14px" }}>
                Start logging meals to see adherence data
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsScreen;
