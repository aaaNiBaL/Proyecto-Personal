import { createSupabaseClient } from '../supabase/client'

export async function deleteOwnAccount() {
  const client = createSupabaseClient()
  const { error } = await client.functions.invoke('delete-account', {
    method: 'POST',
    body: {},
  })
  if (error) {
    throw new Error(
      `No se pudo eliminar tu cuenta. Despliega la función segura "delete-account" en Supabase: ${error.message}`,
    )
  }

  const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
  if (signOutError) {
    throw new Error(
      `La cuenta fue eliminada, pero no se pudo cerrar esta sesión localmente: ${signOutError.message}`,
    )
  }
}
