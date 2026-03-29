// ============================================================
// SHARED MODULE
// Config, Theme, Supabase, Services, Contexts, Icons, Styles
// ============================================================
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- GYM CONFIG ----
// Default fallback config (used until tenant config loads from database)
export const DEFAULT_GYM_CONFIG = {
  id: "brodi-demo", name: "Brodi", shortName: "BRODI",
  tagline: "Gym Management. Community. Confidence.", subtitle: "Built for the Box.",
  location: "", address: "", phone: "", email: "", website: "",
  since: "2026",
  colors: { primary: "#2D8C4E", primaryDark: "#1F6B3A", primaryLight: "#3DAF62", primarySubtle: "rgba(45, 140, 78, 0.12)", secondary: "#1A1A1A", accent: "#D4A843", accentSubtle: "rgba(212, 168, 67, 0.12)" },
  logoUrl: null,
  classTypes: ["CrossFit", "Open Gym"],
  membershipTiers: [
    { id: "unlimited", name: "Unlimited", price: 175, interval: "month" },
    { id: "limited", name: "3x/Week", price: 140, interval: "month" },
    { id: "drop-in", name: "Drop-In", price: 25, interval: "visit" },
  ],
  hours: { mon: "Closed", tue: "Closed", wed: "Closed", thu: "Closed", fri: "Closed", sat: "Closed", sun: "Closed" },
};
export let GYM_CONFIG = { ...DEFAULT_GYM_CONFIG };

// ---- MULTI-TENANT RESOLVER ----
// Reads subdomain from URL to determine which gym to load
// tekton.brodiapp.com → "tekton" → gym_id "tekton-fitness"
// localhost:5173 → falls back to DEFAULT_GYM_CONFIG.id
export const resolveSubdomain = () => {
  const hostname = window.location.hostname;
  // Local development fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Check for ?gym= query param for local dev testing
    const params = new URLSearchParams(window.location.search);
    return params.get('gym') || null;
  }
  // Production: extract subdomain from *.brodiapp.com or *.vercel.app
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0]; // e.g. "tekton" from "tekton.brodiapp.com"
  if (parts.length === 2 && hostname.endsWith('.vercel.app')) return parts[0].replace('-app', '');
  return null;
};

// Resolve tenant: subdomain → gym_id via tenants table
export const resolveTenant = async (supabaseClient) => {
  const subdomain = resolveSubdomain();
  if (!subdomain) return GYM_CONFIG.id; // fallback to default

  try {
    const { data } = await supabaseClient
      .from('tenants')
      .select('gym_id')
      .eq('subdomain', subdomain)
      .eq('active', true)
      .single();
    if (data) return data.gym_id;
  } catch (e) {
    console.log('Tenant lookup failed, using default:', e.message);
  }
  return GYM_CONFIG.id;
};

// Load full gym config from gym_settings and apply it
export const loadAndApplyGymConfig = async (supabaseClient, gymId) => {
  GYM_CONFIG.id = gymId;
  try {
    const { data } = await supabaseClient
      .from('gym_settings')
      .select('*')
      .eq('gym_id', gymId)
      .single();
    if (data) {
      GYM_CONFIG.name = data.name || GYM_CONFIG.name;
      GYM_CONFIG.shortName = data.short_name || GYM_CONFIG.name.toUpperCase();
      if (data.primary_color) {
        GYM_CONFIG.colors.primary = data.primary_color;
        GYM_CONFIG.colors.primaryDark = darkenHex(data.primary_color);
        GYM_CONFIG.colors.primaryLight = lightenHex(data.primary_color);
        GYM_CONFIG.colors.primarySubtle = subtleHex(data.primary_color);
      }
      if (data.accent_color) {
        GYM_CONFIG.colors.accent = data.accent_color;
        GYM_CONFIG.colors.accentSubtle = subtleHex(data.accent_color);
      }
      GYM_CONFIG.logoUrl = data.logo_url || null;
      GYM_CONFIG.tagline = data.tagline || GYM_CONFIG.tagline;
      GYM_CONFIG.subtitle = data.subtitle || GYM_CONFIG.subtitle;
      GYM_CONFIG.location = data.location || GYM_CONFIG.location;
      GYM_CONFIG.address = data.address || GYM_CONFIG.address;
      GYM_CONFIG.phone = data.phone || GYM_CONFIG.phone;
      GYM_CONFIG.email = data.email || GYM_CONFIG.email;
      GYM_CONFIG.website = data.website || GYM_CONFIG.website;
      GYM_CONFIG.since = data.since || GYM_CONFIG.since;
      if (data.class_types) GYM_CONFIG.classTypes = typeof data.class_types === 'string' ? JSON.parse(data.class_types) : data.class_types;
      if (data.membership_tiers) GYM_CONFIG.membershipTiers = typeof data.membership_tiers === 'string' ? JSON.parse(data.membership_tiers) : data.membership_tiers;
      if (data.hours) GYM_CONFIG.hours = typeof data.hours === 'string' ? JSON.parse(data.hours) : data.hours;
      THEME = buildTheme(GYM_CONFIG);
    }
  } catch (e) {
    console.log('Gym settings load failed, using defaults:', e.message);
  }
  THEME = buildTheme(GYM_CONFIG);
};

