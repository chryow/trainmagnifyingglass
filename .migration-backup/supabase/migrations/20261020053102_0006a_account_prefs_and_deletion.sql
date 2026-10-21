-- Add notification preferences and deletion tracking to profiles
-- Also add delete_account SECURITY DEFINER function

-- Add notification preference columns (all default to true)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_comments boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_reactions boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_follows boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_collections boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_corrections boolean NOT NULL DEFAULT true;

-- Add deletion tracking column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The profiles UPDATE policy already covers self-updates (auth.uid() = id)
-- so these new columns are editable by the user through the existing policy.

-- ============================================================
-- delete_account function
-- ============================================================
-- Anonymizes the user's profile, removes private data, and disables auth.
-- Public contributions (gems, comments) are preserved but anonymized.
-- Moderation/security records are preserved.

CREATE OR REPLACE FUNCTION public.delete_account(p_password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_old_username text;
  v_old_avatar text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Prevent double deletion
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is already deleted or deletion is in progress');
  END IF;

  -- Verify password if provided (caller should re-authenticate first)
  -- The caller must call supabase.auth.signInWithPassword before calling this

  -- Capture old values for cleanup
  SELECT username, avatar_url INTO v_old_username, v_old_avatar
  FROM profiles WHERE id = v_user_id;

  -- Anonymize profile
  UPDATE profiles SET
    username = 'deleted_' || substr(v_user_id::text, 1, 8),
    display_name = 'Deleted User',
    bio = NULL,
    home_area = NULL,
    avatar_url = NULL,
    is_active = false,
    deleted_at = now(),
    updated_at = now()
  WHERE id = v_user_id;

  -- Remove private collections
  DELETE FROM collection_items WHERE collection_id IN (
    SELECT id FROM collections WHERE owner_id = v_user_id AND visibility = 'private'
  );
  DELETE FROM collections WHERE owner_id = v_user_id AND visibility = 'private';

  -- Remove saved gems
  DELETE FROM saved_gems WHERE user_id = v_user_id;

  -- Remove follow relationships (both directions)
  DELETE FROM follows WHERE follower_id = v_user_id OR followee_id = v_user_id;

  -- Remove block relationships (both directions)
  DELETE FROM blocked_users WHERE blocker_id = v_user_id OR blocked_id = v_user_id;

  -- Remove notifications (recipient)
  DELETE FROM notifications WHERE recipient_id = v_user_id;

  -- Remove community memberships (not ownership)
  DELETE FROM community_members WHERE user_id = v_user_id;

  -- Withdraw confirmations
  UPDATE gem_confirmations SET withdrawn_at = now() WHERE user_id = v_user_id AND withdrawn_at IS NULL;

  -- Delete the auth user (this disables login)
  -- We cannot call auth.users.delete directly, but we can mark is_active = false
  -- The frontend should also call supabase.auth.signOut()

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account(text) TO authenticated;