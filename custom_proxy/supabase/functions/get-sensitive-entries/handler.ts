import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Database } from '../_shared/types/database.types.ts'
import { supabaseGetDecryptedSensitiveEntries } from '../_shared/services/supabase.ts'
import { GetSensitiveEntriesResponse } from '../_shared/types/api.ts'

export async function getSensitiveEntriesHandler(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<GetSensitiveEntriesResponse> {
  const entries = await supabaseGetDecryptedSensitiveEntries(supabase, userId)
  return {
    sensitiveEntries: entries,
  }
}
