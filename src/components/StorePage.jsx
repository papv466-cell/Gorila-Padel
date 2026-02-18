import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getFeaturedProducts, 
  getGorilaApprovedProducts, 
  getBestSellers 
} from '../services/store';
import ProductCard from './ProductCard';
import './StorePage.css';

export default function StorePage() {
  const [featured, setFeatured] = useState([]);
  const [gorilaApproved, setGorilaApproved] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const [feat, approved, best] = await Promise.all([
        getFeaturedProducts(8),
        getGorilaApprovedProducts(8),
        getBestSellers(8)
      ]);
      setFeatured(feat);
      setGorilaApproved(approved);
      setBestSellers(best);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="store-page">
        <div className="store-loading">
          <div className="loading-spinner">🦍</div>
          <p>Cargando la jungla...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page">
      {/* Hero Banner */}
      <section className="store-hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              <span className="title-line">GORILA</span>
              <span className="title-line title-outline">STORE</span>
            </h1>
            <p className="hero-subtitle">
              El equipamiento que usan los que ganan.<br/>
              <span className="subtitle-accent">Los demás solo miran.</span>
            </p>
            <div className="hero-cta">
              <Link to="/store/palas" className="cta-primary">
                VER PALAS 🦍
              </Link>
              <Link to="/store/ofertas" className="cta-secondary">
                OFERTAS FLASH
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-glow"></div>
            <div className="hero-grid"></div>
          </div>
        </div>
      </section>

      {/* Categories Quick Nav */}
      <section className="store-categories">
        <Link to="/store/palas" className="category-card palas">
          <div className="category-icon">🏓</div>
          <div className="category-name">Palas</div>
          <div className="category-count">237 productos</div>
        </Link>
        <Link to="/store/ropa" className="category-card ropa">
          <div className="category-icon">👕</div>
          <div className="category-name">Ropa</div>
          <div className="category-count">189 productos</div>
        </Link>
        <Link to="/store/calzado" className="category-card calzado">
          <div className="category-icon">👟</div>
          <div className="category-name">Calzado</div>
          <div className="category-count">94 productos</div>
        </Link>
        <Link to="/store/accesorios" className="category-card accesorios">
          <div className="category-icon">🎒</div>
          <div className="category-name">Accesorios</div>
          <div className="category-count">312 productos</div>
        </Link>
        <Link to="/store/tech" className="category-card tech">
          <div className="category-icon">⌚</div>
          <div className="category-name">Tech</div>
          <div className="category-count">67 productos</div>
        </Link>
      </section>

      {/* Gorila Approved */}
      {gorilaApproved.length > 0 && (
        <section className="store-section gorila-section">
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-badge">
                <span className="badge-icon">🦍</span>
                <span className="badge-text">GORILA APPROVED</span>
              </div>
              <h2 className="section-title">Lo mejor de lo mejor</h2>
              <p className="section-subtitle">
                Probado, machacado y aprobado por los gorilas del club
              </p>
            </div>
            <Link to="/store/gorila-approved" className="section-link">
              Ver todos →
            </Link>
          </div>
          <div className="products-scroll">
            {gorilaApproved.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="store-section">
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-badge fire">
                <span className="badge-icon">🔥</span>
                <span className="badge-text">MÁS VENDIDOS</span>
              </div>
              <h2 className="section-title">Lo que están comprando</h2>
              <p className="section-subtitle">
                Esta semana en la jungla
              </p>
            </div>
            <Link to="/store/best-sellers" className="section-link">
              Ver todos →
            </Link>
          </div>
          <div className="products-scroll">
            {bestSellers.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="store-section">
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-badge star">
                <span className="badge-icon">⭐</span>
                <span className="badge-text">DESTACADOS</span>
              </div>
              <h2 className="section-title">Picks del mes</h2>
              <p className="section-subtitle">
                Los que van a arrasar este mes
              </p>
            </div>
            <Link to="/store/featured" className="section-link">
              Ver todos →
            </Link>
          </div>
          <div className="products-scroll">
            {featured.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="store-cta-banner">
        <div className="cta-content">
          <h3 className="cta-title">
            ¿Tienes una tienda de pádel?
          </h3>
          <p className="cta-text">
            Únete al marketplace y vende a miles de gorilas hambrientos de equipamiento
          </p>
          <Link to="/vendor/register" className="cta-button">
            VENDER EN GORILA STORE
          </Link>
        </div>
        <div className="cta-visual">
          <div className="cta-stats">
            <div className="stat">
              <div className="stat-number">15K+</div>
              <div className="stat-label">Usuarios activos</div>
            </div>
            <div className="stat">
              <div className="stat-number">500+</div>
              <div className="stat-label">Productos vendidos/mes</div>
            </div>
            <div className="stat">
              <div className="stat-number">4.8⭐</div>
              <div className="stat-label">Rating promedio</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}