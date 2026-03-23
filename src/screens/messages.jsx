import { useState, useEffect, useCallback, useRef } from 'react';
import { GYM_CONFIG, THEME, S, I, services, supabase, useAuth, membersCache } from '../config/shared';

const MessagesScreen = ({ onBack }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null); // conversation object
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const isStaff = user.role === "admin" || user.role === "coach";

  // Load all conversations for this user
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, messages(id, body, sender_id, created_at, read_at)')
      .or(`member_id.eq.${user.id},coach_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    const convos = (data || []).map(c => {
      const msgs = (c.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMsg = msgs[0] || null;
      const unread = msgs.filter(m => m.sender_id !== user.id && !m.read_at).length;
      const otherId = c.member_id === user.id ? c.coach_id : c.member_id;
      const other = membersCache.find(m => m.id === otherId);
      return { ...c, lastMsg, unread, other };
    });
    setConversations(convos);
    setLoading(false);
  }, [user.id]);

  // Load members for new chat picker
  const loadMembers = useCallback(async () => {
    const all = await services.members.getAll();
    setMembers(all.filter(m => m.id !== user.id));
  }, [user.id]);

  useEffect(() => { loadConversations(); loadMembers(); }, [loadConversations, loadMembers]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase.channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new;
        // If we're in a conversation and the message belongs to it
        if (activeConvo && newMessage.conversation_id === activeConvo.id) {
          setMessages(prev => [...prev, {
            id: newMessage.id, conversationId: newMessage.conversation_id,
            senderId: newMessage.sender_id, body: newMessage.body,
            createdAt: newMessage.created_at, readAt: newMessage.read_at,
          }]);
          // Mark as read
          if (newMessage.sender_id !== user.id) {
            supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', newMessage.id).then();
          }
        }
        // Refresh conversation list
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvo, user.id, loadConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Open a conversation
  const openConvo = async (convo) => {
    setActiveConvo(convo);
    // Load messages
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true });

    const msgs = (data || []).map(m => ({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      body: m.body, createdAt: m.created_at, readAt: m.read_at,
    }));
    setMessages(msgs);

    // Mark unread messages as read
    const unread = (data || []).filter(m => m.sender_id !== user.id && !m.read_at);
    if (unread.length > 0) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .in('id', unread.map(m => m.id));
      loadConversations();
    }
  };

  // Start a new conversation with someone
  const startConvo = async (otherId) => {
    const otherMember = members.find(m => m.id === otherId);
    if (!otherMember) return;

    // Determine coach/member roles for the conversation
    const memberIdField = (user.role === "member") ? user.id : otherId;
    const coachIdField = (user.role === "member") ? otherId : user.id;

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, messages(id, body, sender_id, created_at, read_at)')
      .eq('member_id', memberIdField)
      .eq('coach_id', coachIdField)
      .single();

    if (existing) {
      const msgs = (existing.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const convo = { ...existing, lastMsg: msgs[0] || null, unread: 0, other: otherMember };
      setShowNewChat(false);
      openConvo(convo);
      return;
    }

    // Create new conversation
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ gym_id: GYM_CONFIG.id, member_id: memberIdField, coach_id: coachIdField })
      .select()
      .single();

    if (newConvo) {
      const convo = { ...newConvo, lastMsg: null, unread: 0, other: otherMember, messages: [] };
      setShowNewChat(false);
      openConvo(convo);
      loadConversations();
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConvo || sending) return;
    setSending(true);
    const body = newMsg.trim();
    setNewMsg("");

    await supabase.from('messages').insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      body,
    });

    // Update conversation last_message_at
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeConvo.id);

    setSending(false);
    loadConversations();
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ===== CHAT VIEW =====
  if (activeConvo) {
    const other = activeConvo.other;
    return (
      <div style={S.screen}>
        {/* Chat Header */}
        <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm, marginBottom: THEME.spacing.md }}>
          <button onClick={() => { setActiveConvo(null); setMessages([]); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            <I.chevL size={22} color={THEME.colors.primary} />
          </button>
          {other?.avatar ? (
            <img src={other.avatar} alt="" style={{ width: "36px", height: "36px", borderRadius: THEME.radius.full, objectFit: "cover" }} />
          ) : (
            <div style={{ ...S.avatar, width: "36px", height: "36px", fontSize: "14px" }}>
              {other ? `${other.firstName?.charAt(0)}${other.lastName?.charAt(0)}` : "?"}
            </div>
          )}
          <div>
            <div style={{ fontFamily: THEME.fonts.display, fontSize: "18px", letterSpacing: "0.5px" }}>
              {other ? `${other.firstName} ${other.lastName}` : "Unknown"}
            </div>
            <div style={{ fontSize: "11px", color: THEME.colors.textMuted }}>
              {other?.role || "member"}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "80px", paddingBottom: THEME.spacing.md }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: THEME.spacing.xl, color: THEME.colors.textMuted, fontSize: "14px" }}>
              No messages yet. Say hello!
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === user.id;
            const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString();
            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: "center", padding: "12px 0", fontSize: "11px", fontFamily: THEME.fonts.display, letterSpacing: "1.5px", color: THEME.colors.textMuted }}>
                    {new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "6px" }}>
                  <div style={{
                    maxWidth: "75%", padding: "10px 14px", borderRadius: "16px",
                    borderBottomRightRadius: isMe ? "4px" : "16px",
                    borderBottomLeftRadius: isMe ? "16px" : "4px",
                    background: isMe
                      ? `linear-gradient(135deg, ${THEME.colors.primary}, ${THEME.colors.primaryDark})`
                      : THEME.colors.surfaceLight,
                    color: isMe ? THEME.colors.white : THEME.colors.text,
                  }}>
                    <div style={{ fontSize: "14px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
                    <div style={{
                      fontSize: "10px", marginTop: "4px", textAlign: "right",
                      color: isMe ? "rgba(255,255,255,0.5)" : THEME.colors.textMuted,
                    }}>
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div style={{
          position: "fixed", bottom: "70px", left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: "1200px", padding: `0 ${THEME.spacing.md}`,
          background: THEME.colors.bg, paddingTop: THEME.spacing.sm, paddingBottom: THEME.spacing.sm,
        }}>
          <div style={{ display: "flex", gap: THEME.spacing.sm, alignItems: "flex-end" }}>
            <textarea
              style={{
                ...S.inp, flex: 1, minHeight: "44px", maxHeight: "120px", resize: "none", overflow: "hidden",
                padding: "10px 14px", fontSize: "14px", lineHeight: "1.4", borderRadius: THEME.radius.full,
              }}
              value={newMsg}
              onChange={e => { setNewMsg(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              placeholder="Type a message..."
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onFocus={e => (e.target.style.borderColor = THEME.colors.primary)}
              onBlur={e => (e.target.style.borderColor = THEME.colors.border)}
            />
            <button onClick={sendMessage} disabled={!newMsg.trim() || sending} style={{
              width: "44px", height: "44px", borderRadius: THEME.radius.full, border: "none", cursor: "pointer",
              background: (!newMsg.trim() || sending) ? THEME.colors.surfaceLight : `linear-gradient(135deg, ${THEME.colors.primary}, ${THEME.colors.primaryDark})`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={(!newMsg.trim() || sending) ? THEME.colors.textMuted : THEME.colors.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== NEW CHAT PICKER =====
  if (showNewChat) {
    const chatTargets = isStaff
      ? members // coaches/admins can message anyone
      : members.filter(m => m.role === "coach" || m.role === "admin"); // members can only message staff

    return (
      <div style={S.screen}>
        <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm, marginBottom: THEME.spacing.lg }}>
          <button onClick={() => setShowNewChat(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            <I.chevL size={22} color={THEME.colors.primary} />
          </button>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "24px", letterSpacing: "1px" }}>New Message</div>
        </div>

        <div style={{ color: THEME.colors.textMuted, fontSize: "13px", marginBottom: THEME.spacing.md }}>
          {isStaff ? "Select a member to message" : "Select a coach to message"}
        </div>

        {chatTargets.map(m => (
          <button key={m.id} onClick={() => startConvo(m.id)} style={{
            display: "flex", alignItems: "center", gap: THEME.spacing.sm, width: "100%",
            padding: THEME.spacing.md, marginBottom: "6px", borderRadius: THEME.radius.lg,
            background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`,
            cursor: "pointer", textAlign: "left",
          }}>
            {m.avatar ? (
              <img src={m.avatar} alt="" style={{ width: "40px", height: "40px", borderRadius: THEME.radius.full, objectFit: "cover" }} />
            ) : (
              <div style={S.avatar}>{m.firstName?.charAt(0)}{m.lastName?.charAt(0)}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", fontSize: "15px", color: THEME.colors.text }}>{m.firstName} {m.lastName}</div>
              <div style={{ fontSize: "12px", color: THEME.colors.textMuted }}>{m.role}</div>
            </div>
            <I.chevR size={16} color={THEME.colors.textMuted} />
          </button>
        ))}

        {chatTargets.length === 0 && (
          <div style={{ textAlign: "center", padding: THEME.spacing.xl, color: THEME.colors.textMuted }}>
            No {isStaff ? "members" : "coaches"} available
          </div>
        )}
      </div>
    );
  }

  // ===== CONVERSATION LIST =====
  return (
    <div style={S.screen}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: THEME.spacing.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: THEME.spacing.sm }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            <I.chevL size={22} color={THEME.colors.primary} />
          </button>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "28px", letterSpacing: "1px" }}>Messages</div>
        </div>
        <button onClick={() => setShowNewChat(true)} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "8px 14px", borderRadius: THEME.radius.md, border: "none", cursor: "pointer",
          background: THEME.colors.primarySubtle, color: THEME.colors.primary,
          fontFamily: THEME.fonts.display, fontSize: "12px", letterSpacing: "1px",
        }}>
          <I.plus size={14} color={THEME.colors.primary} /> New
        </button>
      </div>

      {loading && <div style={{ textAlign: "center", color: THEME.colors.textMuted, padding: THEME.spacing.xl }}>Loading...</div>}

      {!loading && conversations.length === 0 && (
        <div style={{ textAlign: "center", padding: THEME.spacing.xl }}>
          <div style={{ fontSize: "40px", marginBottom: THEME.spacing.md }}>💬</div>
          <div style={{ fontFamily: THEME.fonts.display, fontSize: "18px", marginBottom: THEME.spacing.sm }}>No Messages Yet</div>
          <div style={{ color: THEME.colors.textMuted, fontSize: "14px", marginBottom: THEME.spacing.lg }}>
            {isStaff ? "Start a conversation with a member" : "Message a coach to get started"}
          </div>
          <button onClick={() => setShowNewChat(true)} style={{
            ...S.btn1, width: "auto", display: "inline-flex", padding: "12px 24px",
            alignItems: "center", gap: "8px",
          }}>
            <I.plus size={16} color={THEME.colors.white} /> Start a Conversation
          </button>
        </div>
      )}

      {conversations.map(c => (
        <button key={c.id} onClick={() => openConvo(c)} style={{
          display: "flex", alignItems: "center", gap: THEME.spacing.sm, width: "100%",
          padding: THEME.spacing.md, marginBottom: "6px", borderRadius: THEME.radius.lg,
          background: c.unread > 0 ? THEME.colors.primarySubtle : THEME.colors.surface,
          border: `1px solid ${c.unread > 0 ? THEME.colors.primary + "44" : THEME.colors.border}`,
          cursor: "pointer", textAlign: "left",
        }}>
          {/* Avatar */}
          {c.other?.avatar ? (
            <img src={c.other.avatar} alt="" style={{ width: "48px", height: "48px", borderRadius: THEME.radius.full, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ ...S.avatar, width: "48px", height: "48px", fontSize: "18px" }}>
              {c.other ? `${c.other.firstName?.charAt(0)}${c.other.lastName?.charAt(0)}` : "?"}
            </div>
          )}

          {/* Name + last message */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
              <span style={{ fontWeight: c.unread > 0 ? "700" : "600", fontSize: "15px", color: THEME.colors.text }}>
                {c.other ? `${c.other.firstName} ${c.other.lastName}` : "Unknown"}
              </span>
              <span style={{ fontSize: "11px", color: THEME.colors.textMuted, flexShrink: 0 }}>
                {c.lastMsg ? timeAgo(c.lastMsg.created_at) : ""}
              </span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{
                fontSize: "13px", color: c.unread > 0 ? THEME.colors.text : THEME.colors.textMuted,
                fontWeight: c.unread > 0 ? "500" : "400",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 30px)",
              }}>
                {c.lastMsg ? (c.lastMsg.sender_id === user.id ? `You: ${c.lastMsg.body}` : c.lastMsg.body) : "No messages yet"}
              </span>
              {c.unread > 0 && (
                <div style={{
                  minWidth: "20px", height: "20px", borderRadius: "10px",
                  background: THEME.colors.primary, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: THEME.fonts.display, fontSize: "10px", color: THEME.colors.white, padding: "0 6px", flexShrink: 0,
                }}>{c.unread}</div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default MessagesScreen;
