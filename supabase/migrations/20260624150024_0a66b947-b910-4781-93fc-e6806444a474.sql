
ALTER TABLE public.maintenance_settings
  DROP COLUMN IF EXISTS emergency_token;

ALTER TABLE public.maintenance_settings
  ADD COLUMN IF NOT EXISTS emergency_token_hash text,
  ADD COLUMN IF NOT EXISTS emergency_token_single_use boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_token_used_at timestamptz;
