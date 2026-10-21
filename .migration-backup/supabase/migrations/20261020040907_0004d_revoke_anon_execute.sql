/*
# Phase 4d — Revoke EXECUTE from anon on correction functions

The accept/reject/request_more_info/escalate functions should only be
callable by authenticated users. The SECURITY DEFINER body re-checks
authorization, but anon should not be able to call them at all.
*/

REVOKE EXECUTE ON FUNCTION public.accept_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_more_info(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.escalate_correction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_verification_config() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_confirmation_cooldown() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_gem_edit() FROM anon;
