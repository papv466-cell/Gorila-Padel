import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toggleFavorite, addToCart } from '../services/store';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const [isFav, setIsFav] = useState(false);
  const [adding, setAdding] = useState(false);

  const discount = product.old_price 
    ? Math.round((1 - product.price / product.old_price) * 100)
    : 0;

  async function handleFavorite(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await toggleFavorite(product.id);
      setIsFav(result.action === 'added');
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (adding) return;
    
    setAdding(true);
    try {
      await addToCart(product.id, 1);
      // TODO: Mostrar toast "Añadido al carrito"
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => setAdding(false), 1000);
    }
  }

  return (
    <Link 
      to={`/store/product/${product.vendor.id}/${product.slug}`} 
      className="product-card"
    >
      <div className="product-image-container">
        <img 
          src={product.images[0] || '/placeholder-product.png'} 
          alt={product.name}
          className="product-image"
          loading="lazy"
        />
        
        {/* Badges */}
        <div className="product-badges">
          {product.gorila_approved && (
            <span className="badge gorila-badge">🦍 APPROVED</span>
          )}
          {discount > 0 && (
            <span className="badge discount-badge">-{discount}%</span>
          )}
          {product.stock < 5 && product.stock > 0 && (
            <span className="badge stock-badge">Últimas {product.stock}</span>
          )}
          {product.stock === 0 && (
            <span className="badge out-badge">Agotado</span>
          )}
        </div>

        {/* Actions overlay */}
        <div className="product-actions">
          <button 
            className={`action-btn favorite ${isFav ? 'active' : ''}`}
            onClick={handleFavorite}
            aria-label="Añadir a favoritos"
          >
            {isFav ? '❤️' : '🤍'}
          </button>
          {product.stock > 0 && (
            <button 
              className={`action-btn quick-add ${adding ? 'adding' : ''}`}
              onClick={handleQuickAdd}
              disabled={adding}
            >
              {adding ? '✓' : '🛒'}
            </button>
          )}
        </div>
      </div>

      <div className="product-info">
        {/* Vendor */}
        <div className="product-vendor">
          <span className="vendor-name">{product.vendor.shop_name}</span>
          {product.vendor.verified && (
            <span className="vendor-verified" title="Vendedor verificado">✓</span>
          )}
        </div>

        {/* Name */}
        <h3 className="product-name">{product.name}</h3>

        {/* Rating */}
        {product.total_reviews > 0 && (
          <div className="product-rating">
            <span className="rating-stars">
              {'⭐'.repeat(Math.round(product.rating))}
            </span>
            <span className="rating-count">({product.total_reviews})</span>
          </div>
        )}

        {/* Price */}
        <div className="product-price">
          <span className="price-current">{product.price}€</span>
          {product.old_price && (
            <span className="price-old">{product.old_price}€</span>
          )}
        </div>

        {/* Brand */}
        {product.brand && (
          <div className="product-brand">{product.brand}</div>
        )}
      </div>
    </Link>
  );
}