// src/pages/SellerProductForm.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SellerLayout from '../components/SellerLayout';
import {
  createProduct,
  updateProduct,
  getMyProduct,
  uploadProductImage,
  PRODUCT_CATEGORIES
} from '../services/store';

export default function SellerProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'palas',
    subcategory: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '',
    sku: '',
    images: [],
    tags: '',
    isActive: true,
    specs: {
      peso: '',
      balance: '',
      forma: '',
      material: '',
      marca: ''
    }
  });

  useEffect(() => {
    if (isEdit) {
      loadProduct();
    }
  }, [id]);

  async function loadProduct() {
    try {
      setLoading(true);
      const product = await getMyProduct(id);
      
      setFormData({
        title: product.title || '',
        description: product.description || '',
        category: product.category || 'palas',
        subcategory: product.subcategory || '',
        price: product.price || '',
        compareAtPrice: product.compare_at_price || '',
        stockQuantity: product.stock_quantity || '',
        sku: product.sku || '',
        images: product.images || [],
        tags: (product.tags || []).join(', '),
        isActive: product.is_active,
        specs: product.specs || {}
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        uploadProductImage(file, id || 'temp-' + Date.now())
      );
      
      const uploadedUrls = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
    } catch (err) {
      alert('Error al subir imágenes: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index) {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validaciones
      if (!formData.title.trim()) {
        throw new Error('El título es obligatorio');
      }
      if (!formData.price || parseFloat(formData.price) <= 0) {
        throw new Error('El precio debe ser mayor a 0');
      }

      const productData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory?.trim() || '',
        price: parseFloat(formData.price),
        compare_at_price: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : null,
        stock_quantity: parseInt(formData.stockQuantity) || 0,
        sku: formData.sku?.trim() || '',
        images: formData.images || [],
        tags: (formData.tags || '').split(',').map(t => t.trim()).filter(Boolean),
        is_active: formData.isActive,
        specs: Object.fromEntries(
          Object.entries(formData.specs || {}).filter(([_, v]) => v)
        )
      };

      if (isEdit) {
        await updateProduct(id, productData);
        alert('✅ Producto actualizado correctamente');
      } else {
        await createProduct(productData);
        alert('✅ Producto creado correctamente');
      }

      navigate('/vendedor/productos');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  }

  if (loading && isEdit) {
    return (
      <SellerLayout>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando producto...</div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      
      {/* HEADER */}
      <div style={{ marginBottom: 30 }}>
        <button
          className="btn ghost"
          onClick={() => navigate('/vendedor/productos')}
          style={{ marginBottom: 16, padding: '8px 12px' }}
        >
          ← Volver a productos
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 8 }}>
          {isEdit ? 'Editar Producto' : 'Añadir Producto'}
        </h1>
        <p style={{ opacity: 0.75, fontSize: 14 }}>
          {isEdit ? 'Actualiza la información del producto' : 'Completa los datos del nuevo producto'}
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444',
          marginBottom: 20,
          fontWeight: 800
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        {/* INFORMACIÓN BÁSICA */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 20
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 20 }}>
            📝 Información Básica
          </h2>

          {/* Título */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
              Título del Producto *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Pala Bullpadel Vertex 03 2024"
              required
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 15
              }}
            />
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe las características, materiales, beneficios..."
              rows={6}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 15,
                resize: 'vertical',
                lineHeight: 1.6
              }}
            />
          </div>

          {/* Categoría y Subcategoría */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                Categoría *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              >
                {PRODUCT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                Subcategoría
              </label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="Ej: Palas de control"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
              Etiquetas (separadas por comas)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="bullpadel, vertex, fibra de carbono"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 15
              }}
            />
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              Ayuda a los usuarios a encontrar tu producto
            </div>
          </div>
        </div>

        {/* PRECIO E INVENTARIO */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 20
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 20 }}>
            💰 Precio e Inventario
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Precio */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                Precio (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="149.99"
                required
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              />
            </div>

            {/* Precio Comparación */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                Precio Antes (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.compareAtPrice}
                onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                placeholder="199.99"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              />
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                Para mostrar descuentos
              </div>
            </div>

            {/* Stock */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                Stock Disponible
              </label>
              <input
                type="number"
                min="0"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                placeholder="10"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              />
            </div>

            {/* SKU */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                SKU / Referencia
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="VTX-03-2024"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 15
                }}
              />
            </div>
          </div>
        </div>

        {/* ESPECIFICACIONES (solo para palas) */}
        {formData.category === 'palas' && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 20
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 20 }}>
              ⚙️ Especificaciones Técnicas
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                  Peso (g)
                </label>
                <input
                  type="text"
                  value={formData.specs.peso || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, peso: e.target.value }
                  })}
                  placeholder="365"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: 15
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                  Balance
                </label>
                <input
                  type="text"
                  value={formData.specs.balance || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, balance: e.target.value }
                  })}
                  placeholder="Medio"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: 15
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                  Forma
                </label>
                <input
                  type="text"
                  value={formData.specs.forma || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, forma: e.target.value }
                  })}
                  placeholder="Diamante"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: 15
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                  Material
                </label>
                <input
                  type="text"
                  value={formData.specs.material || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, material: e.target.value }
                  })}
                  placeholder="Fibra de Carbono"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: 15
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 8, fontSize: 14 }}>
                  Marca
                </label>
                <input
                  type="text"
                  value={formData.specs.marca || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, marca: e.target.value }
                  })}
                  placeholder="Bullpadel"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: 15
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* IMÁGENES */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 20
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 20 }}>
            📸 Imágenes del Producto
          </h2>

          {/* Galería de imágenes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
            marginBottom: 16
          }}>
            {formData.images.map((url, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  paddingTop: '100%',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.2)'
                }}
              >
                <img
                  src={url}
                  alt={`Producto ${index + 1}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(239,68,68,0.95)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 900
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Botón añadir imagen */}
            <label style={{
              paddingTop: '100%',
              position: 'relative',
              borderRadius: 12,
              border: '2px dashed rgba(255,255,255,0.25)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              ':hover': { borderColor: '#74B800' }
            }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 32,
                opacity: uploading ? 0.3 : 0.6
              }}>
                {uploading ? '⏳' : '➕'}
              </div>
            </label>
          </div>

          <div style={{ fontSize: 13, opacity: 0.7 }}>
            💡 Añade hasta 10 imágenes. La primera será la imagen principal.
          </div>
        </div>

        {/* ESTADO */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 20
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              style={{
                width: 20,
                height: 20,
                cursor: 'pointer'
              }}
            />
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Publicar producto
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                El producto será visible en la tienda
              </div>
            </div>
          </label>
        </div>

        {/* BOTONES */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigate('/vendedor/productos')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn"
            disabled={loading || uploading}
            style={{
              flex: 1,
              background: '#74B800'
            }}
          >
            {loading ? '⏳ Guardando...' : (isEdit ? '✓ Actualizar Producto' : '✓ Crear Producto')}
          </button>
        </div>
      </form>
    </SellerLayout>
  );
}