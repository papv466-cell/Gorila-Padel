// src/components/UI/CartFloatingButton.jsx
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

export default function CartFloatingButton() {
  const { totalItems } = useCart();
  const location = useLocation();

  // No mostrar en el carrito ni en checkout
  const hideOn = ['/tienda/carrito', '/tienda/checkout', '/tienda/pedido-confirmado'];
  if (hideOn.includes(location.pathname)) return null;

  // No mostrar si no hay items
  if (totalItems === 0) return null;

  return (
    <Link
      to="/tienda/carrito"
      className="cartFloatingBtn"
    >
      🛒
      {totalItems > 0 && (
        <div className="cartFloatingBadge">
          {totalItems > 9 ? '9+' : totalItems}
        </div>
      )}
    </Link>
  );
}