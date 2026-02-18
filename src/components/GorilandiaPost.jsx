import { useState, useEffect } from 'react';
import { toggleReaction, getPostReactions, getUserReaction, getComments, createComment } from '../services/gorilandia';
import './GorilandiaPost.css';

export default function GorilandiaPost({ post, onReload }) {
  const [reactions, setReactions] = useState({ gorila: 0, fuego: 0, fuerza: 0, risa: 0 });
  const [userReaction, setUserReaction] = useState([]); // Ahora es array
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const userName = post.user?.full_name || post.user?.email?.split('@')[0] || 'Usuario';
  const mediaUrls = post.media_url || [];

  useEffect(() => {
    loadReactions();
    loadUserReaction();
  }, [post.id]);

  async function loadReactions() {
    try {
      const data = await getPostReactions(post.id);
      console.log('📊 Reacciones cargadas:', data);
      setReactions(data);
    } catch (error) {
      console.error('Error cargando reacciones:', error);
    }
  }

  async function loadUserReaction() {
    try {
      const reaction = await getUserReaction(post.id);
      setUserReaction(reaction);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function loadComments() {
    try {
      const data = await getComments(post.id);
      setComments(data);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function handleReaction(type) {
    try {
      console.log('🔥 Reacción:', type);
      await toggleReaction(post.id, type);
      
      // Esperar 100ms para que la BD se actualice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await loadReactions();
      await loadUserReaction();
      console.log('✅ Reacciones actualizadas');
    } catch (error) {
      console.error('❌ Error reacción:', error);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await createComment(post.id, newComment);
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <article className="gorilandia-post">
      <div className="post-header">
        <div className="post-user">
          <div className="user-avatar">{userName[0].toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="post-time">{new Date(post.created_at).toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </div>

      {mediaUrls.length > 0 && (
        <div className="post-media">
          {post.type === 'video' ? (
            <video src={mediaUrls[0]} controls className="post-video" />
          ) : (
            <div className="post-images">
              <img src={mediaUrls[currentImageIndex]} alt="Post" className="post-image" />
              {mediaUrls.length > 1 && (
                <>
                  <button className="image-nav prev" onClick={() => setCurrentImageIndex(p => p === 0 ? mediaUrls.length - 1 : p - 1)}>‹</button>
                  <button className="image-nav next" onClick={() => setCurrentImageIndex(p => p === mediaUrls.length - 1 ? 0 : p + 1)}>›</button>
                  <div className="image-dots">
                    {mediaUrls.map((_, i) => (
                      <span key={i} className={`dot ${i === currentImageIndex ? 'active' : ''}`} onClick={() => setCurrentImageIndex(i)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {post.caption && (
        <div className="post-caption">
          <span className="caption-user">{userName}</span> {post.caption}
        </div>
      )}

      <div className="post-actions">
        <div className="reactions-bar">
          <button className={`reaction-btn ${userReaction.includes('gorila') ? 'active' : ''}`} onClick={() => handleReaction('gorila')}>
            🦍 {reactions.gorila > 0 && reactions.gorila}
          </button>
          <button className={`reaction-btn ${userReaction.includes('fuego') ? 'active' : ''}`} onClick={() => handleReaction('fuego')}>
            🔥 {reactions.fuego > 0 && reactions.fuego}
          </button>
          <button className={`reaction-btn ${userReaction.includes('fuerza') ? 'active' : ''}`} onClick={() => handleReaction('fuerza')}>
            💪 {reactions.fuerza > 0 && reactions.fuerza}
          </button>
          <button className={`reaction-btn ${userReaction.includes('risa') ? 'active' : ''}`} onClick={() => handleReaction('risa')}>
            😂 {reactions.risa > 0 && reactions.risa}
          </button>
        </div>

        <button className="comments-toggle" onClick={() => { setShowComments(!showComments); if (!showComments) loadComments(); }}>
          💬 Comentarios {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {comments.map(c => {
              const cUser = c.user?.full_name || c.user?.email?.split('@')[0] || 'Usuario';
              return (
                <div key={c.id} className="comment">
                  <div className="comment-avatar">{cUser[0].toUpperCase()}</div>
                  <div className="comment-content">
                    <span className="comment-user">{cUser}</span>
                    <p className="comment-text">{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <form className="comment-form" onSubmit={handleComment}>
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escribe un comentario..." className="comment-input" />
            <button type="submit" className="comment-submit">Enviar</button>
          </form>
        </div>
      )}
    </article>
  );
}