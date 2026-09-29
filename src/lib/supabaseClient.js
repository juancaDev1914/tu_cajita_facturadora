import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper para probar la conexión desde consola o desde la app
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}
