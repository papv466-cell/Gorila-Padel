import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // ⭐ FUERZA REFRESH DEL SCHEMA CACHE
  global: {
    headers: {
      'X-Client-Info': 'gorila-padel-v2'
    }
  }
})

// ⭐ Forzar recarga del schema
if (typeof window !== 'undefined') {
  console.log('🔄 Supabase client initialized');
}