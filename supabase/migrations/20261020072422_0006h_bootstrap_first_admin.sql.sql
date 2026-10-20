-- Self-service first-admin bootstrap.
-- Allows the first registered user to claim admin without dashboard access.
-- Only works when NO admin exists yet (checked via auth.users raw_app_meta_data).

CREATE OR REPLACE FUNCTION public.try_bootstrap_first_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  -- Check if any user already has admin role in JWT metadata
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE raw_app_meta_data @> '{"role":"admin"}'::jsonb
  ) INTO admin_exists;

  IF admin_exists THEN
    RETURN jsonb_build_object('success', false, 'reason', 'An admin already exists');
  END IF;

  -- Promote the caller in auth metadata (this is what is_platform_admin reads)
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  WHERE id = auth.uid();

  -- Also update profiles.role for display; tolerate trigger blocking it
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_bootstrap_first_admin() TO authenticated;
