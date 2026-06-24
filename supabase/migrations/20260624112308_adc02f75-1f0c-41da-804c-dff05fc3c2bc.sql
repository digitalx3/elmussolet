-- Allow anon and authenticated to execute is_admin so RLS policies that reference it
-- (e.g. cms_blocks "Anyone can view active cms blocks") can be evaluated for guests.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.is_admin(uuid) IS
  'Used inside public RLS policies; anon must keep EXECUTE so guest reads do not fail with "permission denied for function is_admin".';