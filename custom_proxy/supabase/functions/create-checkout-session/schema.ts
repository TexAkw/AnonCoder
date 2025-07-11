import { z } from 'npm:zod'
import type { CreateCheckoutSessionRequest } from '../_shared/types/api.ts'

export const createCheckoutSessionSchema: z.ZodType<CreateCheckoutSessionRequest> =
  z.object({})
