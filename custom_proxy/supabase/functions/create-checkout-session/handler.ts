import {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '../_shared/types/api.ts'
import Stripe from 'npm:stripe@18.3.0'
import { User } from 'npm:@supabase/supabase-js@2'

export async function createCheckoutSessionHandler(
  request: CreateCheckoutSessionRequest,
  stripe: Stripe,
  user: User,
): Promise<CreateCheckoutSessionResponse> {
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: 'price_1RiFTPCVZANad7eYgFdJeXBi',
        quantity: 1,
      },
    ],
    customer_email: user.email,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    locale: 'auto',
    payment_method_options: {
      card: {},
    },
  })

  console.log('checkoutSession', checkoutSession)

  return {
    checkoutSessionUrl: checkoutSession.url,
  }
}
