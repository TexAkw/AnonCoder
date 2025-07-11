import { z } from 'npm:zod'
import type { AnonymizeMessageRequest } from '../_shared/types/api.ts'

export const anonymizeMessageSchema: z.ZodType<AnonymizeMessageRequest> =
  z.object({
    message: z.string(),
    entryIds: z.array(z.string()),
    customWords: z.array(z.string()).optional(),
  })
