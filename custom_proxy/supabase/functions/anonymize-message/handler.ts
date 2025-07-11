import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { generateAnonymizedValue } from '../_shared/services/anonymization.ts'
import {
  supabaseCreateSensitiveEntry,
  supabaseGetDecryptedSensitiveEntries,
} from '../_shared/services/supabase.ts'
import { findSensitiveEntitiesInText } from '../_shared/text-utils.ts'
import {
  AnonymizeMessageRequest,
  AnonymizeMessageResponse,
} from '../_shared/types/api.ts'
import { Database } from '../_shared/types/database.types.ts'

export async function anonymizeMessageHandler(
  supabase: SupabaseClient<Database>,
  request: AnonymizeMessageRequest,
  userId: string,
): Promise<AnonymizeMessageResponse> {
  // If the message is empty, return it as is
  if (!request.message || request.message.trim() === '') {
    return { message: request.message, newlyCreatedEntries: [] }
  }

  const { entryIds, customWords = [] } = request

  // 1. Fetch ALL decrypted sensitive entries for the user
  const allUserEntries = await supabaseGetDecryptedSensitiveEntries(
    supabase,
    userId,
  )
  console.log('allUserEntries', allUserEntries);

  const allEntriesMap = new Map(
    allUserEntries.map((entry) => [entry.id, entry]),
  )
  // 2. Handle creation of new "custom words" if any
  const existingSensitiveValues = new Set(
    allUserEntries.map((entry) => entry.sensitiveValue),
  )
  const newWordsToCreate = customWords.filter(
    (word) => !existingSensitiveValues.has(word),
  )

  const newEntriesPromises = newWordsToCreate.map((word) => {
    const anonymizedValue = generateAnonymizedValue('custom')
    return supabaseCreateSensitiveEntry(
      supabase,
      userId,
      word,
      anonymizedValue,
      'custom',
    )
  })
  const newlyCreatedEntries = await Promise.all(newEntriesPromises)

  for (const newEntry of newlyCreatedEntries) {
    allEntriesMap.set(newEntry.id, newEntry)
  }

  // 3. Determine the final list of sensitive entries to use for anonymization
  const entryIdsToUse = new Set([
    ...entryIds,
    ...newlyCreatedEntries.map((e) => e.id),
  ])
  const sensitiveEntries = Array.from(allEntriesMap.values()).filter((entry) =>
    entryIdsToUse.has(entry.id),
  )

  // If there are no sensitive entries to process, return the original message
  if (sensitiveEntries.length === 0) {
    return { message: request.message, newlyCreatedEntries: [] }
  }

  // 4. Find all occurrences of sensitive entities in the message
  const nonOverlappingMatches = findSensitiveEntitiesInText(
    request.message,
    sensitiveEntries.map((entry) => ({ value: entry.sensitiveValue })),
  )

  // If no matches found, return original message
  if (nonOverlappingMatches.length === 0) {
    return { message: request.message, newlyCreatedEntries }
  }

  // Sort matches by start position in descending order to replace from end to beginning
  const sortedMatches = nonOverlappingMatches.sort((a, b) => b.start - a.start)

  // 5. Replace sensitive values with anonymized values in the message
  let anonymizedMessage = request.message
  for (const match of sortedMatches) {
    const anonymizedValue = sensitiveEntries.find(
      (entry) => entry.sensitiveValue === match.value,
    )?.anonymizedValue

    if (anonymizedValue) {
      anonymizedMessage =
        `${anonymizedMessage.slice(0, match.start)}` +
        `${anonymizedValue}` +
        `${anonymizedMessage.slice(match.end)}`
    }
  }

  return {
    message: anonymizedMessage,
    newlyCreatedEntries,
  }
}
