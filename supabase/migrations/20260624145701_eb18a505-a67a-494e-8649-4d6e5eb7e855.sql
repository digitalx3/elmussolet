
ALTER TABLE public.maintenance_settings
  ADD COLUMN IF NOT EXISTS emergency_token text,
  ADD COLUMN IF NOT EXISTS emergency_token_expires_at timestamptz;
