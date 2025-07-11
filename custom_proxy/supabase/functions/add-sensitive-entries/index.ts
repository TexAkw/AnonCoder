import { Hono } from 'jsr:@hono/hono@4.8.2'
import { cors } from 'jsr:@hono/hono@4.8.2/cors'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { supabaseMiddleware } from '../_shared/middleware/supabase.middleware.ts'
import { zValidator } from '../_shared/middleware/zValidator.middleware.ts'
import { AppBindings } from '../_shared/types/AppBindings.ts'
import { addSensitiveEntriesHandler } from './handler.ts'
import { addSensitiveEntriesSchema } from './schema.ts'

const app = new Hono<{ Bindings: AppBindings }>()
app.use('*', cors())

app.post(
  '/add-sensitive-entries',
  supabaseMiddleware,
  //authMiddleware,
  zValidator('json', addSensitiveEntriesSchema),
  async (c) => {
    const response = await addSensitiveEntriesHandler(
      c.req.valid('json'),
      c.get('supabase'),
      "22ab4eb2-ad52-4a98-be05-77307b4e8076",
    )
    return c.json(response, 200)
  },
)

Deno.serve(app.fetch)
