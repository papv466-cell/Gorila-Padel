// src/pages/SellerProducts.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SellerLayout from '../components/SellerLayout';
import { getMyProducts, deleteProduct } from '../services/store';

export default function SellerProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadProducts();
  }, [page, search, category]);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await getMyProducts({ page, search, category });
      setProducts(data.products);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId, productTitle) {
    if (!confirm(`¿Eliminar "${productTitle}"?`)) return;

    try {
      await deleteProduct(productId);
      loadProducts();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  }

  return (
    <SellerLayout>
      
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        gap: 20,
        flexWrap: 'wrap'
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 8 }}>
            Mis Productos
          </h1>
          <p style={{ opacity: 0.75, fontSize: 14 }}>
            Gestiona tu catálogo de productos
          </p>
        </div>

        <button
          className="btn"
          onClick={() => navigate('/vendedor/productos/nuevo')}
          style={{
            background: '#74B800',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>➕</span>
          Añadir Producto
        </button>
      </div>

      {/* FILTROS */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14
            }}
          />

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              minWidth: 180
            }}
          >
            <option value="">Todas las categorías</option>
            <option value="palas">Palas</option>
            <option value="ropa">Ropa</option>
            <option value="calzado">Calzado</option>
            <option value="pelotas">Pelotas</option>
            <option value="accesorios">Accesorios</option>
          </select>
        </div>
      </div>

      {/* LISTA DE PRODUCTOS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando productos...</div>
        </div>
      ) : products.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 60,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>📦</div>
          <h2 style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>
            No tienes productos
          </h2>
          <p style={{ opacity: 0.75, marginBottom: 24 }}>
            Añade tu primer producto para empezar a vender
          </p>
          <button
            className="btn"
            onClick={() => navigate('/vendedor/productos/nuevo')}
            style={{ background: '#74B800' }}
          >
            Añadir Producto
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            {products.map(product => (
              <div
                key={product.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr auto',
                  gap: 20,
                  alignItems: 'center'
                }}
              >
                {/* IMAGEN */}
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/vendedor/productos/${product.id}`)}
                >
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 48, opacity: 0.3 }}>📦</span>
                  )}
                </div>

                {/* INFO */}
                <div>
                  <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 6 }}>
                    {product.title}
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                    {product.category}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 14, fontWeight: 800 }}>
                    <span style={{ color: '#74B800' }}>€{product.price}</span>
                    <span style={{ opacity: 0.7 }}>Stock: {product.stock_quantity}</span>
                    <span style={{ opacity: 0.7 }}>Ventas: {product.sales || 0}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {product.is_active ? (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 900,
                        background: 'rgba(34,197,94,0.12)',
                        color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.25)'
                      }}>
                        ✓ ACTIVO
                      </span>
                    ) : (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 900,
                        background: 'rgba(156,163,175,0.12)',
                        color: '#9ca3af',
                        border: '1px solid rgba(156,163,175,0.25)'
                      }}>
                        ⏸ INACTIVO
                      </span>
                    )}
                  </div>
                </div>

                {/* ACCIONES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn ghost"
                    onClick={() => navigate(`/vendedor/productos/${product.id}`)}
                    style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => navigate(`/tienda/producto/${product.slug}`)}
                    style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    👁️ Ver
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => handleDelete(product.id, product.title)}
                    style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PAGINACIÓN */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              marginTop: 30
            }}>
              <button
                className="btn ghost"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Anterior
              </button>
              <span style={{
                padding: '10px 20px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                fontWeight: 900
              }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </SellerLayout>
  );
}