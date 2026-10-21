/*
# Fix community RLS recursion + transactional community creation

## Root cause
The communities SELECT policy inline-queries community_members, and the
community_members SELECT policy inline-queries communities. Each inline
query re-evaluates the other table's RLS policies, creating an infinite
recursion: communities_select → community_members (cm_select) →
communities (communities_select) → ...

## Fix
1. Replace inline cross-table subqueries in communities and
   community_members policies with calls to existing SECURITY DEFINER
   helper functions is_community_member() and is_community_moderator().
   These functions run with owner privileges and bypass RLS, breaking
   the recursive chain.

2. Add a transactional create_community() SECURITY DEFINER RPC that
   inserts both the community row and the owner membership row in a
   single function. This prevents ownerless communities if either
   insert fails, and avoids the client doing two separate inserts.

## Security
- RLS remains enabled on communities and community_members.
- Private communities remain inaccessible to non-members.
- The create_community function assigns owner_id from auth.uid()
  server-side — clients cannot create communities owned by others.
- is_community_moderator rechecks auth.uid() (already does).
- EXECUTE on create_community restricted to authenticated only.
- All functions use fixed search_path = public.

## Non-destructive
- No tables or columns changed.
- No data deleted or modified.
- Existing communities and memberships remain intact.
- Policies are dropped and recreated (idempotent).
*/

-- ============================================================================
-- 1. Break recursion: replace inline cross-table subqueries with helpers
-- ============================================================================

-- communities SELECT: use is_community_member() instead of inline subquery
DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select"
ON public.communities FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR public.is_community_member(communities.id)
  OR public.is_platform_admin()
);

-- community_members SELECT: use is_community_moderator() instead of
-- inline subquery on communities. For the "member sees own membership"
-- case we keep user_id = auth.uid() directly (no cross-table needed).
-- For "community owner sees all members" we use is_community_moderator()
-- which queries communities with owner_id = auth.uid() under SECURITY
-- DEFINER (no RLS re-evaluation).
-- For "public community membership is visible" we use a helper to avoid
-- inline communities query.

-- Create a safe helper: is the given community public?
CREATE OR REPLACE FUNCTION public.is_community_public(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND visibility = 'public'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_community_public(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_community_public(uuid) TO authenticated;

DROP POLICY IF EXISTS "cm_select" ON public.community_members;
CREATE POLICY "cm_select"
ON public.community_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_moderator(community_members.community_id)
  OR public.is_community_public(community_members.community_id)
  OR public.is_platform_admin()
);

-- community_members INSERT: use is_community_public() instead of inline
DROP POLICY IF EXISTS "cm_insert_own" ON public.community_members;
CREATE POLICY "cm_insert_own"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND (
    public.is_community_public(community_members.community_id)
    OR public.is_community_moderator(community_members.community_id)
  )
);

-- community_members UPDATE: use is_community_moderator() (already does via inline,
-- but replace with the function for consistency and to avoid any recursion)
DROP POLICY IF EXISTS "cm_update_owner" ON public.community_members;
CREATE POLICY "cm_update_owner"
ON public.community_members FOR UPDATE
TO authenticated
USING (public.is_community_moderator(community_members.community_id) OR public.is_platform_admin())
WITH CHECK (public.is_community_moderator(community_members.community_id) OR public.is_platform_admin());

-- community_members DELETE: use is_community_moderator()
DROP POLICY IF EXISTS "cm_delete" ON public.community_members;
CREATE POLICY "cm_delete"
ON public.community_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_moderator(community_members.community_id)
  OR public.is_platform_admin()
);

-- ============================================================================
-- 2. Transactional create_community RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_community(
  p_name text,
  p_description text DEFAULT NULL,
  p_community_type text DEFAULT 'interest_based',
  p_visibility text DEFAULT 'public',
  p_general_area text DEFAULT NULL,
  p_guidelines text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_community_id uuid;
BEGIN
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_community_type NOT IN ('location_based', 'interest_based', 'private_group') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid community type');
  END IF;

  IF p_visibility NOT IN ('public', 'private') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid visibility');
  END IF;

  INSERT INTO public.communities (name, description, community_type, visibility, general_area, guidelines, owner_id)
  VALUES (p_name, p_description, p_community_type, p_visibility, p_general_area, p_guidelines, v_owner_id)
  RETURNING id INTO v_community_id;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, v_owner_id, 'owner');

  RETURN jsonb_build_object('success', true, 'community_id', v_community_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, text) TO authenticated;
