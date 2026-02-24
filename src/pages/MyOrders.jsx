// src/pages/MyOrders.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login?redirect=/tienda/mis-pedidos'); return; }
      const { data, error } = await supabase
        .from('store_orders')
        .select(`*, items:store_order_items(*, product:store_products(id, title, images, slug))`)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const STATUS = {
    pending:   { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: '⏳' },
    paid:      { label: 'Pagado',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  icon: '💳' },
    shipped:   { label: 'Enviado',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', icon: '🚚' },
    delivered: { label: 'Entregado',  color: '#74B800', bg: 'rgba(116,184,0,0.12)',  border: 'rgba(116,184,0,0.25)',  icon: '✅' },
    cancelled: { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  icon: '❌' },
  };

  const STEPS = ['pending', 'paid', 'shipped', 'delivered'];

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @keyframes goFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .goOrderCard { transition: border-color .15s; }
        .goOrderCard:hover { border-color: rgba(116,184,0,0.2) !important; }
      `}</style>
      <div className="pageWrap">
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 60px' }}>

          {/* Header */}
          <div style={{ padding: '16px 0 24px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>📋 Mis Pedidos</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              {loading ? '...' : `${orders.length} pedido${orders.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: 36 }}>⏳</div>
              <div style={{ marginTop: 10, fontWeight: 800 }}>Cargando pedidos...</div>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 52 }}>📦</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 16, marginBottom: 8 }}>No tienes pedidos aún</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>Cuando hagas una compra aparecerá aquí</div>
              <Link to="/tienda" style={{ padding: '11px 22px', borderRadius: 12, background: '#74B800', color: '#000', fontWeight: 900, textDecoration: 'none', fontSize: 14 }}>
                Ir a la tienda →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map((order, idx) => {
                const status = STATUS[order.status] || STATUS.pending;
                const isExpanded = expanded === order.id;
                const stepIdx = STEPS.indexOf(order.status);

                return (
                  <div key={order.id} className="goOrderCard"
                    style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', animation: `goFadeUp 0.3s ease ${idx * 0.05}s both` }}>

                    {/* Header pedido */}
                    <div onClick={() => setExpanded(isExpanded ? null : order.id)}
                      style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>#{order.order_number}</span>
                          <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                          {new Date(order.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {' · '}{(order.items || []).length} producto{(order.items || []).length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#74B800' }}>€{order.total}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Contenido expandido */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>

                        {/* Barra de progreso */}
                        {order.status !== 'cancelled' && stepIdx >= 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              {STEPS.map((s, i) => (
                                <div key={s} style={{ fontSize: 10, fontWeight: 800, color: i <= stepIdx ? '#74B800' : 'rgba(255,255,255,0.2)', textAlign: 'center', flex: 1 }}>
                                  {STATUS[s]?.icon}
                                  <div style={{ marginTop: 2 }}>{STATUS[s]?.label}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${((stepIdx + 1) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg,#74B800,#9BE800)', borderRadius: 999, transition: 'width .5s' }} />
                            </div>
                          </div>
                        )}

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                          {(order.items || []).map(item => (
                            <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0 }}>
                                {item.product?.images?.[0]
                                  ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 22, opacity: 0.2 }}>📦</div>
                                }
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>x{item.quantity}</div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: '#74B800', flexShrink: 0 }}>€{(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>

                        {/* Tracking */}
                        {order.tracking_number && (
                          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12, fontWeight: 800, color: '#8b5cf6' }}>
                            🚚 Seguimiento: {order.tracking_number}{order.carrier ? ` · ${order.carrier}` : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}