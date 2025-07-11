import { Hono } from 'jsr:@hono/hono@4.8.2'
import { cors } from 'jsr:@hono/hono@4.8.2/cors'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { supabaseMiddleware } from '../_shared/middleware/supabase.middleware.ts'
import { AppBindings } from '../_shared/types/AppBindings.ts'
import { getSensitiveEntriesHandler } from './handler.ts'

const app = new Hono<{ Bindings: AppBindings }>()
app.use('*', cors())

app.get(
  '/get-sensitive-entries',
  supabaseMiddleware,
  //authMiddleware,
  async (c) => {
    const response = await getSensitiveEntriesHandler(
      c.get('supabase'),
      "22ab4eb2-ad52-4a98-be05-77307b4e8076",
    )

    return c.json(response)
  },
)

Deno.serve(app.fetch)
