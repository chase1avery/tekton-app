// ============================================================
// CrossFit Gym Management App — White-Label Platform
// Phase 1-7: Complete — Foundation + Schedule + Profile + Records + Community + Admin + Billing + PWA
// ============================================================

import { useState, useEffect, createContext, useContext, useCallback } from "react";

// ============================================================
// GYM CONFIG
// ============================================================
const GYM_CONFIG = {
  id: "tekton-fitness", name: "Tekton Fitness", shortName: "TEKTON",
  tagline: "CrossFit. Nutrition. Community.", subtitle: "Built Here.",
  location: "Murray, Utah", address: "5914 S 350 W, Murray, UT 84107",
  phone: "(801) 419-2488", email: "info@tektonfitness.com",
  website: "tektonfitness.com", since: "2012",
  colors: {
    primary: "#2D8C4E", primaryDark: "#1F6B3A", primaryLight: "#3DAF62",
    primarySubtle: "rgba(45, 140, 78, 0.12)", secondary: "#1A1A1A",
    accent: "#D4A843", accentSubtle: "rgba(212, 168, 67, 0.12)",
  },
  logoUrl: null,
  classTypes: ["CrossFit", "Open Gym", "Barbell Club", "MetFix", "Nutrition Coaching"],
  membershipTiers: [
    { id: "unlimited", name: "Unlimited", price: 175, interval: "month" },
    { id: "limited", name: "3x/Week", price: 140, interval: "month" },
    { id: "drop-in", name: "Drop-In", price: 25, interval: "visit" },
  ],
  hours: {
    mon: "5:00 AM – 7:30 PM", tue: "5:00 AM – 7:30 PM", wed: "5:00 AM – 7:30 PM",
    thu: "5:00 AM – 7:30 PM", fri: "5:00 AM – 6:30 PM", sat: "7:00 AM – 10:00 AM", sun: "Closed",
  },
};

// ============================================================
// THEME
// ============================================================
const THEME = {
  colors: {
    bg: "#0B0F0D", surface: "#141A16", surfaceLight: "#1C241E", surfaceHover: "#243028",
    border: "#2A332C", borderLight: "#384039",
    primary: GYM_CONFIG.colors.primary, primaryDark: GYM_CONFIG.colors.primaryDark,
    primaryLight: GYM_CONFIG.colors.primaryLight, primarySubtle: GYM_CONFIG.colors.primarySubtle,
    accent: GYM_CONFIG.colors.accent, accentSubtle: GYM_CONFIG.colors.accentSubtle,
    success: "#2ECC71", warning: "#F39C12", error: "#E74C3C",
    text: "#F0F4F1", textSecondary: "#94A89A", textMuted: "#5A6B5E",
    white: "#FFFFFF", black: "#000000",
  },
  fonts: { display: "'Bebas Neue', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace" },
  radius: { sm: "6px", md: "10px", lg: "14px", xl: "20px", full: "9999px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
};

// ============================================================
// HELPER: generate dates for the current week (Mon-Sun)
// ============================================================
const getWeekDates = (refDate) => {
  const d = new Date(refDate);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    return dt.toISOString().split("T")[0];
  });
};

const fmt = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return { day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()], num: d.getDate() };
};

