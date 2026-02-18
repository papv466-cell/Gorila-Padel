// src/contexts/CartContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) loadCart(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        loadCart(currentUser.id);
      } else {
        setItems([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadCart(userId) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('store_cart')
        .select(`
          id,
          user_id,
          product_id,
          quantity,
          created_at,
          product:store_products(
            id,
            title,
            price,
            images,
            slug,
            stock_quantity,
            seller:store_sellers(
              id,
              business_name
            )
          )
        `)
        .eq('user_id', userId);

      if (error) { console.error('Error cargando carrito:', error); setItems([]); return; }
      setItems(data || []);
    } catch (err) {
      console.error('Error loadCart:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(productId, quantity = 1) {
    if (!user) throw new Error('Debes iniciar sesión');
    const { data: existing } = await supabase
      .from('store_cart').select('*')
      .eq('user_id', user.id).eq('product_id', productId).maybeSingle();

    if (existing) {
      const { error } = await supabase.from('store_cart')
        .update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('store_cart')
        .insert([{ user_id: user.id, product_id: productId, quantity }]);
      if (error) throw error;
    }
    await loadCart(user.id);
  }

  async function updateQuantity(cartItemId, quantity) {
    if (!user) return;
    if (quantity <= 0) return await removeItem(cartItemId);
    const { error } = await supabase.from('store_cart')
      .update({ quantity }).eq('id', cartItemId).eq('user_id', user.id);
    if (error) throw error;
    await loadCart(user.id);
  }

  async function removeItem(cartItemId) {
    if (!user) return;
    const { error } = await supabase.from('store_cart')
      .delete().eq('id', cartItemId).eq('user_id', user.id);
    if (error) throw error;
    await loadCart(user.id);
  }

  async function clearCart() {
    if (!user) return;
    const { error } = await supabase.from('store_cart').delete().eq('user_id', user.id);
    if (error) throw error;
    setItems([]);
  }

  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => {
    return sum + ((item.product?.price || 0) * (item.quantity || 0));
  }, 0);

  return (
    <CartContext.Provider value={{
      items, loading, totalItems, subtotal,
      addItem, updateQuantity, removeItem, clearCart,
      loadCart: () => user && loadCart(user.id)
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}