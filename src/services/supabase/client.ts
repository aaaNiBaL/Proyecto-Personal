import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let supabaseClient: SupabaseClient<Database> | null = null

export function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && getSupabaseKey())
}

function getSupabaseKey() {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = getSupabaseKey()

  if (!url || !publishableKey) {
    throw new Error(
      'Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.',
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

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(url, publishableKey)
  }

  return supabaseClient
}