const fmtLong = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const fmtTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2,"0")} ${ampm}`;
};

const today = () => new Date().toISOString().split("T")[0];

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_MEMBERS = [
  { id: "m1", email: "chase@tektonfitness.com", password: "demo123", firstName: "Chase", lastName: "Avery", role: "admin", avatar: null, phone: "(801) 419-2488", emergencyContact: { name: "Sarah Avery", phone: "(801) 555-0102", relation: "Spouse" }, membershipType: "unlimited", membershipStatus: "active", joinDate: "2023-01-15T00:00:00Z", gymId: "tekton-fitness" },
  { id: "m2", email: "mckensey@tektonfitness.com", password: "demo123", firstName: "McKensey", lastName: "Ciaramella", role: "coach", avatar: null, phone: "(801) 555-0201", emergencyContact: { name: "Emergency Contact", phone: "(801) 555-0202", relation: "Family" }, membershipType: "unlimited", membershipStatus: "active", joinDate: "2020-06-01T00:00:00Z", gymId: "tekton-fitness" },
  { id: "m3", email: "brett@tektonfitness.com", password: "demo123", firstName: "Brett", lastName: "Wilson", role: "coach", avatar: null, phone: "(801) 555-0301", emergencyContact: { name: "Emergency Contact", phone: "(801) 555-0302", relation: "Family" }, membershipType: "unlimited", membershipStatus: "active", joinDate: "2019-03-01T00:00:00Z", gymId: "tekton-fitness" },
  { id: "m4", email: "alex@example.com", password: "demo123", firstName: "Alex", lastName: "Rivera", role: "member", avatar: null, phone: "(801) 555-0401", emergencyContact: { name: "Maria Rivera", phone: "(801) 555-0402", relation: "Spouse" }, membershipType: "unlimited", membershipStatus: "active", joinDate: "2023-06-10T00:00:00Z", gymId: "tekton-fitness" },
  { id: "m5", email: "taylor@example.com", password: "demo123", firstName: "Taylor", lastName: "Brooks", role: "member", avatar: null, phone: "(801) 555-0501", emergencyContact: { name: "Mike Brooks", phone: "(801) 555-0502", relation: "Brother" }, membershipType: "limited", membershipStatus: "active", joinDate: "2024-01-20T00:00:00Z", gymId: "tekton-fitness" },
  { id: "m6", email: "hilary@example.com", password: "demo123", firstName: "Hilary", lastName: "Simmons", role: "member", avatar: null, phone: "(801) 555-0601", emergencyContact: { name: "Dan Simmons", phone: "(801) 555-0602", relation: "Spouse" }, membershipType: "unlimited", membershipStatus: "active", joinDate: "2022-09-15T00:00:00Z", gymId: "tekton-fitness" },
];

// Generate a full week of sessions dynamically
const generateWeekSessions = () => {
  const week = getWeekDates(new Date());
  const sessions = [];
  let sid = 1;
  const weekdaySlots = [
    { title: "CrossFit", startTime: "05:00", endTime: "06:00", capacity: 16, coachId: "m2" },
    { title: "CrossFit", startTime: "06:00", endTime: "07:00", capacity: 16, coachId: "m3" },
    { title: "CrossFit", startTime: "09:00", endTime: "10:00", capacity: 16, coachId: "m2" },
    { title: "CrossFit", startTime: "12:00", endTime: "13:00", capacity: 16, coachId: "m3" },
    { title: "CrossFit", startTime: "16:30", endTime: "17:30", capacity: 16, coachId: "m2" },
    { title: "CrossFit", startTime: "17:30", endTime: "18:30", capacity: 16, coachId: "m3" },
    { title: "Open Gym", startTime: "18:30", endTime: "19:30", capacity: 24, coachId: "m2" },
  ];
  const satSlots = [
    { title: "CrossFit", startTime: "07:00", endTime: "08:00", capacity: 20, coachId: "m3" },
    { title: "CrossFit", startTime: "08:00", endTime: "09:00", capacity: 20, coachId: "m2" },
    { title: "Barbell Club", startTime: "09:00", endTime: "10:00", capacity: 12, coachId: "m3" },
  ];
  // Pre-seed some signups for today and tomorrow
  const todayStr = today();
  const tomorrowStr = week[week.indexOf(todayStr) + 1] || week[1];

  week.forEach((date) => {
    const d = new Date(date + "T12:00:00");
    const dow = d.getDay();
    if (dow === 0) return; // Sunday closed
    const slots = dow === 6 ? satSlots : weekdaySlots;
    slots.forEach((slot) => {
      let signups = [];
      if (date === todayStr) {
        if (slot.startTime === "05:00") signups = ["m1", "m4", "m6"];
        else if (slot.startTime === "06:00") signups = ["m5"];
        else if (slot.startTime === "12:00") signups = ["m4"];
        else if (slot.startTime === "16:30") signups = ["m1", "m4", "m5", "m6"];
      } else if (date === tomorrowStr) {
        if (slot.startTime === "05:00" || slot.startTime === "07:00") signups = ["m1", "m4"];
      }
      sessions.push({
        id: `s${sid++}`, gymId: "tekton-fitness", coachId: slot.coachId,
        title: slot.title, date, startTime: slot.startTime, endTime: slot.endTime,
        capacity: slot.capacity, signups: [...signups], workoutId: null,
      });
    });
  });
  return sessions;
};

const MOCK_SESSIONS = generateWeekSessions();

const MOCK_WORKOUTS = [
  { id: "w1", gymId: "tekton-fitness", createdBy: "m2", date: today() + "T00:00:00Z", title: "FRAN", type: "ForTime", description: "21-15-9 Thrusters and Pull-ups", movements: [{ name: "Thrusters", reps: "21-15-9", weight: "95/65 lbs", notes: null }, { name: "Pull-ups", reps: "21-15-9", weight: null, notes: null }], timeCap: 10, rounds: null },
  { id: "w2", gymId: "tekton-fitness", createdBy: "m3", date: "2026-03-06T00:00:00Z", title: "DT", type: "ForTime", description: "5 Rounds: 12 DL, 9 HPC, 6 Push Jerk (155/105)", movements: [{ name: "Deadlifts", reps: "12", weight: "155/105 lbs", notes: null }, { name: "Hang Power Cleans", reps: "9", weight: "155/105 lbs", notes: null }, { name: "Push Jerks", reps: "6", weight: "155/105 lbs", notes: null }], timeCap: 15, rounds: 5 },
  { id: "w3", gymId: "tekton-fitness", createdBy: "m2", date: "2026-03-05T00:00:00Z", title: "Midweek Grinder", type: "AMRAP", description: "16 min AMRAP", movements: [{ name: "Wall Balls", reps: "15", weight: "20/14 lbs", notes: null }, { name: "Box Jumps", reps: "12", weight: "24/20 in", notes: null }, { name: "Toes-to-Bar", reps: "9", weight: null, notes: null }], timeCap: 16, rounds: null },
];

const MOCK_PRS = [
  { id: "pr1", memberId: "m1", category: "lift", name: "Back Squat", value: "365", unit: "lbs", date: "2026-02-15T00:00:00Z", notes: "Belt + sleeves" },
  { id: "pr2", memberId: "m1", category: "lift", name: "Deadlift", value: "425", unit: "lbs", date: "2026-01-20T00:00:00Z", notes: null },
  { id: "pr3", memberId: "m1", category: "lift", name: "Clean & Jerk", value: "255", unit: "lbs", date: "2025-12-10T00:00:00Z", notes: "Competition" },
  { id: "pr4", memberId: "m1", category: "benchmark", name: "Fran", value: "3:42", unit: "time", date: "2026-01-05T00:00:00Z", notes: "Rx" },
  { id: "pr5", memberId: "m1", category: "benchmark", name: "Murph", value: "38:15", unit: "time", date: "2025-05-26T00:00:00Z", notes: "Partitioned" },
  { id: "pr6", memberId: "m4", category: "lift", name: "Back Squat", value: "315", unit: "lbs", date: "2026-02-20T00:00:00Z", notes: null },
  { id: "pr7", memberId: "m4", category: "benchmark", name: "Fran", value: "4:10", unit: "time", date: "2026-01-05T00:00:00Z", notes: "Rx" },
  { id: "pr8", memberId: "m6", category: "lift", name: "Back Squat", value: "185", unit: "lbs", date: "2026-02-22T00:00:00Z", notes: "PR!" },
];

const MOCK_RESULTS = [
  { id: "r1", memberId: "m1", workoutId: "w1", sessionId: "s1", score: "3:58", scoreType: "time", rx: true, notes: "UB thrusters round of 21", date: "2026-03-07T06:00:00Z", highFives: ["m4","m6","m3"] },
  { id: "r2", memberId: "m4", workoutId: "w1", sessionId: "s1", score: "5:22", scoreType: "time", rx: true, notes: "Broke up pull-ups 11/10", date: "2026-03-07T06:00:00Z", highFives: ["m1"] },
  { id: "r3", memberId: "m6", workoutId: "w1", sessionId: "s1", score: "7:15", scoreType: "time", rx: false, notes: "65lb thrusters + banded PU", date: "2026-03-07T06:00:00Z", highFives: ["m1","m4","m2"] },
  { id: "r4", memberId: "m5", workoutId: "w1", sessionId: "s2", score: "6:03", scoreType: "time", rx: true, notes: null, date: "2026-03-07T07:00:00Z", highFives: [] },
  { id: "r5", memberId: "m1", workoutId: "w2", sessionId: null, score: "9:45", scoreType: "time", rx: true, notes: "Heavy but moved well", date: "2026-03-06T06:30:00Z", highFives: ["m3","m4","m5","m6"] },
  { id: "r6", memberId: "m4", workoutId: "w2", sessionId: null, score: "11:20", scoreType: "time", rx: true, notes: "Grip was toast after round 3", date: "2026-03-06T06:30:00Z", highFives: ["m1","m6"] },
  { id: "r7", memberId: "m3", workoutId: "w2", sessionId: null, score: "8:12", scoreType: "time", rx: true, notes: "Fast cycling", date: "2026-03-06T07:30:00Z", highFives: ["m1","m2","m4","m5","m6"] },
  { id: "r8", memberId: "m5", workoutId: "w3", sessionId: null, score: "4+15", scoreType: "rounds+reps", rx: true, notes: "T2B unbroken!", date: "2026-03-05T06:30:00Z", highFives: ["m1","m4"] },
  { id: "r9", memberId: "m6", workoutId: "w3", sessionId: null, score: "3+22", scoreType: "rounds+reps", rx: false, notes: "Scaled to knee raises", date: "2026-03-05T06:30:00Z", highFives: ["m1"] },
  { id: "r10", memberId: "m1", workoutId: "w3", sessionId: null, score: "5+3", scoreType: "rounds+reps", rx: true, notes: "Wall balls slowed me down", date: "2026-03-05T06:30:00Z", highFives: ["m3","m4"] },
];

const MOCK_BILLING = [
  { id: "b1", memberId: "m1", amount: 17500, description: "Unlimited — Mar 2026", date: "2026-03-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b2", memberId: "m1", amount: 17500, description: "Unlimited — Feb 2026", date: "2026-02-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b3", memberId: "m1", amount: 17500, description: "Unlimited — Jan 2026", date: "2026-01-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b4", memberId: "m1", amount: 17500, description: "Unlimited — Dec 2025", date: "2025-12-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b5", memberId: "m1", amount: 17500, description: "Unlimited — Nov 2025", date: "2025-11-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b6", memberId: "m4", amount: 17500, description: "Unlimited — Mar 2026", date: "2026-03-01T00:00:00Z", status: "paid", method: "card" },
  { id: "b7", memberId: "m5", amount: 14000, description: "3x/Week — Mar 2026", date: "2026-03-01T00:00:00Z", status: "pending", method: "card" },
];

// ============================================================
// SERVICE LAYER
// ============================================================
const createService = (init) => {
  let d = [...init];
  return {
    getAll: () => Promise.resolve([...d]),
    getById: (id) => Promise.resolve(d.find((x) => x.id === id) || null),
    getByField: (f, v) => Promise.resolve(d.filter((x) => x[f] === v)),
    create: (item) => { const n = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}` }; d = [...d, n]; return Promise.resolve(n); },
    update: (id, u) => { d = d.map((x) => (x.id === id ? { ...x, ...u } : x)); return Promise.resolve(d.find((x) => x.id === id)); },
    delete: (id) => { d = d.filter((x) => x.id !== id); return Promise.resolve(true); },
  };
};
const services = {
  members: createService(MOCK_MEMBERS), workouts: createService(MOCK_WORKOUTS),
  sessions: createService(MOCK_SESSIONS), prs: createService(MOCK_PRS),
  results: createService(MOCK_RESULTS), billing: createService(MOCK_BILLING),
  auth: {
    login: async (email, pw) => { const all = await services.members.getAll(); const m = all.find((u) => u.email === email && u.password === pw); if (!m) throw new Error("Invalid email or password"); return { ...m }; },
    signup: async ({ email, password, firstName, lastName }) => { const all = await services.members.getAll(); if (all.find((u) => u.email === email)) throw new Error("Email already in use"); return services.members.create({ email, password, firstName, lastName, role: "member", avatar: null, phone: "", emergencyContact: { name: "", phone: "", relation: "" }, membershipType: "unlimited", membershipStatus: "active", joinDate: new Date().toISOString(), gymId: GYM_CONFIG.id }); },
  },
};

