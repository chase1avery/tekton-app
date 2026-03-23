import { useState, useEffect, useCallback } from 'react';
import { GYM_CONFIG, THEME, S, I, supabase, useAuth, autoResize } from '../config/shared';

// Macro calculator: estimate daily targets from body weight, activity, and goal
const calcMacros = (weightLbs, activity, goal) => {
  const weightKg = weightLbs / 2.205;
  const bmr = 10 * weightKg + 6.25 * 170 - 5 * 30 + 5; // Mifflin-St Jeor (avg height/age)
  const actMultiplier = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }[activity] || 1.55;
  let tdee = Math.round(bmr * actMultiplier);
  const goalAdj = { cut: -500, maintain: 0, build: 300 }[goal] || 0;
  const calories = Math.round(tdee + goalAdj);
  const protein = Math.round(weightLbs * (goal === "cut" ? 1.2 : goal === "build" ? 1.0 : 1.0));
  const fat = Math.round(calories * 0.25 / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { calories, protein, carbs, fat };
};

// Progress ring component
const MacroRing = ({ label, current, target, color, unit = "g", size = 80 }) => {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const statusColor = pct >= 0.9 && pct <= 1.1 ? THEME.colors.success : pct > 1.1 ? THEME.colors.error : color;
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={THEME.colors.surfaceLight} strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={statusColor} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div style={{ marginTop: "-" + (size / 2 + 12) + "px", position: "relative", height: size / 2 + 12 + "px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: THEME.fonts.mono, fontSize: "16px", fontWeight: "700", color: THEME.colors.text }}>{current}</div>
        <div style={{ fontSize: "9px", color: THEME.colors.textMuted }}>/ {target}{unit}</div>
      </div>
      <div style={{ fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1.5px", color, marginTop: "4px" }}>{label}</div>
    </div>
  );
};

const NutritionScreen = ({ onBack }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState("today"); // today | log | week | setup
  const [targets, setTargets] = useState(null); // { calories, protein, carbs, fat, goal, bodyWeight }
  const [todayMeals, setTodayMeals] = useState([]);
  const [weekData, setWeekData] = useState([]); // [{ date, calories, protein, carbs, fat }]
  const [savedMeals, setSavedMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Meal form
  const [mealForm, setMealForm] = useState({ meal_name: "", calories: "", protein: "", carbs: "", fat: "", notes: "" });
  const [mealSaving, setMealSaving] = useState(false);
  const [mealSaved, setMealSaved] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Setup form
  const [setupForm, setSetupForm] = useState({ bodyWeight: "", activity: "active", goal: "maintain" });
  const [setupSaving, setSetupSaving] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    setLoading(true);
    // Load targets
    const { data: t } = await supabase.from("nutrition_targets").select("*").eq("member_id", user.id).single();
    if (t) setTargets({ calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, goal: t.goal, bodyWeight: t.body_weight });

    // Load today's meals
    const { data: meals } = await supabase.from("meal_logs").select("*").eq("member_id", user.id).eq("date", todayStr).order("created_at");
    setTodayMeals(meals || []);

    // Load week data (last 7 days)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const { data: weekMeals } = await supabase.from("meal_logs").select("*").eq("member_id", user.id).gte("date", weekStart.toISOString().split("T")[0]).order("date");

    // Aggregate by day
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      days[ds] = { date: ds, calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    (weekMeals || []).forEach(m => {
      if (days[m.date]) {
        days[m.date].calories += m.calories || 0;
        days[m.date].protein += m.protein || 0;
        days[m.date].carbs += m.carbs || 0;
        days[m.date].fat += m.fat || 0;
      }
    });
    setWeekData(Object.values(days));

    // Load saved meals
    const { data: saved } = await supabase.from("saved_meals").select("*").eq("member_id", user.id).order("created_at", { ascending: false });
    setSavedMeals(saved || []);

    setLoading(false);
  }, [user.id, todayStr]);

  useEffect(() => { load(); }, [load]);

  // Today's totals
  const totals = todayMeals.reduce((a, m) => ({
    calories: a.calories + (m.calories || 0), protein: a.protein + (m.protein || 0),
    carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Log a meal
  const handleLogMeal = async () => {
    if (!mealForm.meal_name || mealSaving) return;
    setMealSaving(true);
    await supabase.from("meal_logs").insert({
      member_id: user.id, date: todayStr, meal_name: mealForm.meal_name,
      calories: Number(mealForm.calories) || 0, protein: Number(mealForm.protein) || 0,
      carbs: Number(mealForm.carbs) || 0, fat: Number(mealForm.fat) || 0,
      notes: mealForm.notes || null,
    });
    setMealSaving(false); setMealSaved(true);
    setMealForm({ meal_name: "", calories: "", protein: "", carbs: "", fat: "", notes: "" });
    await load();
    setTimeout(() => setMealSaved(false), 1500);
  };

  // Save meal as template
  const handleSaveMeal = async () => {
    if (!mealForm.meal_name) return;
    await supabase.from("saved_meals").insert({
      member_id: user.id, meal_name: mealForm.meal_name,
      calories: Number(mealForm.calories) || 0, protein: Number(mealForm.protein) || 0,
      carbs: Number(mealForm.carbs) || 0, fat: Number(mealForm.fat) || 0,
    });
    await load();
  };

  // Use saved meal
  const useSavedMeal = (meal) => {
    setMealForm({ meal_name: meal.meal_name, calories: String(meal.calories), protein: String(meal.protein), carbs: String(meal.carbs), fat: String(meal.fat), notes: "" });
    setShowSaved(false);
  };

  // Delete a meal log
  const deleteMeal = async (id) => {
    await supabase.from("meal_logs").delete().eq("id", id);
    await load();
  };

  // Save nutrition targets
  const handleSaveSetup = async () => {
    if (!setupForm.bodyWeight) return;
    setSetupSaving(true);
    const macros = calcMacros(Number(setupForm.bodyWeight), setupForm.activity, setupForm.goal);
    await supabase.from("nutrition_targets").upsert({
      member_id: user.id, calories: macros.calories, protein: macros.protein,
      carbs: macros.carbs, fat: macros.fat, goal: setupForm.goal,
      body_weight: Number(setupForm.bodyWeight), set_by: user.id,
    }, { onConflict: "member_id" });
    setTargets({ ...macros, goal: setupForm.goal, bodyWeight: Number(setupForm.bodyWeight) });
    setSetupSaving(false);
    setTab("today");
  };

  // Save custom targets directly
  const handleSaveCustomTargets = async () => {
    setSetupSaving(true);
    await supabase.from("nutrition_targets").upsert({
      member_id: user.id,
      calories: Number(setupForm.customCals) || targets?.calories || 2000,
      protein: Number(setupForm.customPro) || targets?.protein || 150,
      carbs: Number(setupForm.customCarbs) || targets?.carbs || 200,
      fat: Number(setupForm.customFat) || targets?.fat || 60,
      goal: targets?.goal || "maintain",
      body_weight: targets?.bodyWeight || null, set_by: user.id,
    }, { onConflict: "member_id" });
    await load();
    setSetupSaving(false);
    setTab("today");
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: "10px 4px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: tab === id ? THEME.colors.primary : THEME.colors.surfaceLight,
      color: tab === id ? THEME.colors.white : THEME.colors.textSecondary,
      fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1.5px",
    }}>{label}</button>
  );

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm, marginBottom: THEME.spacing.lg }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
          <I.chevL size={22} color={THEME.colors.primary} />
        </button>
        <div style={{ fontFamily: THEME.fonts.display, fontSize: "28px", letterSpacing: "1px" }}>Nutrition</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: THEME.spacing.lg }}>
        <TabBtn id="today" label="Today" />
        <TabBtn id="log" label="+ Log" />
        <TabBtn id="week" label="Week" />
        <TabBtn id="setup" label="Setup" />
      </div>

      {/* No targets set — prompt setup */}
      {!targets && tab !== "setup" && (
        <div style={{ ...S.card, textAlign: "center", padding: THEME.spacing.xl }}>
          <div style={{ fontSize: "40px", marginBottom: THEME.spacing.md }}>🥗</div>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "18px", marginBottom: THEME.spacing.sm }}>Set Up Your Macros</div>
          <div style={{ color: THEME.colors.textMuted, fontSize: "14px", marginBottom: THEME.spacing.lg }}>
            Calculate your daily targets based on your weight and goals
          </div>
          <button onClick={() => setTab("setup")} style={{ ...S.btn1, width: "auto", display: "inline-flex", padding: "12px 24px" }}>
            Get Started
          </button>
        </div>
      )}

      {/* ===== TODAY ===== */}
      {tab === "today" && targets && (
        <>
          {/* Macro Rings */}
          <div style={{ ...S.card, display: "flex", gap: THEME.spacing.sm, justifyContent: "center" }}>
            <MacroRing label="CALORIES" current={totals.calories} target={targets.calories} color={THEME.colors.primary} unit="cal" />
            <MacroRing label="PROTEIN" current={totals.protein} target={targets.protein} color="#E74C3C" />
            <MacroRing label="CARBS" current={totals.carbs} target={targets.carbs} color="#3498DB" />
            <MacroRing label="FAT" current={totals.fat} target={targets.fat} color="#F39C12" />
          </div>

          {/* Remaining */}
          <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
            {[
              { l: "Calories", r: targets.calories - totals.calories, c: THEME.colors.primary },
              { l: "Protein", r: targets.protein - totals.protein, c: "#E74C3C" },
              { l: "Carbs", r: targets.carbs - totals.carbs, c: "#3498DB" },
              { l: "Fat", r: targets.fat - totals.fat, c: "#F39C12" },
            ].map(x => (
              <div key={x.l} style={{ flex: 1, textAlign: "center", padding: "8px", background: THEME.colors.surfaceLight, borderRadius: THEME.radius.md }}>
                <div style={{ fontFamily: THEME.fonts.mono, fontSize: "14px", fontWeight: "700", color: x.r >= 0 ? x.c : THEME.colors.error }}>{x.r >= 0 ? x.r : `+${Math.abs(x.r)}`}</div>
                <div style={{ fontSize: "8px", fontFamily: THEME.fonts.display, letterSpacing: "1px", color: THEME.colors.textMuted, marginTop: "2px" }}>{x.l} left</div>
              </div>
            ))}
          </div>

          {/* Today's Meals */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: THEME.spacing.sm }}>
            <div style={S.cardLbl}>Today's Meals ({todayMeals.length})</div>
            <button onClick={() => setTab("log")} style={{
              padding: "6px 12px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
              background: THEME.colors.primarySubtle, color: THEME.colors.primary,
              fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1px",
            }}><I.plus size={12} color={THEME.colors.primary} /> Log Meal</button>
          </div>

          {todayMeals.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: THEME.spacing.lg }}>
              <div style={{ color: THEME.colors.textMuted, fontSize: "14px" }}>No meals logged today</div>
            </div>
          )}

          {todayMeals.map(m => (
            <div key={m.id} style={{ ...S.card, padding: THEME.spacing.md, marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "15px" }}>{m.meal_name}</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: THEME.colors.primary, fontFamily: THEME.fonts.mono }}>{m.calories}cal</span>
                    <span style={{ fontSize: "11px", color: "#E74C3C", fontFamily: THEME.fonts.mono }}>{m.protein}p</span>
                    <span style={{ fontSize: "11px", color: "#3498DB", fontFamily: THEME.fonts.mono }}>{m.carbs}c</span>
                    <span style={{ fontSize: "11px", color: "#F39C12", fontFamily: THEME.fonts.mono }}>{m.fat}f</span>
                  </div>
                  {m.notes && <div style={{ fontSize: "12px", color: THEME.colors.textMuted, fontStyle: "italic", marginTop: "4px" }}>{m.notes}</div>}
                </div>
                <button onClick={() => deleteMeal(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                  <I.trash size={14} color={THEME.colors.error} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ===== LOG MEAL ===== */}
      {tab === "log" && (
        <>
          {/* Saved Meals Quick Pick */}
          {savedMeals.length > 0 && (
            <div style={{ marginBottom: THEME.spacing.md }}>
              <button onClick={() => setShowSaved(!showSaved)} style={{
                display: "flex", alignItems: "center", gap: "6px", width: "100%",
                padding: THEME.spacing.md, borderRadius: THEME.radius.lg, cursor: "pointer",
                background: THEME.colors.surfaceLight, border: `1px solid ${THEME.colors.border}`,
                color: THEME.colors.textSecondary, fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
              }}>
                ⚡ Quick Add from Saved Meals ({savedMeals.length})
                <div style={{ marginLeft: "auto", transform: showSaved ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <I.chevR size={14} color={THEME.colors.textMuted} />
                </div>
              </button>
              {showSaved && (
                <div style={{ marginTop: "6px" }}>
                  {savedMeals.map(m => (
                    <button key={m.id} onClick={() => useSavedMeal(m)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                      padding: "10px 14px", marginBottom: "4px", borderRadius: THEME.radius.md,
                      background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`,
                      cursor: "pointer", textAlign: "left",
                    }}>
                      <span style={{ fontWeight: "500", fontSize: "14px", color: THEME.colors.text }}>{m.meal_name}</span>
                      <span style={{ fontSize: "11px", color: THEME.colors.textMuted, fontFamily: THEME.fonts.mono }}>{m.calories}cal · {m.protein}p · {m.carbs}c · {m.fat}f</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={S.card}>
            <div style={S.cardLbl}>Log a Meal</div>

            <div style={S.inpGrp}>
              <label style={{ ...S.lbl, fontSize: "11px" }}>Meal Name</label>
              <input style={S.inp} value={mealForm.meal_name} onChange={e => setMealForm(f => ({ ...f, meal_name: e.target.value }))}
                placeholder="e.g. Chicken + Rice, Protein Shake..." onFocus={e => (e.target.style.borderColor = THEME.colors.primary)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
            </div>

            <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
              {[
                { k: "calories", l: "Calories", c: THEME.colors.primary, p: "kcal" },
                { k: "protein", l: "Protein", c: "#E74C3C", p: "g" },
              ].map(x => (
                <div key={x.k} style={{ flex: 1 }}>
                  <label style={{ ...S.lbl, fontSize: "10px", color: x.c }}>{x.l}</label>
                  <input style={{ ...S.inp, padding: "10px 12px", fontSize: "14px" }} type="number" value={mealForm[x.k]}
                    onChange={e => setMealForm(f => ({ ...f, [x.k]: e.target.value }))} placeholder={x.p}
                    onFocus={e => (e.target.style.borderColor = x.c)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
              {[
                { k: "carbs", l: "Carbs", c: "#3498DB", p: "g" },
                { k: "fat", l: "Fat", c: "#F39C12", p: "g" },
              ].map(x => (
                <div key={x.k} style={{ flex: 1 }}>
                  <label style={{ ...S.lbl, fontSize: "10px", color: x.c }}>{x.l}</label>
                  <input style={{ ...S.inp, padding: "10px 12px", fontSize: "14px" }} type="number" value={mealForm[x.k]}
                    onChange={e => setMealForm(f => ({ ...f, [x.k]: e.target.value }))} placeholder={x.p}
                    onFocus={e => (e.target.style.borderColor = x.c)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
                </div>
              ))}
            </div>

            <div style={S.inpGrp}>
              <label style={{ ...S.lbl, fontSize: "11px" }}>Notes (optional)</label>
              <input style={S.inp} value={mealForm.notes} onChange={e => setMealForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Post-workout meal" onFocus={e => (e.target.style.borderColor = THEME.colors.primary)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
            </div>

            <div style={{ display: "flex", gap: THEME.spacing.sm }}>
              <button onClick={handleLogMeal} disabled={!mealForm.meal_name || mealSaving} style={{
                ...S.btn1, flex: 2, marginTop: 0, opacity: (!mealForm.meal_name || mealSaving) ? 0.5 : 1,
              }}>
                {mealSaved ? "Logged!" : mealSaving ? "Saving..." : "Log Meal"}
              </button>
              <button onClick={handleSaveMeal} disabled={!mealForm.meal_name} style={{
                ...S.btn2, flex: 1, marginTop: 0, opacity: !mealForm.meal_name ? 0.5 : 1, fontSize: "11px",
              }}>
                Save Template
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== WEEK VIEW ===== */}
      {tab === "week" && targets && (
        <>
          <div style={S.card}>
            <div style={S.cardLbl}>Last 7 Days — Calories</div>
            <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "120px" }}>
              {weekData.map(d => {
                const pct = targets.calories > 0 ? Math.min(d.calories / targets.calories, 1.3) : 0;
                const hit = d.calories >= targets.calories * 0.9 && d.calories <= targets.calories * 1.1;
                const over = d.calories > targets.calories * 1.1;
                const isToday = d.date === todayStr;
                const dayName = ["S", "M", "T", "W", "T", "F", "S"][new Date(d.date + "T12:00:00").getDay()];
                return (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div style={{ fontSize: "9px", fontFamily: THEME.fonts.mono, color: THEME.colors.textMuted }}>{d.calories > 0 ? d.calories : ""}</div>
                    <div style={{
                      width: "100%", borderRadius: "4px 4px 2px 2px",
                      height: `${Math.max(pct * 80, 4)}px`,
                      background: d.calories === 0 ? THEME.colors.surfaceLight : hit ? THEME.colors.success : over ? THEME.colors.error : THEME.colors.primary,
                      opacity: isToday ? 1 : 0.7,
                      transition: "height 0.3s",
                    }} />
                    <div style={{
                      fontSize: "10px", fontFamily: THEME.fonts.display, letterSpacing: "0.5px",
                      color: isToday ? THEME.colors.primary : THEME.colors.textMuted, fontWeight: isToday ? "700" : "400",
                    }}>{dayName}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: THEME.spacing.md, justifyContent: "center", marginTop: THEME.spacing.md }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: THEME.colors.success }} />
                <span style={{ fontSize: "10px", color: THEME.colors.textMuted }}>On target</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: THEME.colors.primary }} />
                <span style={{ fontSize: "10px", color: THEME.colors.textMuted }}>Under</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: THEME.colors.error }} />
                <span style={{ fontSize: "10px", color: THEME.colors.textMuted }}>Over</span>
              </div>
            </div>
          </div>

          {/* Weekly macro breakdown */}
          <div style={S.card}>
            <div style={S.cardLbl}>Daily Breakdown</div>
            {weekData.map(d => {
              const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(d.date + "T12:00:00").getDay()];
              const isToday = d.date === todayStr;
              return (
                <div key={d.date} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${THEME.colors.border}`,
                  opacity: d.calories === 0 && !isToday ? 0.4 : 1,
                }}>
                  <span style={{
                    fontFamily: THEME.fonts.display, fontSize: "13px", width: "36px",
                    color: isToday ? THEME.colors.primary : THEME.colors.textMuted, fontWeight: isToday ? "700" : "400",
                  }}>{dayName}</span>
                  <span style={{ fontSize: "11px", fontFamily: THEME.fonts.mono, color: THEME.colors.primary }}>{d.calories}cal</span>
                  <span style={{ fontSize: "11px", fontFamily: THEME.fonts.mono, color: "#E74C3C" }}>{d.protein}p</span>
                  <span style={{ fontSize: "11px", fontFamily: THEME.fonts.mono, color: "#3498DB" }}>{d.carbs}c</span>
                  <span style={{ fontSize: "11px", fontFamily: THEME.fonts.mono, color: "#F39C12" }}>{d.fat}f</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== SETUP ===== */}
      {tab === "setup" && (
        <>
          {/* Macro Calculator */}
          <div style={S.card}>
            <div style={S.cardLbl}>Macro Calculator</div>
            <div style={{ color: THEME.colors.textMuted, fontSize: "13px", marginBottom: THEME.spacing.md, lineHeight: "1.5" }}>
              Enter your body weight and goals to calculate daily macro targets
            </div>

            <div style={S.inpGrp}>
              <label style={{ ...S.lbl, fontSize: "11px" }}>Body Weight (lbs)</label>
              <input style={S.inp} type="number" value={setupForm.bodyWeight}
                onChange={e => setSetupForm(f => ({ ...f, bodyWeight: e.target.value }))}
                placeholder="e.g. 185" onFocus={e => (e.target.style.borderColor = THEME.colors.primary)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
            </div>

            <div style={{ marginBottom: THEME.spacing.md }}>
              <label style={{ ...S.lbl, fontSize: "11px" }}>Activity Level</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {[
                  { id: "sedentary", l: "Sedentary" }, { id: "light", l: "Light" },
                  { id: "moderate", l: "Moderate" }, { id: "active", l: "Active (CrossFit)" },
                  { id: "athlete", l: "Athlete (2x/day)" },
                ].map(a => (
                  <button key={a.id} onClick={() => setSetupForm(f => ({ ...f, activity: a.id }))} style={{
                    padding: "8px 12px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
                    background: setupForm.activity === a.id ? THEME.colors.primarySubtle : THEME.colors.surfaceLight,
                    color: setupForm.activity === a.id ? THEME.colors.primary : THEME.colors.textMuted,
                    fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1px",
                  }}>{a.l}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: THEME.spacing.md }}>
              <label style={{ ...S.lbl, fontSize: "11px" }}>Goal</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { id: "cut", l: "Cut", desc: "-500 cal" },
                  { id: "maintain", l: "Maintain", desc: "TDEE" },
                  { id: "build", l: "Build", desc: "+300 cal" },
                ].map(g => (
                  <button key={g.id} onClick={() => setSetupForm(f => ({ ...f, goal: g.id }))} style={{
                    flex: 1, padding: "12px 8px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
                    background: setupForm.goal === g.id ? THEME.colors.primary : THEME.colors.surfaceLight,
                    color: setupForm.goal === g.id ? THEME.colors.white : THEME.colors.textMuted,
                    textAlign: "center",
                  }}>
                    <div style={{ fontFamily: THEME.fonts.display, fontSize: "14px", letterSpacing: "1px" }}>{g.l}</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.7 }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {setupForm.bodyWeight && (
              <div style={{ background: THEME.colors.surfaceLight, borderRadius: THEME.radius.md, padding: THEME.spacing.md, marginBottom: THEME.spacing.md }}>
                <div style={{ fontFamily: THEME.fonts.display, fontSize: "11px", letterSpacing: "1.5px", color: THEME.colors.textMuted, marginBottom: THEME.spacing.sm }}>Your Daily Targets</div>
                {(() => {
                  const preview = calcMacros(Number(setupForm.bodyWeight), setupForm.activity, setupForm.goal);
                  return (
                    <div style={{ display: "flex", gap: THEME.spacing.sm }}>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontFamily: THEME.fonts.mono, fontSize: "18px", fontWeight: "700", color: THEME.colors.primary }}>{preview.calories}</div>
                        <div style={{ fontSize: "9px", fontFamily: THEME.fonts.display, color: THEME.colors.textMuted }}>CAL</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontFamily: THEME.fonts.mono, fontSize: "18px", fontWeight: "700", color: "#E74C3C" }}>{preview.protein}g</div>
                        <div style={{ fontSize: "9px", fontFamily: THEME.fonts.display, color: THEME.colors.textMuted }}>PROTEIN</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontFamily: THEME.fonts.mono, fontSize: "18px", fontWeight: "700", color: "#3498DB" }}>{preview.carbs}g</div>
                        <div style={{ fontSize: "9px", fontFamily: THEME.fonts.display, color: THEME.colors.textMuted }}>CARBS</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontFamily: THEME.fonts.mono, fontSize: "18px", fontWeight: "700", color: "#F39C12" }}>{preview.fat}g</div>
                        <div style={{ fontSize: "9px", fontFamily: THEME.fonts.display, color: THEME.colors.textMuted }}>FAT</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button onClick={handleSaveSetup} disabled={!setupForm.bodyWeight || setupSaving} style={{
              ...S.btn1, marginTop: 0, opacity: (!setupForm.bodyWeight || setupSaving) ? 0.5 : 1,
            }}>
              {setupSaving ? "Saving..." : "Set My Targets"}
            </button>
          </div>

          {/* Manual Override */}
          {targets && (
            <div style={S.card}>
              <div style={S.cardLbl}>Or Set Custom Targets</div>
              <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
                {[
                  { k: "customCals", l: "Calories", c: THEME.colors.primary, v: targets.calories },
                  { k: "customPro", l: "Protein", c: "#E74C3C", v: targets.protein },
                ].map(x => (
                  <div key={x.k} style={{ flex: 1 }}>
                    <label style={{ ...S.lbl, fontSize: "10px", color: x.c }}>{x.l}</label>
                    <input style={{ ...S.inp, padding: "10px 12px", fontSize: "14px" }} type="number"
                      value={setupForm[x.k] ?? ""} placeholder={String(x.v)}
                      onChange={e => setSetupForm(f => ({ ...f, [x.k]: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = x.c)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
                {[
                  { k: "customCarbs", l: "Carbs", c: "#3498DB", v: targets.carbs },
                  { k: "customFat", l: "Fat", c: "#F39C12", v: targets.fat },
                ].map(x => (
                  <div key={x.k} style={{ flex: 1 }}>
                    <label style={{ ...S.lbl, fontSize: "10px", color: x.c }}>{x.l}</label>
                    <input style={{ ...S.inp, padding: "10px 12px", fontSize: "14px" }} type="number"
                      value={setupForm[x.k] ?? ""} placeholder={String(x.v)}
                      onChange={e => setSetupForm(f => ({ ...f, [x.k]: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = x.c)} onBlur={e => (e.target.style.borderColor = THEME.colors.border)} />
                  </div>
                ))}
              </div>
              <button onClick={handleSaveCustomTargets} disabled={setupSaving} style={{
                ...S.btn2, marginTop: 0, opacity: setupSaving ? 0.5 : 1,
              }}>Save Custom Targets</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NutritionScreen;
