import { HTTPException } from 'jsr:@hono/hono@4.8.2/http-exception'
import { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { SensitiveEntryResponse } from '../types/api.ts'
import { Database } from '../types/database.types.ts'

/**
 * Retrieves all sensitive entries for a given user, with the sensitive values decrypted.
 * It calls a security-definer RPC function in the database.
 * @param supabase - Supabase client instance (must have service_role privileges)
 * @param userId - The UUID of the user whose entries are to be fetched.
 * @returns Promise resolving to an array of decrypted sensitive entries.
 */
export async function supabaseGetDecryptedSensitiveEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SensitiveEntryResponse[]> {
  const { data, error } = await supabase.rpc(
    'get_decrypted_sensitive_entries_for_user',
    { p_user_id: userId },
  )

  if (error) {
    console.error('Error fetching decrypted sensitive entries:', error)
    throw new HTTPException(500, {
      message: 'Could not fetch sensitive entries.',
    })
  }
  // The RPC returns a slightly different shape, so we map it to our API response type.
  return (data || []).map((entry) => ({
    id: entry.id,
    sensitiveValue: entry.sensitive_value,
    anonymizedValue: entry.anonymized_value,
    label: entry.label || 'custom',
  }))
}

/**
 * Creates multiple sensitive entries in a single transaction by first creating secrets in the vault,
 * then storing references to them in the sensitive_entries table.
 * @param supabase - Supabase client instance (must have service_role privileges)
 * @param userId - The user ID to associate with the entries.
 * @param entries - Array of entries to create, each containing sensitiveValue, anonymizedValue, and label.
 * @returns Promise resolving to an array of the newly created sensitive entries (with decrypted values).
 */
export async function supabaseCreateMultipleSensitiveEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
  entries: Array<{
    sensitiveValue: string
    anonymizedValue: string
    label: string
  }>,
): Promise<SensitiveEntryResponse[]> {
  if (entries.length === 0) {
    return []
  }

  // Use a transaction to ensure all operations succeed or fail together
  const { data, error } = await supabase.rpc(
    'create_multiple_sensitive_entries',
    {
      p_user_id: userId,
      p_entries: entries.map((entry) => ({
        sensitive_value: entry.sensitiveValue,
        anonymized_value: entry.anonymizedValue,
        label: entry.label,
      })),
    },
  )

  if (error) {
    console.error('Error creating multiple sensitive entries:', error)
    throw new HTTPException(500, {
      message: 'Failed to create secure entries.',
    })
  }

  // Return the created entries in the expected format
  return (data || []).map((entry) => ({
    id: entry.id,
    sensitiveValue: entry.sensitive_value,
    anonymizedValue: entry.anonymized_value,
    label: entry.label || 'custom',
  }))
}

/**
 * Creates a new sensitive entry by first creating a secret in the vault,
 * then storing a reference to it in the sensitive_entries table.
 * @param supabase - Supabase client instance (must have service_role privileges)
 * @param userId - The user ID to associate with the entry.
 * @param sensitiveValue - The plaintext sensitive value to be encrypted.
 * @param anonymizedValue - The value to replace the sensitive value with.
 * @param label - The label for the sensitive entry (e.g., 'custom').
 * @returns Promise resolving to the newly created sensitive entry (with decrypted value).
 */
export async function supabaseCreateSensitiveEntry(
  supabase: SupabaseClient<Database>,
  userId: string,
  sensitiveValue: string,
  anonymizedValue: string,
  label: string,
): Promise<SensitiveEntryResponse> {
  // Use the batch function for single entry to maintain consistency
  const results = await supabaseCreateMultipleSensitiveEntries(
    supabase,
    userId,
    [{ sensitiveValue, anonymizedValue, label }],
  )

  return results[0]
}

/**
 * Deletes sensitive entries from the database by their IDs for a specific user.
 * The corresponding secrets in the vault are deleted automatically via CASCADE.
 * @param supabase - Supabase client instance
 * @param userId - User ID to ensure entries belong to this user
 * @param entryIds - Array of entry IDs to delete
 * @returns Promise resolving to an array of the deleted entry IDs.
 */
export async function supabaseDeleteSensitiveEntriesByIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryIds: string[],
): Promise<string[]> {
  if (entryIds.length === 0) {
    return []
  }

  // Call the security definer function to perform the deletion securely.
  const { data, error } = await supabase.rpc(
    'delete_sensitive_entries_for_user',
    {
      p_user_id: userId,
      p_entry_ids: entryIds,
    },
  )

  if (error) {
    console.error('Failed to delete sensitive entries', error)
    throw new HTTPException(500, {
      message: 'Failed to delete sensitive entries',
    })
  }

  return data || []
}
