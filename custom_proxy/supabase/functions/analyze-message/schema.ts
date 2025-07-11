import { z } from 'npm:zod'
import type { AnalyzeMessageRequest } from '../_shared/types/api.ts'

export const analyzeMessageSchema: z.ZodType<AnalyzeMessageRequest> = z.object({
  message: z.string(),
})
