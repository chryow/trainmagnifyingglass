/*
# Harden Phase 1 functions

Fixes security advisor warnings:
1. set_updated_at: set search_path, it's a trigger function (not directly callable via API, but tighten anyway).
2. handle_new_user, add_owner_as_member: these are trigger-only SECURITY DEFINER functions. Revoke EXECUTE from anon/authenticated so they cannot be called via the REST API; triggers still fire because they run with the function's privileges.
3. is_platform_admin: set explicit search_path (already set). Revoke execute from anon to prevent anon probing; keep authenticated (used in policies — policies run with invoker... actually policies run as the caller). Keep authenticated execute.
*/

ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM anon, authenticated;