// ---- COLOR HELPERS ----
export const hexToRgb = (hex) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return { r, g, b }; };
export const darkenHex = (hex, amt = 30) => { const { r, g, b } = hexToRgb(hex); return `#${Math.max(0,r-amt).toString(16).padStart(2,"0")}${Math.max(0,g-amt).toString(16).padStart(2,"0")}${Math.max(0,b-amt).toString(16).padStart(2,"0")}`; };
export const lightenHex = (hex, amt = 30) => { const { r, g, b } = hexToRgb(hex); return `#${Math.min(255,r+amt).toString(16).padStart(2,"0")}${Math.min(255,g+amt).toString(16).padStart(2,"0")}${Math.min(255,b+amt).toString(16).padStart(2,"0")}`; };
export const subtleHex = (hex, a = 0.12) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

export const buildTheme = (config) => ({
  colors: { bg: "#0B0F0D", surface: "#141A16", surfaceLight: "#1C241E", surfaceHover: "#243028", border: "#2A332C", borderLight: "#384039", primary: config.colors.primary, primaryDark: darkenHex(config.colors.primary), primaryLight: lightenHex(config.colors.primary), primarySubtle: subtleHex(config.colors.primary), accent: config.colors.accent, accentSubtle: config.colors.accentSubtle, success: "#2ECC71", warning: "#F39C12", error: "#E74C3C", text: "#F0F4F1", textSecondary: "#94A89A", textMuted: "#5A6B5E", white: "#FFFFFF", black: "#000000" },
  fonts: { display: "'Bebas Neue', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace" },
  radius: { sm: "6px", md: "10px", lg: "14px", xl: "20px", full: "9999px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
});
export let THEME = buildTheme(GYM_CONFIG);

export const applyGymSettings = (overrides) => {
  if (overrides.name) { GYM_CONFIG.name = overrides.name; GYM_CONFIG.shortName = overrides.shortName || overrides.name.toUpperCase(); }
  if (overrides.primaryColor) { GYM_CONFIG.colors.primary = overrides.primaryColor; GYM_CONFIG.colors.primaryDark = darkenHex(overrides.primaryColor); GYM_CONFIG.colors.primaryLight = lightenHex(overrides.primaryColor); GYM_CONFIG.colors.primarySubtle = subtleHex(overrides.primaryColor); }
  if (overrides.logoUrl !== undefined) GYM_CONFIG.logoUrl = overrides.logoUrl;
  THEME = buildTheme(GYM_CONFIG);
};

// ---- CONTEXTS ----
export const SettingsContext = createContext({ refresh: () => {} });
export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const AnnouncementContext = createContext({ announcements: [], reload: () => {} });
export const useAnnouncements = () => useContext(AnnouncementContext);

// ---- SUPABASE ----
export const supabase = createClient('https://hgxharjliwycyefinnpm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhneGhhcmpsaXd5Y3llZmlubnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODQ0MjMsImV4cCI6MjA4OTU2MDQyM30.NC9d5Sv4qigJcexRrdkXCWH6MGvFiEbGFNGhybOpdug');

// ---- HELPERS ----
export const getWeekDates = (refDate) => { const d = new Date(refDate); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7)); return Array.from({ length: 7 }, (_, i) => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return dt.toISOString().split("T")[0]; }); };
export const fmt = (dateStr) => { const d = new Date(dateStr + "T12:00:00"); return { day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()], num: d.getDate() }; };
export const fmtLong = (dateStr) => { const d = new Date(dateStr + "T12:00:00"); const months = ["January","February","March","April","May","June","July","August","September","October","November","December"]; return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
export const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; const hr = h % 12 || 12; return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2,"0")} ${ampm}`; };
export const today = () => new Date().toISOString().split("T")[0];
export const autoResize = (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; };
export const WEIGHT_LEVELS = ["Rx", "Rx+", "Mastered", "Scaled", "Foundation"];

// ---- MEMBERS CACHE ----
export let membersCache = [];
export const setMembersCache = (m) => { membersCache = m; };

// ---- FIELD MAPPERS ----
const mapMember = (m) => m ? ({ id: m.id, authId: m.auth_id, email: m.email, firstName: m.first_name, lastName: m.last_name, role: m.role, phone: m.phone || "", avatar: m.avatar_url, emergencyContact: m.emergency_contact || { name: "", phone: "", relation: "" }, membershipType: m.membership_type, membershipStatus: m.membership_status, joinDate: m.join_date, gymId: m.gym_id }) : null;
const mapWorkout = (w) => w ? ({ id: w.id, gymId: w.gym_id, createdBy: w.created_by, date: w.date, title: w.title, type: w.type, description: w.description || "", warmup: w.warmup, strength: w.strength, accessory: w.accessory, notes: w.notes || null, movements: w.movements || [], timeCap: w.time_cap, targetTime: w.target_time || null, rounds: w.rounds }) : null;
const mapSession = (s) => s ? ({ id: s.id, gymId: s.gym_id, coachId: s.coach_id, title: s.title, date: s.date, startTime: s.start_time?.slice(0, 5) || s.start_time, endTime: s.end_time?.slice(0, 5) || s.end_time, capacity: s.capacity, workoutId: s.workout_id, signups: (s.session_signups || []).map(su => su.member_id) }) : null;
const mapPr = (p) => p ? ({ id: p.id, memberId: p.member_id, category: p.category, name: p.name, value: p.value, unit: p.unit, date: p.date, notes: p.notes }) : null;
const mapResult = (r) => r ? ({ id: r.id, memberId: r.member_id, workoutId: r.workout_id, sessionId: r.session_id, score: r.score, scoreType: r.score_type, rx: r.rx, scale: r.scale || (r.rx ? "Rx" : "Scaled"), notes: r.notes, date: r.date, highFives: r.high_fives || [] }) : null;
const mapBilling = (b) => b ? ({ id: b.id, memberId: b.member_id, amount: b.amount, description: b.description, date: b.date, status: b.status, method: b.method }) : null;

// ---- SERVICES ----
export const services = {
  members: {
    getAll: async () => { const { data } = await supabase.from('members').select('*').eq('gym_id', GYM_CONFIG.id); return (data || []).map(mapMember); },
    getById: async (id) => { const { data } = await supabase.from('members').select('*').eq('id', id).single(); return mapMember(data); },
    getByField: async (field, value) => { const dbField = { memberId: 'member_id', gymId: 'gym_id', authId: 'auth_id', email: 'email', role: 'role' }[field] || field; const { data } = await supabase.from('members').select('*').eq(dbField, value); return (data || []).map(mapMember); },
    create: async (item) => { const { data } = await supabase.from('members').insert({ email: item.email, first_name: item.firstName, last_name: item.lastName, role: item.role || 'member', phone: item.phone || '', emergency_contact: item.emergencyContact || { name: "", phone: "", relation: "" }, membership_type: item.membershipType || 'unlimited', membership_status: item.membershipStatus || 'active', gym_id: item.gymId || GYM_CONFIG.id }).select().single(); return mapMember(data); },
    update: async (id, updates) => { const dbUpdates = {}; if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName; if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName; if (updates.email !== undefined) dbUpdates.email = updates.email; if (updates.phone !== undefined) dbUpdates.phone = updates.phone; if (updates.role !== undefined) dbUpdates.role = updates.role; if (updates.emergencyContact !== undefined) dbUpdates.emergency_contact = updates.emergencyContact; if (updates.membershipType !== undefined) dbUpdates.membership_type = updates.membershipType; if (updates.membershipStatus !== undefined) dbUpdates.membership_status = updates.membershipStatus; if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar; const { data } = await supabase.from('members').update(dbUpdates).eq('id', id).select().single(); return mapMember(data); },
    delete: async (id) => { await supabase.from('members').delete().eq('id', id); return true; },
  },
  workouts: {
    getAll: async () => { const { data } = await supabase.from('workouts').select('*').eq('gym_id', GYM_CONFIG.id).order('date', { ascending: false }); return (data || []).map(mapWorkout); },
    getById: async (id) => { const { data } = await supabase.from('workouts').select('*').eq('id', id).single(); return mapWorkout(data); },
    getByField: async (field, value) => { const dbField = { gymId: 'gym_id', createdBy: 'created_by' }[field] || field; const { data } = await supabase.from('workouts').select('*').eq(dbField, value); return (data || []).map(mapWorkout); },
    create: async (item) => { const { data } = await supabase.from('workouts').insert({ gym_id: item.gymId || GYM_CONFIG.id, created_by: item.createdBy || null, date: item.date, title: item.title, type: item.type || 'ForTime', description: item.description || '', warmup: item.warmup || null, strength: item.strength || null, accessory: item.accessory || null, notes: item.notes || null, target_time: item.targetTime || null, movements: item.movements || [], time_cap: item.timeCap || null, rounds: item.rounds || null }).select().single(); return mapWorkout(data); },
    update: async (id, updates) => { const dbUpdates = {}; if (updates.title !== undefined) dbUpdates.title = updates.title; if (updates.type !== undefined) dbUpdates.type = updates.type; if (updates.description !== undefined) dbUpdates.description = updates.description; if (updates.warmup !== undefined) dbUpdates.warmup = updates.warmup; if (updates.strength !== undefined) dbUpdates.strength = updates.strength; if (updates.accessory !== undefined) dbUpdates.accessory = updates.accessory; if (updates.notes !== undefined) dbUpdates.notes = updates.notes; if (updates.targetTime !== undefined) dbUpdates.target_time = updates.targetTime; if (updates.movements !== undefined) dbUpdates.movements = updates.movements; if (updates.timeCap !== undefined) dbUpdates.time_cap = updates.timeCap; if (updates.date !== undefined) dbUpdates.date = updates.date; const { data } = await supabase.from('workouts').update(dbUpdates).eq('id', id).select().single(); return mapWorkout(data); },
    delete: async (id) => { await supabase.from('workouts').delete().eq('id', id); return true; },
  },
  sessions: {
    getAll: async () => { const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('gym_id', GYM_CONFIG.id).order('date').order('start_time'); return (data || []).map(mapSession); },
    getById: async (id) => { const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('id', id).single(); return mapSession(data); },
    getByField: async (field, value) => { const dbField = { gymId: 'gym_id', coachId: 'coach_id', workoutId: 'workout_id', date: 'date' }[field] || field; const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq(dbField, value); return (data || []).map(mapSession); },
    create: async (item) => { const { data } = await supabase.from('sessions').insert({ gym_id: item.gymId || GYM_CONFIG.id, coach_id: item.coachId, title: item.title, date: item.date, start_time: item.startTime, end_time: item.endTime, capacity: item.capacity || 16, workout_id: item.workoutId || null }).select('*, session_signups(member_id)').single(); return mapSession(data); },
    update: async (id, updates) => { if (updates.signups !== undefined) { /* handled via signup/cancel */ } const dbUpdates = {}; if (updates.title !== undefined) dbUpdates.title = updates.title; if (updates.coachId !== undefined) dbUpdates.coach_id = updates.coachId; if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity; if (updates.workoutId !== undefined) dbUpdates.workout_id = updates.workoutId; if (Object.keys(dbUpdates).length > 0) { await supabase.from('sessions').update(dbUpdates).eq('id', id); } const { data } = await supabase.from('sessions').select('*, session_signups(member_id)').eq('id', id).single(); return mapSession(data); },
    delete: async (id) => { await supabase.from('session_signups').delete().eq('session_id', id); await supabase.from('sessions').delete().eq('id', id); return true; },
    signup: async (sessionId, memberId) => { await supabase.from('session_signups').insert({ session_id: sessionId, member_id: memberId }); },
    cancel: async (sessionId, memberId) => { await supabase.from('session_signups').delete().eq('session_id', sessionId).eq('member_id', memberId); },
  },
  prs: {
    getAll: async () => { const { data } = await supabase.from('personal_records').select('*').order('date', { ascending: false }); return (data || []).map(mapPr); },
    getById: async (id) => { const { data } = await supabase.from('personal_records').select('*').eq('id', id).single(); return mapPr(data); },
    getByField: async (field, value) => { const dbField = { memberId: 'member_id' }[field] || field; const { data } = await supabase.from('personal_records').select('*').eq(dbField, value).order('date', { ascending: false }); return (data || []).map(mapPr); },
    create: async (item) => { const { data } = await supabase.from('personal_records').insert({ member_id: item.memberId, category: item.category, name: item.name, value: item.value, unit: item.unit, date: item.date || new Date().toISOString(), notes: item.notes || null }).select().single(); return mapPr(data); },
    update: async (id, updates) => { const { data } = await supabase.from('personal_records').update(updates).eq('id', id).select().single(); return mapPr(data); },
    delete: async (id) => { await supabase.from('personal_records').delete().eq('id', id); return true; },
  },
  results: {
    getAll: async () => { const { data } = await supabase.from('workout_results').select('*').order('date', { ascending: false }); return (data || []).map(mapResult); },
    getById: async (id) => { const { data } = await supabase.from('workout_results').select('*').eq('id', id).single(); return mapResult(data); },
    getByField: async (field, value) => { const dbField = { memberId: 'member_id', workoutId: 'workout_id', sessionId: 'session_id' }[field] || field; const { data } = await supabase.from('workout_results').select('*').eq(dbField, value).order('date', { ascending: false }); return (data || []).map(mapResult); },
    create: async (item) => { const { data } = await supabase.from('workout_results').insert({ member_id: item.memberId, workout_id: item.workoutId || null, session_id: item.sessionId || null, score: item.score, score_type: item.scoreType || 'time', rx: item.rx !== undefined ? item.rx : true, scale: item.scale || (item.rx ? "Rx" : "Scaled"), notes: item.notes || null, date: item.date || new Date().toISOString(), high_fives: item.highFives || [] }).select().single(); return mapResult(data); },
    update: async (id, updates) => { const dbUpdates = {}; if (updates.score !== undefined) dbUpdates.score = updates.score; if (updates.scoreType !== undefined) dbUpdates.score_type = updates.scoreType; if (updates.rx !== undefined) dbUpdates.rx = updates.rx; if (updates.scale !== undefined) dbUpdates.scale = updates.scale; if (updates.notes !== undefined) dbUpdates.notes = updates.notes; if (updates.highFives !== undefined) dbUpdates.high_fives = updates.highFives; const { data } = await supabase.from('workout_results').update(dbUpdates).eq('id', id).select().single(); return mapResult(data); },
    delete: async (id) => { await supabase.from('workout_results').delete().eq('id', id); return true; },
  },
  billing: {
    getAll: async () => { const { data } = await supabase.from('billing_records').select('*').order('date', { ascending: false }); return (data || []).map(mapBilling); },
    getById: async (id) => { const { data } = await supabase.from('billing_records').select('*').eq('id', id).single(); return mapBilling(data); },
    getByField: async (field, value) => { const dbField = { memberId: 'member_id' }[field] || field; const { data } = await supabase.from('billing_records').select('*').eq(dbField, value).order('date', { ascending: false }); return (data || []).map(mapBilling); },
    create: async (item) => { const { data } = await supabase.from('billing_records').insert({ member_id: item.memberId, amount: item.amount, description: item.description, date: item.date || new Date().toISOString(), status: item.status || 'pending', method: item.method || 'card' }).select().single(); return mapBilling(data); },
    update: async (id, updates) => { const { data } = await supabase.from('billing_records').update(updates).eq('id', id).select().single(); return mapBilling(data); },
    delete: async (id) => { await supabase.from('billing_records').delete().eq('id', id); return true; },
  },
  announcements: {
    getActive: async () => { const now = new Date().toISOString(); const { data } = await supabase.from('announcements').select('*').eq('gym_id', GYM_CONFIG.id).gte('expires_at', now).order('created_at', { ascending: false }); return (data || []).map(a => ({ id: a.id, gymId: a.gym_id, message: a.message, createdBy: a.created_by, createdAt: a.created_at, expiresAt: a.expires_at })); },
    create: async (item) => { const { data } = await supabase.from('announcements').insert({ gym_id: item.gymId || GYM_CONFIG.id, message: item.message, created_by: item.createdBy, expires_at: item.expiresAt }).select().single(); return data; },
    delete: async (id) => { await supabase.from('announcements').delete().eq('id', id); return true; },
  },
  waitlist: {
    getForSession: async (sessionId) => {
      const { data } = await supabase.from('session_waitlist').select('*').eq('session_id', sessionId).order('position');
      return (data || []).map(w => ({ id: w.id, sessionId: w.session_id, memberId: w.member_id, position: w.position, joinedAt: w.joined_at }));
    },
    join: async (sessionId, memberId) => {
      // Get next position
      const { data: existing } = await supabase.from('session_waitlist').select('position').eq('session_id', sessionId).order('position', { ascending: false }).limit(1);
      const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 1;
      await supabase.from('session_waitlist').insert({ session_id: sessionId, member_id: memberId, position: nextPos });
    },
    leave: async (sessionId, memberId) => {
      await supabase.from('session_waitlist').delete().eq('session_id', sessionId).eq('member_id', memberId);
      // Re-number positions
      const { data: remaining } = await supabase.from('session_waitlist').select('*').eq('session_id', sessionId).order('position');
      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i].position !== i + 1) {
            await supabase.from('session_waitlist').update({ position: i + 1 }).eq('id', remaining[i].id);
          }
        }
      }
    },
    promoteFirst: async (sessionId) => {
      // Get first person on waitlist
      const { data } = await supabase.from('session_waitlist').select('*').eq('session_id', sessionId).order('position').limit(1);
      if (!data || data.length === 0) return null;
      const first = data[0];
      // Add them to session signups
      await supabase.from('session_signups').insert({ session_id: sessionId, member_id: first.member_id });
      // Remove from waitlist
      await supabase.from('session_waitlist').delete().eq('id', first.id);
      // Re-number remaining
      const { data: remaining } = await supabase.from('session_waitlist').select('*').eq('session_id', sessionId).order('position');
      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i].position !== i + 1) {
            await supabase.from('session_waitlist').update({ position: i + 1 }).eq('id', remaining[i].id);
          }
        }
      }
      return first.member_id;
    },
  },
  auth: {
    login: async (email, password) => { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message); const { data: member } = await supabase.from('members').select('*').eq('auth_id', data.user.id).single(); if (!member) throw new Error("Member profile not found"); return mapMember(member); },
    signup: async ({ email, password, firstName, lastName }) => { const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName, gym_id: GYM_CONFIG.id } } }); if (error) throw new Error(error.message); await new Promise(r => setTimeout(r, 500)); const { data: member } = await supabase.from('members').select('*').eq('auth_id', data.user.id).single(); if (member && member.gym_id !== GYM_CONFIG.id) { await supabase.from('members').update({ gym_id: GYM_CONFIG.id }).eq('id', member.id); member.gym_id = GYM_CONFIG.id; } return mapMember(member); },
    logout: async () => { await supabase.auth.signOut(); },
    getSession: async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return null; const { data: member } = await supabase.from('members').select('*').eq('auth_id', session.user.id).single(); return mapMember(member); },
  },
};

// ---- STREAK CALCULATOR ----
export const calcStreak = (allSessions, memberId) => {
  const memberSessions = allSessions.filter(s => s.signups && s.signups.includes(memberId)).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (memberSessions.length === 0) return { current: 0, longest: 0, totalSessions: 0 };
  const getWeekKey = (dateStr) => { const d = new Date(dateStr + "T12:00:00"); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7)); return mon.toISOString().split("T")[0]; };
  const weekCounts = {}; memberSessions.forEach(s => { const wk = getWeekKey(s.date); weekCounts[wk] = (weekCounts[wk] || 0) + 1; });
  const sortedWeeks = Object.keys(weekCounts).sort();
  let current = 0, longest = 0, streak = 0;
  for (let i = 0; i < sortedWeeks.length; i++) {
    const wk = sortedWeeks[i];
    if (weekCounts[wk] >= 4) { if (i > 0) { const prevWeek = new Date(sortedWeeks[i - 1] + "T12:00:00"); const thisWeek = new Date(wk + "T12:00:00"); const diff = (thisWeek - prevWeek) / (1000 * 60 * 60 * 24); if (diff === 7 && weekCounts[sortedWeeks[i - 1]] >= 4) { streak++; } else { streak = 1; } } else { streak = 1; } longest = Math.max(longest, streak); } else { streak = 0; }
  }
  const currentWeekKey = getWeekKey(today()); const lastWeekDate = new Date(currentWeekKey + "T12:00:00"); lastWeekDate.setDate(lastWeekDate.getDate() - 7); const lastWeekKey = lastWeekDate.toISOString().split("T")[0];
  current = 0; const currentWeekQualifies = (weekCounts[currentWeekKey] || 0) >= 4; const lastWeekQualifies = (weekCounts[lastWeekKey] || 0) >= 4;
  if (currentWeekQualifies || lastWeekQualifies) { let checkWeek = currentWeekQualifies ? currentWeekKey : lastWeekKey; while (weekCounts[checkWeek] && weekCounts[checkWeek] >= 4) { current++; const prev = new Date(checkWeek + "T12:00:00"); prev.setDate(prev.getDate() - 7); checkWeek = prev.toISOString().split("T")[0]; } }
  return { current, longest: Math.max(longest, current), totalSessions: memberSessions.length };
};
export let streakCache = {};
export const setStreakCache = (memberId, val) => { streakCache[memberId] = val; };
export const getStreak = (memberId) => streakCache[memberId] || { current: 0, longest: 0, totalSessions: 0 };

// ---- ICONS ----
const Ico = ({ children, size = 22, color = THEME.colors.textSecondary, ...r }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...r}>{children}</svg>);
export const I = {
  home: (p) => <Ico {...p}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></Ico>,
  cal: (p) => <Ico {...p}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></Ico>,
  trophy: (p) => <Ico {...p}><path d="M12 15l-2 5h4l-2-5zm0 0a6 6 0 006-6V4H6v5a6 6 0 006 6zM6 4H4v3a2 2 0 002 2m12-5h2v3a2 2 0 01-2 2" /></Ico>,
  users: (p) => <Ico {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Ico>,
  user: (p) => <Ico {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></Ico>,
  activity: (p) => <Ico {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Ico>,
  clock: (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ico>,
  plus: (p) => <Ico {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>,
  x: (p) => <Ico {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Ico>,
  check: (p) => <Ico {...p}><polyline points="20 6 9 17 4 12" /></Ico>,
  chevR: (p) => <Ico {...p}><polyline points="9 18 15 12 9 6" /></Ico>,
  chevL: (p) => <Ico {...p}><polyline points="15 18 9 12 15 6" /></Ico>,
  edit: (p) => <Ico {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Ico>,
  trash: (p) => <Ico {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Ico>,
  shield: (p) => <Ico {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ico>,
  phone: (p) => <Ico {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></Ico>,
  mail: (p) => <Ico {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></Ico>,
  medal: (p) => <Ico {...p}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></Ico>,
  out: (p) => <Ico {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Ico>,
};

// ---- STYLES ----
export const S = {
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

// ---- COMPONENTS ----
export const FlameStreak = ({ count, size = "md" }) => {
  if (!count || count < 1) return null;
  const sizes = { sm: { w: 28, h: 28, font: 10, flame: 14 }, md: { w: 36, h: 36, font: 12, flame: 18 }, lg: { w: 48, h: 48, font: 16, flame: 24 } };
  const s = sizes[size] || sizes.md;
  return (<div style={{ position: "relative", width: `${s.w}px`, height: `${s.h}px`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span className="flame-anim" style={{ fontSize: `${s.flame}px`, position: "absolute", top: "-2px" }}>🔥</span><span style={{ position: "relative", zIndex: 1, fontFamily: THEME.fonts.display, fontSize: `${s.font}px`, color: THEME.colors.white, fontWeight: "700", textShadow: "0 1px 3px rgba(0,0,0,0.5)", marginTop: "2px" }}>{count}</span></div>);
};

export const renderWithLinks = (text) => {
  if (!text) return null;
  const combined = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => `%%LINK%%${label}%%URL%%${url}%%ENDLINK%%`);
  const segments = combined.split(/(%%LINK%%.*?%%ENDLINK%%)/);
  return segments.map((seg, i) => { const linkMatch = seg.match(/%%LINK%%(.+?)%%URL%%(.+?)%%ENDLINK%%/); if (linkMatch) { return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{color:THEME.colors.error,fontWeight:"600",textDecoration:"underline"}}>{linkMatch[1]}</a>; } const urlRegex = /(https?:\/\/[^\s]+)/g; const urlParts = seg.split(urlRegex); return urlParts.map((part, j) => { if (part.match(urlRegex)) { return <a key={`${i}-${j}`} href={part} target="_blank" rel="noopener noreferrer" style={{color:THEME.colors.error,fontWeight:"600",textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>; } return part; }); });
};

export const AnnouncementBanner = () => {
  const { announcements } = useAnnouncements();
  if (!announcements || announcements.length === 0) return null;
  return (<div style={{marginBottom:THEME.spacing.md}}>{announcements.map(a => (<div key={a.id} style={{ background:"rgba(231, 76, 60, 0.20)", border:"1px solid rgba(231, 76, 60, 0.35)", borderRadius:THEME.radius.md,padding:"12px 16px",marginBottom:"6px", display:"flex",alignItems:"flex-start",gap:"10px" }}><span style={{fontSize:"16px",flexShrink:0,marginTop:"1px"}}>📢</span><div style={{flex:1}}><div style={{fontSize:"14px",color:THEME.colors.text,lineHeight:"1.5",whiteSpace:"pre-line"}}>{renderWithLinks(a.message)}</div><div style={{fontSize:"10px",color:THEME.colors.textMuted,marginTop:"4px",fontFamily:THEME.fonts.display,letterSpacing:"1px"}}>Expires {new Date(a.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div></div></div>))}</div>);
};

export const MOVEMENT_LIBRARY = [
  "Thrusters","Pull-ups","Deadlifts","Clean & Jerk","Snatch","Back Squat","Front Squat",
  "Overhead Squat","Bench Press","Strict Press","Push Press","Push Jerk","Wall Balls",
  "Box Jumps","Burpees","Toes-to-Bar","Muscle-ups","HSPU","Rowing","Bike Erg",
  "Ski Erg","Double Unders","Pistols","Lunges","Kettlebell Swings","Turkish Get-ups",
  "Power Cleans","Hang Cleans","Hang Power Cleans","Squat Cleans","Power Snatches",
  "Hang Snatches","Overhead Lunges","GHD Sit-ups","Hip Extensions","Ring Dips",
  "Bar Dips","Rope Climbs","Sled Push","Sled Pull","Farmers Carry","Running",
];

// ---- GLOBAL CSS ----
export const globalCSS = (THEME) => `
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
  @keyframes flameFlicker {
    0%, 100% { transform: scale(1) rotate(-3deg); }
    25% { transform: scale(1.1) rotate(3deg); }
    50% { transform: scale(0.95) rotate(-2deg); }
    75% { transform: scale(1.05) rotate(2deg); }
  }
  .flame-anim { animation: flameFlicker 0.8s ease-in-out infinite; display: inline-block; }
  @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
  input,textarea{transition:border-color 0.2s ease,box-shadow 0.2s ease;}
  input:focus,textarea:focus{border-color:${THEME.colors.primary} !important;box-shadow:0 0 0 3px ${THEME.colors.primarySubtle};}
  textarea{font-family:${THEME.fonts.body},'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}
  input{font-family:${THEME.fonts.body},'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}
  input,textarea{color-scheme:dark;}
  @media (min-width: 768px) { #root > div > div:last-child { padding-left: 32px; padding-right: 32px; } }
  @media (min-width: 1024px) { #root > div > div:last-child { padding-left: 48px; padding-right: 48px; } }
`;
