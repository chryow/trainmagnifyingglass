-- Revoke EXECUTE from PUBLIC (which covers anon) on all SECURITY DEFINER functions
-- that should not be publicly callable. Then grant to authenticated only where needed.

-- Functions that should NOT be callable via REST by anyone (trigger-only functions)
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_confirmation_cooldown() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_gem_edit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_collection_add() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_gem_reaction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_comment_rate_limited(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_gem_rate_limited(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_report_rate_limited(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_correction_rate_limited(uuid) FROM PUBLIC;

-- Functions callable by authenticated (used in RLS policies or via REST by logged-in users)
REVOKE EXECUTE ON FUNCTION public.accept_correction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_correction(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_see_gem(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_gem(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.escalate_correction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_correction(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_verification_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_verification_config() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_correction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_correction(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_more_info(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_more_info(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.shares_community(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_community(uuid, uuid) TO authenticated;