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
  const [showFilters, setShowFilters] = useState(false);
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
    if (isMobile) setShowFilters(false);
  }

  const inputStyle = { width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, boxSizing: 'border-box' };

  const FiltersContent = () => (
    <>
      {/* Búsqueda */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Buscar</label>
        <input type="text" placeholder="Buscar productos..." value={search}
          onChange={e => updateFilter('search', e.target.value)} style={inputStyle} />
      </div>

      {/* Ordenar */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Ordenar por</label>
        <select value={sortBy} onChange={e => updateFilter('sort', e.target.value)} style={{ ...inputStyle, fontWeight: 900 }}>
          <option value="created_at">Más recientes</option>
          <option value="popular">Más vendidos</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>
      </div>

      {/* Categorías */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Categoría</label>
        {isMobile ? (
          // Móvil: chips horizontales scrollables
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[{ value: '', label: 'Todas' }, ...PRODUCT_CATEGORIES].map(cat => (
              <button key={cat.value} onClick={() => updateFilter('category', cat.value)} style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap',
                border: category === cat.value ? '1px solid #74B800' : '1px solid rgba(255,255,255,0.15)',
                background: category === cat.value ? 'rgba(116,184,0,0.15)' : 'rgba(255,255,255,0.04)',
                color: category === cat.value ? '#74B800' : '#fff',
              }}>{cat.label}</button>
            ))}
          </div>
        ) : (
          // Desktop: lista vertical
          <div style={{ display: 'grid', gap: 6 }}>
            {[{ value: '', label: 'Todas' }, ...PRODUCT_CATEGORIES].map(cat => (
              <button key={cat.value} onClick={() => updateFilter('category', cat.value)} style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 900, textAlign: 'left', cursor: 'pointer',
                border: category === cat.value ? '1px solid #74B800' : '1px solid rgba(255,255,255,0.12)',
                background: category === cat.value ? 'rgba(116,184,0,0.12)' : 'transparent',
                color: category === cat.value ? '#74B800' : '#fff',
              }}>{cat.label}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

          {/* HEADER */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 950, marginBottom: 4 }}>🛍️ Gorila Store</h1>
                <p style={{ opacity: 0.75, fontSize: 14 }}>Todo el equipamiento de pádel que necesitas</p>
              </div>
              <Link to="/vendedor/registro" className="btn" style={{ background: '#74B800', display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 13 : 15 }}>
                🏪 Vender en Gorila Store
              </Link>
            </div>

            {/* Botón filtros en móvil */}
            {isMobile && (
              <button onClick={() => setShowFilters(!showFilters)} style={{
                width: '100%', padding: '12px 16px', borderRadius: 12, marginBottom: 8,
                border: '1px solid rgba(255,255,255,0.15)', background: showFilters ? 'rgba(116,184,0,0.12)' : 'rgba(255,255,255,0.04)',
                color: showFilters ? '#74B800' : '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span>🔍 Filtros {category && `· ${PRODUCT_CATEGORIES.find(c => c.value === category)?.label}`}</span>
                <span>{showFilters ? '▲' : '▼'}</span>
              </button>
            )}

            {/* Panel filtros en móvil (desplegable) */}
            {isMobile && showFilters && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <FiltersContent />
              </div>
            )}
          </div>

          {/* LAYOUT */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 24 }}>

            {/* SIDEBAR - solo desktop */}
            {!isMobile && (
              <aside style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, height: 'fit-content', position: 'sticky', top: 80 }}>
                <h3 style={{ fontSize: 16, fontWeight: 950, marginBottom: 16 }}>Filtros</h3>
                <FiltersContent />
              </aside>
            )}

            {/* PRODUCTOS */}
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
                  <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando productos...</div>
                </div>
              ) : products.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 50, marginBottom: 16 }}>🔍</div>
                  <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>No se encontraron productos</h2>
                  <p style={{ opacity: 0.75, marginBottom: 16 }}>Intenta con otros filtros</p>
                  <button className="btn ghost" onClick={() => setSearchParams({})}>Limpiar filtros</button>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: isMobile ? 12 : 20
                  }}>
                    {products.map(product => (
                      <Link key={product.id} to={`/tienda/producto/${product.slug || product.id}`}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                        {/* Imagen */}
                        <div style={{ paddingTop: '100%', position: 'relative', background: 'rgba(0,0,0,0.2)' }}>
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt={product.title}
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 50, opacity: 0.3 }}>📦</div>
                          )}
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <div style={{ position: 'absolute', top: 8, right: 8, padding: '4px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                              -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{ padding: isMobile ? 10 : 14 }}>
                          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 950, color: '#fff', marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {product.title}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, textTransform: 'uppercase', fontWeight: 900 }}>
                            {product.seller?.business_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 950, color: '#74B800' }}>€{product.price}</div>
                            {product.compare_at_price && product.compare_at_price > product.price && (
                              <div style={{ fontSize: 12, opacity: 0.5, textDecoration: 'line-through' }}>€{product.compare_at_price}</div>
                            )}
                          </div>
                          {product.sales > 0 && (
                            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{product.sales} vendidos</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* PAGINACIÓN */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 32 }}>
                      <button className="btn ghost" onClick={() => updateFilter('page', Math.max(1, page - 1))} disabled={page === 1}>← Anterior</button>
                      <div style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', fontWeight: 900 }}>{page} / {totalPages}</div>
                      <button className="btn ghost" onClick={() => updateFilter('page', Math.min(totalPages, page + 1))} disabled={page === totalPages}>Siguiente →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}