/*
# Phase 1 Security Fixes — Authorization Hardening

## Plain-English summary
This migration fixes three authorization defects discovered during the
Phase 1 security review, plus one hardening improvement:

1. **Role escalation via profile UPDATE** — The profiles_update_self policy
   allowed users to update ANY column on their own row, including `role`.
   A regular user could run `UPDATE profiles SET role='admin'` and grant
   themselves administrator privileges. Fixed by revoking column-level
   UPDATE privilege on `role` (and other privileged columns) from the
   `authenticated` role, so even though the RLS policy permits the row
   update, Postgres denies the column write.

2. **Self-assigned moderator on community join** — The cm_insert_own policy
   checked user_id and community visibility but did NOT validate the `role`
   value. A user could insert a row with `role='moderator'` and join any
   public community as a moderator. Fixed by adding `role = 'member'` to
   the INSERT WITH CHECK predicate.

3. **Profile visibility not enforced** — profiles_select_public used
   `USING (true)`, exposing every profile to every authenticated user
   regardless of the `profile_visibility` setting. Fixed by creating a
   `shares_community()` helper and rewriting the SELECT policy so that
   `community_only` profiles are visible only to users who share at least
   one community membership.

4. **is_platform_admin() callable by anon** — The helper function was
   executable by the anon role, letting unauthenticated users probe it.
   Revoked EXECUTE from anon.

## Changed tables
- `profiles` — column-level UPDATE privilege on `role` revoked from
  `authenticated` and `anon`.
- `community_members` — INSERT policy tightened to require `role = 'member'`.
- `profiles` — SELECT policy rewritten to respect `profile_visibility`.

## New functions
- `shares_community(user_a uuid, user_b uuid)` — returns true if two users
  belong to at least one common community. Used by the profile SELECT policy.

## Security changes
- `profiles_select_public` → replaced with `profiles_select_respecting_visibility`
- `cm_insert_own` → WITH CHECK now includes `role = 'member'`
- Column-level GRANT REVOKE on `profiles.role`
- `REVOKE EXECUTE ON is_platform_admin() FROM anon`

## Important notes
1. The column-level revoke is the primary defense against role escalation.
   Even if a future RLS policy accidentally allows the update, Postgres
   will reject the `role` column write for authenticated users.
2. `shares_community` is SECURITY DEFINER (runs with elevated privileges)
   so it can read community_members across all users. It is STABLE and
   safe to call from RLS policies. EXECUTE is granted to authenticated only.
3. The profiles SELECT policy still allows users to see their own profile
   regardless of visibility setting.
*/

-- ============================================================================
-- Helper: shares_community(user_a, user_b)
-- Returns true if two users share at least one community membership.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.shares_community(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members cm_a
    JOIN public.community_members cm_b
      ON cm_a.community_id = cm_b.community_id
    WHERE cm_a.user_id = user_a
      AND cm_b.user_id = user_b
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_community(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.shares_community(uuid, uuid) TO authenticated;

-- ============================================================================
-- Fix 1: Prevent role escalation via column-level privileges
-- ============================================================================
-- Revoke UPDATE on the `role` column from authenticated and anon so that
-- even though the RLS policy allows updating one's own row, the `role`
-- column cannot be changed by a regular user. Only the service role
-- (which bypasses RLS) or the set_user_role() SECURITY DEFINER function
-- can change roles.
REVOKE UPDATE (role) ON public.profiles FROM authenticated;
REVOKE UPDATE (role) ON public.profiles FROM anon;

-- ============================================================================
-- Fix 2: Prevent self-assigned moderator role on community join
-- ============================================================================
DROP POLICY IF EXISTS "cm_insert_own" ON public.community_members;
CREATE POLICY "cm_insert_own"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id
      AND (c.visibility = 'public' OR c.owner_id = auth.uid())
  )
);

-- ============================================================================
-- Fix 3: Enforce profile_visibility in SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_respecting_visibility"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR profile_visibility = 'public'
  OR public.shares_community(auth.uid(), id)
  OR public.is_platform_admin()
);

-- ============================================================================
-- Fix 4: Revoke EXECUTE on is_platform_admin() from anon
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
