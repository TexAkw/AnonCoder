import { createMiddleware } from 'jsr:@hono/hono@4.8.2/factory'
import { HTTPException } from 'jsr:@hono/hono@4.8.2/http-exception'
import type { User } from 'npm:@supabase/supabase-js@2'
import type { AppBindings } from '../types/AppBindings.ts'
import type { SupabaseVariables } from './supabase.middleware.ts'

export type AuthVariables = {
  user: User
}

/**
 * This middleware is responsible for authenticating users.
 * It first verifies the JWT token and then checks if the user exists in the Supabase database.
 *
 * This middleware requires the `supabaseMiddleware` to be executed before it.
 */
export const authMiddleware = createMiddleware<{
  Bindings: AppBindings
  Variables: SupabaseVariables & AuthVariables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }
  console.log('authHeader', authHeader);

  const token = authHeader.split(' ')[1]
  if (!token) {
    throw new HTTPException(401, { message: 'Malformed token' })
  }

  const supabase = c.get('supabase')
  if (!supabase) {
    throw new HTTPException(500, {
      message: 'Internal Server Error: Supabase client not configured.',
    })
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  console.log('user', user);

  if (error || !user) {
    throw new HTTPException(401, {
      message: `Invalid token: ${error?.message}`,
    })
  }

  c.set('user', user)

  await next()
})
