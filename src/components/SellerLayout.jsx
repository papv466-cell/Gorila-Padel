// src/components/SellerLayout.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCurrentSeller } from '../services/store';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function SellerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => { checkSeller(); }, []);

  async function checkSeller() {
    try {
      const sellerData = await getCurrentSeller();
      if (!sellerData) { navigate('/vendedor/registro'); return; }
      if (!sellerData.is_verified) { navigate('/vendedor/pendiente'); return; }
      setSeller(sellerData);
    } catch (err) {
      console.error(err);
      navigate('/login?redirect=/vendedor/dashboard');
    } finally { setLoading(false); }
  }

  if (loading) {
    return (
      <div className="page"><div className="pageWrap">
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
            <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando...</div>
          </div>
        </div>
      </div></div>
    );
  }

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, icon, label }) => (
    <Link to={to} onClick={() => setShowMenu(false)} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 12, fontWeight: 900, fontSize: 14, textDecoration: 'none',
      background: isActive(to) ? 'rgba(116,184,0,0.15)' : 'transparent',
      color: isActive(to) ? '#74B800' : 'rgba(255,255,255,0.85)',
      border: isActive(to) ? '1px solid rgba(116,184,0,0.25)' : '1px solid transparent',
      marginBottom: 6
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </Link>
  );

  return (
    <div className="page gpSellerPage">
      <div className="pageWrap">
        
        {/* HEADER */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              
              {/* Logo vendedor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: 'linear-gradient(135deg, #9BEF00, #74B800)', display: 'grid', placeItems: 'center', fontSize: 18, border: '2px solid #111' }}>🏪</div>
                <div>
                  <div style={{ fontWeight: 950, fontSize: isMobile ? 14 : 16 }}>{seller?.business_name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Panel de Vendedor</div>
                </div>
              </div>

              {/* Botón menú móvil / Volver desktop */}
              {isMobile ? (
                <button onClick={() => setShowMenu(!showMenu)} style={{
                  padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: showMenu ? 'rgba(116,184,0,0.15)' : 'rgba(255,255,255,0.04)',
                  color: showMenu ? '#74B800' : '#fff', fontWeight: 900, fontSize: 22, cursor: 'pointer'
                }}>☰</button>
              ) : (
                <button className="btn ghost" onClick={() => navigate('/tienda')} style={{ whiteSpace: 'nowrap' }}>← Volver a la tienda</button>
              )}
            </div>
          </div>
        </div>

        {/* MENÚ MÓVIL DESPLEGABLE */}
        {isMobile && showMenu && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
            <nav>
              <NavLink to="/vendedor/dashboard" icon="📊" label="Dashboard" />
              <NavLink to="/vendedor/productos" icon="📦" label="Productos" />
              <NavLink to="/vendedor/pedidos" icon="📋" label="Pedidos" />
              <NavLink to="/vendedor/perfil" icon="⚙️" label="Configuración" />
              <button onClick={() => { setShowMenu(false); navigate('/tienda'); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12, fontWeight: 900, fontSize: 14,
                background: 'transparent', color: 'rgba(255,255,255,0.85)',
                border: '1px solid transparent', cursor: 'pointer', marginTop: 8
              }}>
                <span style={{ fontSize: 18 }}>🛍️</span>
                Ver tienda
              </button>
            </nav>
            {seller?.is_verified && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', fontSize: 11, fontWeight: 900, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✅</span> Cuenta verificada
              </div>
            )}
          </div>
        )}

        <div style={{ maxWidth: 1200, margin: '20px auto 0', padding: '0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 24 }}>
            
            {/* SIDEBAR - solo desktop */}
            {!isMobile && (
              <aside style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, height: 'fit-content', position: 'sticky', top: 80 }}>
                <nav>
                  <NavLink to="/vendedor/dashboard" icon="📊" label="Dashboard" />
                  <NavLink to="/vendedor/productos" icon="📦" label="Productos" />
                  <NavLink to="/vendedor/pedidos" icon="📋" label="Pedidos" />
                  <NavLink to="/vendedor/perfil" icon="⚙️" label="Configuración" />
                </nav>
                {seller?.is_verified && (
                  <div style={{ marginTop: 20, padding: 12, borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', fontSize: 12, fontWeight: 900, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅</span> Cuenta verificada
                  </div>
                )}
              </aside>
            )}

            {/* CONTENIDO */}
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
