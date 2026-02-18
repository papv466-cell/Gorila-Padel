// src/pages/MyOrders.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login?redirect=/tienda/mis-pedidos');
        return;
      }

      const { data, error } = await supabase
        .from('store_orders')
        .select(`
          *,
          items:store_order_items(
            *,
            product:store_products(
              id,
              title,
              images,
              slug
            )
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const statusInfo = {
    pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
    paid: { label: 'Pagado', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
    shipped: { label: 'Enviado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
    delivered: { label: 'Entregado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' },
    cancelled: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' }
  };

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div className="container" style={{ maxWidth: 900 }}>

          <div style={{ marginBottom: 30 }}>
            <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 8 }}>
              📋 Mis Pedidos
            </h1>
            <p style={{ opacity: 0.75 }}>
              Historial de todas tus compras
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
              <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando pedidos...</div>
            </div>
          ) : orders.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 60,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 60, marginBottom: 20 }}>📦</div>
              <h2 style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>
                No tienes pedidos aún
              </h2>
              <p style={{ opacity: 0.75, marginBottom: 24 }}>
                Cuando hagas una compra aparecerá aquí
              </p>
              <Link to="/tienda" className="btn" style={{ background: '#74B800' }}>
                Ir a la tienda
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              {orders.map(order => {
                const status = statusInfo[order.status] || statusInfo.pending;

                return (
                  <div
                    key={order.id}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      overflow: 'hidden'
                    }}
                  >
                    {/* Header pedido */}
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      background: 'rgba(255,255,255,0.02)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 15 }}>
                          Pedido #{order.order_number}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                          {new Date(order.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: 20, fontWeight: 950, color: '#74B800' }}>
                          €{order.total}
                        </div>
                        <div style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          background: status.bg,
                          color: status.color,
                          border: `1px solid ${status.border}`
                        }}>
                          {status.label}
                        </div>
                      </div>
                    </div>

                    {/* Items del pedido */}
                    <div style={{ padding: 20 }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {(order.items || []).map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 1fr auto',
                              gap: 14,
                              alignItems: 'center'
                            }}
                          >
                            <div style={{
                              width: 60,
                              height: 60,
                              borderRadius: 10,
                              overflow: 'hidden',
                              background: 'rgba(0,0,0,0.2)',
                              display: 'grid',
                              placeItems: 'center'
                            }}>
                              {item.product?.images?.[0] ? (
                                <img
                                  src={item.product.images[0]}
                                  alt={item.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: 28, opacity: 0.3 }}>📦</span>
                              )}
                            </div>

                            <div>
                              <div style={{ fontWeight: 900, fontSize: 14 }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                                Cantidad: {item.quantity}
                              </div>
                            </div>

                            <div style={{ fontWeight: 950, color: '#74B800' }}>
                              €{(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tracking */}
                      {order.tracking_number && (
                        <div style={{
                          marginTop: 16,
                          padding: 14,
                          borderRadius: 12,
                          background: 'rgba(139,92,246,0.10)',
                          border: '1px solid rgba(139,92,246,0.2)',
                          fontSize: 13,
                          fontWeight: 900
                        }}>
                          🚚 Número de seguimiento: {order.tracking_number}
                          {order.carrier && ` (${order.carrier})`}
                        </div>
                      )}
                    </div>
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