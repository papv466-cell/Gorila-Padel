// src/pages/SellerDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import SellerLayout from '../components/SellerLayout';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function SellerDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ totalProducts: 0, totalSales: 0, totalRevenue: 0, pendingOrders: 0 });
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data: sellerData } = await supabase.from('store_sellers').select('*').eq('user_id', user.id).maybeSingle();
      if (!sellerData) { navigate('/vendedor/registro'); return; }
      setSeller(sellerData);

      const { data: products } = await supabase.from('store_products').select('*').eq('seller_id', sellerData.id).order('created_at', { ascending: false });
      const productList = products || [];
      setRecentProducts(productList.slice(0, 5));
      const totalSales = productList.reduce((sum, p) => sum + (p.sales || 0), 0);

      const { data: orderItems } = await supabase.from('store_order_items').select(`*, order:store_orders(id, order_number, status, created_at, buyer_id)`).eq('seller_id', sellerData.id).order('created_at', { ascending: false });
      const orders = orderItems || [];
      setRecentOrders(orders.slice(0, 5));
      const totalRevenue = orders.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
      const pendingOrders = new Set(orders.filter(item => item.order?.status === 'pending').map(item => item.order?.id)).size;

      setStats({ totalProducts: productList.length, totalSales, totalRevenue, pendingOrders });
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally { setLoading(false); }
  }

  if (loading) {
    return (
      <SellerLayout>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
            <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando estadísticas...</div>
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>

      <div style={{ marginBottom: isMobile ? 20 : 30 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 950, marginBottom: 6 }}>Dashboard</h1>
        <p style={{ opacity: 0.75, fontSize: isMobile ? 13 : 14 }}>
          Bienvenido, <strong>{seller?.business_name}</strong> · Resumen de tu actividad
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 30 }}>
        <StatCard emoji="📦" label="PRODUCTOS" value={stats.totalProducts} mobile={isMobile} />
        <StatCard emoji="🎯" label="VENDIDAS" value={stats.totalSales} mobile={isMobile} />
        <StatCard emoji="💰" label="INGRESOS" value={`€${stats.totalRevenue.toFixed(0)}`} green mobile={isMobile} />
        <StatCard emoji="📋" label="PENDIENTES" value={stats.pendingOrders} mobile={isMobile} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }}>
        <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 950, marginBottom: 14 }}>Acciones Rápidas</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/vendedor/productos/nuevo')}
            style={{ background: '#74B800', display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13 : 15, padding: isMobile ? '10px 14px' : '12px 18px' }}>
            ➕ Añadir Producto
          </button>
          <button className="btn ghost" onClick={() => navigate('/vendedor/productos')}
            style={{ fontSize: isMobile ? 13 : 15, padding: isMobile ? '10px 14px' : '12px 18px' }}>
            📦 Ver Productos
          </button>
          <button className="btn ghost" onClick={() => navigate('/tienda')}
            style={{ fontSize: isMobile ? 13 : 15, padding: isMobile ? '10px 14px' : '12px 18px' }}>
            🛍️ Ver Tienda
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 950 }}>Productos Recientes</h2>
          <button className="btn ghost" onClick={() => navigate('/vendedor/productos')}
            style={{ padding: '6px 10px', fontSize: 12 }}>Ver todos →</button>
        </div>

        {recentProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: isMobile ? 30 : 40, opacity: 0.6 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontWeight: 800, marginBottom: 6, fontSize: isMobile ? 15 : 16 }}>No tienes productos aún</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 14 }}>Añade tu primer producto para empezar a vender</div>
            <button className="btn" onClick={() => navigate('/vendedor/productos/nuevo')} style={{ fontSize: 14 }}>Añadir Producto</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentProducts.map(product => (
              <div key={product.id} onClick={() => navigate(`/vendedor/productos/${product.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: isMobile ? '50px 1fr' : '60px 1fr auto auto',
                  gap: isMobile ? 10 : 16, padding: isMobile ? 10 : 12, borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  alignItems: 'center', cursor: 'pointer'
                }}>
                <div style={{ width: isMobile ? 50 : 60, height: isMobile ? 50 : 60, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', display: 'grid', placeItems: 'center' }}>
                  {product.images?.[0] ? <img src={product.images[0]} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20, opacity: 0.3 }}>📦</span>}
                </div>
                <div>
                  <div style={{ fontWeight: 950, fontSize: isMobile ? 13 : 15, marginBottom: 3, lineHeight: 1.3 }}>{product.title}</div>
                  <div style={{ fontSize: isMobile ? 11 : 13, opacity: 0.7 }}>
                    €{product.price} · Stock: {product.stock_quantity} · {product.sales || 0} vendidos
                  </div>
                  {isMobile && (
                    <div style={{ fontSize: 13, fontWeight: 950, color: '#74B800', marginTop: 4 }}>
                      €{((product.sales || 0) * product.price).toFixed(0)}
                    </div>
                  )}
                </div>
                {!isMobile && <div style={{ fontSize: 16, fontWeight: 950, color: '#74B800' }}>€{((product.sales || 0) * product.price).toFixed(0)}</div>}
                {!isMobile && (
                  <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: product.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)', color: product.is_active ? '#22c55e' : '#9ca3af', border: `1px solid ${product.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(156,163,175,0.25)'}` }}>
                    {product.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24 }}>
        <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 950, marginBottom: 14 }}>Pedidos Recientes</h2>
        {recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: isMobile ? 30 : 40, opacity: 0.6 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 16 }}>No hay pedidos aún</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentOrders.map(item => (
              <div key={item.id} style={{
                padding: isMobile ? 12 : 14, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: isMobile ? 8 : 16, alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: isMobile ? 13 : 14, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.7 }}>
                    Pedido #{item.order?.order_number} · {item.quantity} ud · €{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{item.order?.created_at ? new Date(item.order.created_at).toLocaleDateString('es-ES') : ''}</div>
                </div>
                {isMobile ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div style={{ fontWeight: 950, color: '#74B800', fontSize: 15 }}>+€{(item.price * item.quantity).toFixed(2)}</div>
                    <StatusBadge status={item.order?.status} />
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 950, color: '#74B800', fontSize: 16 }}>+€{(item.price * item.quantity).toFixed(2)}</div>
                    <StatusBadge status={item.order?.status} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}

function StatCard({ emoji, label, value, green, mobile }) {
  return (
    <div style={{
      background: green ? 'rgba(116,184,0,0.12)' : 'rgba(255,255,255,0.04)',
      border: green ? '1px solid rgba(116,184,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: mobile ? 12 : 18
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: mobile ? 9 : 11, fontWeight: 900, marginBottom: mobile ? 4 : 6, color: green ? '#74B800' : undefined, opacity: green ? 1 : 0.7 }}>{label}</div>
          <div style={{ fontSize: mobile ? 24 : 28, fontWeight: 950, color: green ? '#74B800' : undefined }}>{value}</div>
        </div>
        <div style={{ fontSize: mobile ? 22 : 26 }}>{emoji}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'PENDIENTE', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
    processing: { label: 'PROCESANDO', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    shipped: { label: 'ENVIADO', bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.25)' },
    delivered: { label: 'ENTREGADO', bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    cancelled: { label: 'CANCELADO', bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  };
  const s = map[status] || map.pending;
  return <span style={{ padding: '5px 10px', borderRadius: 999, fontSize: 10, fontWeight: 900, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{s.label}</span>;
}