// src/components/GorilandiaPost.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toggleReaction, getPostReactions, getUserReaction, getComments, createComment } from '../services/gorilandia';

const REACTIONS = [
  { key: 'gorila', emoji: '🦍' },
  { key: 'fuego',  emoji: '🔥' },
  { key: 'fuerza', emoji: '💪' },
  { key: 'risa',   emoji: '😂' },
];

function timeAgo(dateStr) {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch { return ''; }
}

export default function GorilandiaPost({ post, session, onReload }) {
  const navigate = useNavigate();
  const [reactions, setReactions] = useState({ gorila: 0, fuego: 0, fuerza: 0, risa: 0 });
  const [userReaction, setUserReaction] = useState([]);
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [currentImg, setCurrentImg] = useState(0);
  const [commentLoading, setCommentLoading] = useState(false);

  const userName = post.user?.full_name || post.user?.name || post.user?.email?.split('@')[0] || 'Gorila';
  const userAvatar = post.user?.avatar_url || '';
  const mediaUrls = Array.isArray(post.media_url) ? post.media_url : [];

  useEffect(() => {
    loadReactions();
    loadUserReaction();
  }, [post.id]);

  async function loadReactions() {
    try { setReactions(await getPostReactions(post.id)); } catch {}
  }
  async function loadUserReaction() {
    try { setUserReaction(await getUserReaction(post.id)); } catch {}
  }
  async function loadComments() {
    try { setComments(await getComments(post.id)); } catch {}
  }

  async function handleReaction(type) {
    if (!session) { navigate('/login'); return; }
    try {
      await toggleReaction(post.id, type);
      await new Promise(r => setTimeout(r, 80));
      await Promise.all([loadReactions(), loadUserReaction()]);
    } catch {}
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !session) return;
    try {
      setCommentLoading(true);
      await createComment(post.id, newComment.trim());
      setNewComment('');
      await loadComments();
    } catch {} finally { setCommentLoading(false); }
  }

  const totalReactions = Object.values(reactions).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <article style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 0 }}>
      <style>{`
        .glPost { }
        .glPostHeader { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
        .glAvatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: rgba(116,184,0,0.2); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #74B800; font-size: 15px; flex-shrink: 0; overflow: hidden; }
        .glUserName { font-weight: 900; color: #fff; font-size: 14px; cursor: pointer; }
        .glUserName:hover { color: #74B800; }
        .glPostTime { font-size: 11px; color: rgba(255,255,255,0.4); }
        .glMediaWrap { position: relative; background: #000; aspect-ratio: 1; overflow: hidden; }
        .glImg { width: 100%; height: 100%; object-fit: cover; display: block; }
        .glVid { width: 100%; height: 100%; object-fit: contain; display: block; }
        .glNavBtn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); border: none; color: #fff; font-size: 22px; padding: 4px 10px; cursor: pointer; border-radius: 4px; }
        .glNavBtn.prev { left: 6px; }
        .glNavBtn.next { right: 6px; }
        .glDots { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; }
        .glDot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.5); }
        .glDot.on { background: #74B800; }
        .glCaption { padding: 6px 14px 4px; font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; }
        .glCaption strong { color: #fff; cursor: pointer; }
        .glActions { display: flex; align-items: center; gap: 2px; padding: 6px 10px 4px; }
        .glReactBtn { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 15px; font-weight: 800; transition: background .15s; background: transparent; color: rgba(255,255,255,0.7); }
        .glReactBtn.on { background: rgba(116,184,0,0.15); color: #74B800; }
        .glReactBtn:hover { background: rgba(255,255,255,0.07); }
        .glCommentToggle { margin-left: auto; padding: 6px 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; background: transparent; color: rgba(255,255,255,0.5); }
        .glCommentToggle:hover { color: #fff; background: rgba(255,255,255,0.07); }
        .glReactCount { font-size: 11px; color: rgba(255,255,255,0.4); padding: 0 14px 6px; }
        .glComments { padding: 0 14px 10px; }
        .glComment { display: flex; gap: 8px; margin-bottom: 8px; }
        .glCommentAvatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(116,184,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: #74B800; flex-shrink: 0; overflow: hidden; }
        .glCommentBody { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 6px 10px; flex: 1; }
        .glCommentUser { font-size: 11px; font-weight: 900; color: #fff; }
        .glCommentText { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 1px; }
        .glCommentForm { display: flex; gap: 6px; margin-top: 8px; }
        .glCommentInput { flex: 1; padding: 8px 12px; border-radius: 20px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; }
        .glCommentInput:focus { outline: none; border-color: #74B800; }
        .glCommentSend { padding: 8px 14px; border-radius: 20px; background: #74B800; color: #000; font-weight: 900; border: none; cursor: pointer; font-size: 12px; }
        .glCommentSend:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* HEADER */}
      <div className="glPostHeader">
        <div className="glAvatar">
          {userAvatar
            ? <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : userName[0]?.toUpperCase()
          }
        </div>
        <div style={{ flex: 1 }}>
          <div className="glUserName" onClick={() => navigate(`/usuario/${post.user_id}`)}>{userName}</div>
          <div className="glPostTime">{timeAgo(post.created_at)}</div>
        </div>
        {post.type === 'video' && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>🎥 VIDEO</span>}
      </div>

      {/* MEDIA */}
      {mediaUrls.length > 0 && (
        <div className="glMediaWrap">
          {post.type === 'video'
            ? <video src={mediaUrls[0]} controls className="glVid" />
            : <img src={mediaUrls[currentImg]} alt="" className="glImg" />
          }
          {mediaUrls.length > 1 && (<>
            <button className="glNavBtn prev" onClick={() => setCurrentImg(p => p === 0 ? mediaUrls.length - 1 : p - 1)}>‹</button>
            <button className="glNavBtn next" onClick={() => setCurrentImg(p => p === mediaUrls.length - 1 ? 0 : p + 1)}>›</button>
            <div className="glDots">
              {mediaUrls.map((_, i) => <div key={i} className={`glDot${i === currentImg ? ' on' : ''}`} onClick={() => setCurrentImg(i)} />)}
            </div>
          </>)}
        </div>
      )}

      {/* CAPTION */}
      {post.caption && (
        <div className="glCaption">
          <strong onClick={() => navigate(`/usuario/${post.user_id}`)}>{userName}</strong>{' '}{post.caption}
        </div>
      )}

      {/* REACCIONES */}
      <div className="glActions">
        {REACTIONS.map(r => (
          <button key={r.key} className={`glReactBtn${userReaction.includes(r.key) ? ' on' : ''}`} onClick={() => handleReaction(r.key)}>
            {r.emoji}
            {reactions[r.key] > 0 && <span style={{ fontSize: 12 }}>{reactions[r.key]}</span>}
          </button>
        ))}
        <button className="glCommentToggle" onClick={() => { setShowComments(s => !s); if (!showComments) loadComments(); }}>
          💬 {comments.length > 0 ? comments.length : ''}
        </button>
      </div>

      {totalReactions > 0 && (
        <div className="glReactCount">{totalReactions} reacción{totalReactions !== 1 ? 'es' : ''}</div>
      )}

      {/* COMENTARIOS */}
      {showComments && (
        <div className="glComments">
          {comments.map(c => {
            const cName = c.user?.full_name || c.user?.name || c.user?.email?.split('@')[0] || 'Gorila';
            const cAvatar = c.user?.avatar_url || '';
            return (
              <div key={c.id} className="glComment">
                <div className="glCommentAvatar">
                  {cAvatar ? <img src={cAvatar} alt={cName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : cName[0]?.toUpperCase()}
                </div>
                <div className="glCommentBody">
                  <div className="glCommentUser">{cName}</div>
                  <div className="glCommentText">{c.text}</div>
                </div>
              </div>
            );
          })}
          {session && (
            <form className="glCommentForm" onSubmit={handleComment}>
              <input className="glCommentInput" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comenta algo…" />
              <button className="glCommentSend" type="submit" disabled={commentLoading || !newComment.trim()}>
                {commentLoading ? '…' : '→'}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}