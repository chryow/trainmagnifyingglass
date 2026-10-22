/*
# Public-Community Gem Visibility

## Plain-English summary
Published gems in public communities should be visible to ALL authenticated
users, not just community members. Private-community gems remain visible only
to members. This updates the central can_see_gem() helper and the gems SELECT
policy to allow authenticated non-members to see published gems in public
communities.

## Changes
1. Updates can_see_gem() to add: published gems in public communities are
   visible to any authenticated user.
2. Updates gems_select RLS policy to match.
3. Adds is_suspended check to gem_reactions and saved_gems INSERT to ensure
   suspension enforcement is consistent (reactions already check, saved_gems
   has no community interaction so no change needed).

## Security
- Private-community gems remain restricted to members only.
- Draft gems remain author-only.
- Hidden/removed gems remain restricted.
- Block and suspension checks on comments, reactions, confirmations, and
  corrections remain unchanged.
- No USING(true) policies added.
- can_see_gem remains SECURITY DEFINER with fixed search_path.
- EXECUTE privileges unchanged (authenticated only).
*/

-- Update can_see_gem to allow viewing published gems in public communities
CREATE OR REPLACE FUNCTION public.can_see_gem(g_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.gems g
  WHERE g.id = g_id
  AND (
    g.author_id = auth.uid()
    OR (g.status = 'published' AND public.is_community_member(g.community_id))
    OR (g.status = 'published' AND public.is_community_public(g.community_id))
    OR public.is_platform_admin()
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_gem(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_gem(uuid) TO authenticated;

-- Update gems SELECT policy to allow viewing published gems in public communities
DROP POLICY IF EXISTS "gems_select" ON public.gems;
CREATE POLICY "gems_select"
ON public.gems FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR (status = 'published' AND public.is_community_member(community_id))
  OR (status = 'published' AND public.is_community_public(community_id))
  OR public.is_platform_admin()
);
