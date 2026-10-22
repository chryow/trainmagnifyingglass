/*
# Community Archive, Restore, and Delete Functions

## Plain-English summary
Adds three SECURITY DEFINER functions for community owner management:
- archive_community: sets is_active=false, preserving all data
- restore_community: sets is_active=true
- delete_empty_community: permanently deletes a community only if it has
  no gems, no non-owner members, no reports, and no invitations

All functions verify the caller is the community owner.

## Security
- All functions are SECURITY DEFINER with fixed search_path
- EXECUTE restricted to authenticated only (anon and PUBLIC revoked)
- Owner check via auth.uid() = communities.owner_id
- delete_empty_community verifies no dependent records before deleting
- Archive/restore actions are logged in moderation_actions for audit trail
*/

CREATE OR REPLACE FUNCTION public.archive_community(p_community_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_community record;
BEGIN
  SELECT id, name, owner_id INTO v_community FROM public.communities WHERE id = p_community_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  IF v_community.owner_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.communities SET is_active = false, updated_at = now() WHERE id = p_community_id;

  INSERT INTO public.moderation_actions (action_type, target_type, target_id, moderator_id, community_id, reason)
  VALUES ('hide_gem', 'community', p_community_id, auth.uid(), p_community_id, 'Community archived by owner');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_community(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_community(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_community(p_community_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_community record;
BEGIN
  SELECT id, owner_id INTO v_community FROM public.communities WHERE id = p_community_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  IF v_community.owner_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.communities SET is_active = true, updated_at = now() WHERE id = p_community_id;

  INSERT INTO public.moderation_actions (action_type, target_type, target_id, moderator_id, community_id, reason)
  VALUES ('restore_gem', 'community', p_community_id, auth.uid(), p_community_id, 'Community restored by owner');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_community(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_community(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_empty_community(p_community_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_community record;
  v_gem_count int;
  v_member_count int;
  v_report_count int;
  v_invite_count int;
BEGIN
  SELECT id, owner_id INTO v_community FROM public.communities WHERE id = p_community_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  IF v_community.owner_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT count(*) INTO v_gem_count FROM public.gems WHERE community_id = p_community_id;
  SELECT count(*) INTO v_member_count FROM public.community_members WHERE community_id = p_community_id AND user_id != v_community.owner_id;
  SELECT count(*) INTO v_report_count FROM public.reports WHERE community_id = p_community_id;
  SELECT count(*) INTO v_invite_count FROM public.community_invitations WHERE community_id = p_community_id;

  IF v_gem_count > 0 OR v_member_count > 0 OR v_report_count > 0 OR v_invite_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community has dependent records and cannot be deleted');
  END IF;

  DELETE FROM public.community_members WHERE community_id = p_community_id AND user_id = v_community.owner_id;
  DELETE FROM public.communities WHERE id = p_community_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_empty_community(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_empty_community(uuid) TO authenticated;
