
-- Transfer super_admin role to web@cibergueda.com (bypass trigger via session_replication_role)
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('4a023113-72e8-491f-9de4-812c901b36c0', 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_permissions (user_id, permission)
  SELECT '4a023113-72e8-491f-9de4-812c901b36c0', permission
  FROM public.user_permissions
  WHERE user_id = '6caf96a4-50e1-4c59-96f3-c44176bbbb7a'
  ON CONFLICT DO NOTHING;

  DELETE FROM public.user_permissions WHERE user_id = '6caf96a4-50e1-4c59-96f3-c44176bbbb7a';
  DELETE FROM public.user_roles WHERE user_id = '6caf96a4-50e1-4c59-96f3-c44176bbbb7a';

  UPDATE public.profiles SET role = 'admin' WHERE id = '4a023113-72e8-491f-9de4-812c901b36c0';
END $$;
