// src/pages/ProductDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => { loadProduct(); }, [slug]);

  async function loadProduct() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('store_products')
        .select(`*, seller:store_sellers(id, business_name, logo_url, rating, description)`)
        .eq('slug', slug)
        .maybeSingle();
      if (error || !data) { setProduct(null); return; }
      setProduct(data);
      await supabase.from('store_products').update({ views: (data.views || 0) + 1 }).eq('id', data.id);
    } catch { setProduct(null); }
    finally { setLoading(false); }
  }

  async function handleAddToCart() {
    try {
      setAddingToCart(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (confirm('Debes iniciar sesión. ¿Ir a login?')) navigate('/login?redirect=' + window.location.pathname); return; }
      const { data: existing } = await supabase.from('store_cart').select('*').eq('user_id', user.id).eq('product_id', product.id).maybeSingle();
      if (existing) {
        await supabase.from('store_cart').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
      } else {
        await supabase.from('store_cart').insert([{ user_id: user.id, product_id: product.id, quantity }]);
      }
      window.dispatchEvent(new Event('cart-updated'));
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setAddingToCart(false); }
  }

  if (loading) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 800 }}>Cargando...</div>
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap">
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>😕</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 16 }}>Producto no encontrado</h1>
          <Link to="/tienda" style={{ padding: '10px 20px', borderRadius: 12, background: '#74B800', color: '#000', fontWeight: 900, textDecoration: 'none' }}>← Volver</Link>
        </div>
      </div>
    </div>
  );

  const images = product.images || [];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;
  const inStock = product.stock_quantity > 0;

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @keyframes gsPdFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gsAddedPulse { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
        .gsThumb { transition: all .15s; cursor: pointer; }
        .gsThumb:hover { opacity: 1 !important; transform: scale(1.03); }
        .gsQtyBtn { transition: all .15s; }
        .gsQtyBtn:hover { background: rgba(255,255,255,0.15) !important; }
      `}</style>

      <div className="pageWrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 60px' }}>

          {/* Breadcrumb */}
          <div style={{ padding: '12px 0 20px', fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link to="/tienda" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Tienda</Link>
            <span>›</span>
            <span style={{ color: '#74B800' }}>{product.category}</span>
            <span>›</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{product.title}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: 32, animation: 'gsPdFadeUp 0.4s ease' }}>

            {/* ── IMÁGENES ── */}
            <div>
              {/* Imagen principal */}
              <div style={{ borderRadius: 20, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.07)', aspectRatio: '1/1', position: 'relative', marginBottom: 12 }}>
                {images[selectedImage] ? (
                  <img src={images[selectedImage]} alt={product.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 80, opacity: 0.1 }}>🏓</div>
                )}
                {hasDiscount && (
                  <div style={{ position: 'absolute', top: 14, left: 14, padding: '5px 10px', borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 900 }}>
                    -{discountPct}%
                  </div>
                )}
              </div>
              {/* Miniaturas */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <div key={i} className="gsThumb"
                      onClick={() => setSelectedImage(i)}
                      style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: selectedImage === i ? '2px solid #74B800' : '2px solid rgba(255,255,255,0.08)', opacity: selectedImage === i ? 1 : 0.5 }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── INFO + COMPRA ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Categoría + título */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, color: '#74B800', marginBottom: 8 }}>
                  {product.category}
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2, letterSpacing: -0.5 }}>
                  {product.title}
                </h1>
                {product.seller?.business_name && (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                    por <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{product.seller.business_name}</strong>
                  </div>
                )}
              </div>

              {/* Precio */}
              <div style={{ padding: '16px 18px', borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: '#74B800', lineHeight: 1 }}>€{product.price}</span>
                  {hasDiscount && (
                    <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>€{product.compare_at_price}</span>
                  )}
                  {hasDiscount && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 12, fontWeight: 900, border: '1px solid rgba(239,68,68,0.25)' }}>
                      Ahorras €{(product.compare_at_price - product.price).toFixed(2)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>IVA incluido · Envío calculado al finalizar</div>
              </div>

              {/* Stock */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: inStock ? 'rgba(116,184,0,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${inStock ? 'rgba(116,184,0,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: inStock ? '#74B800' : '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: inStock ? '#74B800' : '#ef4444' }}>
                  {inStock ? `En stock · ${product.stock_quantity} disponibles` : 'Sin stock'}
                </span>
                {inStock && product.stock_quantity <= 5 && (
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 800, marginLeft: 'auto' }}>⚡ ¡Pocas unidades!</span>
                )}
              </div>

              {/* Cantidad + Añadir */}
              {inStock && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '4px' }}>
                    <button className="gsQtyBtn" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>−</button>
                    <span style={{ width: 36, textAlign: 'center', fontSize: 16, fontWeight: 900, color: '#fff' }}>{quantity}</span>
                    <button className="gsQtyBtn" onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>+</button>
                  </div>

                  <button onClick={handleAddToCart} disabled={addingToCart || addedFeedback}
                    style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: addedFeedback ? 'rgba(116,184,0,0.3)' : 'linear-gradient(135deg,#74B800,#9BE800)', color: addedFeedback ? '#74B800' : '#000', fontWeight: 900, fontSize: 15, cursor: addingToCart ? 'not-allowed' : 'pointer', transition: 'all .2s', animation: addedFeedback ? 'gsAddedPulse 0.3s ease' : 'none' }}>
                    {addedFeedback ? '✅ ¡Añadido!' : addingToCart ? '⏳...' : '🛒 Añadir al carrito'}
                  </button>
                </div>
              )}

              {/* Descripción */}
              {product.description && (
                <div style={{ padding: '16px 18px', borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Descripción</div>
                  <p style={{ lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>{product.description}</p>
                </div>
              )}

              {/* Specs */}
              {product.specs && Object.keys(product.specs).length > 0 && (
                <div style={{ padding: '16px 18px', borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Especificaciones</div>
                  <div style={{ display: 'grid', gap: 0 }}>
                    {Object.entries(product.specs).map(([key, value], i) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, padding: '9px 0', borderBottom: i < Object.keys(product.specs).length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize', fontWeight: 700 }}>{key}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendedor */}
              {product.seller && (
                <div style={{ padding: '14px 18px', borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', background: 'rgba(116,184,0,0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {product.seller.logo_url ? <img src={product.seller.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>🏪</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{product.seller.business_name}</div>
                    {product.seller.rating && <div style={{ fontSize: 11, color: '#74B800', marginTop: 2 }}>⭐ {product.seller.rating}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}