import { Hono } from 'jsr:@hono/hono@4.8.2'
import { cors } from 'jsr:@hono/hono@4.8.2/cors'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { supabaseMiddleware } from '../_shared/middleware/supabase.middleware.ts'
import { AppBindings } from '../_shared/types/AppBindings.ts'
import { entitiesCategoriesHandler } from './handler.ts'

const app = new Hono<{ Bindings: AppBindings }>()

app.use('*', cors())

app.get('/get-entities-categories', supabaseMiddleware, (c) => {
  const response = entitiesCategoriesHandler()
  return c.json(response)
})

Deno.serve(app.fetch)
