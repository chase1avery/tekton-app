// ============================================================
// CrossFit Gym Management App — White-Label Platform
// Phase 1-7: Complete — Foundation + Schedule + Profile + Records + Community + Admin + Billing + PWA
// ============================================================

import { useState, useEffect, createContext, useContext, useCallback } from "react";

// ============================================================
// GYM CONFIG (defaults — can be overridden by settings stored in Supabase)
// ============================================================
const DEFAULT_GYM_CONFIG = {
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

// Mutable references that get updated by Settings
let GYM_CONFIG = { ...DEFAULT_GYM_CONFIG };

// Helper to derive darker/lighter/subtle from a hex color
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};
const darkenHex = (hex, amt = 30) => {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.max(0, r - amt).toString(16).padStart(2, "0")}${Math.max(0, g - amt).toString(16).padStart(2, "0")}${Math.max(0, b - amt).toString(16).padStart(2, "0")}`;
};
const lightenHex = (hex, amt = 30) => {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.min(255, r + amt).toString(16).padStart(2, "0")}${Math.min(255, g + amt).toString(16).padStart(2, "0")}${Math.min(255, b + amt).toString(16).padStart(2, "0")}`;
};
const subtleHex = (hex, a = 0.12) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const buildTheme = (config) => ({
  colors: {
    bg: "#0B0F0D", surface: "#141A16", surfaceLight: "#1C241E", surfaceHover: "#243028",
    border: "#2A332C", borderLight: "#384039",
    primary: config.colors.primary, primaryDark: darkenHex(config.colors.primary),
    primaryLight: lightenHex(config.colors.primary), primarySubtle: subtleHex(config.colors.primary),
    accent: config.colors.accent, accentSubtle: config.colors.accentSubtle,
    success: "#2ECC71", warning: "#F39C12", error: "#E74C3C",
    text: "#F0F4F1", textSecondary: "#94A89A", textMuted: "#5A6B5E",
    white: "#FFFFFF", black: "#000000",
  },
  fonts: { display: "'Bebas Neue', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace" },
  radius: { sm: "6px", md: "10px", lg: "14px", xl: "20px", full: "9999px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
});

let THEME = buildTheme(GYM_CONFIG);

// Apply settings overrides (called on load and when settings change)
const applyGymSettings = (overrides) => {
  if (overrides.name) { GYM_CONFIG.name = overrides.name; GYM_CONFIG.shortName = overrides.shortName || overrides.name.toUpperCase(); }
  if (overrides.primaryColor) {
    GYM_CONFIG.colors.primary = overrides.primaryColor;
    GYM_CONFIG.colors.primaryDark = darkenHex(overrides.primaryColor);
    GYM_CONFIG.colors.primaryLight = lightenHex(overrides.primaryColor);
    GYM_CONFIG.colors.primarySubtle = subtleHex(overrides.primaryColor);
  }
  if (overrides.logoUrl !== undefined) GYM_CONFIG.logoUrl = overrides.logoUrl;
  THEME = buildTheme(GYM_CONFIG);
};

// Settings context
const SettingsContext = createContext({ refresh: () => {} });

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

// Auto-resize textarea handler
const autoResize = (e) => {
  e.target.style.height = "auto";
  e.target.style.height = e.target.scrollHeight + "px";
};

const WEIGHT_LEVELS = ["Rx", "Rx+", "Mastered", "Scaled", "Foundation"];

// ============================================================
// SUPABASE CLIENT
// ============================================================
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hgxharjliwycyefinnpm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhneGhhcmpsaXd5Y3llZmlubnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODQ0MjMsImV4cCI6MjA4OTU2MDQyM30.NC9d5Sv4qigJcexRrdkXCWH6MGvFiEbGFNGhybOpdug'
);

