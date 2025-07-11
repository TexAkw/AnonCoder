import { HTTPException } from 'jsr:@hono/hono@4.8.2/http-exception'
import { z } from 'npm:zod'

/**
 * NER (Named Entity Recognition) API utilities
 * Functions in this module interact with external NER services
 */

// Zod schemas for response validation
const AkawanNerEntitySchema = z.object({
  text: z.string(),
  label: z.string(),
  score: z.number(),
  start: z.number(),
  end: z.number(),
})

const AkawanNerSuccessResponseSchema = z.object({
  entities: z.array(AkawanNerEntitySchema),
})

// Export the inferred types for use elsewhere
export type AkawanNerEntity = z.infer<typeof AkawanNerEntitySchema>

/**
 * Detects sensitive entities in text using the NER API
 * @param text - The text to analyze
 * @param apiUrl - The NER API endpoint URL
 * @param apiKey - The NER API authentication key
 * @param labels - Array of entity labels with thresholds to detect
 * @returns Promise resolving to detected entities
 */
export async function nerDetectSensitiveEntities(
  text: string,
  apiUrl: string,
  apiKey: string,
): Promise<AkawanNerEntity[]> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: apiKey,
    },
    body: JSON.stringify({
      confidence_threshold: 0.6,
      disable_cross_source_deduplication: true,
      ner_allow_multiple_labels_per_span: false,
      ner_allow_nested_entities: false,
      label_sets: [
        'digital_data',
        'financial_data',
        'location_data',
        'medical_data',
        'personal_data',
        'professional_data',
        'sensitive_data',
      ],
      recognitions_defs: [],
      text,
    }),
  })

  console.log('/v1/ner status', response.status)

  if (!response.ok) {
    const errorData = await response.json()
    const errorMessage = errorData?.message || 'Internal Server Error'

    console.error('NER API error', errorData)
    throw new HTTPException(500, {
      message: `NER API - ${errorMessage}`,
    })
  }

  const data = await response.json()

  // Validate success response structure
  const parseResult = AkawanNerSuccessResponseSchema.safeParse(data)
  if (!parseResult.success) {
    console.error('Invalid success response structure:', parseResult.error)
    console.error('Invalid data', data)
    throw new HTTPException(500, {
      message: 'NER API - Invalid response format',
    })
  }

  return parseResult.data.entities
}
