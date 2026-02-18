// src/services/verifyStoreTables.js
import { supabase } from './supabaseClient.js';

async function verifyStoreTables() {
  console.log('🔍 Verificando tablas de Gorila Store...\n');

  const tables = [
    'store_sellers',
    'store_products',
    'store_orders',
    'store_order_items',
    'store_reviews'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`❌ ${table}: NO EXISTE o hay error`);
        console.error(`   Error: ${error.message}\n`);
      } else {
        console.log(`✅ ${table}: Existe (${count || 0} registros)\n`);
      }
    } catch (err) {
      console.error(`❌ ${table}: Error al verificar`);
      console.error(`   ${err.message}\n`);
    }
  }

  console.log('📊 Verificación completa.');
}

verifyStoreTables();