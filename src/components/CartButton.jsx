import { useCart } from '../contexts/CartContext';
import './CartButton.css';

export default function CartButton() {
  const { totalItems, setIsOpen } = useCart();

  return (
    <button 
      className="cart-button-float"
      onClick={() => setIsOpen(true)}
      aria-label="Abrir carrito"
    >
      <span className="cart-icon">🛒</span>
      {totalItems > 0 && (
        <span className="cart-badge">{totalItems}</span>
      )}
    </button>
  );
}
