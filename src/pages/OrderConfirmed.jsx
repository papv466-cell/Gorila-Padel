// src/pages/OrderConfirmed.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

export default function OrderConfirmed() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (!cleared) {
      clearCart();
      setCleared(true);
    }
  }, []);

  const paymentIntent = searchParams.get('payment_intent');

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div className="container" style={{
          maxWidth: 600,
          margin: '0 auto',
          textAlign: 'center',
          paddingTop: 60
        }}>

          {/* ANIMACIÓN */}
          <div style={{
            width: 120,
            height: 120,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #9BEF00, #74B800)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 30px',
            fontSize: 60,
            boxShadow: '0 20px 60px rgba(116,184,0,0.35)',
            animation: 'gpPulse 2s ease-in-out infinite'
          }}>
            ✓
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 950, marginBottom: 16 }}>
            ¡Pedido confirmado!
          </h1>

          <p style={{ fontSize: 16, opacity: 0.85, lineHeight: 1.6, marginBottom: 30 }}>
            Tu compra se ha procesado correctamente. 
            Recibirás un email con los detalles del pedido y el seguimiento del envío.
          </p>

          {paymentIntent && (
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              marginBottom: 30,
              fontSize: 13,
              opacity: 0.7,
              wordBreak: 'break-all'
            }}>
              Referencia: {paymentIntent}
            </div>
          )}

          {/* PASOS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 40
          }}>
            {[
              { icon: '✅', label: 'Pago confirmado' },
              { icon: '📦', label: 'Preparando envío' },
              { icon: '🚚', label: 'En camino pronto' }
            ].map((step, i) => (
              <div key={i} style={{
                padding: 20,
                borderRadius: 14,
                background: i === 0 ? 'rgba(116,184,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: i === 0 ? '1px solid rgba(116,184,0,0.25)' : '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 900, opacity: i === 0 ? 1 : 0.6 }}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>

          {/* BOTONES */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link
              to="/tienda"
              className="btn"
              style={{ background: '#74B800' }}
            >
              Seguir comprando
            </Link>
            <Link
              to="/tienda/mis-pedidos"
              className="btn ghost"
            >
              Ver mis pedidos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}