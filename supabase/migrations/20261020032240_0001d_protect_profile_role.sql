/*
# Fix role escalation via BEFORE UPDATE trigger

## Plain-English summary
The previous attempt to revoke column-level UPDATE on `profiles.role` did not
work because PostgreSQL's table-level GRANT (which Supabase applies by default)
covers all columns, and `REVOKE COLUMN` cannot override a table-level grant.

This migration uses a different approach: a BEFORE UPDATE trigger that prevents
the `role` column from being changed unless a transaction-local flag is set.
The flag is set only by the `set_user_role()` SECURITY DEFINER function
(service-role only), so regular users updating their own profile through the
API cannot change their role.

## Changes
1. `set_user_role()` — now sets `app.allow_role_change = 'true'` (local) before
   updating the profile, so the trigger permits the change.
2. New trigger `trg_protect_profile_role` — raises an exception if
   `NEW.role IS DISTINCT FROM OLD.role` and the flag is not set.

## Security
- Regular authenticated users: UPDATE on profiles still works (RLS allows
  own-row updates), but the `role` column cannot change.
- Service role via `set_user_role()`: sets the flag, so the trigger allows it.
- Direct service-role UPDATE (bypassing the function): would still be blocked
  by the trigger, but the service role is trusted anyway.

## Important notes
1. The flag is `is_local := true`, so it only lasts for the current transaction
   and cannot leak across requests.
2. The trigger fires BEFORE UPDATE, so it runs before the `set_updated_at`
   trigger.
*/

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_role NOT IN ('user','moderator','admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  -- Set a transaction-local flag so the protect_profile_role trigger
  -- allows this specific role change.
  PERFORM set_config('app.allow_role_change', 'true', true);
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF coalesce(current_setting('app.allow_role_change', true), 'false') != 'true' THEN
      RAISE EXCEPTION 'Not allowed to change profile role directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();
