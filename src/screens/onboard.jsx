import { useState } from "react";
import { supabase, darkenHex, lightenHex, subtleHex } from "../config/shared";

const THEME = {
  bg: "#0B0F0D", surface: "#141A16", surfaceLight: "#1C241E",
  border: "#2A332C", primary: "#2D8C4E", primaryDark: "#1F6B3A",
  accent: "#D4A843", text: "#F0F4F1", textSec: "#94A89A", textMuted: "#5A6B5E",
  error: "#E74C3C", white: "#FFF",
  display: "'Bebas Neue', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace",
};

const defaultForm = {
  subdomain: "", gymId: "", name: "", shortName: "", primaryColor: "#2D8C4E", accentColor: "#D4A843",
  tagline: "", subtitle: "", location: "", address: "", phone: "", email: "", website: "", since: "",
  classTypes: "CrossFit, Open Gym",
  tiers: [{ id: "unlimited", name: "Unlimited", price: "175", interval: "month" }],
  hours: { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "Closed" },
};

const inp = { width: "100%", padding: "10px 14px", borderRadius: "8px", border: `1px solid ${THEME.border}`, background: THEME.surfaceLight, color: THEME.text, fontSize: "14px", fontFamily: THEME.body, outline: "none" };
const lbl = { display: "block", fontSize: "11px", fontFamily: THEME.display, letterSpacing: "1.5px", color: THEME.textMuted, marginBottom: "4px" };
const card = { background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: "12px", padding: "24px", marginBottom: "16px" };

