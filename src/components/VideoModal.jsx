import { useState, useEffect, useCallback } from 'react';
import { THEME, S, I, supabase, GYM_CONFIG } from '../config/shared';

// Extract YouTube video ID from various URL formats
const getYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
};

// Video playback modal
export const VideoModal = ({ movement, videoUrl, onClose }) => {
  const videoId = getYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 9999, width: "92%", maxWidth: "560px",
        background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`,
        borderRadius: THEME.radius.lg, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "18px", letterSpacing: "0.5px" }}>{movement}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            <I.x size={20} color={THEME.colors.textMuted} />
          </button>
        </div>
        {/* YouTube Embed */}
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={movement}
          />
        </div>
      </div>
    </>
  );
};

// Hook to load video library and provide lookup function
export const useVideoLibrary = () => {
  const [videos, setVideos] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('movement_videos').select('*').eq('gym_id', GYM_CONFIG.id);
      const map = {};
      (data || []).forEach(v => { map[v.movement_name.toLowerCase()] = v.video_url; });
      setVideos(map);
      setLoaded(true);
    })();
  }, []);

  const getVideoUrl = (movementName) => videos[movementName?.toLowerCase()] || null;
  const hasVideo = (movementName) => !!videos[movementName?.toLowerCase()];

  return { videos, getVideoUrl, hasVideo, loaded };
};

// Tappable movement name — shows ▶ if video exists
export const MovementName = ({ name, videoUrl, onPlay, style = {} }) => {
  const has = !!videoUrl;
  return (
    <span
      onClick={has ? () => onPlay(name, videoUrl) : undefined}
      style={{
        fontWeight: "600", fontSize: style.fontSize || "15px",
        cursor: has ? "pointer" : "default",
        color: has ? THEME.colors.text : style.color || THEME.colors.text,
        display: "inline-flex", alignItems: "center", gap: "4px",
        ...style,
      }}
    >
      {name}
      {has && <span style={{ fontSize: "10px", color: THEME.colors.primary, opacity: 0.7 }}>▶</span>}
    </span>
  );
};

export default VideoModal;
