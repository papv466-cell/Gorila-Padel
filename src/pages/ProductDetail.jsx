// src/pages/ProductDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { addToCart } from '../services/store';
import { supabase } from '../services/supabaseClient';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [slug]);

  async function loadProduct() {
    try {
      setLoading(true);
      console.log('🔍 Buscando producto con slug:', slug);

      // Buscar SOLO por slug (no intentar como UUID - eso causaba el error 400)
      const { data, error } = await supabase
        .from('store_products')
        .select(`
          *,
          seller:store_sellers(
            id,
            business_name,
            logo_url,
            rating,
            description
          )
        `)
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error('Error Supabase:', error);
        setProduct(null);
        return;
      }

      if (!data) {
        console.warn('⚠️ No encontrado slug:', slug);
        setProduct(null);
        return;
      }

      setProduct(data);

      // Incrementar vistas
      await supabase
        .from('store_products')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', data.id);

    } catch (err) {
      console.error('Error:', err);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    try {
      setAddingToCart(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (confirm('Debes iniciar sesión. ¿Ir a login?')) {
          navigate('/login?redirect=' + window.location.pathname);
        }
        return;
      }
      // Usar directamente supabase en vez de addToCart del store
      const { data: existing } = await supabase
        .from('store_cart')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();
  
      if (existing) {
        await supabase.from('store_cart')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
      } else {
        await supabase.from('store_cart')
          .insert([{ user_id: user.id, product_id: product.id, quantity }]);
      }
  
      alert('✅ Producto añadido al carrito');
  
      // Recargar carrito en el contexto
      window.dispatchEvent(new Event('cart-updated'));
  
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
              <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando producto...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div className="container" style={{ maxWidth: 800, textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>😕</div>
            <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 10 }}>
              Producto no encontrado
            </h1>
            <p style={{ opacity: 0.75, marginBottom: 24 }}>
              Slug buscado: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 6 }}>{slug}</code>
            </p>
            <Link to="/tienda" className="btn">
              ← Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div className="container" style={{ maxWidth: 1200 }}>

          {/* Breadcrumb */}
          <div style={{ marginBottom: 20, fontSize: 13, opacity: 0.7 }}>
            <Link to="/tienda" style={{ color: 'inherit', textDecoration: 'none' }}>Tienda</Link>
            {' > '}
            <Link to={`/tienda?category=${product.category}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {product.category}
            </Link>
            {' > '}
            <span>{product.title}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 60 }}>

            {/* IMÁGENES */}
            <div>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 16,
                paddingTop: '100%',
                position: 'relative'
              }}>
                {images[selectedImage] ? (
                  <img
                    src={images[selectedImage]}
                    alt={product.title}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'grid', placeItems: 'center', fontSize: 80, opacity: 0.3
                  }}>📦</div>
                )}
              </div>

              {images.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 12 }}>
                  {images.map((img, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      style={{
                        paddingTop: '100%', position: 'relative',
                        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                        border: selectedImage === index ? '2px solid #74B800' : '2px solid rgba(255,255,255,0.12)',
                        opacity: selectedImage === index ? 1 : 0.6
                      }}
                    >
                      <img src={img} alt={`${product.title} ${index + 1}`}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* INFO Y COMPRA */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#74B800', marginBottom: 12 }}>
                {product.category}
              </div>

              <h1 style={{ fontSize: 32, fontWeight: 950, marginBottom: 16, lineHeight: 1.2 }}>
                {product.title}
              </h1>

              <div style={{ marginBottom: 20, opacity: 0.7, fontSize: 14 }}>
                Por <strong>{product.seller?.business_name}</strong>
              </div>

              {/* Precio */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 36, fontWeight: 950, color: '#74B800' }}>
                    €{product.price}
                  </div>
                  {hasDiscount && (
                    <>
                      <div style={{ fontSize: 20, opacity: 0.5, textDecoration: 'line-through' }}>
                        €{product.compare_at_price}
                      </div>
                      <div style={{ padding: '6px 10px', borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                        -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                      </div>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>IVA incluido • Envío calculado al finalizar compra</div>
              </div>

              {/* Stock */}
              <div style={{
                padding: 12, borderRadius: 12, marginBottom: 24,
                background: product.stock_quantity > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: product.stock_quantity > 0 ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)'
              }}>
                {product.stock_quantity > 0 ? (
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#22c55e' }}>
                    ✓ En stock ({product.stock_quantity} disponibles)
                  </div>
                ) : (
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#ef4444' }}>✕ Sin stock</div>
                )}
              </div>

              {/* Cantidad */}
              {product.stock_quantity > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>Cantidad</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}>
                      −
                    </button>
                    <div style={{ width: 60, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900 }}>
                      {quantity}
                    </div>
                    <button onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}>
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                <button className="btn" onClick={handleAddToCart}
                  disabled={product.stock_quantity === 0 || addingToCart}
                  style={{ flex: 1, background: '#74B800', fontSize: 16, padding: 16 }}>
                  {addingToCart ? '⏳ Añadiendo...' : '🛒 Añadir al carrito'}
                </button>
                <button className="btn ghost" style={{ width: 50, padding: 16 }}>♥</button>
              </div>

              {/* Descripción */}
              {product.description && (
                <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 950, marginBottom: 12 }}>Descripción</h3>
                  <p style={{ lineHeight: 1.6, opacity: 0.85, whiteSpace: 'pre-wrap' }}>{product.description}</p>
                </div>
              )}

              {/* Especificaciones */}
              {product.specs && Object.keys(product.specs).length > 0 && (
                <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 950, marginBottom: 12 }}>Especificaciones</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 13, opacity: 0.7, textTransform: 'capitalize' }}>{key}</div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{value}</div>
                      </div>
                    ))}
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