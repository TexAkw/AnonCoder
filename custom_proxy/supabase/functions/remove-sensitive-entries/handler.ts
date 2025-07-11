import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Database } from '../_shared/types/database.types.ts'
import { supabaseDeleteSensitiveEntriesByIds } from '../_shared/services/supabase.ts'
import {
  RemoveSensitiveEntriesRequest,
  RemoveSensitiveEntriesResponse,
} from '../_shared/types/api.ts'

export async function removeSensitiveEntriesHandler(
  supabase: SupabaseClient<Database>,
  request: RemoveSensitiveEntriesRequest,
  userId: string,
): Promise<RemoveSensitiveEntriesResponse> {
  const deletedIds = await supabaseDeleteSensitiveEntriesByIds(
    supabase,
    userId,
    request.ids,
  )

  return {
    deletedIds,
  }
}