// ============================================================
// FIELD MAPPERS (snake_case DB <-> camelCase UI)
// ============================================================
const mapMember = (m) => m ? ({
  id: m.id, authId: m.auth_id, email: m.email,
  firstName: m.first_name, lastName: m.last_name, role: m.role,
  phone: m.phone || "", avatar: m.avatar_url,
  emergencyContact: m.emergency_contact || { name: "", phone: "", relation: "" },
  membershipType: m.membership_type, membershipStatus: m.membership_status,
  joinDate: m.join_date, gymId: m.gym_id,
}) : null;

const mapWorkout = (w) => w ? ({
  id: w.id, gymId: w.gym_id, createdBy: w.created_by,
  date: w.date, title: w.title, type: w.type,
  description: w.description || "", warmup: w.warmup, strength: w.strength,
  accessory: w.accessory, notes: w.notes || null,
  movements: w.movements || [],
  timeCap: w.time_cap, targetTime: w.target_time || null, rounds: w.rounds,
}) : null;

const mapSession = (s) => s ? ({
  id: s.id, gymId: s.gym_id, coachId: s.coach_id,
  title: s.title, date: s.date,
  startTime: s.start_time?.slice(0, 5) || s.start_time,
  endTime: s.end_time?.slice(0, 5) || s.end_time,
  capacity: s.capacity, workoutId: s.workout_id,
  signups: (s.session_signups || []).map(su => su.member_id),
}) : null;

const mapPr = (p) => p ? ({
  id: p.id, memberId: p.member_id, category: p.category,
  name: p.name, value: p.value, unit: p.unit,
  date: p.date, notes: p.notes,
}) : null;

const mapResult = (r) => r ? ({
  id: r.id, memberId: r.member_id, workoutId: r.workout_id,
  sessionId: r.session_id, score: r.score, scoreType: r.score_type,
  rx: r.rx, notes: r.notes, date: r.date,
  highFives: r.high_fives || [],
}) : null;

const mapBilling = (b) => b ? ({
  id: b.id, memberId: b.member_id, amount: b.amount,
  description: b.description, date: b.date,
  status: b.status, method: b.method,
}) : null;

