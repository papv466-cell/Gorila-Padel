import { useState, useEffect } from 'react';
import { getFeed, toggleReaction, getPostReactions, getUserReaction, createPost, uploadMedia } from '../services/gorilandia';
import GorilandiaPost from '../components/GorilandiaPost';
import GorilandiaUpload from '../components/GorilandiaUpload';
import './GorilandiaPage.css';

export default function GorilandiaPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    try {
      setLoading(true);
      const data = await getFeed();
      setPosts(data);
    } catch (error) {
      console.error('Error cargando feed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost(postData) {
    try {
      // Upload media files
      const uploadedUrls = [];
      for (const file of postData.files) {
        const url = await uploadMedia(file, postData.type);
        uploadedUrls.push(url);
      }

      await createPost(
        postData.type || 'photo',  // ← Con fallback
        uploadedUrls,
        postData.caption
      );

      // Reload feed
      loadFeed();
      setShowUpload(false);
    } catch (error) {
      console.error('Error creando post:', error);
      alert('Error creando post: ' + error.message);
    }
  }

  return (
    <div className="gorilandia-page">
      {/* Header */}
      <header className="gorilandia-header">
        <h1 className="gorilandia-logo">🦍 Gorilandia</h1>
        <button 
          className="btn-upload" 
          onClick={() => setShowUpload(true)}
        >
          + Publicar
        </button>
      </header>

      {/* Upload Modal */}
      {showUpload && (
        <GorilandiaUpload
          onClose={() => setShowUpload(false)}
          onSubmit={handleCreatePost}
        />
      )}

      {/* Feed */}
      <main className="gorilandia-feed">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Cargando feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🦍</span>
            <h2>No hay publicaciones</h2>
            <p>¡Sé el primero en compartir tu momento de pádel!</p>
            <button className="btn-upload" onClick={() => setShowUpload(true)}>
              Crear primera publicación
            </button>
          </div>
        ) : (
          <div className="posts-container">
            {posts.map(post => (
              <GorilandiaPost 
                key={post.id} 
                post={post}
                onReload={loadFeed}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}