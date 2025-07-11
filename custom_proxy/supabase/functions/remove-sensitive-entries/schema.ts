import { z } from 'npm:zod'
import type { RemoveSensitiveEntriesRequest } from '../_shared/types/api.ts'

export const removeSensitiveEntriesSchema: z.ZodType<RemoveSensitiveEntriesRequest> = z.object({
  ids: z.array(z.string()),
}) 