CREATE TABLE sensitive_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    anonymized_value text NOT NULL,
    sensitive_value_id uuid NOT NULL,
    label text,
    CONSTRAINT fk_vault_secret FOREIGN KEY (sensitive_value_id) REFERENCES vault.secrets(id)
);

ALTER TABLE sensitive_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sensitive entries" 
ON sensitive_entries 
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE sensitive_entries;