export default function OnboardGym() {
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [existingTenants, setExistingTenants] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadTenants = async () => {
    const { data } = await supabase.from("tenants").select("*, gym_settings(*)").order("created_at", { ascending: false });
    setExistingTenants(data || []);
    setLoaded(true);
  };
  if (!loaded) loadTenants();

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const setHour = (day) => (e) => setForm(f => ({ ...f, hours: { ...f.hours, [day]: e.target.value } }));

  // Auto-generate gymId and shortName from name
  const setName = (e) => {
    const name = e.target.value;
    const gymId = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
    const shortName = name.replace(/crossfit|fitness|gym|box/gi, "").trim().toUpperCase() || name.toUpperCase();
    setForm(f => ({ ...f, name, gymId: f.gymId || gymId, shortName: f.shortName || shortName }));
  };

  // Auto-generate subdomain from gymId
  const setGymId = (e) => {
    const gymId = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const subdomain = gymId.replace(/-/g, "").slice(0, 20);
    setForm(f => ({ ...f, gymId, subdomain: f.subdomain || subdomain }));
  };

  const addTier = () => setForm(f => ({ ...f, tiers: [...f.tiers, { id: "", name: "", price: "", interval: "month" }] }));
  const removeTier = (idx) => setForm(f => ({ ...f, tiers: f.tiers.filter((_, i) => i !== idx) }));
  const setTier = (idx, field) => (e) => setForm(f => ({ ...f, tiers: f.tiers.map((t, i) => i === idx ? { ...t, [field]: e.target.value } : t) }));

  const handleSubmit = async () => {
    setError(null); setResult(null);
    if (!form.subdomain || !form.gymId || !form.name) {
      setError("Subdomain, Gym ID, and Gym Name are required.");
      return;
    }

    setSaving(true);
    try {
      // 1. Create tenant record
      const { error: tenantErr } = await supabase.from("tenants").insert({
        subdomain: form.subdomain.toLowerCase().trim(),
        gym_id: form.gymId.trim(),
      });
      if (tenantErr) throw new Error(`Tenant: ${tenantErr.message}`);

      // 2. Create gym_settings record
      const { error: settingsErr } = await supabase.from("gym_settings").insert({
        gym_id: form.gymId.trim(),
        name: form.name,
        short_name: form.shortName || form.name.toUpperCase(),
        primary_color: form.primaryColor,
        accent_color: form.accentColor,
        tagline: form.tagline || null,
        subtitle: form.subtitle || null,
        location: form.location || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        since: form.since || null,
        class_types: form.classTypes.split(",").map(s => s.trim()).filter(Boolean),
        membership_tiers: form.tiers.filter(t => t.name).map(t => ({ id: t.id || t.name.toLowerCase().replace(/\s+/g, "-"), name: t.name, price: Number(t.price) || 0, interval: t.interval })),
        hours: form.hours,
        logo_url: null,
      });
      if (settingsErr) throw new Error(`Settings: ${settingsErr.message}`);

      setResult({
        subdomain: form.subdomain,
        gymId: form.gymId,
        url: `https://${form.subdomain}.brodiapp.com`,
      });
      setForm({ ...defaultForm });
      loadTenants();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, color: THEME.text, fontFamily: THEME.body, padding: "40px 20px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `linear-gradient(135deg,${THEME.primary},${THEME.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.display, fontSize: "18px", color: THEME.white }}>B</div>
          <span style={{ fontFamily: THEME.display, fontSize: "24px", letterSpacing: "5px", color: THEME.primary }}>BRODI</span>
        </div>
        <h1 style={{ fontFamily: THEME.display, fontSize: "36px", letterSpacing: "2px", marginBottom: "8px" }}>Onboard a New Gym</h1>
        <p style={{ color: THEME.textSec, marginBottom: "32px", lineHeight: "1.6" }}>Fill in the gym's information below. This creates their tenant record and gym configuration. Their app will be live at <span style={{ color: THEME.accent, fontFamily: THEME.mono, fontSize: "13px" }}>[subdomain].brodiapp.com</span> immediately.</p>

        {/* Identity */}
        <div style={card}>
          <div style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "2px", color: THEME.textMuted, marginBottom: "16px" }}>Identity</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Gym Name *</label><input style={inp} value={form.name} onChange={setName} placeholder="Iron Valley CrossFit" /></div>
            <div><label style={lbl}>Gym ID *</label><input style={inp} value={form.gymId} onChange={setGymId} placeholder="iron-valley-crossfit" /></div>
            <div><label style={lbl}>Subdomain *</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                <input style={{ ...inp, borderTopRightRadius: 0, borderBottomRightRadius: 0 }} value={form.subdomain} onChange={set("subdomain")} placeholder="ironvalley" />
                <div style={{ padding: "10px 12px", background: THEME.border, borderRadius: "0 8px 8px 0", fontSize: "12px", color: THEME.textMuted, fontFamily: THEME.mono, whiteSpace: "nowrap" }}>.brodiapp.com</div>
              </div>
            </div>
            <div><label style={lbl}>Short Name</label><input style={inp} value={form.shortName} onChange={set("shortName")} placeholder="IRON VALLEY" /></div>
            <div><label style={lbl}>Year Founded</label><input style={inp} value={form.since} onChange={set("since")} placeholder="2018" /></div>
          </div>
        </div>

        {/* Branding */}
        <div style={card}>
          <div style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "2px", color: THEME.textMuted, marginBottom: "16px" }}>Branding</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={lbl}>Primary Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="color" value={form.primaryColor} onChange={set("primaryColor")} style={{ width: "40px", height: "36px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }} />
                <input style={{ ...inp, flex: 1 }} value={form.primaryColor} onChange={set("primaryColor")} placeholder="#B8451C" />
              </div>
            </div>
            <div>
              <label style={lbl}>Accent Color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="color" value={form.accentColor} onChange={set("accentColor")} style={{ width: "40px", height: "36px", border: "none", borderRadius: "6px", cursor: "pointer", background: "none" }} />
                <input style={{ ...inp, flex: 1 }} value={form.accentColor} onChange={set("accentColor")} placeholder="#D4A843" />
              </div>
            </div>
            <div><label style={lbl}>Tagline</label><input style={inp} value={form.tagline} onChange={set("tagline")} placeholder="Strength. Community. Grit." /></div>
            <div><label style={lbl}>Subtitle</label><input style={inp} value={form.subtitle} onChange={set("subtitle")} placeholder="Forged Together." /></div>
          </div>
          {/* Preview */}
          <div style={{ marginTop: "16px", padding: "16px", borderRadius: "10px", background: THEME.bg, border: `1px solid ${THEME.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: `linear-gradient(135deg,${form.primaryColor},${darkenHex(form.primaryColor)})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.display, fontSize: "14px", color: THEME.white }}>{(form.shortName || form.name || "B").charAt(0)}</div>
              <span style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "3px", color: form.primaryColor }}>{form.shortName || "GYM NAME"}</span>
            </div>
            <div style={{ fontSize: "12px", color: THEME.textSec }}>{form.tagline || "Your tagline here"}</div>
          </div>
        </div>

        {/* Contact */}
        <div style={card}>
          <div style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "2px", color: THEME.textMuted, marginBottom: "16px" }}>Contact & Location</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label style={lbl}>Location (City, State)</label><input style={inp} value={form.location} onChange={set("location")} placeholder="Denver, Colorado" /></div>
            <div><label style={lbl}>Full Address</label><input style={inp} value={form.address} onChange={set("address")} placeholder="123 Main St, Denver, CO 80202" /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={set("phone")} placeholder="(303) 555-0199" /></div>
            <div><label style={lbl}>Email</label><input style={inp} value={form.email} onChange={set("email")} placeholder="info@gym.com" /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Website</label><input style={inp} value={form.website} onChange={set("website")} placeholder="ironvalleycrossfit.com" /></div>
          </div>
        </div>

        {/* Operations */}
        <div style={card}>
          <div style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "2px", color: THEME.textMuted, marginBottom: "16px" }}>Operations</div>
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Class Types (comma-separated)</label>
            <input style={inp} value={form.classTypes} onChange={set("classTypes")} placeholder="CrossFit, Open Gym, Barbell Club, Yoga" />
          </div>

          <label style={lbl}>Membership Tiers</label>
          {form.tiers.map((t, idx) => (
            <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <input style={{ ...inp, flex: 2 }} value={t.name} onChange={setTier(idx, "name")} placeholder="Tier name" />
              <input style={{ ...inp, flex: 1 }} value={t.price} onChange={setTier(idx, "price")} placeholder="$" type="number" />
              <select value={t.interval} onChange={setTier(idx, "interval")} style={{ ...inp, flex: 1 }}>
                <option value="month">/month</option>
                <option value="visit">/visit</option>
                <option value="year">/year</option>
              </select>
              {form.tiers.length > 1 && (
                <button onClick={() => removeTier(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: THEME.error, fontSize: "18px", padding: "4px" }}>×</button>
              )}
            </div>
          ))}
          <button onClick={addTier} style={{ background: "none", border: `1px dashed ${THEME.border}`, borderRadius: "8px", padding: "8px 16px", color: THEME.primary, cursor: "pointer", fontFamily: THEME.display, fontSize: "12px", letterSpacing: "1px", width: "100%" }}>+ Add Tier</button>
        </div>

        {/* Hours */}
        <div style={card}>
          <div style={{ fontFamily: THEME.display, fontSize: "16px", letterSpacing: "2px", color: THEME.textMuted, marginBottom: "16px" }}>Operating Hours</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => (
              <div key={day} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: THEME.display, fontSize: "14px", letterSpacing: "1px", color: THEME.textSec, width: "36px" }}>{day.toUpperCase()}</span>
                <input style={{ ...inp, flex: 1 }} value={form.hours[day]} onChange={setHour(day)} placeholder="5:00 AM – 7:30 PM" />
              </div>
            ))}
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ ...card, borderColor: THEME.error, borderLeft: `3px solid ${THEME.error}` }}>
            <div style={{ color: THEME.error, fontFamily: THEME.display, fontSize: "14px", letterSpacing: "1px", marginBottom: "4px" }}>Error</div>
            <div style={{ color: THEME.textSec, fontSize: "14px" }}>{error}</div>
          </div>
        )}

        {result && (
          <div style={{ ...card, borderColor: THEME.primary, borderLeft: `3px solid ${THEME.primary}` }}>
            <div style={{ color: THEME.primary, fontFamily: THEME.display, fontSize: "16px", letterSpacing: "1px", marginBottom: "8px" }}>✓ Gym Created Successfully</div>
            <div style={{ fontSize: "14px", color: THEME.textSec, marginBottom: "4px" }}>
              <strong style={{ color: THEME.text }}>{result.subdomain}</strong>.brodiapp.com is now live
            </div>
            <div style={{ fontFamily: THEME.mono, fontSize: "13px", color: THEME.accent, padding: "8px 12px", background: THEME.bg, borderRadius: "6px", marginTop: "8px" }}>
              {result.url}
            </div>
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={saving} style={{
          width: "100%", padding: "16px", borderRadius: "12px", border: "none", cursor: saving ? "default" : "pointer",
          background: saving ? THEME.surfaceLight : `linear-gradient(135deg,${THEME.primary},${THEME.primaryDark})`,
          color: THEME.white, fontFamily: THEME.display, fontSize: "18px", letterSpacing: "3px",
          marginBottom: "48px", opacity: saving ? 0.5 : 1, transition: "all .2s",
        }}>
          {saving ? "Creating..." : "Create Gym & Go Live"}
        </button>

        {/* Existing Tenants */}
        {existingTenants.length > 0 && (
          <div>
            <div style={{ fontFamily: THEME.display, fontSize: "20px", letterSpacing: "2px", marginBottom: "16px", color: THEME.textSec }}>Active Gyms ({existingTenants.length})</div>
            {existingTenants.map(t => {
              const settings = Array.isArray(t.gym_settings) ? t.gym_settings[0] : t.gym_settings;
              return (
                <div key={t.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "6px",
                      background: settings?.primary_color ? `linear-gradient(135deg,${settings.primary_color},${darkenHex(settings.primary_color)})` : THEME.surfaceLight,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: THEME.display, fontSize: "14px", color: THEME.white,
                    }}>{(settings?.short_name || t.gym_id || "?").charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>{settings?.name || t.gym_id}</div>
                      <div style={{ fontSize: "12px", color: THEME.textMuted }}>{t.subdomain}.brodiapp.com</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "10px",
                      fontFamily: THEME.display, letterSpacing: "1px",
                      background: t.active ? "rgba(45,140,78,0.12)" : "rgba(231,76,60,0.12)",
                      color: t.active ? THEME.primary : THEME.error,
                    }}>{t.active ? "LIVE" : "INACTIVE"}</div>
                    <a href={`https://${t.subdomain}.brodiapp.com`} target="_blank" rel="noreferrer" style={{
                      fontSize: "12px", color: THEME.primary, fontFamily: THEME.display, letterSpacing: "1px",
                    }}>OPEN →</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
