/*
# Phase 3 Security Fixes

## Issues found during review:

1. **COLLECTION_ITEMS SELECT — private-community gem exposure via public collections**
   The collection_items SELECT policy only checked collection visibility, not gem
   visibility. A public collection containing a gem from a private community would
   expose that gem's row via the join. Fix: add `can_see_gem(gem_id)` to the
   collection_items SELECT policy so the gem itself must be visible to the viewer.

2. **GEM_REACTIONS — missing UPDATE policy**
   While the frontend uses delete+insert rather than update, RLS should still have
   an explicit deny-by-default posture. Add UPDATE policy (owner only).

3. **COMMENT_REACTIONS — missing UPDATE policy**
   Same as above. Add UPDATE policy (owner only).

4. **SAVED_GEMS — missing UPDATE policy**
   Add UPDATE policy (owner only) for completeness.

5. **FOLLOWS — missing UPDATE policy**
   Add UPDATE policy (follower only) for completeness.
*/

-- Fix 1: collection_items SELECT must also verify gem visibility
DROP POLICY IF EXISTS "collection_items_select" ON public.collection_items;
CREATE POLICY "collection_items_select"
ON public.collection_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND (
        c.owner_id = auth.uid()
        OR c.visibility = 'public'
        OR (c.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.followee_id = c.owner_id
        ))
        OR public.is_platform_admin()
      )
  )
  AND public.can_see_gem(collection_items.gem_id)
);

-- Fix 2: gem_reactions UPDATE policy (owner only)
DROP POLICY IF EXISTS "gem_reactions_update_own" ON public.gem_reactions;
CREATE POLICY "gem_reactions_update_own"
ON public.gem_reactions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 3: comment_reactions UPDATE policy (owner only)
DROP POLICY IF EXISTS "comment_reactions_update_own" ON public.comment_reactions;
CREATE POLICY "comment_reactions_update_own"
ON public.comment_reactions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 4: saved_gems UPDATE policy (owner only)
DROP POLICY IF EXISTS "saved_gems_update_own" ON public.saved_gems;
CREATE POLICY "saved_gems_update_own"
ON public.saved_gems FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 5: follows UPDATE policy (follower only)
DROP POLICY IF EXISTS "follows_update_own" ON public.follows;
CREATE POLICY "follows_update_own"
ON public.follows FOR UPDATE
TO authenticated
USING (follower_id = auth.uid())
WITH CHECK (follower_id = auth.uid());
