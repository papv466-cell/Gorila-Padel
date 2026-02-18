// src/services/store.js
import { supabase } from './supabaseClient';

/* ===================================
   VENDEDORES (Sellers)
   =================================== */

// Registrar nuevo vendedor
export async function registerSeller(sellerData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('store_sellers')
    .insert([{
      user_id: user.id,
      business_name: sellerData.businessName,
      business_type: sellerData.businessType,
      description: sellerData.description,
      contact_email: sellerData.email,
      contact_phone: sellerData.phone,
      logo_url: sellerData.logoUrl,
      is_verified: false,
      is_active: false
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Obtener perfil de vendedor del usuario actual
export async function getCurrentSeller() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('store_sellers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Actualizar perfil de vendedor
export async function updateSeller(sellerId, updates) {
  const { data, error } = await supabase
    .from('store_sellers')
    .update(updates)
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ===================================
   PRODUCTOS (Vendedor)
   =================================== */

// Crear producto
export async function createProduct(productData) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');
  if (!seller.is_verified) throw new Error('Tu cuenta de vendedor no está verificada');

  const { data, error } = await supabase
  .from('store_products')
  .insert([{
    seller_id: seller.id,
    title: productData.title,
    description: productData.description,
    category: productData.category,
    subcategory: productData.subcategory,
    price: productData.price,
    compare_at_price: productData.compare_at_price,    // ← nombre correcto
    stock_quantity: productData.stock_quantity,         // ← nombre correcto
    sku: productData.sku,
    images: productData.images || [],
    specs: productData.specs || {},
    slug: generateSlug(productData.title),
    tags: productData.tags || [],
    is_active: productData.is_active !== undefined      // ← nombre correcto
      ? productData.is_active
      : true,
    featured: false
  }])
  .select()
  .single();

  if (error) throw error;
  return data;
}

// Obtener productos del vendedor actual
export async function getMyProducts({ page = 1, limit = 20, search = '', category = '' } = {}) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  let query = supabase
    .from('store_products')
    .select('*', { count: 'exact' })
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    products: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// Obtener producto por ID (solo si es del vendedor)
export async function getMyProduct(productId) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('id', productId)
    .eq('seller_id', seller.id)
    .single();

  if (error) throw error;
  return data;
}

// Actualizar producto
export async function updateProduct(productId, updates) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  const { data, error } = await supabase
    .from('store_products')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId)
    .eq('seller_id', seller.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Eliminar producto
export async function deleteProduct(productId) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  const { error } = await supabase
    .from('store_products')
    .delete()
    .eq('id', productId)
    .eq('seller_id', seller.id);

  if (error) throw error;
  return true;
}

/* ===================================
   PEDIDOS (Vendedor)
   =================================== */

// Obtener pedidos del vendedor
export async function getMyOrders({ page = 1, limit = 20, status = '' } = {}) {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  let query = supabase
    .from('store_order_items')
    .select(`
      *,
      order:store_orders(
        id,
        order_number,
        status,
        total,
        created_at,
        buyer:profiles!buyer_id(
          id,
          full_name,
          email
        )
      ),
      product:store_products(
        id,
        title,
        images
      )
    `, { count: 'exact' })
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('order.status', status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    orders: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// Estadísticas del vendedor
export async function getSellerStats() {
  const seller = await getCurrentSeller();
  if (!seller) throw new Error('No tienes una cuenta de vendedor');

  const { count: totalProducts } = await supabase
    .from('store_products')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', seller.id);

  const { count: totalSales } = await supabase
    .from('store_order_items')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', seller.id);

  const { data: revenueData } = await supabase
    .from('store_order_items')
    .select('price, quantity')
    .eq('seller_id', seller.id);

  const totalRevenue = revenueData?.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0) || 0;

  const { count: pendingOrders } = await supabase
    .from('store_order_items')
    .select('order_id', { count: 'exact', head: true })
    .eq('seller_id', seller.id)
    .in('order.status', ['pending', 'paid']);

  return {
    totalProducts: totalProducts || 0,
    totalSales: totalSales || 0,
    totalRevenue: totalRevenue,
    pendingOrders: pendingOrders || 0,
    rating: seller.rating || 0,
    isVerified: seller.is_verified,
    isActive: seller.is_active
  };
}

/* ===================================
   CATÁLOGO PÚBLICO
   =================================== */

// Obtener productos destacados
export async function getFeaturedProducts(limit = 10) {
  const { data, error } = await supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating
      )
    `)
    .eq('is_active', true)
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Obtener productos aprobados por Gorila
export async function getGorilaApprovedProducts(limit = 10) {
  const { data, error } = await supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating
      )
    `)
    .eq('is_active', true)
    .eq('gorila_approved', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Obtener productos más vendidos
export async function getBestSellers(limit = 10) {
  const { data, error } = await supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating
      )
    `)
    .eq('is_active', true)
    .order('sales', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Obtener todos los productos (con filtros)
export async function getProducts({
  page = 1,
  limit = 20,
  search = '',
  category = '',
  minPrice = null,
  maxPrice = null,
  sortBy = 'created_at'
} = {}) {
  let query = supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating
      )
    `, { count: 'exact' })
    .eq('is_active', true);

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (minPrice !== null) {
    query = query.gte('price', minPrice);
  }

  if (maxPrice !== null) {
    query = query.lte('price', maxPrice);
  }

  switch (sortBy) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'popular':
      query = query.order('sales', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    products: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// Obtener producto por slug
// Obtener producto por slug O por id
export async function getProductBySlug(slug) {
  // Primero intentar por slug
  let { data, error } = await supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating,
        description
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle(); // 👈 maybeSingle no lanza error si no encuentra

  // Si no encuentra por slug, buscar por id
  if (!data) {
    const result = await supabase
      .from('store_products')
      .select(`
        *,
        seller:store_sellers(
          id,
          business_name,
          logo_url,
          rating,
          description
        )
      `)
      .eq('id', slug) // 👈 intentar como si fuera ID
      .eq('is_active', true)
      .maybeSingle();

    data = result.data;
    error = result.error;
  }

  if (!data) throw new Error('Producto no encontrado');

  // Incrementar vistas
  await supabase
    .from('store_products')
    .update({ views: (data.views || 0) + 1 })
    .eq('id', data.id);

  return data;
}

// Obtener producto por ID (alias para compatibilidad)
export async function getProduct(productId) {
  return await getProductById(productId);
}

// Obtener producto por ID
export async function getProductById(productId) {
  const { data, error } = await supabase
    .from('store_products')
    .select(`
      *,
      seller:store_sellers(
        id,
        business_name,
        logo_url,
        rating
      )
    `)
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data;
}

// Obtener reviews de un producto
export async function getProductReviews(productId) {
  const { data, error } = await supabase
    .from('store_reviews')
    .select(`
      *,
      user:profiles(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ===================================
   FAVORITOS
   =================================== */

// Verificar si un producto es favorito
export async function isFavorite(productId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('store_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  return !error && !!data;
}

// Toggle favorito
export async function toggleFavorite(productId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión');

  const isFav = await isFavorite(productId);

  if (isFav) {
    const { error } = await supabase
      .from('store_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('store_favorites')
      .insert([{ user_id: user.id, product_id: productId }]);

    if (error) throw error;
    return true;
  }
}

// Obtener favoritos del usuario
export async function getFavorites() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('store_favorites')
    .select(`
      *,
      product:store_products(
        *,
        seller:store_sellers(
          id,
          business_name,
          logo_url
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map(f => f.product) || [];
}

/* ===================================
   CARRITO
   =================================== */

// Obtener carrito
export async function getCart() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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
    .eq('user_id', user.id);

  if (error) {
    console.error('Error cargando carrito:', error);
    return [];
  }

  return data || [];
}

// Añadir al carrito
export async function addToCart(productId, quantity = 1) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión');

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('store_cart')
    .select('*')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('store_cart')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('store_cart')
      .insert([{
        user_id: user.id,
        product_id: productId,
        quantity
      }]);

    if (error) throw error;
  }

  return await getCart();
}

// Actualizar cantidad en carrito
export async function updateCartQuantity(cartItemId, quantity) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión');

  if (quantity <= 0) {
    return await removeFromCart(cartItemId);
  }

  const { error } = await supabase
    .from('store_cart')
    .update({ quantity })
    .eq('id', cartItemId)
    .eq('user_id', user.id);

  if (error) throw error;
  return await getCart();
}

export async function removeFromCart(cartItemId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión');

  const { error } = await supabase
    .from('store_cart')
    .delete()
    .eq('id', cartItemId)
    .eq('user_id', user.id);

  if (error) throw error;
  return await getCart();
}

export async function clearCart() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión');

  const { error } = await supabase
    .from('store_cart')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
  return [];
}

/* ===================================
   UTILIDADES
   =================================== */

function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// Subir imagen de producto
export async function uploadProductImage(file, productId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

// Categorías
export const PRODUCT_CATEGORIES = [
  { value: 'palas', label: 'Palas' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'calzado', label: 'Calzado' },
  { value: 'pelotas', label: 'Pelotas' },
  { value: 'accesorios', label: 'Accesorios' },
  { value: 'bolsas', label: 'Bolsas y Mochilas' },
  { value: 'grips', label: 'Grips y Overgrips' },
  { value: 'protecciones', label: 'Protecciones' },
  { value: 'otros', label: 'Otros' }
];

// Tipos de negocio
export const BUSINESS_TYPES = [
  { value: 'club', label: 'Club de Pádel' },
  { value: 'tienda', label: 'Tienda Deportiva' },
  { value: 'marca', label: 'Marca/Fabricante' },
  { value: 'particular', label: 'Particular' }
];