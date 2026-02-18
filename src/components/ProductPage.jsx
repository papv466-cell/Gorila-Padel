import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { getProduct, getProductReviews, toggleFavorite, isFavorite } from '../services/store';
import './ProductPage.css';

export default function ProductPage() {
  const { vendorSlug, productSlug } = useParams();
  const { addItem } = useCart();
  
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [vendorSlug, productSlug]);

  async function loadProduct() {
    try {
      const prod = await getProduct(productSlug, vendorSlug);
      setProduct(prod);
      setCurrentImage(0);

      const [revs, fav] = await Promise.all([
        getProductReviews(prod.id, 10),
        isFavorite(prod.id)
      ]);
      setReviews(revs);
      setFavorite(fav);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    if (adding || !product) return;
    setAdding(true);
    try {
      await addItem(product.id, quantity);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => setAdding(false), 1000);
    }
  }

  async function handleFavorite() {
    try {
      const result = await toggleFavorite(product.id);
      setFavorite(result.action === 'added');
    } catch (error) {
      console.error('Error:', error);
    }
  }

  if (loading) {
    return (
      <div className="product-page">
        <div className="product-loading">
          <div className="loading-spinner">🦍</div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-page">
        <div className="product-not-found">
          <h2>Producto no encontrado</h2>
          <Link to="/store">← Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  const discount = product.old_price 
    ? Math.round((1 - product.price / product.old_price) * 100)
    : 0;

  return (
    <div className="product-page">
      <div className="product-container">
        {/* Breadcrumb */}
        <nav className="product-breadcrumb">
          <Link to="/store">Tienda</Link>
          <span>/</span>
          <Link to={`/store/${product.category}`}>{product.category}</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        {/* Main Product */}
        <div className="product-main">
          {/* Gallery */}
          <div className="product-gallery">
            <div className="gallery-main">
              <img 
                src={product.images[currentImage] || '/placeholder.png'} 
                alt={product.name}
                className="main-image"
              />
              {product.gorila_approved && (
                <div className="gorila-badge-overlay">
                  🦍 APPROVED
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="gallery-thumbs">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    className={`thumb ${i === currentImage ? 'active' : ''}`}
                    onClick={() => setCurrentImage(i)}
                  >
                    <img src={img} alt={`${product.name} ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="product-info-main">
            {/* Vendor */}
            <div className="vendor-info">
              <span className="vendor-label">Vendido por</span>
              <Link to={`/store/vendor/${product.vendor.slug}`} className="vendor-link">
                {product.vendor.shop_name}
                {product.vendor.verified && (
                  <span className="verified-badge">✓ Verificado</span>
                )}
              </Link>
              <div className="vendor-rating">
                ⭐ {product.vendor.rating.toFixed(1)} ({product.vendor.total_reviews} reviews)
              </div>
            </div>

            {/* Title */}
            <h1 className="product-title">{product.name}</h1>

            {/* Brand */}
            {product.brand && (
              <div className="product-brand-tag">{product.brand}</div>
            )}

            {/* Rating */}
            {product.total_reviews > 0 && (
              <div className="product-rating-main">
                <div className="rating-stars">
                  {'⭐'.repeat(Math.round(product.rating))}
                </div>
                <span className="rating-value">{product.rating.toFixed(1)}</span>
                <span className="rating-count">({product.total_reviews} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="product-pricing">
              <div className="price-main">{product.price}€</div>
              {product.old_price && (
                <>
                  <div className="price-old">{product.old_price}€</div>
                  <div className="price-discount">-{discount}% OFF</div>
                </>
              )}
            </div>

            {/* Stock */}
            <div className="product-stock">
              {product.stock > 0 ? (
                <>
                  <span className="stock-available">✓ En stock</span>
                  {product.stock < 10 && (
                    <span className="stock-warning">
                      ⚠️ Solo quedan {product.stock} unidades
                    </span>
                  )}
                </>
              ) : (
                <span className="stock-out">✗ Agotado</span>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            {product.stock > 0 && (
              <div className="product-actions">
                <div className="quantity-selector">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button 
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
                <button 
                  className={`btn-add-cart ${adding ? 'adding' : ''}`}
                  onClick={handleAddToCart}
                  disabled={adding}
                >
                  {adding ? '✓ AÑADIDO' : '🛒 AÑADIR AL CARRITO'}
                </button>
                <button 
                  className={`btn-favorite ${favorite ? 'active' : ''}`}
                  onClick={handleFavorite}
                >
                  {favorite ? '❤️' : '🤍'}
                </button>
              </div>
            )}

            {/* Features */}
            <div className="product-features">
              <div className="feature">
                <span className="feature-icon">🚚</span>
                <span className="feature-text">Envío gratis -50€</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📦</span>
                <span className="feature-text">Entrega 24-48h</span>
              </div>
              <div className="feature">
                <span className="feature-icon">↩️</span>
                <span className="feature-text">Devolución gratis 14 días</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="product-tabs">
          <div className="tab-content">
            <h3>Descripción</h3>
            <div className="description">
              {product.description || 'Sin descripción disponible.'}
            </div>

            {product.specs && Object.keys(product.specs).length > 0 && (
              <>
                <h3>Especificaciones</h3>
                <div className="specs-grid">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div key={key} className="spec-item">
                      <span className="spec-label">{key}:</span>
                      <span className="spec-value">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3>Reviews ({reviews.length})</h3>
            <div className="reviews-list">
              {reviews.length === 0 ? (
                <p className="no-reviews">
                  Sé el primero en dejar un review canalla 🦍
                </p>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="review-item">
                    <div className="review-header">
                      <div className="review-user">
                        <div className="user-avatar">
                          {review.user.full_name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="user-name">{review.user.full_name || 'Usuario'}</div>
                          <div className="review-stars">
                            {'⭐'.repeat(review.rating)}
                          </div>
                        </div>
                      </div>
                      <div className="review-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {review.title && (
                      <h4 className="review-title">{review.title}</h4>
                    )}
                    <p className="review-comment">{review.comment}</p>
                    {review.verified_purchase && (
                      <span className="verified-purchase">✓ Compra verificada</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}