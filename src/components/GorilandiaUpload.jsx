// src/components/GorilandiaUpload.jsx
import { useState } from 'react';

export default function GorilandiaUpload({ onClose, onSubmit, uploading }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [type, setType] = useState('photo');
  const [previews, setPreviews] = useState([]);
  const [currentPreview, setCurrentPreview] = useState(0);

  function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    if (type === 'video' && selected.length > 1) { alert('Solo 1 video'); return; }
    if (type === 'photo' && selected.length > 10) { alert('Máximo 10 fotos'); return; }
    setFiles(selected);
    setCurrentPreview(0);
    const newPreviews = [];
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === selected.length) setPreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) { alert('Selecciona al menos un archivo'); return; }
    onSubmit({ files, caption, type });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#1a1a1a', borderRadius: '20px 20px 0 0', border: '1px solid rgba(116,184,0,0.2)', maxHeight: '90vh', overflowY: 'auto', padding: '0 0 env(safe-area-inset-bottom)' }}>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 999, margin: '14px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>🦍 Nueva publicación</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', cursor: 'pointer', fontWeight: 900 }}>✕</button>
        </div>

        <div style={{ padding: '0 16px 24px' }}>
          {/* Tipo */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ key: 'photo', label: '📷 Foto' }, { key: 'video', label: '🎥 Video' }].map(t => (
              <button key={t.key} type="button"
                onClick={() => { setType(t.key); setFiles([]); setPreviews([]); setCurrentPreview(0); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 13,
                  background: type === t.key ? '#74B800' : 'rgba(255,255,255,0.08)',
                  color: type === t.key ? '#000' : 'rgba(255,255,255,0.7)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* File input */}
          <label style={{ display: 'block', marginBottom: 12, cursor: 'pointer' }}>
            <input type="file" accept={type === 'video' ? 'video/*' : 'image/*'} multiple={type === 'photo'}
              onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed rgba(116,184,0,0.4)', borderRadius: 12, padding: '20px', textAlign: 'center', background: 'rgba(116,184,0,0.05)' }}>
              {files.length === 0 ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>⬆️</div>
                  <div style={{ color: '#74B800', fontWeight: 800, fontSize: 13 }}>
                    Seleccionar {type === 'photo' ? 'fotos (máx 10)' : 'video'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>Toca para elegir</div>
                </>
              ) : (
                <div style={{ color: '#74B800', fontWeight: 800, fontSize: 13 }}>
                  ✅ {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, fontWeight: 400 }}>Toca para cambiar</div>
                </div>
              )}
            </div>
          </label>

          {/* Preview */}
          {previews.length > 0 && (
            <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#000', aspectRatio: '1' }}>
              {type === 'video'
                ? <video src={previews[0]} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <img src={previews[currentPreview]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              }
              {previews.length > 1 && (
                <>
                  <button onClick={() => setCurrentPreview(p => p === 0 ? previews.length - 1 : p - 1)}
                    style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 20 }}>‹</button>
                  <button onClick={() => setCurrentPreview(p => p === previews.length - 1 ? 0 : p + 1)}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 20 }}>›</button>
                  <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                    {previews.map((_, i) => (
                      <div key={i} onClick={() => setCurrentPreview(i)}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: i === currentPreview ? '#74B800' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Caption */}
          <textarea value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Escribe algo sobre tu momento de pádel…"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, resize: 'none', boxSizing: 'border-box', marginBottom: 14 }}
          />

          {/* Submit */}
          <button onClick={handleSubmit} disabled={uploading || files.length === 0}
            style={{ width: '100%', padding: 14, borderRadius: 12, background: uploading || files.length === 0 ? 'rgba(116,184,0,0.3)' : 'linear-gradient(135deg,#74B800,#9BE800)', color: '#000', fontWeight: 900, border: 'none', cursor: uploading || files.length === 0 ? 'not-allowed' : 'pointer', fontSize: 14 }}>
            {uploading ? '⏳ Publicando…' : '🦍 Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}