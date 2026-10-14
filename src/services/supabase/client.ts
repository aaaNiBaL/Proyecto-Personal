import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.',
    )
  }

  try {
    const parsedUrl = new URL(url)
    const isLocalDevelopment =
      parsedUrl.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)

    if (parsedUrl.protocol !== 'https:' && !isLocalDevelopment) {
      throw new Error('Supabase URL debe usar HTTPS.')
    }
  } catch {
    throw new Error(
      'VITE_SUPABASE_URL debe ser HTTPS o una URL HTTP de desarrollo local.',
    )
  }

  return createClient(url, anonKey)
}
