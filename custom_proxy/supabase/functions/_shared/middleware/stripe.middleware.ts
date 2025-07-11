import { createMiddleware } from 'jsr:@hono/hono@4.8.2/factory'
import { env } from 'jsr:@hono/hono@4.8.2/adapter'
import { AppBindings } from '../types/AppBindings.ts'
import Stripe from 'npm:stripe@18.3.0'

export type StripeVariables = {
  stripe: Stripe
}

export const stripeMiddleware = createMiddleware<{
  Bindings: AppBindings
  Variables: StripeVariables
}>((c, next) => {
  const { STRIPE_SECRET_KEY } = env(c)
  const stripe = new Stripe(STRIPE_SECRET_KEY)
  c.set('stripe', stripe)
  return next()
})
