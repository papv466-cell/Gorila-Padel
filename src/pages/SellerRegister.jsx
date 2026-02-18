// src/pages/SellerRegister.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { registerSeller, getCurrentSeller, BUSINESS_TYPES } from '../services/store';

export default function SellerRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);
  const [existingSeller, setExistingSeller] = useState(null);

  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'club',
    description: '',
    email: '',
    phone: '',
    logoUrl: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login?redirect=/vendedor/registro');
        return;
      }
      setUser(user);

      // Verificar si ya es vendedor
      const seller = await getCurrentSeller();
      if (seller) {
        setExistingSeller(seller);
      }

      // Pre-llenar email
      setFormData(prev => ({ ...prev, email: user.email || '' }));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await registerSeller(formData);
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/vendedor/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div className="container" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>🔒</div>
              <h2>Acceso restringido</h2>
              <p style={{ marginTop: 10, opacity: 0.75 }}>
                Debes iniciar sesión para registrarte como vendedor.
              </p>
              <button
                className="btn"
                onClick={() => navigate('/login?redirect=/vendedor/registro')}
                style={{ marginTop: 20 }}
              >
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (existingSeller) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div className="container" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>
                {existingSeller.is_verified ? '✅' : '⏳'}
              </div>
              <h2>
                {existingSeller.is_verified 
                  ? 'Ya eres vendedor' 
                  : 'Solicitud en revisión'}
              </h2>
              <p style={{ marginTop: 10, opacity: 0.75 }}>
                {existingSeller.is_verified
                  ? 'Tu cuenta de vendedor está activa.'
                  : 'Tu solicitud está siendo revisada por nuestro equipo. Te notificaremos por email cuando esté aprobada.'}
              </p>
              <button
                className="btn"
                onClick={() => navigate(existingSeller.is_verified ? '/vendedor/dashboard' : '/')}
                style={{ marginTop: 20 }}
              >
                {existingSeller.is_verified ? 'Ir al Panel' : 'Volver al Inicio'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container" style={{ maxWidth: 700, margin: '0 auto', paddingTop: 40 }}>
          
          {/* HEADER */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 950, marginBottom: 10 }}>
              🏪 Vende en Gorila Store
            </h1>
            <p style={{ fontSize: 16, opacity: 0.85, maxWidth: 500, margin: '0 auto' }}>
              Registra tu negocio y empieza a vender productos de pádel a nuestra comunidad
            </p>
          </div>

          {/* FORMULARIO */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: 30,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
          }}>
            {success ? (
              <div style={{
                textAlign: 'center',
                padding: 40
              }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
                <h2 style={{ marginBottom: 10 }}>¡Solicitud enviada!</h2>
                <p style={{ opacity: 0.85 }}>
                  Revisaremos tu solicitud y te notificaremos por email.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                
                {/* Nombre del Negocio */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
                    Nombre del Negocio *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Ej: Pádel Club Madrid"
                    required
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 15
                    }}
                  />
                </div>

                {/* Tipo de Negocio */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
                    Tipo de Negocio *
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 15
                    }}
                  >
                    {BUSINESS_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
                    Descripción de tu negocio
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Cuéntanos sobre tu negocio..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 15,
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Email */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
                    Email de Contacto *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 15
                    }}
                  />
                </div>

                {/* Teléfono */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+34 600 000 000"
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 15
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#ef4444',
                    marginBottom: 20,
                    fontSize: 14
                  }}>
                    {error}
                  </div>
                )}

                {/* Info */}
                <div style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  color: '#3b82f6',
                  marginBottom: 20,
                  fontSize: 13,
                  lineHeight: 1.5
                }}>
                  ℹ️ Tu solicitud será revisada por nuestro equipo. Te notificaremos por email cuando esté aprobada.
                </div>

                {/* Botones */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => navigate('/')}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}