// ============================================================
// SERVICE LAYER (Supabase)
// ============================================================
const services = {
  members: {
    getAll: async () => {
      const { data } = await supabase.from('members').select('*').eq('gym_id', GYM_CONFIG.id);
      return (data || []).map(mapMember);
    },
    getById: async (id) => {
      const { data } = await supabase.from('members').select('*').eq('id', id).single();
      return mapMember(data);
    },
    getByField: async (field, value) => {
      const dbField = { memberId: 'member_id', gymId: 'gym_id', authId: 'auth_id', email: 'email', role: 'role' }[field] || field;
      const { data } = await supabase.from('members').select('*').eq(dbField, value);
      return (data || []).map(mapMember);
    },
    create: async (item) => {
      const { data } = await supabase.from('members').insert({
        email: item.email, first_name: item.firstName, last_name: item.lastName,
        role: item.role || 'member', phone: item.phone || '',
        emergency_contact: item.emergencyContact || { name: "", phone: "", relation: "" },
        membership_type: item.membershipType || 'unlimited',
        membership_status: item.membershipStatus || 'active',
        gym_id: item.gymId || GYM_CONFIG.id,
      }).select().single();
      return mapMember(data);
    },
    update: async (id, updates) => {
      const dbUpdates = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.emergencyContact !== undefined) dbUpdates.emergency_contact = updates.emergencyContact;
      if (updates.membershipType !== undefined) dbUpdates.membership_type = updates.membershipType;
      if (updates.membershipStatus !== undefined) dbUpdates.membership_status = updates.membershipStatus;
      if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
      const { data } = await supabase.from('members').update(dbUpdates).eq('id', id).select().single();
      return mapMember(data);
    },
    delete: async (id) => {
      await supabase.from('members').delete().eq('id', id);
      return true;
    },
  },

  workouts: {
    getAll: async () => {
      const { data } = await supabase.from('workouts').select('*').eq('gym_id', GYM_CONFIG.id).order('date', { ascending: false });
      return (data || []).map(mapWorkout);
    },
    getById: async (id) => {
      const { data } = await supabase.from('workouts').select('*').eq('id', id).single();
      return mapWorkout(data);
    },
    getByField: async (field, value) => {
      const dbField = { gymId: 'gym_id', createdBy: 'created_by' }[field] || field;
      const { data } = await supabase.from('workouts').select('*').eq(dbField, value);
      return (data || []).map(mapWorkout);
    },
    create: async (item) => {
      const { data } = await supabase.from('workouts').insert({
        gym_id: item.gymId || GYM_CONFIG.id, created_by: item.createdBy || null,
        date: item.date, title: item.title, type: item.type || 'ForTime',
        description: item.description || '', warmup: item.warmup || null,
        strength: item.strength || null, accessory: item.accessory || null,
        notes: item.notes || null, target_time: item.targetTime || null,
        movements: item.movements || [], time_cap: item.timeCap || null,
        rounds: item.rounds || null,
      }).select().single();
      return mapWorkout(data);
    },
    update: async (id, updates) => {
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.warmup !== undefined) dbUpdates.warmup = updates.warmup;
      if (updates.strength !== undefined) dbUpdates.strength = updates.strength;
      if (updates.accessory !== undefined) dbUpdates.accessory = updates.accessory;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.targetTime !== undefined) dbUpdates.target_time = updates.targetTime;
      if (updates.movements !== undefined) dbUpdates.movements = updates.movements;
      if (updates.timeCap !== undefined) dbUpdates.time_cap = updates.timeCap;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      const { data } = await supabase.from('workouts').update(dbUpdates).eq('id', id).select().single();
      return mapWorkout(data);
    },
    delete: async (id) => {
      await supabase.from('workouts').delete().eq('id', id);
      return true;
    },
  },

  sessions: {
    getAll: async () => {
      const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('gym_id', GYM_CONFIG.id).order('date').order('start_time');
      return (data || []).map(mapSession);
    },
    getById: async (id) => {
      const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('id', id).single();
      return mapSession(data);
    },
    getByField: async (field, value) => {
      const dbField = { gymId: 'gym_id', coachId: 'coach_id', workoutId: 'workout_id', date: 'date' }[field] || field;
      const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq(dbField, value);
      return (data || []).map(mapSession);
    },
    create: async (item) => {
      const { data } = await supabase.from('sessions').insert({
        gym_id: item.gymId || GYM_CONFIG.id, coach_id: item.coachId,
        title: item.title, date: item.date,
        start_time: item.startTime, end_time: item.endTime,
        capacity: item.capacity || 16, workout_id: item.workoutId || null,
      }).select('*, session_signups(member_id)').single();
      return mapSession(data);
    },
    update: async (id, updates) => {
      // Handle signups separately
      if (updates.signups !== undefined) {
        // This is handled through session_signups table directly
        // The update call for signups is a no-op here — use signup/cancel methods
      }
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.coachId !== undefined) dbUpdates.coach_id = updates.coachId;
      if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
      if (updates.workoutId !== undefined) dbUpdates.workout_id = updates.workoutId;
      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from('sessions').update(dbUpdates).eq('id', id);
      }
      const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('id', id).single();
      return mapSession(data);
    },
    delete: async (id) => {
      await supabase.from('session_signups').delete().eq('session_id', id);
      await supabase.from('sessions').delete().eq('id', id);
      return true;
    },
    // Signup/cancel helpers
    signup: async (sessionId, memberId) => {
      await supabase.from('session_signups').insert({ session_id: sessionId, member_id: memberId });
    },
    cancel: async (sessionId, memberId) => {
      await supabase.from('session_signups').delete().eq('session_id', sessionId).eq('member_id', memberId);
    },
  },

  prs: {
    getAll: async () => {
      const { data } = await supabase.from('personal_records').select('*').order('date', { ascending: false });
      return (data || []).map(mapPr);
    },
    getById: async (id) => {
      const { data } = await supabase.from('personal_records').select('*').eq('id', id).single();
      return mapPr(data);
    },
    getByField: async (field, value) => {
      const dbField = { memberId: 'member_id' }[field] || field;
      const { data } = await supabase.from('personal_records').select('*').eq(dbField, value).order('date', { ascending: false });
      return (data || []).map(mapPr);
    },
    create: async (item) => {
      const { data } = await supabase.from('personal_records').insert({
        member_id: item.memberId, category: item.category,
        name: item.name, value: item.value, unit: item.unit,
        date: item.date || new Date().toISOString(), notes: item.notes || null,
      }).select().single();
      return mapPr(data);
    },
    update: async (id, updates) => {
      const { data } = await supabase.from('personal_records').update(updates).eq('id', id).select().single();
      return mapPr(data);
    },
    delete: async (id) => {
      await supabase.from('personal_records').delete().eq('id', id);
      return true;
    },
  },

  results: {
    getAll: async () => {
      const { data } = await supabase.from('workout_results').select('*').order('date', { ascending: false });
      return (data || []).map(mapResult);
    },
    getById: async (id) => {
      const { data } = await supabase.from('workout_results').select('*').eq('id', id).single();
      return mapResult(data);
    },
    getByField: async (field, value) => {
      const dbField = { memberId: 'member_id', workoutId: 'workout_id', sessionId: 'session_id' }[field] || field;
      const { data } = await supabase.from('workout_results').select('*').eq(dbField, value).order('date', { ascending: false });
      return (data || []).map(mapResult);
    },
    create: async (item) => {
      const { data } = await supabase.from('workout_results').insert({
        member_id: item.memberId, workout_id: item.workoutId || null,
        session_id: item.sessionId || null, score: item.score,
        score_type: item.scoreType || 'time', rx: item.rx !== undefined ? item.rx : true,
        notes: item.notes || null, date: item.date || new Date().toISOString(),
        high_fives: item.highFives || [],
      }).select().single();
      return mapResult(data);
    },
    update: async (id, updates) => {
      const dbUpdates = {};
      if (updates.score !== undefined) dbUpdates.score = updates.score;
      if (updates.scoreType !== undefined) dbUpdates.score_type = updates.scoreType;
      if (updates.rx !== undefined) dbUpdates.rx = updates.rx;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.highFives !== undefined) dbUpdates.high_fives = updates.highFives;
      const { data } = await supabase.from('workout_results').update(dbUpdates).eq('id', id).select().single();
      return mapResult(data);
    },
    delete: async (id) => {
      await supabase.from('workout_results').delete().eq('id', id);
      return true;
    },
  },

  billing: {
    getAll: async () => {
      const { data } = await supabase.from('billing_records').select('*').order('date', { ascending: false });
      return (data || []).map(mapBilling);
    },
    getById: async (id) => {
      const { data } = await supabase.from('billing_records').select('*').eq('id', id).single();
      return mapBilling(data);
    },
    getByField: async (field, value) => {
      const dbField = { memberId: 'member_id' }[field] || field;
      const { data } = await supabase.from('billing_records').select('*').eq(dbField, value).order('date', { ascending: false });
      return (data || []).map(mapBilling);
    },
    create: async (item) => {
      const { data } = await supabase.from('billing_records').insert({
        member_id: item.memberId, amount: item.amount,
        description: item.description, date: item.date || new Date().toISOString(),
        status: item.status || 'pending', method: item.method || 'card',
      }).select().single();
      return mapBilling(data);
    },
    update: async (id, updates) => {
      const { data } = await supabase.from('billing_records').update(updates).eq('id', id).select().single();
      return mapBilling(data);
    },
    delete: async (id) => {
      await supabase.from('billing_records').delete().eq('id', id);
      return true;
    },
  },

  auth: {
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const { data: member } = await supabase.from('members').select('*').eq('auth_id', data.user.id).single();
      if (!member) throw new Error("Member profile not found");
      return mapMember(member);
    },
    signup: async ({ email, password, firstName, lastName }) => {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (error) throw new Error(error.message);
      // The trigger function auto-creates the member row
      // Wait a moment for the trigger to complete, then fetch
      await new Promise(r => setTimeout(r, 500));
      const { data: member } = await supabase.from('members').select('*').eq('auth_id', data.user.id).single();
      return mapMember(member);
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data: member } = await supabase.from('members').select('*').eq('auth_id', session.user.id).single();
      return mapMember(member);
    },
  },
};

