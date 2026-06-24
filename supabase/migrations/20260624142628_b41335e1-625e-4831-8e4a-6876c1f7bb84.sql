
-- Polítiques d'storage per al bucket `backups`: només admins
CREATE POLICY "backups_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'backups' AND public.is_admin(auth.uid()));

CREATE POLICY "backups_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.is_admin(auth.uid()));

CREATE POLICY "backups_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'backups' AND public.is_admin(auth.uid()));

CREATE POLICY "backups_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'backups' AND public.is_admin(auth.uid()));

-- Taula d'historial
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  file_path text,
  file_size_bytes bigint,
  tables_json jsonb,
  storage_json jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX backup_runs_created_at_idx ON public.backup_runs (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_runs_admin_all"
  ON public.backup_runs FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER backup_runs_set_updated_at
  BEFORE UPDATE ON public.backup_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
