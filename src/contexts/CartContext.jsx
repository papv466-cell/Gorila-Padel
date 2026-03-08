// src/contexts/CartContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        userIdRef.current = user.id;
        setUser(user);
        loadCart(user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      const currentId = currentUser?.id ?? null;

      // Si es el mismo usuario, ignorar completamente
      if (currentId && currentId === userIdRef.current) return;

      userIdRef.current = currentId;
      setUser(currentUser);
      if (currentUser) loadCart(currentUser.id);
      else setItems([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadCart(userId) {
  try {
    setLoading(true);

    // Timeout de seguridad: si tarda más de 8 segundos, continuar sin carrito
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );

    const queryPromise = supabase
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

        const result = await Promise.race([queryPromise, timeoutPromise]);
    const { data, error } = result;

    if (error) { setItems([]); return; }
    setItems(data || []);
  } catch (err) {
    setItems([]); // timeout o error → carrito vacío, app sigue funcionando
  } finally {
    setLoading(false); // SIEMPRE se ejecuta
  }
}

  const addingRef = useRef(new Set());

async function addItem(productId, quantity = 1) {
  if (!user) throw new Error('Debes iniciar sesión');
  if (addingRef.current.has(productId)) return;
  addingRef.current.add(productId);
  try {
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
  } finally {
    addingRef.current.delete(productId);
  }
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
