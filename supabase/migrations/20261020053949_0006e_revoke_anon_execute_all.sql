-- Revoke EXECUTE from anon on all SECURITY DEFINER functions that should not be public.
-- Trigger functions don't need direct EXECUTE from any role.
-- Helper functions used in RLS need EXECUTE from authenticated only.

REVOKE EXECUTE ON FUNCTION public.accept_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_see_gem(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_confirmation_cooldown() FROM anon;
REVOKE EXECUTE ON FUNCTION public.escalate_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_verification_config() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_comment_rate_limited(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_correction_rate_limited(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_gem_rate_limited(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_report_rate_limited(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_gem_edit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_collection_add() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_gem_reaction() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_more_info(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shares_community(uuid, uuid) FROM anon;

-- Also revoke from authenticated on functions that should only be called via triggers (not via REST)
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_confirmation_cooldown() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_gem_edit() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_collection_add() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_gem_reaction() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_comment_rate_limited(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_gem_rate_limited(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_report_rate_limited(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_correction_rate_limited(uuid) FROM authenticated;