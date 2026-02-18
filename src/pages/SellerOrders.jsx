// src/pages/SellerOrders.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SellerLayout from '../components/SellerLayout';
import { supabase } from '../services/supabaseClient';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function SellerOrders() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      // Obtener vendedor
      const { data: seller, error: sellerError } = await supabase
        .from('store_sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (sellerError || !seller) {
        console.error('Error obteniendo vendedor:', sellerError);
        setLoading(false);
        return;
      }

      console.log('Seller ID:', seller.id);

      // Obtener items de pedidos del vendedor
      const { data: orderItems, error: itemsError } = await supabase
        .from('store_order_items')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });

      if (itemsError) {
        console.error('Error obteniendo items:', itemsError);
        setLoading(false);
        return;
      }

      console.log('Order items:', orderItems);

      if (!orderItems || orderItems.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Obtener IDs únicos de pedidos
      const orderIds = [...new Set(orderItems.map(item => item.order_id))];
      console.log('Order IDs:', orderIds);

      // Obtener info de los pedidos
      const { data: ordersData, error: ordersError } = await supabase
        .from('store_orders')
        .select('*')
        .in('id', orderIds);

      if (ordersError) {
        console.error('Error obteniendo pedidos:', ordersError);
        setLoading(false);
        return;
      }

      console.log('Orders data:', ordersData);

      // Obtener IDs únicos de compradores
      const buyerIds = [...new Set(ordersData.map(o => o.buyer_id).filter(Boolean))];
      
      // Obtener info de compradores
      const { data: buyers } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', buyerIds);

      const buyersMap = {};
      (buyers || []).forEach(b => { buyersMap[b.id] = b; });

      // Agrupar items por pedido
      const groupedOrders = {};
      orderItems.forEach(item => {
        const orderId = item.order_id;
        if (!groupedOrders[orderId]) {
          const orderData = ordersData.find(o => o.id === orderId);
          if (!orderData) return;
          
          groupedOrders[orderId] = {
            ...orderData,
            buyer: buyersMap[orderData.buyer_id] || null,
            items: []
          };
        }
        groupedOrders[orderId].items.push(item);
      });

      const finalOrders = Object.values(groupedOrders);
      console.log('Final orders:', finalOrders);
      setOrders(finalOrders);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const statusMap = {
    pending: { label: 'PENDIENTE', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
    processing: { label: 'PROCESANDO', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    shipped: { label: 'ENVIADO', bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.25)' },
    delivered: { label: 'ENTREGADO', bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    cancelled: { label: 'CANCELADO', bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' }
  };

  function StatusBadge({ status }) {
    const s = statusMap[status] || statusMap.pending;
    return <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{s.label}</span>;
  }

  return (
    <SellerLayout>
      <div style={{ marginBottom: isMobile ? 20 : 30 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 950, marginBottom: 4 }}>Pedidos</h1>
        <p style={{ opacity: 0.75, fontSize: isMobile ? 13 : 14 }}>Gestiona los pedidos de tus productos</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: isMobile ? 16 : 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: 'Todos' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'processing', label: 'Procesando' },
            { value: 'shipped', label: 'Enviados' },
            { value: 'delivered', label: 'Entregados' }
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{
                padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 900, cursor: 'pointer',
                border: filter === f.value ? '1px solid #74B800' : '1px solid rgba(255,255,255,0.12)',
                background: filter === f.value ? 'rgba(116,184,0,0.15)' : 'rgba(255,255,255,0.04)',
                color: filter === f.value ? '#74B800' : '#fff'
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: isMobile ? 40 : 60 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando pedidos...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 40 : 60, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 50 : 60, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 950, marginBottom: 8 }}>No hay pedidos</h2>
          <p style={{ opacity: 0.75, fontSize: isMobile ? 14 : 15 }}>
            {filter === 'all' ? 'Aún no tienes pedidos' : `No hay pedidos ${filter === 'pending' ? 'pendientes' : filter === 'processing' ? 'procesando' : filter === 'shipped' ? 'enviados' : 'entregados'}`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? 12 : 16 }}>
          {filteredOrders.map(order => {
            const totalOrder = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const address = order.shipping_address;

            return (
              <div key={order.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 14 : 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: isMobile ? 15 : 17, marginBottom: 4 }}>
                      Pedido #{order.order_number}
                    </div>
                    <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>
                      {new Date(order.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, flex: 1 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7 }}>
                        {item.quantity} ud × €{item.price}
                      </div>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 950, color: '#74B800' }}>
                        €{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.6, marginBottom: 6 }}>CLIENTE</div>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, marginBottom: 2 }}>
                      {order.buyer?.name || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7 }}>
                      {order.buyer?.email || 'Sin email'}
                    </div>
                    {address && (
                      <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7, marginTop: 6 }}>
                        📍 {address.street}, {address.city} {address.postalCode}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.6, marginBottom: 6 }}>TOTAL</div>
                    <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 950, color: '#74B800' }}>
                      €{totalOrder.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SellerLayout>
  );
}