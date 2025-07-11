import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Database } from '../_shared/types/database.types.ts'
import {
  AddSensitiveEntriesRequest,
  AddSensitiveEntriesResponse,
} from '../_shared/types/api.ts'
import {
  supabaseGetDecryptedSensitiveEntries,
  supabaseCreateMultipleSensitiveEntries,
} from '../_shared/services/supabase.ts'
import { generateAnonymizedValue } from '../_shared/services/anonymization.ts'

export async function addSensitiveEntriesHandler(
  request: AddSensitiveEntriesRequest,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AddSensitiveEntriesResponse> {
  // 1. Fetch all existing decrypted sensitive entries for the user.
  const existingEntries = await supabaseGetDecryptedSensitiveEntries(
    supabase,
    userId,
  )

  const existingSensitiveValues = new Set(
    existingEntries.map((entry) => entry.sensitiveValue),
  )

  // 2. Filter out words that already exist.
  const newWordsToCreate = request.words.filter(
    (word) => !existingSensitiveValues.has(word.value),
  )

  // 3. Create new entries for the new words in a single transaction.
  const entriesToCreate = newWordsToCreate.map((word) => ({
    sensitiveValue: word.value,
    anonymizedValue: generateAnonymizedValue('custom'),
    label: 'custom',
  }))

  const newEntries = await supabaseCreateMultipleSensitiveEntries(
    supabase,
    userId,
    entriesToCreate,
  )

  // 4. Find the existing entries that were part of the request.
  const requestedWordValues = new Set(request.words.map((word) => word.value))
  const existingRequestedEntries = existingEntries.filter((entry) =>
    requestedWordValues.has(entry.sensitiveValue),
  )

  // 5. Combine new and existing requested entries for the final response.
  const results = [...existingRequestedEntries, ...newEntries]

  return { results }
}
