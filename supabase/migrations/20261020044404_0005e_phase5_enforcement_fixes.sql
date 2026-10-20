/*
# Phase 5 Enforcement Fixes

## Overview
This migration fixes three critical Phase 5 gaps:
1. Suspension enforcement — suspended users can currently still create gems, comment, react, confirm, and submit corrections in the suspended community.
2. Blocker identity leak — `blocked_users` SELECT policy allows the blocked user to see who blocked them.
3. Comment block policy has two conflicting INSERT policies; the block-aware one blocks ALL comments (not just replies as documented).

## Changes

### 1. New helper function: `is_suspended(user_id, community_id)`
- Returns true if the user has an active (unlifted, unexpired) suspension in the given community.
- SECURITY DEFINER, STABLE, returns boolean.
- EXECUTE granted to authenticated only.

### 2. Gems INSERT policy updated
- Added `NOT is_suspended(auth.uid(), community_id)` to the WITH CHECK.
- Suspended users cannot create new gems in the suspended community.

### 3. Comments INSERT policies updated
- Dropped the old `comments_insert` policy (which had no block check).
- Dropped the `comments_insert_own` policy (which blocked all comments between blocked users).
- Created a single `comments_insert_own` policy that:
  - Checks author_id = auth.uid()
  - Checks can_see_gem(gem_id)
  - Checks NOT is_either_blocked between commenter and gem author
  - Checks NOT is_suspended in the gem's community

### 4. Reactions INSERT policy updated
- Added block check and suspension check to `gem_reactions_insert`.

### 5. Confirmations INSERT policy updated
- Added suspension check to `gem_confirmations_insert`.

### 6. Corrections INSERT policy updated
- Added block check and suspension check to `corrections_insert`.

### 7. blocked_users SELECT policy narrowed
- Changed from `(auth.uid() = blocker_id OR auth.uid() = blocked_id)` to `auth.uid() = blocker_id` only.
- Blocked users can no longer see who blocked them.

## Security
- All new/modified policies are TO authenticated.
- `is_suspended` is SECURITY DEFINER with safe search_path.
- EXECUTE on `is_suspended` granted to authenticated only, revoked from anon and PUBLIC.
*/

-- ============================================================
-- 1. is_suspended helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_suspended(p_user_id uuid, p_community_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_suspensions
    WHERE user_id = p_user_id
      AND community_id = p_community_id
      AND lifted_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_suspended(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid, uuid) TO authenticated;

-- ============================================================
-- 2. blocked_users SELECT — narrow to blocker only
-- ============================================================

DROP POLICY IF EXISTS "blocked_users_select_own" ON blocked_users;
CREATE POLICY "blocked_users_select_own"
ON blocked_users FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

-- ============================================================
-- 3. Gems INSERT — add suspension check
-- ============================================================

DROP POLICY IF EXISTS "gems_insert" ON gems;
CREATE POLICY "gems_insert"
ON gems FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status IN ('draft', 'published')
  AND is_community_member(community_id)
  AND NOT is_suspended(auth.uid(), community_id)
);

-- ============================================================
-- 4. Comments INSERT — single policy with block + suspension checks
-- ============================================================

DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own"
ON comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND can_see_gem(gem_id)
  AND NOT is_either_blocked(auth.uid(), (SELECT author_id FROM gems WHERE gems.id = comments.gem_id))
  AND NOT is_suspended(auth.uid(), (SELECT community_id FROM gems WHERE gems.id = comments.gem_id))
);

-- ============================================================
-- 5. Reactions INSERT — add block + suspension checks
-- ============================================================

DROP POLICY IF EXISTS "gem_reactions_insert" ON gem_reactions;
CREATE POLICY "gem_reactions_insert"
ON gem_reactions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND can_see_gem(gem_id)
  AND NOT is_either_blocked(auth.uid(), (SELECT author_id FROM gems WHERE gems.id = gem_reactions.gem_id))
  AND NOT is_suspended(auth.uid(), (SELECT community_id FROM gems WHERE gems.id = gem_reactions.gem_id))
);

-- ============================================================
-- 6. Confirmations INSERT — add suspension check
-- ============================================================

DROP POLICY IF EXISTS "gem_confirmations_insert" ON gem_confirmations;
CREATE POLICY "gem_confirmations_insert"
ON gem_confirmations FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND can_see_gem(gem_id)
  AND is_community_member((SELECT community_id FROM gems WHERE gems.id = gem_confirmations.gem_id))
  AND NOT is_suspended(auth.uid(), (SELECT community_id FROM gems WHERE gems.id = gem_confirmations.gem_id))
);

-- ============================================================
-- 7. Corrections INSERT — add block + suspension checks
-- ============================================================

DROP POLICY IF EXISTS "corrections_insert" ON correction_suggestions;
CREATE POLICY "corrections_insert"
ON correction_suggestions FOR INSERT
TO authenticated
WITH CHECK (
  suggested_by = auth.uid()
  AND can_see_gem(gem_id)
  AND NOT EXISTS (SELECT 1 FROM gems g WHERE g.id = correction_suggestions.gem_id AND g.author_id = auth.uid())
  AND NOT is_either_blocked(auth.uid(), (SELECT author_id FROM gems WHERE gems.id = correction_suggestions.gem_id))
  AND NOT is_suspended(auth.uid(), (SELECT community_id FROM gems WHERE gems.id = correction_suggestions.gem_id))
);