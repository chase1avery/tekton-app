import { useState } from 'react';
import { GYM_CONFIG, THEME } from '../config/shared';

// Generate a branded PR card image using Canvas
const generatePrImage = async (pr, userName) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
  bg.addColorStop(0, '#0B0F0D');
  bg.addColorStop(1, '#141A16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  // Accent stripe on left
  const stripe = ctx.createLinearGradient(0, 0, 0, 1080);
  stripe.addColorStop(0, GYM_CONFIG.colors.primary);
  stripe.addColorStop(1, GYM_CONFIG.colors.accent);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, 8, 1080);

  // Top section — gym branding
  ctx.fillStyle = GYM_CONFIG.colors.primary;
  ctx.font = 'bold 32px sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText(GYM_CONFIG.shortName || GYM_CONFIG.name.toUpperCase(), 60, 80);

  // Divider line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 110);
  ctx.lineTo(1020, 110);
  ctx.stroke();

  // "NEW PERSONAL RECORD" label
  ctx.fillStyle = GYM_CONFIG.colors.accent;
  ctx.font = 'bold 28px sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('NEW PERSONAL RECORD', 60, 200);

  // PR emoji row
  ctx.font = '60px sans-serif';
  ctx.fillText('🏆', 60, 290);

  // Movement name
  ctx.fillStyle = '#F0F4F1';
  ctx.font = 'bold 72px sans-serif';
  ctx.letterSpacing = '2px';
  // Word wrap if needed
  const name = pr.name;
  if (name.length > 16) {
    ctx.font = 'bold 56px sans-serif';
  }
  ctx.fillText(name, 60, 400);

  // Big value
  const valueGrad = ctx.createLinearGradient(60, 420, 60, 580);
  valueGrad.addColorStop(0, GYM_CONFIG.colors.primary);
  valueGrad.addColorStop(1, GYM_CONFIG.colors.accent);
  ctx.fillStyle = valueGrad;
  ctx.font = 'bold 160px sans-serif';
  ctx.fillText(pr.value, 60, 600);

  // Unit
  ctx.fillStyle = 'rgba(240,244,241,0.6)';
  ctx.font = 'bold 48px sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText(pr.unit, 60, 670);

  // Category badge
  const catX = 60;
  const catY = 730;
  ctx.fillStyle = 'rgba(212,168,67,0.15)';
  const catText = pr.category?.toUpperCase() || 'LIFT';
  ctx.font = 'bold 24px sans-serif';
  const catWidth = ctx.measureText(catText).width + 40;
  ctx.beginPath();
  ctx.roundRect(catX, catY - 28, catWidth, 40, 8);
  ctx.fill();
  ctx.fillStyle = GYM_CONFIG.colors.accent;
  ctx.fillText(catText, catX + 20, catY);

  // Notes
  if (pr.notes) {
    ctx.fillStyle = 'rgba(240,244,241,0.5)';
    ctx.font = 'italic 28px sans-serif';
    ctx.fillText(`"${pr.notes}"`, 60, 820);
  }

  // Bottom section
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(60, 920);
  ctx.lineTo(1020, 920);
  ctx.stroke();

  // User name + date
  ctx.fillStyle = '#F0F4F1';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(userName, 60, 970);

  ctx.fillStyle = 'rgba(240,244,241,0.4)';
  ctx.font = '24px sans-serif';
  const dateStr = new Date(pr.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.fillText(dateStr, 60, 1010);

  // Gym location
  ctx.fillStyle = 'rgba(240,244,241,0.3)';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(GYM_CONFIG.location || '', 1020, 1010);
  ctx.textAlign = 'left';

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
};

// Share button component
export const SharePrButton = ({ pr, userName, size = "sm" }) => {
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await generatePrImage(pr, userName);
      const file = new File([blob], `PR-${pr.name.replace(/\s+/g, '-')}.png`, { type: 'image/png' });

      // Try Web Share API (works on iOS, Android, some desktop)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `New PR: ${pr.name}`,
          text: `Just hit a new ${pr.name} PR — ${pr.value} ${pr.unit}! 🏆 #CrossFit #PR #${GYM_CONFIG.shortName}`,
          files: [file],
        });
        setShared(true);
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PR-${pr.name.replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShared(true);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Share error:', e);
    }
    setSharing(false);
    setTimeout(() => setShared(false), 2000);
  };

  if (size === "icon") {
    return (
      <button onClick={handleShare} disabled={sharing} style={{
        background: "none", border: "none", cursor: "pointer", padding: "4px",
        opacity: sharing ? 0.5 : 1,
      }} title="Share PR">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={shared ? THEME.colors.success : THEME.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>
    );
  }

  return (
    <button onClick={handleShare} disabled={sharing} style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "8px 14px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
      background: shared ? THEME.colors.success : THEME.colors.primarySubtle,
      color: shared ? THEME.colors.white : THEME.colors.primary,
      fontFamily: THEME.fonts.display, fontSize: "11px", letterSpacing: "1px",
      opacity: sharing ? 0.5 : 1, transition: "all 0.2s",
    }}>
      {shared ? "Shared!" : sharing ? "Generating..." : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
};

export default SharePrButton;
