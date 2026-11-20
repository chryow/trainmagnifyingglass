/*
# Bug fixes (Nov 2026 audit)

1. Username availability check for sign-up
   Logged-out visitors cannot read `profiles` (RLS is authenticated-only), so
   the register page's availability check always reported "available" and a
   taken username then failed sign-up with "Database error saving new user".
   `is_username_available()` answers yes/no without exposing any profile data.

2. Joining private communities with an invite code
   Invitees could neither read the invitation (SELECT is owner/mod only) nor
   insert a membership (INSERT requires a public community), so invite codes
   never worked. `redeem_invitation()` validates the code and joins atomically.

3. Deleted / deactivated accounts could still sign in
   `delete_account()` and `admin_deactivate_account()` only set
   profiles.is_active = false; the login itself kept working. A trigger now
   mirrors is_active onto auth.users.banned_until, which Supabase Auth enforces
   on sign-in and token refresh. Reactivation clears the ban.

4. Live notifications never arrived
   The notifications table was not in the `supabase_realtime` publication, so
   the Notifications page's realtime subscription never received inserts.
*/

-- ---------------------------------------------------------------------------
-- 1. Username availability
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username)
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Redeem a community invitation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.community_invitations%ROWTYPE;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not signed in.');
  END IF;

  SELECT * INTO v_inv
  FROM public.community_invitations
  WHERE code = trim(p_code)
  FOR UPDATE;

  IF NOT FOUND OR v_inv.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or already-used invitation code.');
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired.');
  END IF;

  SELECT is_active INTO v_active FROM public.communities WHERE id = v_inv.community_id;
  IF NOT coalesce(v_active, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This community is no longer active.');
  END IF;

  IF public.is_suspended(v_uid, v_inv.community_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are suspended from this community.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = v_inv.community_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('success', true, 'community_id', v_inv.community_id, 'already_member', true);
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_inv.community_id, v_uid, 'member');

  UPDATE public.community_invitations
  SET used_by = v_uid, used_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'community_id', v_inv.community_id);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Block sign-in for inactive (deleted / deactivated) accounts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_auth_ban_with_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE auth.users
    SET banned_until = CASE WHEN NEW.is_active THEN NULL ELSE 'infinity'::timestamptz END
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_ban_with_active() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_auth_ban ON public.profiles;
CREATE TRIGGER trg_sync_auth_ban
AFTER UPDATE OF is_active ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_ban_with_active();

-- Apply to any accounts that were already inactive
UPDATE auth.users u
SET banned_until = 'infinity'::timestamptz
FROM public.profiles p
WHERE p.id = u.id AND p.is_active = false;

-- ---------------------------------------------------------------------------
-- 4. Realtime notifications
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
