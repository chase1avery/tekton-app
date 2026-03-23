import { useState, useEffect, useCallback, useContext } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, useAnnouncements, AnnouncementBanner, FlameStreak, SettingsContext, AnnouncementContext, membersCache, setMembersCache, calcStreak, streakCache, setStreakCache, getStreak, getWeekDates, fmt, fmtLong, fmtTime, today, autoResize, WEIGHT_LEVELS, MOVEMENT_LIBRARY, darkenHex, lightenHex, subtleHex, applyGymSettings, renderWithLinks } from '../config/shared';
import { NavContext } from '../App';

const ProfileScreen = () => {
  const { user, login, logout } = useAuth();
  const { openNutrition, openMessages } = useContext(NavContext);
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
    // Load sessions for streak calculation
    services.sessions.getAll().then(allSessions => {
      setStreakCache(user.id, calcStreak(allSessions, user.id));
    });
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

      {/* Streak Stats */}
      {(() => {
        const streak = getStreak(user.id);
        return (
          <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
            <div style={{...S.statBox,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                {streak.current > 0 && <FlameStreak count={streak.current} size="md" />}
                {streak.current === 0 && <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.textMuted}}>0</div>}
              </div>
              <div style={S.statLbl}>Current Streak</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.accent}}>{streak.longest}</div>
              <div style={S.statLbl}>Longest Streak</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statVal,fontSize:"20px",color:THEME.colors.primary}}>{streak.totalSessions}</div>
              <div style={S.statLbl}>Total Sessions</div>
            </div>
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div style={{display:"flex",gap:THEME.spacing.sm,marginBottom:THEME.spacing.md}}>
        <button onClick={openNutrition} style={{
          flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
          padding:"14px",borderRadius:THEME.radius.lg,border:`1px solid ${THEME.colors.border}`,
          background:THEME.colors.surface,cursor:"pointer",
        }}>
          <span style={{fontSize:"18px"}}>🥗</span>
          <span style={{fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"1.5px",color:THEME.colors.primary}}>Nutrition</span>
        </button>
        <button onClick={openMessages} style={{
          flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
          padding:"14px",borderRadius:THEME.radius.lg,border:`1px solid ${THEME.colors.border}`,
          background:THEME.colors.surface,cursor:"pointer",
        }}>
          <span style={{fontSize:"18px"}}>💬</span>
          <span style={{fontFamily:THEME.fonts.display,fontSize:"13px",letterSpacing:"1.5px",color:THEME.colors.primary}}>Messages</span>
        </button>
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

export default ProfileScreen;
