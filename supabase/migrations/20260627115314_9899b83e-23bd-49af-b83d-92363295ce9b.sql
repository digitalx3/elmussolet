ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text DEFAULT 'ES';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS country text DEFAULT 'ES';