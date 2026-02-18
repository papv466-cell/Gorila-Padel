import { useState } from 'react';
import './GorilandiaUpload.css';

export default function GorilandiaUpload({ onClose, onSubmit }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [type, setType] = useState('photo');
  const [previews, setPreviews] = useState([]);

  function handleFileChange(e) {
    const selectedFiles = Array.from(e.target.files);
    
    if (type === 'video' && selectedFiles.length > 1) {
      alert('Solo puedes subir 1 video');
      return;
    }

    if (type === 'photo' && selectedFiles.length > 10) {
      alert('Máximo 10 fotos');
      return;
    }

    setFiles(selectedFiles);

    // Generate previews
    const newPreviews = [];
    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === selectedFiles.length) {
          setPreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    
    if (files.length === 0) {
      alert('Selecciona al menos una foto o video');
      return;
    }

    onSubmit({ files, caption, type });
  }

  return (
    <div className="upload-modal">
      <div className="upload-backdrop" onClick={onClose} />
      
      <div className="upload-content">
        <div className="upload-header">
          <h2>Nueva Publicación</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Type selector */}
          <div className="type-selector">
            <button
              type="button"
              className={`type-btn ${type === 'photo' ? 'active' : ''}`}
              onClick={() => { setType('photo'); setFiles([]); setPreviews([]); }}
            >
              📷 Foto
            </button>
            <button
              type="button"
              className={`type-btn ${type === 'video' ? 'active' : ''}`}
              onClick={() => { setType('video'); setFiles([]); setPreviews([]); }}
            >
              🎥 Video
            </button>
          </div>

          {/* File input */}
          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-input"
              accept={type === 'video' ? 'video/*' : 'image/*'}
              multiple={type === 'photo'}
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {files.length === 0 ? (
                <>
                  <span className="upload-icon">⬆️</span>
                  <span>Seleccionar {type === 'photo' ? 'fotos (máx 10)' : 'video'}</span>
                </>
              ) : (
                <span>{files.length} archivo(s) seleccionado(s)</span>
              )}
            </label>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="previews-grid">
              {previews.map((preview, idx) => (
                <div key={idx} className="preview-item">
                  {type === 'video' ? (
                    <video src={preview} controls className="preview-video" />
                  ) : (
                    <img src={preview} alt={`Preview ${idx + 1}`} className="preview-image" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe algo sobre tu publicación..."
            className="caption-input"
            rows="4"
          />

          {/* Submit */}
          <button type="submit" className="submit-btn">
            Publicar
          </button>
        </form>
      </div>
    </div>
  );
}