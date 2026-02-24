// src/pages/GorilandiaPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getFeed, createPost, uploadMedia } from '../services/gorilandia';
import GorilandiaPost from '../components/GorilandiaPost';
import GorilandiaUpload from '../components/GorilandiaUpload';

export default function GorilandiaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { loadFeed(); }, []);

  async function loadFeed() {
    try {
      setLoading(true);
      const data = await getFeed();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error cargando feed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost(postData) {
    try {
      setUploading(true);
      const uploadedUrls = [];
      for (const file of postData.files) {
        const url = await uploadMedia(file, postData.type);
        uploadedUrls.push(url);
      }
      await createPost(postData.type || 'photo', uploadedUrls, postData.caption);
      setShowUpload(false);
      await loadFeed();
    } catch (e) {
      console.error('Error creando post:', e);
      alert('Error: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }} className="page pageWithHeader">
      <style>{`
        .glPage { max-width: 480px; margin: 0 auto; padding: 0 0 80px; }
        .glHeader { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px 8px; }
        .glTitle { font-size: 22px; font-weight: 900; color: #fff; }
        .glTitle span { color: #74B800; }
        .glPublicar { padding: 9px 16px; border-radius: 10px; background: linear-gradient(135deg,#74B800,#9BE800); color: #000; font-weight: 900; border: none; cursor: pointer; font-size: 13px; }
        .glDivider { height: 1px; background: rgba(255,255,255,0.07); margin: 0; }
      `}</style>

      <div className="glPage">
        {/* HEADER */}
        <div className="glHeader">
          <div className="glTitle">🦍 Gorila<span>landia</span></div>
          <button className="glPublicar" onClick={() => { if (!session) { navigate('/login'); return; } setShowUpload(true); }}>
            ➕ Publicar
          </button>
        </div>
        <div className="glDivider" />

        {/* FEED */}
        <main style={{ padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🦍</div>
              Cargando feed…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🦍</div>
              <div style={{ fontWeight: 900, color: '#fff', fontSize: 18, marginBottom: 6 }}>Nadie ha publicado aún</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>¡Sé el primero en compartir tu momento de pádel!</div>
              <button onClick={() => { if (!session) { navigate('/login'); return; } setShowUpload(true); }}
                style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#74B800,#9BE800)', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                ➕ Crear publicación
              </button>
            </div>
          ) : (
            posts.map(post => (
              <GorilandiaPost key={post.id} post={post} session={session} onReload={loadFeed} />
            ))
          )}
        </main>
      </div>

      {showUpload && (
        <GorilandiaUpload onClose={() => setShowUpload(false)} onSubmit={handleCreatePost} uploading={uploading} />
      )}
    </div>
  );
}