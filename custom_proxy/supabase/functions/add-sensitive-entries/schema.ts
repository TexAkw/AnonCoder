import { z } from 'npm:zod'
import type { AddSensitiveEntriesRequest } from '../_shared/types/api.ts'

export const addSensitiveEntriesSchema: z.ZodType<AddSensitiveEntriesRequest> =
  z.object({
    words: z.array(
      z.object({
        value: z.string(),
      }),
    ),
  })
