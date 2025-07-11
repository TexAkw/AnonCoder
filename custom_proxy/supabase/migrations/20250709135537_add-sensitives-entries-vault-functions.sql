-- Function to create multiple sensitive entries in a single transaction
-- This ensures all operations succeed or fail together
CREATE OR REPLACE FUNCTION public.create_multiple_sensitive_entries(
  p_user_id uuid,
  p_entries jsonb
)
RETURNS TABLE (
    id uuid,
    sensitive_value text,
    anonymized_value text,
    label text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entry_record jsonb;
  secret_id uuid;
  created_entry record;
BEGIN
  -- Loop through each entry in the JSON array
  FOR entry_record IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    -- Create the secret in the vault
    SELECT vault.create_secret(
      (entry_record->>'sensitive_value')::text,
      null,
      'Sensitive entry for user ' || p_user_id::text
    ) INTO secret_id;

    -- Insert the entry into the table
    INSERT INTO public.sensitive_entries (
      user_id,
      anonymized_value,
      sensitive_value_id,
      label
    ) VALUES (
      p_user_id,
      (entry_record->>'anonymized_value')::text,
      secret_id,
      COALESCE((entry_record->>'label')::text, 'custom')
    );

    -- Return the created entry with decrypted value
    SELECT
      ase.id,
      (entry_record->>'sensitive_value')::text as sensitive_value,
      ase.anonymized_value,
      ase.label
    INTO created_entry
    FROM public.sensitive_entries as ase
    WHERE ase.sensitive_value_id = secret_id
      AND ase.user_id = p_user_id
      AND ase.anonymized_value = (entry_record->>'anonymized_value')::text
    ORDER BY ase.created_at DESC
    LIMIT 1;

    id := created_entry.id;
    sensitive_value := created_entry.sensitive_value;
    anonymized_value := created_entry.anonymized_value;
    label := created_entry.label;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Helper function to retrieve decrypted secrets for a user.
-- This should be called from a secure context (e.g., an Edge Function).
create or replace function public.get_decrypted_sensitive_entries_for_user(p_user_id uuid)
returns table (
    id uuid,
    created_at timestamptz,
    anonymized_value text,
    sensitive_value text,
    label text
)
language sql
security definer
as $$
    select
        ase.id,
        ase.created_at,
        ase.anonymized_value,
        vds.decrypted_secret as sensitive_value,
        ase.label
    from
        public.sensitive_entries as ase
    join
        vault.decrypted_secrets as vds on ase.sensitive_value_id = vds.id
    where
        ase.user_id = p_user_id;
$$;

-- Helper function to securely delete sensitive entries and their corresponding secrets.
-- This function runs with the creator's permissions (postgres) to ensure it can
-- delete from both public.sensitive_entries and vault.secrets.
CREATE OR REPLACE FUNCTION public.delete_sensitive_entries_for_user(
  p_user_id uuid,
  p_entry_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_ids_to_delete uuid[];
  deleted_entry_ids uuid[];
BEGIN
  -- Step 1: For security, find the secret IDs belonging to the user and the entry IDs.
  SELECT array_agg(sensitive_value_id)
  INTO secret_ids_to_delete
  FROM public.sensitive_entries
  WHERE user_id = p_user_id AND id = ANY(p_entry_ids);

  -- Step 2: If we found matching entries, proceed with deletion.
  IF array_length(secret_ids_to_delete, 1) > 0 THEN
    -- First, delete from the public table.
    WITH deleted AS (
      DELETE FROM public.sensitive_entries
      WHERE id = ANY(p_entry_ids)
      RETURNING id
    )
    SELECT array_agg(id) INTO deleted_entry_ids FROM deleted;

    -- Second, explicitly delete the secrets from the vault.
    DELETE FROM vault.secrets
    WHERE id = ANY(secret_ids_to_delete);
  END IF;

  RETURN deleted_entry_ids;
END;
$$;
