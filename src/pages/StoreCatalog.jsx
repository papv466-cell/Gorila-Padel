// src/pages/StoreCatalog.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProducts, PRODUCT_CATEGORIES } from '../services/store';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function StoreCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const isMobile = useIsMobile();

  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'created_at';

  useEffect(() => { loadProducts(); }, [page, category, search, sortBy]);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await getProducts({ page, category, search, sortBy });
      setProducts(data.products);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  }

  const allCategories = [{ value: '', label: '⚡ Todo' }, ...PRODUCT_CATEGORIES];

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @keyframes gsCardIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gsShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .gsProductCard { transition: transform .2s, box-shadow .2s; cursor: pointer; }
        .gsProductCard:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important; }
        .gsProductCard:hover .gsProductImg { transform: scale(1.05); }
        .gsProductImg { transition: transform .4s cubic-bezier(.4,0,.2,1); }
        .gsCatPill { transition: all .15s; cursor: pointer; border: none; }
        .gsCatPill:hover { opacity: 1 !important; }
        .gsSearchInput { outline: none; }
        .gsSearchInput:focus { border-color: rgba(116,184,0,0.6) !important; box-shadow: 0 0 0 3px rgba(116,184,0,0.15) !important; }
        .gsSortBtn { transition: all .15s; }
        .gsSortBtn:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>

      <div className="pageWrap">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 12px 40px' : '0 24px 60px' }}>

          {/* ── HERO BANNER ── */}
          <div style={{ margin: isMobile ? '12px 0 20px' : '20px 0 28px', borderRadius: 20, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #0d1a00 0%, #1a3300 50%, #0d1a00 100%)', border: '1px solid rgba(116,184,0,0.2)', minHeight: isMobile ? 120 : 160 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(116,184,0,0.15), transparent 60%)' }} />
            <div style={{ position: 'absolute', top: -20, right: -20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(116,184,0,0.04)', border: '1px solid rgba(116,184,0,0.1)' }} />
            <div style={{ position: 'absolute', top: 10, right: 40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(116,184,0,0.03)', border: '1px solid rgba(116,184,0,0.08)' }} />
            <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '20px 16px' : '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, color: '#74B800', marginBottom: 6 }}>⚡ Gorila Store</div>
                <h1 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1, letterSpacing: -0.5 }}>
                  Equípate como<br />
                  <span style={{ color: '#74B800' }}>un Gorila</span>
                </h1>
                <div style={{ fontSize: isMobile ? 11 : 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  Palas, ropa y accesorios de pádel
                </div>
              </div>
              <Link to="/vendedor/registro" style={{ padding: isMobile ? '8px 12px' : '10px 18px', borderRadius: 12, background: 'rgba(116,184,0,0.15)', border: '1px solid rgba(116,184,0,0.3)', color: '#74B800', fontWeight: 900, fontSize: isMobile ? 11 : 13, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                🏪 Vender
              </Link>
            </div>
          </div>

          {/* ── BÚSQUEDA ── */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
            <input
              className="gsSearchInput"
              type="text"
              placeholder="Buscar palas, zapatillas, ropa..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', transition: 'all .2s' }}
            />
          </div>

          {/* ── CATEGORÍAS PILLS ── */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {allCategories.map(cat => (
              <button key={cat.value} className="gsCatPill"
                onClick={() => updateFilter('category', cat.value)}
                style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', background: category === cat.value ? '#74B800' : 'rgba(255,255,255,0.08)', color: category === cat.value ? '#000' : 'rgba(255,255,255,0.7)', border: 'none', boxShadow: category === cat.value ? '0 4px 12px rgba(116,184,0,0.3)' : 'none', opacity: category === cat.value ? 1 : 0.8 }}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* ── TOOLBAR ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              {loading ? '...' : `${products.length} producto${products.length !== 1 ? 's' : ''}`}
              {category && ` · ${PRODUCT_CATEGORIES.find(c => c.value === category)?.label || category}`}
            </div>
            <select value={sortBy} onChange={e => updateFilter('sort', e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              <option value="created_at" style={{ background: '#1a1a1a' }}>Más recientes</option>
              <option value="popular" style={{ background: '#1a1a1a' }}>Más vendidos</option>
              <option value="price_asc" style={{ background: '#1a1a1a' }}>Precio: menor a mayor</option>
              <option value="price_desc" style={{ background: '#1a1a1a' }}>Precio: mayor a menor</option>
            </select>
          </div>

          {/* ── GRID PRODUCTOS ── */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(220px,1fr))', gap: isMobile ? 10 : 16 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ paddingTop: '100%', background: 'linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%)', backgroundSize: '200% auto', animation: 'gsShimmer 1.5s linear infinite' }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ height: 14, borderRadius: 6, background: '#1a1a1a', marginBottom: 8 }} />
                    <div style={{ height: 10, borderRadius: 6, background: '#1a1a1a', width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Sin resultados</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Prueba con otros filtros</div>
              <button onClick={() => setSearchParams({})}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(116,184,0,0.15)', border: '1px solid rgba(116,184,0,0.3)', color: '#74B800', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(220px,1fr))', gap: isMobile ? 10 : 16 }}>
                {products.map((product, idx) => {
                  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
                  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;
                  return (
                    <Link key={product.id} to={`/tienda/producto/${product.slug || product.id}`}
                      className="gsProductCard"
                      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', display: 'block', animation: `gsCardIn 0.3s ease ${idx * 0.04}s both` }}>

                      {/* Imagen */}
                      <div style={{ paddingTop: '100%', position: 'relative', background: '#0d0d0d', overflow: 'hidden' }}>
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.title} className="gsProductImg"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                            <span style={{ fontSize: 48, opacity: 0.15 }}>🏓</span>
                          </div>
                        )}
                        {/* Badge descuento */}
                        {hasDiscount && (
                          <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                            -{discountPct}%
                          </div>
                        )}
                        {/* Badge nuevo */}
                        {!hasDiscount && idx < 3 && (
                          <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 6, background: 'rgba(116,184,0,0.9)', color: '#000', fontSize: 10, fontWeight: 900 }}>
                            NUEVO
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: isMobile ? '10px 10px 12px' : '12px 14px 14px' }}>
                        {product.seller?.business_name && (
                          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                            {product.seller.business_name}
                          </div>
                        )}
                        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {product.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: '#74B800' }}>€{product.price}</span>
                            {hasDiscount && (
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>€{product.compare_at_price}</span>
                            )}
                          </div>
                          {product.sales > 0 && (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>{product.sales} vendidos</span>
                          )}
                        </div>
                        {/* Stock bajo */}
                        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, color: '#f59e0b' }}>
                            ⚡ Solo {product.stock_quantity} left
                          </div>
                        )}
                        {product.stock_quantity === 0 && (
                          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, color: '#ef4444' }}>
                            ✕ Agotado
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                  <button onClick={() => updateFilter('page', Math.max(1, page - 1))} disabled={page === 1}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: page === 1 ? 'rgba(255,255,255,0.2)' : '#fff', fontWeight: 800, fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                    ← Anterior
                  </button>
                  <div style={{ padding: '10px 18px', borderRadius: 10, background: '#74B800', color: '#000', fontWeight: 900, fontSize: 13 }}>
                    {page} / {totalPages}
                  </div>
                  <button onClick={() => updateFilter('page', Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: page === totalPages ? 'rgba(255,255,255,0.2)' : '#fff', fontWeight: 800, fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}