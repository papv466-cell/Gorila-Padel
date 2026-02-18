// src/pages/SellerSettings.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SellerLayout from '../components/SellerLayout';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function SellerSettings() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState({
    business_name: '',
    description: '',
    phone: '',
    website: ''
  });

  useEffect(() => { loadSeller(); }, []);

  async function loadSeller() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: sellerData, error } = await supabase
        .from('store_sellers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error cargando vendedor:', error);
        return;
      }

      setSeller(sellerData);
      setForm({
        business_name: sellerData.business_name || '',
        description: sellerData.description || '',
        phone: sellerData.phone || '',
        website: sellerData.website || ''
      });
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.business_name.trim()) {
      toast.error('El nombre del negocio es obligatorio');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('store_sellers')
        .update({
          business_name: form.business_name,
          description: form.description,
          phone: form.phone,
          website: form.website
        })
        .eq('id', seller.id);

      if (error) throw error;

      toast.success('✅ Cambios guardados');
      loadSeller();
    } catch (err) {
      console.error('Error guardando:', err);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
    opacity: 0.7
  };

  if (loading) {
    return (
      <SellerLayout>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando configuración...</div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div style={{ marginBottom: isMobile ? 20 : 30 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 950, marginBottom: 4 }}>Configuración</h1>
        <p style={{ opacity: 0.75, fontSize: isMobile ? 13 : 14 }}>Gestiona la información de tu negocio</p>
      </div>

      <div style={{ maxWidth: 600 }}>
        {/* INFO BASICA */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 950, marginBottom: 16 }}>Información Básica</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>NOMBRE DEL NEGOCIO *</label>
            <input
              type="text"
              value={form.business_name}
              onChange={e => setForm({ ...form, business_name: e.target.value })}
              placeholder="Ej: Pádel Pro Shop"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>DESCRIPCIÓN</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Cuéntanos sobre tu negocio..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>TELÉFONO</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+34 600 000 000"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>SITIO WEB</label>
            <input
              type="url"
              value={form.website}
              onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="https://tutienda.com"
              style={inputStyle}
            />
          </div>
        </div>

        {/* ESTADO DE VERIFICACION */}
        <div style={{ background: seller?.is_verified ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)', border: seller?.is_verified ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(251,191,36,0.25)', borderRadius: 16, padding: isMobile ? 16 : 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 32 }}>{seller?.is_verified ? '✅' : '⏳'}</div>
            <div>
              <div style={{ fontWeight: 950, fontSize: isMobile ? 15 : 16, marginBottom: 4, color: seller?.is_verified ? '#22c55e' : '#fbbf24' }}>
                {seller?.is_verified ? 'Cuenta Verificada' : 'Verificación Pendiente'}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.8 }}>
                {seller?.is_verified
                  ? 'Tu cuenta está verificada y puedes vender en Gorila Store'
                  : 'Tu cuenta está siendo revisada por el equipo de Gorila Pádel'}
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#74B800',
              flex: 1,
              minWidth: 200,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
          </button>
          <button
            className="btn ghost"
            onClick={() => navigate('/vendedor/dashboard')}
            style={{ minWidth: 150 }}
          >
            ← Volver
          </button>
        </div>

        {/* INFO ADICIONAL */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, opacity: 0.7 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>ℹ️ Información</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Los cambios se verán reflejados en tu perfil público</li>
            <li>El nombre del negocio aparecerá en todos tus productos</li>
            <li>Asegúrate de que tu información de contacto sea correcta</li>
          </ul>
        </div>
      </div>
    </SellerLayout>
  );
}