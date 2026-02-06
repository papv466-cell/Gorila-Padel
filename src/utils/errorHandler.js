// src/utils/errorHandler.js

/**
 * Maneja errores de Supabase y devuelve mensajes user-friendly
 */
 export function handleSupabaseError(error, defaultMessage = 'Algo salió mal') {
    console.error('[SUPABASE_ERROR]', error);
    
    // Errores comunes de Supabase
    if (error?.code === '23505') {
      return 'Este registro ya existe';
    }
    
    if (error?.code === '23503') {
      return 'Referencia inválida';
    }
    
    if (error?.code === 'PGRST116') {
      return 'No se encontró el registro';
    }
    
    // No exponer detalles técnicos al usuario
    return defaultMessage;
  }
  
  /**
   * Maneja errores de red
   */
  export function handleNetworkError(error) {
    console.error('[NETWORK_ERROR]', error);
    
    if (!navigator.onLine) {
      return 'Sin conexión a internet';
    }
    
    return 'Error de conexión. Inténtalo de nuevo.';
  }