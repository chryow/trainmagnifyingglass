/*
# Phase 5d: Fix EXECUTE grants on Phase 5 functions

## Overview
The REVOKE EXECUTE statements in the Phase 5 migration didn't take effect
because PostgreSQL grants EXECUTE to PUBLIC by default when a function
is created, and REVOKE from anon alone may not override the PUBLIC grant.

## Changes
- REVOKE EXECUTE on all privileged Phase 5 functions from PUBLIC and anon
- GRANT EXECUTE to authenticated only for functions users need
- Keep helper functions (is_blocked, is_either_blocked, is_community_moderator) 
  executable by authenticated only
*/

REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_suspend_user(uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_lift_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.escalate_report(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_account(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_account(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_moderation_action(text, text, uuid, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_either_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_community_moderator(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_report(text, uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_either_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_suspend_user(uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_lift_suspension(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_report(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_account(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_account(uuid, text) TO authenticated;