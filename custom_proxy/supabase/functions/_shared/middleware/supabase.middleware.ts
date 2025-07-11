import { createMiddleware } from 'jsr:@hono/hono@4.8.2/factory'
import { env } from 'jsr:@hono/hono@4.8.2/adapter'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AppBindings } from '../types/AppBindings.ts'
import { Database } from '../types/database.types.ts'

export type SupabaseVariables = {
  supabase: SupabaseClient<Database>
}

export const supabaseMiddleware = createMiddleware<{
  Bindings: AppBindings
  Variables: SupabaseVariables
}>((c, next) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env(c)
  const supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  )
  c.set('supabase', supabase)
  return next()
})
