import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getProducts } from '../services/store';
import ProductCard from './ProductCard';
import './CategoryPage.css';

const CATEGORIES = {
  palas: { name: 'Palas', icon: '🏓', description: 'Pa\' machacar rivales' },
  ropa: { name: 'Ropa', icon: '👕', description: 'Suda con estilo' },
  calzado: { name: 'Calzado', icon: '👟', description: 'Pisa fuerte' },
  accesorios: { name: 'Accesorios', icon: '🎒', description: 'Los detalles que marcan' },
  tech: { name: 'Tech', icon: '⌚', description: 'Monitoriza tu juego' }
};

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Más recientes' },
  { value: 'price:asc', label: 'Precio: Bajo a Alto' },
  { value: 'price:desc', label: 'Precio: Alto a Bajo' },
  { value: 'rating:desc', label: 'Mejor valorados' },
  { value: 'sales:desc', label: 'Más vendidos' }
];

export default function CategoryPage() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [sortBy, setSortBy] = useState('created_at:desc');

  const categoryInfo = CATEGORIES[category] || { name: category, icon: '🛍️', description: '' };

  useEffect(() => {
    loadProducts();
  }, [category, sortBy, minPrice, maxPrice, selectedBrands]);

  async function loadProducts() {
    setLoading(true);
    try {
      const [field, order] = sortBy.split(':');
      const data = await getProducts({
        category,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        brand: selectedBrands.length > 0 ? selectedBrands[0] : null, // TODO: Support multiple
        sortBy: field,
        sortOrder: order,
        limit: 50
      });
      setProducts(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleBrand(brand) {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  }

  function clearFilters() {
    setMinPrice('');
    setMaxPrice('');
    setSelectedBrands([]);
    setSortBy('created_at:desc');
  }

  // Get unique brands from products
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];

  const activeFiltersCount = 
    (minPrice ? 1 : 0) + 
    (maxPrice ? 1 : 0) + 
    selectedBrands.length;

  return (
    <div className="category-page">
      {/* Header */}
      <div className="category-header">
        <div className="category-title-group">
          <span className="category-icon">{categoryInfo.icon}</span>
          <div>
            <h1 className="category-title">{categoryInfo.name}</h1>
            <p className="category-description">{categoryInfo.description}</p>
          </div>
        </div>
        <div className="category-meta">
          <span className="product-count">{products.length} productos</span>
        </div>
      </div>

      <div className="category-content">
        {/* Filters Sidebar */}
        <aside className={`filters-sidebar ${showFilters ? 'active' : ''}`}>
          <div className="filters-header">
            <h3>Filtros</h3>
            {activeFiltersCount > 0 && (
              <button className="clear-filters" onClick={clearFilters}>
                Limpiar ({activeFiltersCount})
              </button>
            )}
            <button 
              className="close-filters-mobile"
              onClick={() => setShowFilters(false)}
            >
              ✕
            </button>
          </div>

          {/* Price Range */}
          <div className="filter-section">
            <h4 className="filter-title">Precio</h4>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="price-input"
              />
              <span>—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="price-input"
              />
            </div>
          </div>

          {/* Brands */}
          {brands.length > 0 && (
            <div className="filter-section">
              <h4 className="filter-title">Marca</h4>
              <div className="filter-options">
                {brands.map(brand => (
                  <label key={brand} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() => toggleBrand(brand)}
                    />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          {/* Toolbar */}
          <div className="products-toolbar">
            <button 
              className="filters-toggle-mobile"
              onClick={() => setShowFilters(!showFilters)}
            >
              <span>🔧</span>
              Filtros
              {activeFiltersCount > 0 && (
                <span className="filter-badge">{activeFiltersCount}</span>
              )}
            </button>

            <div className="sort-select-wrapper">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Products */}
          {loading ? (
            <div className="products-loading">
              <div className="loading-spinner">🦍</div>
              <p>Buscando productos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="products-empty">
              <p>No hay productos que coincidan con tus filtros</p>
              <button onClick={clearFilters} className="btn-clear">
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile filters overlay */}
      {showFilters && (
        <div 
          className="filters-overlay-mobile"
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}