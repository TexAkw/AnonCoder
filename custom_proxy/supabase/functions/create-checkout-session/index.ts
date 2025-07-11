// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { Hono } from 'jsr:@hono/hono@4.8.2'
import { cors } from 'jsr:@hono/hono@4.8.2/cors'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { stripeMiddleware } from '../_shared/middleware/stripe.middleware.ts'
import { supabaseMiddleware } from '../_shared/middleware/supabase.middleware.ts'
import { zValidator } from '../_shared/middleware/zValidator.middleware.ts'
import { AppBindings } from '../_shared/types/AppBindings.ts'
import { createCheckoutSessionHandler } from './handler.ts'
import { createCheckoutSessionSchema } from './schema.ts'

const app = new Hono<{ Bindings: AppBindings }>()
app.use('*', cors())

app.post(
  '/create-checkout-session',
  supabaseMiddleware,
  stripeMiddleware,
  //authMiddleware,
  zValidator('json', createCheckoutSessionSchema),
  async (c) => {
    const response = await createCheckoutSessionHandler(
      c.req.valid('json'),
      c.get('stripe'),
      "22ab4eb2-ad52-4a98-be05-77307b4e8076",
    )
    return c.json(response, 200)
  },
)

Deno.serve(app.fetch)

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-checkout-session' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