// Keep a reference for components that look up members by ID
// This gets populated when data loads
let membersCache = [];

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
  app: { fontFamily: THEME.fonts.body, background: THEME.colors.bg, color: THEME.colors.text, minHeight: "100vh", maxWidth: "1200px", margin: "0 auto", position: "relative", overflow: "hidden" },
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
  tabBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "1200px", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0 22px", background: THEME.colors.bg, borderTop: `1px solid ${THEME.colors.border}`, zIndex: 100 },
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
    membersCache = allMembers;
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

// ============================================================
// SCHEDULE SCREEN (Phase 2 + WOD Detail View)
// ============================================================
const ScheduleScreen = () => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today());
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [viewingWod, setViewingWod] = useState(null); // null = schedule list, object = WOD detail

  const weekDates = getWeekDates(weekStart);

  const loadSessions = useCallback(async () => {
    const [all, wods] = await Promise.all([
      services.sessions.getAll(),
      services.workouts.getAll(),
    ]);
    setAllSessions(all);
    setAllWorkouts(wods);
    setSessions(all.filter(s => s.date === selectedDate));
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
                    <div style={{fontWeight:"600",fontSize:"15px"}}>{m.name}</div>
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
                  <span onClick={(e)=>{e.stopPropagation();const c=coachObj(s.coachId);if(c?.avatar){const rect=e.target.getBoundingClientRect();setCoachPopup({coach:c,x:rect.left,y:rect.bottom+8});}}} style={{cursor:coachObj(s.coachId)?.avatar?"pointer":"default",textDecoration:coachObj(s.coachId)?.avatar?"underline":"none",textUnderlineOffset:"3px",textDecorationColor:THEME.colors.border}}>Coach {coach(s.coachId)}</span>
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
    </div>
  );
};

