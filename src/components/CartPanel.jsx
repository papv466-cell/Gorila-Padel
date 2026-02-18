import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import './CartPanel.css';

export default function CartPanel() {
  const { cart, isOpen, setIsOpen, totalItems, subtotal, updateQuantity, removeItem } = useCart();

  if (!isOpen) return null;

  return (
    <>
      <div className="cart-overlay" onClick={() => setIsOpen(false)} />
      <div className="cart-panel">
        <div className="cart-header">
          <h2>
            Tu Carrito 
            {totalItems > 0 && <span className="cart-count">({totalItems})</span>}
          </h2>
          <button className="cart-close" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-icon">🛒</div>
            <p className="empty-title">El carrito más vacío que</p>
            <p className="empty-subtitle">la excusa de tu compañero cuando perdéis 😂</p>
            <Link 
              to="/store" 
              className="btn-continue-shopping"
              onClick={() => setIsOpen(false)}
            >
              IR DE COMPRAS 🦍
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <Link 
                    to={`/store/product/${item.vendor.id}/${item.product.slug}`}
                    className="item-image"
                    onClick={() => setIsOpen(false)}
                  >
                    <img 
                      src={item.product.images[0] || '/placeholder.png'} 
                      alt={item.product.name}
                    />
                  </Link>

                  <div className="item-details">
                    <Link 
                      to={`/store/product/${item.vendor.id}/${item.product.slug}`}
                      className="item-name"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.product.name}
                    </Link>
                    <div className="item-vendor">{item.vendor.shop_name}</div>
                    <div className="item-price">{item.product.price}€</div>
                  </div>

                  <div className="item-actions">
                    <div className="item-quantity">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                      >
                        +
                      </button>
                    </div>
                    <button 
                      className="item-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-subtotal">
                <span>Subtotal:</span>
                <span className="subtotal-amount">{subtotal.toFixed(2)}€</span>
              </div>
              {subtotal < 50 && (
                <div className="shipping-notice">
                  Añade {(50 - subtotal).toFixed(2)}€ más para envío gratis 🚚
                </div>
              )}
              <div className="cart-actions">
                <Link 
                  to="/cart" 
                  className="btn-view-cart"
                  onClick={() => setIsOpen(false)}
                >
                  VER CARRITO
                </Link>
                <Link 
                  to="/checkout" 
                  className="btn-checkout"
                  onClick={() => setIsOpen(false)}
                >
                  💳 PAGAR AHORA
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}