import { useState, useEffect } from 'react';
import { GYM_CONFIG, THEME, S, I, supabase } from '../config/shared';

const ActivateScreen = ({ token, onActivated, onCancel }) => {
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expired, setExpired] = useState(false);

  // Look up the pending member by token
  useEffect(() => {
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('pending_members')
        .select('*')
        .eq('activation_token', token)
        .eq('activated', false)
        .single();

      if (fetchErr || !data) {
        setExpired(true);
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(data.expires_at) < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      setPending(data);
      setLoading(false);
    })();
  }, [token]);

  const handleActivate = async () => {
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setActivating(true);

    try {
      // Create the auth account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: pending.email,
        password,
        options: {
          data: {
            first_name: pending.first_name,
            last_name: pending.last_name,
          }
        }
      });

      if (authErr) {
        // If user already exists, try to sign in instead
        if (authErr.message.includes('already registered')) {
          setError("This email already has an account. Try logging in instead.");
          setActivating(false);
          return;
        }
        throw authErr;
      }

      // Wait for the trigger to create the member row
      await new Promise(r => setTimeout(r, 800));

      // Update the member row with the correct membership type and phone
      const { data: member } = await supabase
        .from('members')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

      if (member) {
        await supabase.from('members').update({
          membership_type: pending.membership_type || 'unlimited',
          membership_status: 'active',
          phone: pending.phone || '',
          gym_id: pending.gym_id,
        }).eq('id', member.id);
      }

      // Mark the pending record as activated
      await supabase.from('pending_members').update({
        activated: true,
      }).eq('id', pending.id);

      setSuccess(true);

      // Auto-login after 2 seconds
      setTimeout(() => {
        onActivated(pending.email, password);
      }, 2000);

    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setActivating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={S.authWrap}>
        <div style={{ textAlign: "center" }}>
          <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "24px", color: THEME.colors.text, letterSpacing: "3px", marginTop: "16px" }}>{GYM_CONFIG.shortName}</div>
          <div style={{ color: THEME.colors.textMuted, fontSize: "13px", marginTop: "8px" }}>Verifying your invitation...</div>
        </div>
      </div>
    );
  }

  // Expired or invalid token
  if (expired) {
    return (
      <div style={S.authWrap}>
        <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
        <div style={S.gymTitle}>{GYM_CONFIG.shortName}</div>
        <div style={{ ...S.gymSub, marginBottom: THEME.spacing.xl }}>
          {GYM_CONFIG.tagline}
        </div>
        <div style={S.card}>
          <div style={{ textAlign: "center", padding: THEME.spacing.lg }}>
            <div style={{ fontSize: "40px", marginBottom: THEME.spacing.md }}>⏰</div>
            <div style={{ fontFamily: THEME.fonts.display, fontSize: "20px", marginBottom: THEME.spacing.sm }}>
              Link Expired or Invalid
            </div>
            <div style={{ color: THEME.colors.textMuted, fontSize: "14px", lineHeight: "1.5", marginBottom: THEME.spacing.lg }}>
              This activation link is no longer valid. It may have expired or already been used. Contact your gym to get a new invitation.
            </div>
            <button onClick={onCancel} style={S.btn1}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={S.authWrap}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "60px", marginBottom: THEME.spacing.md }}>🎉</div>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "28px", letterSpacing: "1px", marginBottom: THEME.spacing.sm }}>
            Welcome to {GYM_CONFIG.name}!
          </div>
          <div style={{ color: THEME.colors.textMuted, fontSize: "14px", marginBottom: THEME.spacing.lg }}>
            Your account is set up, {pending.first_name}. Logging you in...
          </div>
          <div style={{ color: THEME.colors.primary, fontSize: "13px" }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Activation form
  return (
    <div style={S.authWrap}>
      <div style={S.logoBox}>{GYM_CONFIG.shortName.charAt(0)}</div>
      <div style={S.gymTitle}>{GYM_CONFIG.shortName}</div>
      <div style={{ ...S.gymSub, marginBottom: THEME.spacing.lg }}>
        {GYM_CONFIG.tagline}
      </div>

      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: THEME.spacing.lg }}>
          <div style={{ fontSize: "32px", marginBottom: THEME.spacing.sm }}>👋</div>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "22px", letterSpacing: "0.5px" }}>
            Welcome, {pending.first_name}!
          </div>
          <div style={{ color: THEME.colors.textMuted, fontSize: "14px", marginTop: "6px", lineHeight: "1.5" }}>
            Set up your password to access {GYM_CONFIG.name}
          </div>
        </div>

        {/* Email (read-only) */}
        <div style={S.inpGrp}>
          <label style={{ ...S.lbl, fontSize: "11px" }}>Email</label>
          <div style={{
            ...S.inp, background: THEME.colors.surfaceLight, color: THEME.colors.textMuted,
            cursor: "default", opacity: 0.7,
          }}>
            {pending.email}
          </div>
        </div>

        {/* Membership tier badge */}
        <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
          <div style={{ ...S.badge, background: THEME.colors.primarySubtle, color: THEME.colors.primary, fontSize: "11px", padding: "4px 12px" }}>
            {pending.membership_type ? pending.membership_type.charAt(0).toUpperCase() + pending.membership_type.slice(1) : "Member"}
          </div>
          <span style={{ color: THEME.colors.textMuted, fontSize: "12px" }}>Membership</span>
        </div>

        {/* Password */}
        <div style={S.inpGrp}>
          <label style={{ ...S.lbl, fontSize: "11px" }}>Create Password</label>
          <input
            style={S.inp} type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            onFocus={e => (e.target.style.borderColor = THEME.colors.primary)}
            onBlur={e => (e.target.style.borderColor = THEME.colors.border)}
          />
        </div>

        {/* Confirm Password */}
        <div style={S.inpGrp}>
          <label style={{ ...S.lbl, fontSize: "11px" }}>Confirm Password</label>
          <input
            style={S.inp} type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            onFocus={e => (e.target.style.borderColor = THEME.colors.primary)}
            onBlur={e => (e.target.style.borderColor = THEME.colors.border)}
            onKeyDown={e => { if (e.key === "Enter") handleActivate(); }}
          />
        </div>

        {error && <div style={S.err}>{error}</div>}

        <button onClick={handleActivate} disabled={activating || !password || !confirmPassword} style={{
          ...S.btn1, opacity: (activating || !password || !confirmPassword) ? 0.5 : 1,
        }}>
          {activating ? "Setting Up Your Account..." : "Activate My Account"}
        </button>
      </div>

      <button onClick={onCancel} style={{ ...S.btn2, marginTop: THEME.spacing.md }}>
        Already have an account? Log in
      </button>
    </div>
  );
};

export default ActivateScreen;