// ============================================================
// PROFILE SCREEN (Phase 2 — NEW)
// ============================================================
const ProfileScreen = () => {
  const { user, login, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const ec = user.emergencyContact || {};
  const [form, setForm] = useState({
    firstName: user.firstName, lastName: user.lastName,
    phone: user.phone, email: user.email,
    ecFirstName: ec.firstName || ec.name || "", ecLastName: ec.lastName || "",
    ecEmail: ec.email || "", ecPhone: ec.phone || "",
    ecAddress: ec.address || "", ecRelation: ec.relation || "",
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
      emergencyContact: {
        firstName: form.ecFirstName, lastName: form.ecLastName,
        name: `${form.ecFirstName} ${form.ecLastName}`.trim(),
        email: form.ecEmail, phone: form.ecPhone,
        address: form.ecAddress, relation: form.ecRelation,
      },
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
        <label style={{cursor:"pointer",position:"relative",flexShrink:0}}>
          {user.avatar ? (
            <img src={user.avatar} alt="" style={{width:"64px",height:"64px",borderRadius:THEME.radius.full,objectFit:"cover"}} />
          ) : (
            <div style={{
              width:"64px",height:"64px",borderRadius:THEME.radius.full,
              background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:THEME.fonts.display,fontSize:"26px",color:THEME.colors.white,
            }}>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</div>
          )}
          <div style={{
            position:"absolute",bottom:"-2px",right:"-2px",width:"22px",height:"22px",
            borderRadius:"50%",background:THEME.colors.primary,display:"flex",alignItems:"center",justifyContent:"center",
            border:`2px solid ${THEME.colors.surface}`,
          }}><I.edit size={10} color={THEME.colors.white}/></div>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ext = file.name.split(".").pop();
            const path = `avatars/${user.id}.${ext}`;
            const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
            if (upErr) { console.error("Upload error:", upErr); return; }
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
            const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
            const updated = await services.members.update(user.id, { avatar: avatarUrl });
            login(updated);
          }} />
        </label>
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
          <div style={{display:"flex",gap:THEME.spacing.sm}}>
            <div style={{flex:1}}>{[{k:"ecFirstName",l:"First Name"}].map(x=><div key={x.k} style={S.inpGrp}><label style={{...S.lbl,fontSize:"11px"}}>{x.l}</label><input style={S.inp} value={form[x.k]} onChange={e=>set(x.k,e.target.value)} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>)}</div>
            <div style={{flex:1}}>{[{k:"ecLastName",l:"Last Name"}].map(x=><div key={x.k} style={S.inpGrp}><label style={{...S.lbl,fontSize:"11px"}}>{x.l}</label><input style={S.inp} value={form[x.k]} onChange={e=>set(x.k,e.target.value)} onFocus={e=>(e.target.style.borderColor=THEME.colors.primary)} onBlur={e=>(e.target.style.borderColor=THEME.colors.border)} /></div>)}</div>
          </div>
          {[
            {k:"ecEmail",l:"Email"},{k:"ecPhone",l:"Phone"},{k:"ecAddress",l:"Address"},{k:"ecRelation",l:"Relationship"},
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
        </div>
      )}

      {/* Emergency Contact */}
      {!editing && (
        <div style={{...S.card,borderLeft:`3px solid ${THEME.colors.warning}`}}>
          <div style={{display:"flex",alignItems:"center",gap:THEME.spacing.sm,marginBottom:THEME.spacing.sm}}>
            <I.shield size={16} color={THEME.colors.warning}/>
            <div style={S.cardLbl}>Emergency Contact</div>
          </div>
          {(() => {
            const ec = user.emergencyContact || {};
            const ecName = ec.firstName ? `${ec.firstName} ${ec.lastName || ""}`.trim() : ec.name || "";
            if (!ecName) return <div style={{color:THEME.colors.textMuted,fontSize:"14px"}}>No emergency contact set. Tap Edit to add one.</div>;
            return (
              <>
                <InfoRow icon={<I.user size={16} color={THEME.colors.textMuted}/>} label="Name" value={ecName} />
                {ec.relation && <InfoRow icon={<I.users size={16} color={THEME.colors.textMuted}/>} label="Relationship" value={ec.relation} />}
                {ec.email && <InfoRow icon={<I.mail size={16} color={THEME.colors.textMuted}/>} label="Email" value={ec.email} />}
                {ec.phone && <InfoRow icon={<I.phone size={16} color={THEME.colors.textMuted}/>} label="Phone" value={ec.phone} />}
                {ec.address && <InfoRow icon={<I.home size={16} color={THEME.colors.textMuted}/>} label="Address" value={ec.address} />}
              </>
            );
          })()}
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
  const settingsCtx = useContext(SettingsContext);
  const [tab, setTab] = useState("overview"); // overview | users | roster | wod | schedule | settings
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
      <div style={{fontFamily:THEME.fonts.display,fontSize:"28px",letterSpacing:"1px",marginBottom:THEME.spacing.lg}}>Admin</div>

      <div style={{display:"flex",gap:"5px",marginBottom:THEME.spacing.lg,flexWrap:"wrap"}}>
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="users" label="Users" />
        <TabBtn id="roster" label="Roster" />
        <TabBtn id="wod" label="Program" />
        <TabBtn id="schedule" label="Schedule" />
        {user.role === "admin" && <TabBtn id="settings" label="Settings" />}
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
  const settingsCtx = useContext(SettingsContext);
  const [tab, setTab] = useState("home");
  const [, forceUpdate] = useState(0);
  const isStaff = user.role==="admin"||user.role==="coach";
  const screens = {home:DashboardScreen,schedule:ScheduleScreen,records:RecordsScreen,community:CommunityScreen,profile:ProfileScreen,admin:AdminScreen};
  const Sc = screens[tab]||DashboardScreen;

  // Re-render when settings change
  useEffect(() => { forceUpdate(v => v + 1); }, [settingsCtx.version]);

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:`14px ${THEME.spacing.md} 0`,position:"sticky",top:0,zIndex:50,background:THEME.colors.bg}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {GYM_CONFIG.logoUrl ? (
            <img src={GYM_CONFIG.logoUrl} alt="" style={{width:"32px",height:"32px",borderRadius:"8px",objectFit:"contain"}} />
          ) : (
            <div style={{width:"32px",height:"32px",borderRadius:"8px",background:`linear-gradient(135deg,${THEME.colors.primary},${THEME.colors.primaryDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontFamily:THEME.fonts.display,color:THEME.colors.white,fontWeight:"700"}}>{GYM_CONFIG.shortName.charAt(0)}</div>
          )}
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
  const [loading, setLoading] = useState(true);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const login = useCallback((u)=>setUser(u),[]);
  const logout = useCallback(async ()=>{
    await services.auth.logout();
    setUser(null);
    setView("login");
  },[]);

  // Load gym settings from Supabase
  const loadGymSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from("gym_settings").select("*").eq("gym_id", GYM_CONFIG.id).single();
      if (data) {
        applyGymSettings({
          name: data.name, shortName: data.short_name,
          primaryColor: data.primary_color, logoUrl: data.logo_url,
        });
      }
    } catch (e) { /* No settings saved yet — use defaults */ }
  }, []);

  const refreshSettings = useCallback(() => {
    loadGymSettings().then(() => setSettingsVersion(v => v + 1));
  }, [loadGymSettings]);

  // Check for existing session on app load
  useEffect(() => {
    (async () => {
      await loadGymSettings();
      try {
        const member = await services.auth.getSession();
        if (member) {
          setUser(member);
          membersCache = await services.members.getAll();
        }
      } catch (e) {
        console.log("No existing session");
      }
      setLoading(false);
    })();
  }, [loadGymSettings]);

  if (loading) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
          *{margin:0;padding:0;box-sizing:border-box;}
          body{background:#000;}
        `}</style>
        <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
          <div style={{textAlign:"center"}}>
            <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
            <div style={{fontFamily:THEME.fonts.display,fontSize:"24px",color:THEME.colors.text,letterSpacing:"3px",marginTop:"16px"}}>{GYM_CONFIG.shortName}</div>
            <div style={{color:THEME.colors.textMuted,fontSize:"13px",marginTop:"8px"}}>Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <SettingsContext.Provider value={{refresh:refreshSettings, version:settingsVersion}}>
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
        textarea{font-family:${THEME.fonts.body},'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}
        input{font-family:${THEME.fonts.body},'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}
        input,textarea{color-scheme:dark;}
        @media (min-width: 768px) {
          #root > div > div:last-child { padding-left: 32px; padding-right: 32px; }
        }
        @media (min-width: 1024px) {
          #root > div > div:last-child { padding-left: 48px; padding-right: 48px; }
        }
      `}</style>
      <div style={S.app}>
        <AuthContext.Provider value={{user,login,logout}}>
          {!user?(view==="login"?<LoginScreen onSwitch={()=>setView("signup")} onLogin={login}/>:<SignupScreen onSwitch={()=>setView("login")} onLogin={login}/>):<MainApp/>}
        </AuthContext.Provider>
      </div>
    </SettingsContext.Provider>
  );
}
