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

  const shipping = subtotal > 50 ? 0 : 4.99;
  const total = subtotal + shipping;
  const shippingProgress = Math.min((subtotal / 50) * 100, 100);

  if (loading) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 36 }}>⏳</div>
          <div style={{ marginTop: 10, fontWeight: 800 }}>Cargando carrito...</div>
        </div>
      </div>
    </div>
  );

  if (items.length === 0) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap">
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '80px 16px 0' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🛒</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 10 }}>Tu carrito está vacío</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 28, fontSize: 14 }}>Añade productos de la tienda para empezar</p>
          <Link to="/tienda" style={{ padding: '12px 24px', borderRadius: 12, background: '#74B800', color: '#000', fontWeight: 900, textDecoration: 'none', fontSize: 14 }}>
            Ver productos →
          </Link>
        </div>
      </div>
    </div>
  );

  const Resumen = () => (
    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Resumen del pedido</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{totalItems} producto{totalItems !== 1 ? 's' : ''}</span>
          <span style={{ fontWeight: 800 }}>€{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Envío</span>
          <span style={{ fontWeight: 800, color: shipping === 0 ? '#74B800' : '#fff' }}>
            {shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 900, fontSize: 17 }}>Total</span>
          <span style={{ fontWeight: 900, fontSize: 22, color: '#74B800' }}>€{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Barra envío gratis */}
      {subtotal < 50 && (
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: 'rgba(116,184,0,0.06)', border: '1px solid rgba(116,184,0,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#74B800', marginBottom: 6 }}>
            🚚 Faltan €{(50 - subtotal).toFixed(2)} para envío gratis
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${shippingProgress}%`, background: 'linear-gradient(90deg,#74B800,#9BE800)', borderRadius: 999, transition: 'width .4s' }} />
          </div>
        </div>
      )}

      <button onClick={() => navigate('/tienda/checkout')}
        style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#74B800,#9BE800)', color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>
        💳 Finalizar compra
      </button>
      <Link to="/tienda" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 700 }}>
        ← Seguir comprando
      </Link>
    </div>
  );

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @keyframes gcFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .gcItem { transition: border-color .15s; animation: gcFadeUp .3s ease both; }
        .gcItem:hover { border-color: rgba(116,184,0,0.15) !important; }
        .gcQtyBtn { transition: all .12s; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05) !important; }
        .gcQtyBtn:hover { background: rgba(255,255,255,0.12) !important; }
        .gcRemoveBtn { transition: all .12s; }
        .gcRemoveBtn:hover { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; }
      `}</style>

      <div className="pageWrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 12px 40px' : '0 24px 60px' }}>

          <div style={{ padding: '14px 0 20px' }}>
            <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#fff', margin: 0 }}>
              🛒 Carrito <span style={{ fontSize: isMobile ? 14 : 16, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>({totalItems})</span>
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 16 }}>

            {/* PRODUCTOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item, idx) => {
                const product = item.product;
                if (!product) return null;
                return (
                  <div key={item.id} className="gcItem"
                    style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14, animationDelay: `${idx * 0.05}s` }}>

                    <Link to={`/tienda/producto/${product.slug}`}>
                      <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', background: '#1a1a1a' }}>
                        {product.images?.[0]
                          ? <img src={product.images[0]} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 28, opacity: 0.15 }}>🏓</div>}
                      </div>
                    </Link>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <Link to={`/tienda/producto/${product.slug}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', lineHeight: 1.3 }}>{product.title}</div>
                        </Link>
                        <div style={{ fontSize: 17, fontWeight: 900, color: '#74B800', flexShrink: 0 }}>
                          €{(product.price * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      {product.seller?.business_name && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {product.seller.business_name}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '2px' }}>
                          <button className="gcQtyBtn" onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{ width: 30, height: 30, borderRadius: 6, color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>−</button>
                          <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>{item.quantity}</span>
                          <button className="gcQtyBtn" onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{ width: 30, height: 30, borderRadius: 6, color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>+</button>
                        </div>

                        <button className="gcRemoveBtn" onClick={() => removeItem(item.id)}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                          🗑️ Eliminar
                        </button>

                        {item.quantity > 1 && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                            €{product.price} c/u
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isMobile && <Resumen />}
            </div>

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