-- Replace the self-service "Become the first admin" bootstrap.
--
-- The old try_bootstrap_first_admin() let ANY signed-in user claim admin
-- while no admin existed, so on a fresh deployment whoever pressed the button
-- first won. Now that the project owner has dashboard access, admins are
-- granted from the Supabase SQL editor instead:
--
--   select public.make_admin('you@example.com');
--   select public.remove_admin('someone@example.com');
--
-- These functions are NOT callable from the app (anon/authenticated have no
-- EXECUTE), only by the database owner via the dashboard SQL editor.
-- The user must sign out and back in afterwards so their token picks up the role.

DROP FUNCTION IF EXISTS public.try_bootstrap_first_admin();

CREATE OR REPLACE FUNCTION public.make_admin(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(user_email);
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No account found with email %', user_email;
  END IF;

  -- is_platform_admin() reads this from the JWT
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  WHERE id = target_id;

  -- Keep profiles.role in sync for display (trigger requires this flag)
  PERFORM set_config('app.allow_role_change', 'true', true);
  UPDATE public.profiles SET role = 'admin' WHERE id = target_id;

  RETURN format('%s is now an admin. They must sign out and back in.', user_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_admin(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(user_email);
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No account found with email %', user_email;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
  WHERE id = target_id;

  PERFORM set_config('app.allow_role_change', 'true', true);
  UPDATE public.profiles SET role = 'user' WHERE id = target_id;

  RETURN format('%s is no longer an admin. They must sign out and back in.', user_email);
END;
$$;

REVOKE ALL ON FUNCTION public.make_admin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_admin(text) FROM PUBLIC, anon, authenticated;