// ============================================================
// CONTEXT
// ============================================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// ============================================================
// ICONS
// ============================================================
const Ico = ({ children, size = 22, color = THEME.colors.textSecondary, ...r }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...r}>{children}</svg>);
const I = {
  home: (p) => <Ico {...p}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></Ico>,
  cal: (p) => <Ico {...p}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></Ico>,
  trophy: (p) => <Ico {...p}><path d="M12 15l-2 5h4l-2-5zm0 0a6 6 0 006-6V4H6v5a6 6 0 006 6zM6 4H4v3a2 2 0 002 2m12-5h2v3a2 2 0 01-2 2" /></Ico>,
  users: (p) => <Ico {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Ico>,
  user: (p) => <Ico {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></Ico>,
  out: (p) => <Ico {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" /></Ico>,
  check: (p) => <Ico {...p}><path d="M20 6L9 17l-5-5" /></Ico>,
  x: (p) => <Ico {...p}><path d="M18 6L6 18M6 6l12 12" /></Ico>,
  chevL: (p) => <Ico {...p}><path d="M15 18l-6-6 6-6" /></Ico>,
  chevR: (p) => <Ico {...p}><path d="M9 18l6-6-6-6" /></Ico>,
  edit: (p) => <Ico {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Ico>,
  mail: (p) => <Ico {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></Ico>,
  phone: (p) => <Ico {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></Ico>,
  dollar: (p) => <Ico {...p}><path d="M12 1v22m5-18H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H7" /></Ico>,
  shield: (p) => <Ico {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ico>,
  clock: (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Ico>,
  fire: (p) => <Ico {...p}><path d="M12 2c.5 4-2 6-2 10a4 4 0 008 0c0-4-3-6-3-10" /><path d="M10 14a2 2 0 004 0c0-2-1-3-2-5-1 2-2 3-2 5" /></Ico>,
  hand: (p) => <Ico {...p}><path d="M18 11V6a2 2 0 00-4 0m0 5V4a2 2 0 00-4 0m0 7V6a2 2 0 00-4 0v7" /><path d="M6 13v-2a2 2 0 00-4 0v5a8 8 0 0016 0v-5" /></Ico>,
  activity: (p) => <Ico {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Ico>,
  medal: (p) => <Ico {...p}><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></Ico>,
  plus: (p) => <Ico {...p}><path d="M12 5v14m-7-7h14" /></Ico>,
  trash: (p) => <Ico {...p}><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Ico>,
  save: (p) => <Ico {...p}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8m0-16v5h8" /></Ico>,
};

// ============================================================
// STYLES
// ============================================================
const S = {
  app: { fontFamily: THEME.fonts.body, background: THEME.colors.bg, color: THEME.colors.text, minHeight: "100vh", maxWidth: "430px", margin: "0 auto", position: "relative", overflow: "hidden" },
  screen: { padding: `${THEME.spacing.lg} ${THEME.spacing.md}`, paddingBottom: "110px", minHeight: "100vh" },
  authWrap: { display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", padding: THEME.spacing.lg },
  logoBox: { width: "64px", height: "64px", borderRadius: "16px", background: `linear-gradient(135deg, ${THEME.colors.primary}, ${THEME.colors.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "28px", fontFamily: THEME.fonts.display, color: THEME.colors.white, letterSpacing: "2px" },
  gymTitle: { fontFamily: THEME.fonts.display, fontSize: "38px", color: THEME.colors.text, textAlign: "center", lineHeight: "1", letterSpacing: "3px" },
  gymSub: { fontFamily: THEME.fonts.body, fontSize: "13px", color: THEME.colors.textMuted, textAlign: "center", marginTop: "8px", marginBottom: THEME.spacing.xxl },
  inpGrp: { marginBottom: THEME.spacing.md },
  lbl: { fontFamily: THEME.fonts.display, fontSize: "13px", letterSpacing: "2px", color: THEME.colors.textSecondary, marginBottom: "6px", display: "block" },
  inp: { width: "100%", padding: "14px 16px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, color: THEME.colors.text, fontSize: "16px", fontFamily: THEME.fonts.body, outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" },
  btn1: { width: "100%", padding: "16px", border: "none", borderRadius: THEME.radius.md, background: `linear-gradient(135deg, ${THEME.colors.primary}, ${THEME.colors.primaryDark})`, color: THEME.colors.white, fontFamily: THEME.fonts.display, fontSize: "16px", letterSpacing: "3px", cursor: "pointer", marginTop: THEME.spacing.md },
  btn2: { width: "100%", padding: "14px", background: "transparent", color: THEME.colors.textSecondary, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, fontFamily: THEME.fonts.display, fontSize: "14px", letterSpacing: "2px", cursor: "pointer", marginTop: THEME.spacing.sm },
  err: { color: THEME.colors.error, fontSize: "13px", marginTop: THEME.spacing.sm, textAlign: "center" },
  lnk: { background: "none", border: "none", color: THEME.colors.primary, fontFamily: THEME.fonts.body, fontSize: "14px", cursor: "pointer", padding: 0, textDecoration: "underline" },
  tabBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "430px", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0 22px", background: THEME.colors.bg, borderTop: `1px solid ${THEME.colors.border}`, zIndex: 100 },
  tabBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "4px 10px" },
  tabLbl: { fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1.5px" },
  card: { background: THEME.colors.surface, borderRadius: THEME.radius.lg, padding: THEME.spacing.lg, marginBottom: THEME.spacing.md, border: `1px solid ${THEME.colors.border}` },
  cardLbl: { fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "2px", color: THEME.colors.textMuted, marginBottom: THEME.spacing.sm },
  greeting: { fontFamily: THEME.fonts.display, fontSize: "32px", letterSpacing: "1px", lineHeight: "1.1" },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: THEME.radius.full, fontFamily: THEME.fonts.display, fontSize: "11px", letterSpacing: "1px" },
  sRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${THEME.colors.border}` },
  avatar: { width: "40px", height: "40px", borderRadius: THEME.radius.full, background: THEME.colors.primarySubtle, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.fonts.display, fontSize: "16px", fontWeight: "700", color: THEME.colors.primary, flexShrink: 0 },
  statBox: { flex: 1, background: THEME.colors.surfaceLight, borderRadius: THEME.radius.md, padding: "14px", textAlign: "center" },
  statVal: { fontFamily: THEME.fonts.mono, fontSize: "22px", fontWeight: "700", color: THEME.colors.text },
  statLbl: { fontFamily: THEME.fonts.display, fontSize: "10px", letterSpacing: "1.5px", color: THEME.colors.textMuted, marginTop: "4px" },
};

// ============================================================
// LOGIN
// ============================================================
const LoginScreen = ({ onSwitch, onLogin }) => {
  const [email, setEmail] = useState("chase@tektonfitness.com");
  const [pw, setPw] = useState("demo123");
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
      <div style={{textAlign:"center",marginTop:THEME.spacing.lg,color:THEME.colors.textMuted,fontSize:"12px"}}>Demo: chase@tektonfitness.com / demo123</div>
    </div>
  );
};

// ============================================================
// SIGNUP
// ============================================================
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

// ============================================================
// DASHBOARD (Phase 1 — unchanged)
// ============================================================
const DashboardScreen = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [wod, setWod] = useState(null);
  const [results, setResults] = useState([]);
  const [myPrs, setMyPrs] = useState([]);
  useEffect(() => { (async () => {
    const td = today();
    setSessions((await services.sessions.getAll()).filter(s => s.date === td));
    setWod((await services.workouts.getAll()).find(w => w.date.startsWith(td)) || null);
    setResults((await services.results.getAll()).slice(-4).reverse());
    setMyPrs((await services.prs.getByField("memberId", user.id)).slice(0, 3));
  })(); }, [user.id]);
  const greet = () => { const h=new Date().getHours(); return h<12?"Morning":h<17?"Afternoon":"Evening"; };
  const mName = (id) => { const m=MOCK_MEMBERS.find(x=>x.id===id); return m?`${m.firstName} ${m.lastName.charAt(0)}.`:"?"; };
  const coach = (id) => { const m=MOCK_MEMBERS.find(x=>x.id===id); return m?m.firstName:"Coach"; };
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
      <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
        <div style={S.statBox}><div style={S.statVal}>{sessions.reduce((a,s)=>a+(s.signups.includes(user.id)?1:0),0)}</div><div style={S.statLbl}>Classes Today</div></div>
        <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.accent}}>{myPrs.length}</div><div style={S.statLbl}>Recent PRs</div></div>
        <div style={S.statBox}><div style={{...S.statVal,color:THEME.colors.primary,fontSize:"16px"}}>{user.membershipStatus==="active"?"Active":"Paused"}</div><div style={S.statLbl}>Status</div></div>
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
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}><div style={S.avatar}>{mName(r.memberId).charAt(0)}</div><div><div style={{fontWeight:"600",fontSize:"14px"}}>{mName(r.memberId)}</div><div style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{MOCK_WORKOUTS.find(w=>w.id===r.workoutId)?.title||"WOD"}</div></div></div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:THEME.fonts.mono,fontSize:"20px",fontWeight:"700",color:THEME.colors.primary}}>{r.score}</div>{r.rx&&<div style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"9px"}}>Rx</div>}</div>
          </div>
          {r.notes&&<div style={{color:THEME.colors.textMuted,fontSize:"12px",marginTop:"4px",marginLeft:"52px",fontStyle:"italic"}}>{r.notes}</div>}
        </div>)}
      </div>
    </div>
  );
};

