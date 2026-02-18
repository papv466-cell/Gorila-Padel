// src/pages/CartPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function CartPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { items, loading, totalItems, subtotal, updateQuantity, removeItem } = useCart();

  if (loading) {
    return (
      <div className="page pageWithHeader">
        <div className="pageWrap">
          <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
              <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando carrito...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page pageWithHeader">
        <div className="pageWrap">
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: 60, padding: '60px 16px 0' }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🛒</div>
            <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 12 }}>Tu carrito está vacío</h1>
            <p style={{ opacity: 0.75, marginBottom: 30 }}>Añade productos de nuestra tienda para empezar</p>
            <Link to="/tienda" className="btn" style={{ background: '#74B800' }}>Ver productos</Link>
          </div>
        </div>
      </div>
    );
  }

  const shipping = subtotal > 50 ? 0 : 4.99;
  const total = subtotal + shipping;

  // Componente resumen reutilizable
  const Resumen = () => (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>Resumen del pedido</h2>
      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
          <span style={{ opacity: 0.75 }}>Subtotal</span>
          <span style={{ fontWeight: 900 }}>€{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
          <span style={{ opacity: 0.75 }}>Envío</span>
          <span style={{ fontWeight: 900, color: shipping === 0 ? '#74B800' : '#fff' }}>
            {shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 950, fontSize: 20 }}>Total</span>
          <span style={{ fontWeight: 950, fontSize: 22, color: '#74B800' }}>€{total.toFixed(2)}</span>
        </div>
      </div>
      <button className="btn" onClick={() => navigate('/tienda/checkout')}
        style={{ width: '100%', padding: 18, fontSize: 16, fontWeight: 950, background: '#74B800', marginBottom: 12 }}>
        💳 Finalizar Compra
      </button>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14, fontSize: 20, opacity: 0.6 }}>
        <span title="Apple Pay">🍎</span>
        <span title="Google Pay">G</span>
        <span title="Visa/Mastercard">💳</span>
      </div>
      <Link to="/tienda" style={{ display: 'block', textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontWeight: 900 }}>
        ← Seguir comprando
      </Link>
    </div>
  );

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 950 }}>
              🛒 Mi Carrito ({totalItems} {totalItems === 1 ? 'producto' : 'productos'})
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: 20 }}>

            {/* PRODUCTOS */}
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map(item => {
                const product = item.product;
                if (!product) return null;
                return (
                  <div key={item.id} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16, padding: 16,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '80px 1fr' : '100px 1fr auto',
                    gap: 16, alignItems: 'center'
                  }}>
                    {/* IMAGEN */}
                    <Link to={`/tienda/producto/${product.slug}`}>
                      <div style={{ width: isMobile ? 80 : 100, height: isMobile ? 80 : 100, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', display: 'grid', placeItems: 'center' }}>
                        {product.images?.[0]
                          ? <img src={product.images[0]} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>}
                      </div>
                    </Link>

                    {/* INFO + CONTROLES */}
                    <div>
                      <Link to={`/tienda/producto/${product.slug}`} style={{ textDecoration: 'none', color: '#fff' }}>
                        <div style={{ fontWeight: 950, fontSize: isMobile ? 14 : 16, marginBottom: 4, lineHeight: 1.3 }}>
                          {product.title}
                        </div>
                      </Link>
                      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>
                        {product.seller?.business_name}
                      </div>

                      {/* Precio en móvil */}
                      {isMobile && (
                        <div style={{ fontSize: 18, fontWeight: 950, color: '#74B800', marginBottom: 10 }}>
                          €{(product.price * item.quantity).toFixed(2)}
                          {item.quantity > 1 && (
                            <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>
                              (€{product.price} × {item.quantity})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cantidad + Eliminar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>−</button>
                        <span style={{ fontWeight: 900, minWidth: 24, textAlign: 'center', fontSize: 16 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>+</button>
                        <button onClick={() => removeItem(item.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>

                    {/* PRECIO en desktop */}
                    {!isMobile && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 950, color: '#74B800' }}>
                          €{(product.price * item.quantity).toFixed(2)}
                        </div>
                        {item.quantity > 1 && (
                          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                            €{product.price} × {item.quantity}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Barra envío gratis */}
              {subtotal < 50 && (
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(116,184,0,0.08)', border: '1px solid rgba(116,184,0,0.2)', fontSize: 14, fontWeight: 900 }}>
                  🚚 ¡Añade €{(50 - subtotal).toFixed(2)} más para envío gratis!
                  <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(subtotal / 50) * 100}%`, background: '#74B800', borderRadius: 999, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              {/* Resumen en móvil - debajo de productos */}
              {isMobile && <Resumen />}
            </div>

            {/* RESUMEN en desktop - columna derecha */}
            {!isMobile && (
              <div style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
                <Resumen />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}