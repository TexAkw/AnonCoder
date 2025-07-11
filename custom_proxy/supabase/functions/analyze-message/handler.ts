import { AppBindings } from '../_shared/types/AppBindings.ts'
import { HTTPException } from 'jsr:@hono/hono@4.8.2/http-exception'
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Database } from '../_shared/types/database.types.ts'
import { nerDetectSensitiveEntities } from '../_shared/services/ner.ts'
import {
  supabaseGetDecryptedSensitiveEntries,
  supabaseCreateSensitiveEntry,
} from '../_shared/services/supabase.ts'
import {
  AnalyzeMessageRequest,
  AnalyzeMessageResponse,
} from '../_shared/types/api.ts'
import { generateAnonymizedValue } from '../_shared/services/anonymization.ts'
import {
  findSensitiveEntitiesInText,
  removeOverlappingMatches,
} from '../_shared/text-utils.ts'

export async function analyzeMessageHandler(
  env: AppBindings,
  supabase: SupabaseClient<Database>,
  request: AnalyzeMessageRequest,
  userId: string,
): Promise<AnalyzeMessageResponse> {
  const detectedEntities = await nerDetectSensitiveEntities(
    request.message,
    env.AKAWAN_NER_API_URL,
    env.AKAWAN_NER_API_KEY,
  )

  // 1. Fetch all existing decrypted entries to check against.
  const existingEntries = await supabaseGetDecryptedSensitiveEntries(
    supabase,
    userId,
  )

  // 2. Check if the message contains entities from `supabaseGetDecryptedSensitiveEntries` that the NER didn't detect
  const manualDetectionsMatches = findSensitiveEntitiesInText(
    request.message,
    existingEntries.map((e) => ({ value: e.sensitiveValue })),
  )

  const existingEntriesMapForLabel = new Map(
    existingEntries.map((e) => [e.sensitiveValue, { label: e.label }]),
  )
  const manualDetections = manualDetectionsMatches.map((match) => ({
    text: match.value,
    start: match.start,
    end: match.end,
    label: existingEntriesMapForLabel.get(match.value)!.label,
  }))

  const labelMap = new Map()
  for (const d of detectedEntities) {
    labelMap.set(`${d.text}-${d.start}-${d.end}`, d.label)
  }
  for (const d of manualDetections) {
    const key = `${d.text}-${d.start}-${d.end}`
    if (!labelMap.has(key)) {
      labelMap.set(key, d.label)
    }
  }

  const allForOverlap = [...detectedEntities, ...manualDetections].map((d) => ({
    value: d.text,
    start: d.start,
    end: d.end,
  }))

  const uniqueForOverlap = []
  const seenForOverlap = new Set()
  for (const d of allForOverlap) {
    const key = `${d.value}-${d.start}-${d.end}`
    if (!seenForOverlap.has(key)) {
      uniqueForOverlap.push(d)
      seenForOverlap.add(key)
    }
  }

  const uniqueMatchesResult = removeOverlappingMatches(uniqueForOverlap)

  const finalDetectionsList = uniqueMatchesResult.map((m) => {
    const key = `${m.value}-${m.start}-${m.end}`
    return {
      text: m.value,
      label: labelMap.get(key)!,
    }
  })

  // 3. Determine which of the detected entities are new.
  const existingSensitiveValues = new Set(
    existingEntries.map((entry) => entry.sensitiveValue),
  )
  const newEntitiesToCreate = finalDetectionsList.filter(
    (entity) => !existingSensitiveValues.has(entity.text),
  )

  // 4. Create the new entries in parallel.
  const newEntriesPromises = newEntitiesToCreate.map((entity) => {
    const anonymizedValue = generateAnonymizedValue(entity.label)
    return supabaseCreateSensitiveEntry(
      supabase,
      userId,
      entity.text,
      anonymizedValue,
      entity.label,
    )
  })
  const newEntries = await Promise.all(newEntriesPromises)

  // 5. Combine all entries for the final response mapping.
  const allEntries = [...existingEntries, ...newEntries]
  const entriesMap = new Map(
    allEntries.map((entry) => [entry.sensitiveValue, entry]),
  )

  // 6. Map the original detected entities to the response format.
  const results = finalDetectionsList.map((entity) => {
    const matchingEntry = entriesMap.get(entity.text)
    if (!matchingEntry) {
      // This should not happen given the logic above, but as a safeguard:
      console.error(
        `Could not find a matching database entry for sensitive value: "${entity.text}"`,
      )
      throw new HTTPException(500, {
        message: 'Internal consistency error.',
      })
    }
    return {
      id: matchingEntry.id,
      sensitiveValue: matchingEntry.sensitiveValue,
      anonymizedValue: matchingEntry.anonymizedValue,
      label: matchingEntry.label,
    }
  })

  return { results }
}