// ============================================================
// SCHEDULE SCREEN (Phase 2 — NEW)
// ============================================================
const ScheduleScreen = () => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today());
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const weekDates = getWeekDates(weekStart);

  const loadSessions = useCallback(async () => {
    const all = await services.sessions.getAll();
    setAllSessions(all);
    setSessions(all.filter(s => s.date === selectedDate));
  }, [selectedDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleSignup = async (sessionId) => {
    setActioningId(sessionId);
    const s = allSessions.find(x => x.id === sessionId);
    if (!s || s.signups.includes(user.id) || s.signups.length >= s.capacity) { setActioningId(null); return; }
    await services.sessions.update(sessionId, { signups: [...s.signups, user.id] });
    await loadSessions();
    setActioningId(null);
  };

  const handleCancel = async (sessionId) => {
    setActioningId(sessionId);
    const s = allSessions.find(x => x.id === sessionId);
    if (!s) { setActioningId(null); return; }
    await services.sessions.update(sessionId, { signups: s.signups.filter(id => id !== user.id) });
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

  const coach = (id) => { const m = MOCK_MEMBERS.find(x => x.id === id); return m ? m.firstName : "Coach"; };
  const isToday = selectedDate === today();
  const isPast = (date, time) => {
    const now = new Date();
    const sessionTime = new Date(`${date}T${time}:00`);
    return sessionTime < now;
  };

  // Count signups for the selected week
  const myWeekSignups = allSessions.filter(s => weekDates.includes(s.date) && s.signups.includes(user.id)).length;

  return (
    <div style={S.screen}>
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Schedule</div>

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

      {/* Date Header */}
      <div style={{fontFamily:THEME.fonts.display,fontSize:"16px",letterSpacing:"2px",color:THEME.colors.textSecondary,marginBottom:THEME.spacing.md}}>
        {isToday ? "Today" : fmtLong(selectedDate)}
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

        return (
          <div key={s.id} style={{
            ...S.card,
            borderLeft: `3px solid ${signedUp ? THEME.colors.primary : past ? THEME.colors.border : THEME.colors.surfaceLight}`,
            opacity: past ? 0.5 : 1,
            marginBottom: THEME.spacing.sm,
            padding: THEME.spacing.md,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:"4px"}}>
                  <span style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{s.title}</span>
                  {signedUp && <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px"}}>Signed Up</div>}
                </div>
                <div style={{color:THEME.colors.textSecondary,fontSize:"13px",display:"flex",alignItems:"center",gap:"12px"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><I.clock size={13} color={THEME.colors.textMuted}/> {fmtTime(s.startTime)} – {fmtTime(s.endTime)}</span>
                  <span>Coach {coach(s.coachId)}</span>
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:"55px"}}>
                <div style={{fontFamily:THEME.fonts.mono,fontSize:"16px",fontWeight:"700"}}>
                  <span style={{color: full ? THEME.colors.error : THEME.colors.primary}}>{s.signups.length}</span>
                  <span style={{color:THEME.colors.textMuted}}>/{s.capacity}</span>
                </div>
                <div style={{fontSize:"11px",color: full ? THEME.colors.error : THEME.colors.textMuted}}>
                  {full ? "Full" : `${spotsLeft} spots`}
                </div>
              </div>
            </div>

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
                ) : (
                  <button onClick={()=>handleSignup(s.id)} disabled={actioning||full} style={{
                    width:"100%",padding:"10px",borderRadius:THEME.radius.md,border:"none",
                    background: full ? THEME.colors.surfaceLight : `linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                    color: full ? THEME.colors.textMuted : THEME.colors.white,
                    fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"2px",cursor: full?"default":"pointer",
                    opacity:actioning?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  }}>
                    {full ? "Class Full" : actioning ? "Signing Up..." : <><I.check size={14} color={THEME.colors.white}/> Sign Up</>}
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
    </div>
  );
};

// ============================================================
// PROFILE SCREEN (Phase 2 — NEW)
// ============================================================
const ProfileScreen = () => {
  const { user, login, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: user.firstName, lastName: user.lastName,
    phone: user.phone, email: user.email,
    ecName: user.emergencyContact.name, ecPhone: user.emergencyContact.phone, ecRelation: user.emergencyContact.relation,
  });
  const [bills, setBills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    services.billing.getByField("memberId", user.id).then(setBills);
  }, [user.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const updated = await services.members.update(user.id, {
      firstName: form.firstName, lastName: form.lastName,
      phone: form.phone, email: form.email,
      emergencyContact: { name: form.ecName, phone: form.ecPhone, relation: form.ecRelation },
    });
    login(updated); // Update context
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setEditing(false); }, 1200);
  };

  const tier = GYM_CONFIG.membershipTiers.find(t => t.id === user.membershipType);
  const joinDate = new Date(user.joinDate);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const memberSince = `${months[joinDate.getMonth()]} ${joinDate.getFullYear()}`;

  const InfoRow = ({ icon, label, value }) => (
    <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,padding:"12px 0",borderBottom:`1px solid ${THEME.colors.border}`}}>
      <div style={{width:"32px",display:"flex",justifyContent:"center"}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textMuted}}>{label}</div>
        <div style={{fontSize:"15px",fontWeight:"500",marginTop:"2px"}}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:THEME.spacing.xl}}>
        <div>
          <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px"}}>Profile</div>
          <div style={{color:THEME.colors.textMuted,fontSize:"13px"}}>{user.email}</div>
        </div>
        {!editing && (
          <button onClick={()=>setEditing(true)} style={{background:"none",border:`1px solid ${THEME.colors.border}`,borderRadius:THEME.radius.md,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>
            <I.edit size={14} color={THEME.colors.primary}/>
            <span style={{fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1.5px",color:THEME.colors.primary}}>Edit</span>
          </button>
        )}
      </div>

      {/* Avatar + Name Card */}
      <div style={{...S.card,display:"flex",alignItems:"center",gap:THEME.spacing.lg}}>
        <div style={{
          width:"64px",height:"64px",borderRadius:THEME.radius.full,flexShrink:0,
          background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontFamily:THEME.fonts.display,fontSize:"26px",color:THEME.colors.white,
        }}>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</div>
        <div>
          <div style={{fontFamily:THEME.fonts.display,fontSize:"22px",letterSpacing:"1px"}}>{user.firstName} {user.lastName}</div>
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginTop:"4px"}}>
            <div style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary}}>{user.role}</div>
            <span style={{color:THEME.colors.textMuted,fontSize:"12px"}}>Since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Edit Mode */}
      {editing && (
        <div style={S.card}>
          <div style={S.cardLbl}>Edit Profile</div>
          {[
            {k:"firstName",l:"First Name"},{k:"lastName",l:"Last Name"},
            {k:"email",l:"Email"},{k:"phone",l:"Phone"},
          ].map(x=><div key={x.k} style={S.inpGrp}><label style={{...S.lbl,fontSize:"11px"}}>{x.l}</label><input style={S.inp} value={form[x.k]} onChange={e=>set(x.k,e.target.value)} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>)}

          <div style={{...S.cardLbl,marginTop:THEME.spacing.md}}>Emergency Contact</div>
          {[
            {k:"ecName",l:"Name"},{k:"ecPhone",l:"Phone"},{k:"ecRelation",l:"Relationship"},
          ].map(x=><div key={x.k} style={S.inpGrp}><label style={{...S.lbl,fontSize:"11px"}}>{x.l}</label><input style={S.inp} value={form[x.k]} onChange={e=>set(x.k,e.target.value)} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>)}

          <div style={{display:"flex",gap:THEME.spacing.sm,marginTop:THEME.spacing.md}}>
            <button onClick={()=>setEditing(false)} style={{...S.btn2,flex:1,marginTop:0}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{...S.btn1,flex:1,marginTop:0,opacity:saving?0.6:1}}>
              {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Account Info */}
      {!editing && (
        <div style={S.card}>
          <div style={S.cardLbl}>Account Info</div>
          <InfoRow icon={<I.mail size={16} color={THEME.colors.textMuted}/>} label="Email" value={user.email} />
          <InfoRow icon={<I.phone size={16} color={THEME.colors.textMuted}/>} label="Phone" value={user.phone || "Not set"} />
          <InfoRow icon={<I.shield size={16} color={THEME.colors.textMuted}/>} label="Emergency Contact" value={user.emergencyContact.name ? `${user.emergencyContact.name} (${user.emergencyContact.relation})` : "Not set"} />
        </div>
      )}

      {/* Membership */}
      <div style={{...S.card,borderLeft:`3px solid ${user.membershipStatus==="active"?THEME.colors.primary:THEME.colors.warning}`}}>
        <div style={S.cardLbl}>Membership</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.md}}>
          <div>
            <div style={{fontFamily:THEME.fonts.display,fontSize:"20px"}}>{tier?.name || user.membershipType}</div>
            <div style={{color:THEME.colors.textSecondary,fontSize:"13px"}}>
              {tier ? `$${tier.price}/${tier.interval}` : ""}
            </div>
          </div>
          <div style={{
            ...S.badge,
            background: user.membershipStatus === "active" ? THEME.colors.primarySubtle : THEME.colors.accentSubtle,
            color: user.membershipStatus === "active" ? THEME.colors.primary : THEME.colors.warning,
            fontSize:"12px",padding:"5px 14px",
          }}>
            {user.membershipStatus}
          </div>
        </div>

        {/* Next billing date */}
        <div style={{background:THEME.colors.surfaceLight,borderRadius:THEME.radius.md,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:THEME.spacing.sm}}>
          <div>
            <div style={{fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textMuted}}>Next Billing Date</div>
            <div style={{fontSize:"15px",fontWeight:"500",marginTop:"2px"}}>April 1, 2026</div>
          </div>
          <div style={{fontFamily:THEME.fonts.mono,fontSize:"18px",fontWeight:"700",color:THEME.colors.primary}}>${tier?.price || "—"}</div>
        </div>

        {/* Payment method (Stripe scaffold) */}
        <div style={{background:THEME.colors.surfaceLight,borderRadius:THEME.radius.md,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
            <div style={{width:"40px",height:"26px",borderRadius:"4px",background:"linear-gradient(135deg,#1a1f71,#2d4dab)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontSize:"9px",fontWeight:"700",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>VISA</span>
            </div>
            <div>
              <div style={{fontSize:"13px",fontWeight:"500"}}>•••• •••• •••• 4242</div>
              <div style={{fontSize:"11px",color:THEME.colors.textMuted}}>Expires 09/28</div>
            </div>
          </div>
          <button style={{background:"none",border:`1px solid ${THEME.colors.border}`,borderRadius:THEME.radius.sm,padding:"6px 12px",cursor:"pointer",color:THEME.colors.textSecondary,fontSize:"11px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>
            Update
          </button>
        </div>
      </div>

      {/* Spending Summary */}
      <div style={S.card}>
        <div style={S.cardLbl}>Spending Summary</div>
        <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
          <div style={S.statBox}>
            <div style={{...S.statVal,fontSize:"18px",color:THEME.colors.primary}}>
              ${(bills.filter(b=>b.status==="paid").reduce((a,b)=>a+b.amount,0)/100).toFixed(0)}
            </div>
            <div style={S.statLbl}>Total Paid</div>
          </div>
          <div style={S.statBox}>
            <div style={{...S.statVal,fontSize:"18px",color:THEME.colors.accent}}>
              ${(bills.filter(b=>{const d=new Date(b.date);const now=new Date();return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&b.status==="paid"}).reduce((a,b)=>a+b.amount,0)/100).toFixed(0)}
            </div>
            <div style={S.statLbl}>This Month</div>
          </div>
          <div style={S.statBox}>
            <div style={{...S.statVal,fontSize:"18px"}}>{bills.length}</div>
            <div style={S.statLbl}>Invoices</div>
          </div>
        </div>

        {/* Pending alerts */}
        {bills.some(b=>b.status==="pending") && (
          <div style={{
            background:"rgba(212,168,67,0.08)",borderRadius:THEME.radius.md,
            padding:"10px 14px",marginBottom:THEME.spacing.md,
            display:"flex",alignItems:"center",gap:THEME.spacing.sm,
            border:`1px solid rgba(212,168,67,0.2)`,
          }}>
            <span style={{fontSize:"16px"}}>⚠️</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:"600",color:THEME.colors.accent}}>Pending Payment</div>
              <div style={{fontSize:"12px",color:THEME.colors.textMuted}}>
                {bills.filter(b=>b.status==="pending").length} invoice{bills.filter(b=>b.status==="pending").length>1?"s":""} awaiting payment
              </div>
            </div>
            <button style={{
              background:`linear-gradient(135deg,${THEME.colors.accent},#B8922F)`,border:"none",borderRadius:THEME.radius.sm,
              padding:"6px 14px",cursor:"pointer",color:THEME.colors.white,
              fontFamily:THEME.fonts.display,fontSize:"11px",letterSpacing:"1px",
            }}>Pay Now</button>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div style={S.card}>
        <div style={S.cardLbl}>Billing History</div>
        {bills.length === 0 && <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No billing records</div>}
        {bills.map((b, i) => (
          <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<bills.length-1?`1px solid ${THEME.colors.border}`:"none"}}>
            <div>
              <div style={{fontSize:"14px",fontWeight:"500"}}>{b.description}</div>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"2px"}}>
                <span style={{color:THEME.colors.textMuted,fontSize:"12px"}}>{new Date(b.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>·</span>
                <span style={{color:THEME.colors.textMuted,fontSize:"11px",textTransform:"capitalize"}}>{b.method}</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:THEME.fonts.mono,fontSize:"16px",fontWeight:"600"}}>${(b.amount/100).toFixed(2)}</div>
              <div style={{
                ...S.badge,fontSize:"9px",
                background: b.status==="paid" ? THEME.colors.primarySubtle : b.status==="pending" ? THEME.colors.accentSubtle : "rgba(231,76,60,0.12)",
                color: b.status==="paid" ? THEME.colors.primary : b.status==="pending" ? THEME.colors.accent : THEME.colors.error,
              }}>{b.status}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gym Info + Logout */}
      <div style={S.card}>
        <div style={S.cardLbl}>Gym Info</div>
        <InfoRow icon={<I.home size={16} color={THEME.colors.textMuted}/>} label="Location" value={GYM_CONFIG.address} />
        <InfoRow icon={<I.phone size={16} color={THEME.colors.textMuted}/>} label="Phone" value={GYM_CONFIG.phone} />
        <InfoRow icon={<I.mail size={16} color={THEME.colors.textMuted}/>} label="Email" value={GYM_CONFIG.email} />
      </div>

      <button onClick={logout} style={{
        ...S.btn2, display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
        color:THEME.colors.error, borderColor:"rgba(231,76,60,0.3)", marginTop:THEME.spacing.md,
      }}>
        <I.out size={16} color={THEME.colors.error}/> Sign Out
      </button>
    </div>
  );
};

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

// ============================================================
// COMMUNITY SCREEN (Phase 4 — NEW)
// ============================================================
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
    const [r, w, m] = await Promise.all([
      services.results.getAll(),
      services.workouts.getAll(),
      services.members.getAll(),
    ]);
    setResults(r.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setWorkouts(w);
    setMembers(m);
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
                    <div style={{fontWeight:"600",fontSize:"14px"}}>{mName(r.memberId)}{isMe && <span style={{color:THEME.colors.textMuted,fontWeight:"400"}}> (you)</span>}</div>
                    <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{timeAgo(r.date)}</div>
                  </div>
                  {r.rx && <div style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"9px"}}>Rx</div>}
                  {!r.rx && <div style={{...S.badge,background:"rgba(255,255,255,0.05)",color:THEME.colors.textMuted,fontSize:"9px"}}>Scaled</div>}
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
                          {r.rx && <span style={{...S.badge,background:THEME.colors.accentSubtle,color:THEME.colors.accent,fontSize:"8px",padding:"1px 6px"}}>Rx</span>}
                          {!r.rx && <span style={{...S.badge,background:"rgba(255,255,255,0.05)",color:THEME.colors.textMuted,fontSize:"8px",padding:"1px 6px"}}>Scaled</span>}
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

// ============================================================
// ADMIN SCREEN (Phase 5 — NEW)
// ============================================================
const MOVEMENT_LIBRARY = [
  "Thrusters","Pull-ups","Deadlifts","Clean & Jerk","Snatch","Back Squat","Front Squat",
  "Overhead Squat","Bench Press","Strict Press","Push Press","Push Jerk","Wall Balls",
  "Box Jumps","Burpees","Toes-to-Bar","Muscle-ups","HSPU","Rowing","Bike Erg",
  "Ski Erg","Double Unders","Pistols","Lunges","Kettlebell Swings","Turkish Get-ups",
  "Ring Dips","Rope Climbs","GHD Sit-ups","Hang Power Cleans","Power Cleans",
  "Sumo Deadlift High Pull","Bar Muscle-ups","Chest-to-Bar Pull-ups",
];

const AdminScreen = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview"); // overview | roster | wod | schedule
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // WOD Builder
  const [wodForm, setWodForm] = useState({ title:"", type:"ForTime", description:"", timeCap:"", warmup:"", strength:"", accessory:"", date:today(), movements:[] });
  const [newMov, setNewMov] = useState({ name:"", reps:"", weight:"", notes:"" });
  const [wodSaving, setWodSaving] = useState(false);
  const [wodSaved, setWodSaved] = useState(false);
  const [movSearch, setMovSearch] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  // Schedule Builder
  const [schedForm, setSchedForm] = useState({ title:"CrossFit", date:today(), startTime:"05:00", endTime:"06:00", capacity:"16", coachId:user.id });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);

  // Roster filter
  const [rosterFilter, setRosterFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [m, s, w, r] = await Promise.all([
      services.members.getAll(), services.sessions.getAll(),
      services.workouts.getAll(), services.results.getAll(),
    ]);
    setMembers(m); setSessions(s); setWorkouts(w); setResults(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const coaches = members.filter(m => m.role === "coach" || m.role === "admin");
  const coachName = (id) => { const m = members.find(x => x.id === id); return m ? m.firstName : "?"; };
  const todaySessions = sessions.filter(s => s.date === today());
  const todayAttendance = todaySessions.reduce((a, s) => a + s.signups.length, 0);
  const activeMembers = members.filter(m => m.membershipStatus === "active");
  const filteredRoster = rosterFilter === "all" ? members : members.filter(m => m.role === rosterFilter);

  // WOD builder
  const addMovement = () => {
    if (!newMov.name || !newMov.reps) return;
    setWodForm(f => ({ ...f, movements: [...f.movements, { ...newMov, weight: newMov.weight || null, notes: newMov.notes || null }] }));
    setNewMov({ name: "", reps: "", weight: "", notes: "" });
    setMovSearch("");
  };
  const removeMovement = (idx) => {
    setWodForm(f => ({ ...f, movements: f.movements.filter((_, i) => i !== idx) }));
  };
  const handlePublishWod = async () => {
    if (!wodForm.title) return;
    setWodSaving(true);
    await services.workouts.create({
      gymId: GYM_CONFIG.id, createdBy: user.id,
      date: wodForm.date + "T00:00:00Z", title: wodForm.title,
      type: wodForm.type, description: wodForm.description,
      warmup: wodForm.warmup || null,
      strength: wodForm.strength || null,
      accessory: wodForm.accessory || null,
      movements: wodForm.movements,
      timeCap: wodForm.timeCap ? Number(wodForm.timeCap) : null, rounds: null,
    });
    setWodSaving(false); setWodSaved(true);
    setWodForm({ title: "", type: "ForTime", description: "", timeCap: "", warmup: "", strength: "", accessory: "", date: today(), movements: [] });
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
    await services.sessions.create({
      gymId: GYM_CONFIG.id, coachId: schedForm.coachId,
      title: schedForm.title, date: schedForm.date,
      startTime: schedForm.startTime, endTime: schedForm.endTime,
      capacity: Number(schedForm.capacity) || 16,
      signups: [], workoutId: null,
    });
    setSchedSaving(false); setSchedSaved(true);
    await load();
    setTimeout(() => setSchedSaved(false), 1500);
  };

  const deleteSession = async (id) => {
    await services.sessions.delete(id);
    await load();
  };

  const filteredMovements = movSearch
    ? MOVEMENT_LIBRARY.filter(m => m.toLowerCase().includes(movSearch.toLowerCase()))
    : [];

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 4px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: tab === id ? THEME.colors.primary : THEME.colors.surfaceLight,
      color: tab === id ? THEME.colors.white : THEME.colors.textSecondary,
      fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
      flex: 1,
    }}>{label}</button>
  );

  return (
    <div style={S.screen}>
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Admin</div>

      <div style={{display:"flex",gap:"5px",marginBottom:THEME.spacing.lg}}>
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="roster" label="Roster" />
        <TabBtn id="wod" label="Program" />
        <TabBtn id="schedule" label="Schedule" />
      </div>

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
                  <div>
                    <span style={{fontFamily:THEME.fonts.display,fontSize:"16px"}}>{w.title}</span>
                    <span style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px",marginLeft:"8px"}}>{w.type}</span>
                  </div>
                  <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{results.filter(r=>r.workoutId===w.id).length} results</span>
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
                <input style={S.inp} value={wodForm.description} onChange={e=>setWodForm(f=>({...f,description:e.target.value}))}
                  placeholder="e.g. 21-15-9 for time" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
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
                <input style={{...S.inp,flex:1}} type="date" value={wodForm.date} onChange={e=>setWodForm(f=>({...f,date:e.target.value}))}
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

          {/* CSV IMPORT */}
          <div style={{...S.card,background:THEME.colors.surfaceLight,border:`1px dashed ${THEME.colors.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>📄</span>
              <div style={S.cardLbl}>Import WODs from CSV</div>
            </div>
            <div style={{color:THEME.colors.textMuted,fontSize:"12px",marginBottom:THEME.spacing.md,lineHeight:"1.6"}}>
              Upload a CSV with columns: <span style={{fontFamily:THEME.fonts.mono,fontSize:"11px",color:THEME.colors.textSecondary}}>date, title, type, description, timecap, warmup, strength, accessory, movements</span>
              <br/>Movements format: <span style={{fontFamily:THEME.fonts.mono,fontSize:"11px",color:THEME.colors.textSecondary}}>Name:Reps:Weight;Name:Reps:Weight</span>
              <br/>Example: <span style={{fontFamily:THEME.fonts.mono,fontSize:"11px",color:THEME.colors.textSecondary}}>Thrusters:21-15-9:95 lbs;Pull-ups:21-15-9:</span>
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

          {/* WARMUP SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.warning}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>🔥</span>
              <div style={S.cardLbl}>Warmup</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"100px", resize:"vertical", lineHeight:"1.6",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.warmup} onChange={e=>setWodForm(f=>({...f,warmup:e.target.value}))}
              placeholder={"e.g.\n2 Rounds:\n400m Run\n10 Inchworms\n10 Air Squats\n10 PVC Pass-throughs\n\nThen: 2x5 Empty Bar Thrusters"}
              onFocus={e=>(e.target.style.borderColor=THEME.colors.warning)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* STRENGTH SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.accent}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>🏋️</span>
              <div style={S.cardLbl}>Strength</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"100px", resize:"vertical", lineHeight:"1.6",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.strength} onChange={e=>setWodForm(f=>({...f,strength:e.target.value}))}
              placeholder={"e.g.\nBack Squat\n5 @ 65%\n5 @ 75%\n3 @ 85%\n1 @ 90%\n1 @ 95%\n\nRest 2 min between sets"}
              onFocus={e=>(e.target.style.borderColor=THEME.colors.accent)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* PRESCRIBED WOD SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.primary}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>⏱️</span>
              <div style={S.cardLbl}>Prescribed WOD</div>
            </div>

            {/* Movement list */}
            {wodForm.movements.length > 0 && (
              <div style={{marginBottom:THEME.spacing.sm}}>
                {wodForm.movements.map((m, idx) => (
                  <div key={idx} style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,padding:"8px 0",borderBottom:`1px solid ${THEME.colors.border}`}}>
                    <span style={{fontFamily:THEME.fonts.display,fontSize:"14px",color:THEME.colors.textMuted,width:"20px"}}>{idx+1}</span>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:"600",fontSize:"14px"}}>{m.name}</span>
                      <span style={{color:THEME.colors.textSecondary,fontSize:"12px",marginLeft:"8px"}}>{m.reps}{m.weight?` @ ${m.weight}`:""}</span>
                    </div>
                    <button onClick={()=>removeMovement(idx)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px"}}>
                      <I.trash size={14} color={THEME.colors.error} />
                    </button>
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
              <div style={{display:"flex",gap:"6px"}}>
                <div style={{flex:1}}><label style={{...S.lbl,fontSize:"10px"}}>Reps</label><input style={{...S.inp,padding:"10px 12px",fontSize:"14px"}} value={newMov.reps} onChange={e=>setNewMov(f=>({...f,reps:e.target.value}))} placeholder="21-15-9" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
                <div style={{flex:1}}><label style={{...S.lbl,fontSize:"10px"}}>Weight</label><input style={{...S.inp,padding:"10px 12px",fontSize:"14px"}} value={newMov.weight} onChange={e=>setNewMov(f=>({...f,weight:e.target.value}))} placeholder="95 lbs" onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>
                <button onClick={addMovement} disabled={!newMov.name||!newMov.reps} style={{
                  alignSelf:"flex-end",padding:"10px 16px",borderRadius:THEME.radius.md,border:"none",cursor:"pointer",
                  background:(!newMov.name||!newMov.reps)?THEME.colors.surfaceHover:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
                  color:(!newMov.name||!newMov.reps)?THEME.colors.textMuted:THEME.colors.white,
                  fontFamily:THEME.fonts.display,fontSize:"12px",letterSpacing:"1px",marginBottom:"0",
                }}>Add</button>
              </div>
            </div>
          </div>

          {/* ACCESSORY SECTION */}
          <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.textSecondary}`}}>
            <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
              <span style={{fontSize:"16px"}}>💪</span>
              <div style={S.cardLbl}>Accessory Work</div>
            </div>
            <textarea style={{
              ...S.inp, minHeight:"100px", resize:"vertical", lineHeight:"1.6",
              fontFamily:THEME.fonts.body, fontSize:"14px",
            }} value={wodForm.accessory} onChange={e=>setWodForm(f=>({...f,accessory:e.target.value}))}
              placeholder={"e.g.\n3x12 Dumbbell Rows (each arm)\n3x15 GHD Hip Extensions\n3x20 Banded Pull-aparts\n\nFoam roll and stretch 5 min"}
              onFocus={e=>(e.target.style.borderColor=THEME.colors.textSecondary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} />
          </div>

          {/* PUBLISH BUTTON */}
          <button onClick={handlePublishWod} disabled={wodSaving||!wodForm.title} style={{
            ...S.btn1,marginBottom:THEME.spacing.lg,
            opacity:(!wodForm.title||wodSaving)?0.5:1,
          }}>
            {wodSaved?"WOD Published!":wodSaving?"Publishing...":"Publish WOD"}
          </button>

          {/* Existing WODs */}
          <div style={{...S.cardLbl,marginBottom:THEME.spacing.sm}}>Published WODs</div>
          {[...workouts].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(w => (
            <div key={w.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:w.warmup||w.strength||w.accessory?"8px":"0"}}>
                <div>
                  <div style={{fontFamily:THEME.fonts.display,fontSize:"18px"}}>{w.title}</div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
                    <span style={{...S.badge,background:THEME.colors.primarySubtle,color:THEME.colors.primary,fontSize:"9px"}}>{w.type}</span>
                    {w.timeCap && <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.timeCap} min</span>}
                    <span style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{w.movements.length} movements</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:THEME.fonts.display,fontSize:"13px",color:THEME.colors.primary}}>
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(w.date).getDay()]}
                  </div>
                  <div style={{color:THEME.colors.textMuted,fontSize:"11px"}}>{new Date(w.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                </div>
              </div>

              {/* Warmup preview */}
              {w.warmup && (
                <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                  <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.warning,marginBottom:"4px"}}>🔥 Warmup</div>
                  <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.warmup}</div>
                </div>
              )}

              {/* Strength preview */}
              {w.strength && (
                <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                  <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.accent,marginBottom:"4px"}}>🏋️ Strength</div>
                  <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.strength}</div>
                </div>
              )}

              {/* WOD movements */}
              {w.movements.length > 0 && (
                <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                  <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.primary,marginBottom:"4px"}}>⏱️ WOD</div>
                  {w.movements.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:"12px",color:THEME.colors.textSecondary}}>
                      <span>{m.name}</span><span style={{fontFamily:THEME.fonts.mono,fontSize:"11px"}}>{m.reps}{m.weight?` @ ${m.weight}`:""}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Accessory preview */}
              {w.accessory && (
                <div style={{padding:"8px 0",borderTop:`1px solid ${THEME.colors.border}`}}>
                  <div style={{fontSize:"10px",fontFamily:THEME.fonts.display,letterSpacing:"1.5px",color:THEME.colors.textSecondary,marginBottom:"4px"}}>💪 Accessory</div>
                  <div style={{fontSize:"12px",color:THEME.colors.textSecondary,whiteSpace:"pre-line",lineHeight:"1.5"}}>{w.accessory}</div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ===== SCHEDULE BUILDER ===== */}
      {tab === "schedule" && (
        <>
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

            <button onClick={handleAddSession} disabled={schedSaving} style={{
              ...S.btn1,marginTop:0,opacity:schedSaving?0.5:1,
            }}>
              {schedSaved?"Session Added!":schedSaving?"Adding...":"Add Session"}
            </button>
          </div>

          {/* Today's schedule */}
          <div style={{...S.cardLbl,marginTop:THEME.spacing.lg,marginBottom:THEME.spacing.sm}}>Today's Schedule ({todaySessions.length} classes)</div>
          {todaySessions.map(s => (
            <div key={s.id} style={{...S.card,padding:THEME.spacing.md,marginBottom:"8px",display:"flex",alignItems:"center",gap:THEME.spacing.sm}}>
              <div style={{width:"3px",height:"40px",borderRadius:"2px",background:THEME.colors.primary,flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={{fontWeight:"600",fontSize:"14px"}}>{s.title}</div>
                <div style={{color:THEME.colors.textSecondary,fontSize:"12px"}}>{fmtTime(s.startTime)}–{fmtTime(s.endTime)} · {coachName(s.coachId)}</div>
              </div>
              <div style={{textAlign:"right",marginRight:"8px"}}>
                <div style={{fontFamily:THEME.fonts.mono,fontSize:"14px"}}>{s.signups.length}/{s.capacity}</div>
              </div>
              <button onClick={()=>deleteSession(s.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px"}}>
                <I.trash size={14} color={THEME.colors.error} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ============================================================
// TAB BAR
// ============================================================
const TabBar = ({active,setActive,isStaff}) => {
  const tabs=[{id:"home",l:"Home",ic:I.home},{id:"schedule",l:"Schedule",ic:I.cal},{id:"records",l:"Records",ic:I.trophy},{id:"community",l:"Feed",ic:I.activity},{id:"profile",l:"Profile",ic:I.user}];
  if(isStaff) tabs.push({id:"admin",l:"Admin",ic:I.users});
  return (
    <div style={S.tabBar}>
      {tabs.map(t=>{const on=active===t.id;const Ic=t.ic;return(
        <button key={t.id} style={S.tabBtn} onClick={()=>setActive(t.id)}>
          <Ic size={on?24:20} color={on?THEME.colors.primary:THEME.colors.textMuted}/>
          <span style={{...S.tabLbl,color:on?THEME.colors.primary:THEME.colors.textMuted,fontWeight:on?"700":"400"}}>{t.l}</span>
          {on&&<div style={{width:"4px",height:"4px",borderRadius:"50%",background:THEME.colors.primary,marginTop:"1px"}}/>}
        </button>
      );})}
    </div>
  );
};

// ============================================================
// MAIN SHELL
// ============================================================
const MainApp = () => {
  const {user,logout} = useAuth();
  const [tab, setTab] = useState("home");
  const isStaff = user.role==="admin"||user.role==="coach";
  const screens = {home:DashboardScreen,schedule:ScheduleScreen,records:RecordsScreen,community:CommunityScreen,profile:ProfileScreen,admin:AdminScreen};
  const Sc = screens[tab]||DashboardScreen;
  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:`14px ${THEME.spacing.md} 0`,position:"sticky",top:0,zIndex:50,background:THEME.colors.bg}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"32px",height:"32px",borderRadius:"8px",background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontFamily:THEME.fonts.display,color:THEME.colors.white,fontWeight:"700"}}>{GYM_CONFIG.shortName.charAt(0)}</div>
          <span style={{fontFamily:THEME.fonts.display,fontSize:"16px",color:THEME.colors.primary,letterSpacing:"3px"}}>{GYM_CONFIG.shortName}</span>
        </div>
        <button onClick={logout} style={{background:"none",border:"none",cursor:"pointer",padding:"8px"}}><I.out size={18} color={THEME.colors.textMuted}/></button>
      </div>
      <Sc />
      <TabBar active={tab} setActive={setTab} isStaff={isStaff} />
    </>
  );
};

// ============================================================
// ROOT
// ============================================================
export default function App() {
  const [user,setUser] = useState(null);
  const [view,setView] = useState("login");
  const login = useCallback((u)=>setUser(u),[]);
  const logout = useCallback(()=>{setUser(null);setView("login");},[]);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;}
        body{background:#000;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${THEME.colors.border};border-radius:4px;}
        ::placeholder{color:${THEME.colors.textMuted};}
        button{transition:all 0.15s ease;-webkit-tap-highlight-color:transparent;}
        button:active{transform:scale(0.97);}
        input,textarea{transition:border-color 0.2s ease,box-shadow 0.2s ease;}
        input:focus,textarea:focus{border-color:${THEME.colors.primary} !important;box-shadow:0 0 0 3px ${THEME.colors.primarySubtle};}
        textarea{font-family:${THEME.fonts.body};}
      `}</style>
      <div style={S.app}>
        <AuthContext.Provider value={{user,login,logout}}>
          {!user?(view==="login"?<LoginScreen onSwitch={()=>setView("signup")} onLogin={login}/>:<SignupScreen onSwitch={()=>setView("login")} onLogin={login}/>):<MainApp/>}
        </AuthContext.Provider>
      </div>
    </>
  );
}
