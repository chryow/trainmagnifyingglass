-- ============================================================
-- Abuse protection: rate-limiting helper functions
-- ============================================================
-- These functions check if a user has exceeded submission thresholds
-- within a time window. They are used in RLS INSERT policies to
-- prevent spam at the database level.

-- Check if user has posted too many comments recently
-- Limit: 10 comments per 5 minutes
CREATE OR REPLACE FUNCTION public.is_comment_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 10
  FROM comments
  WHERE author_id = p_user_id
    AND created_at > now() - interval '5 minutes';
$$;
REVOKE EXECUTE ON FUNCTION public.is_comment_rate_limited(uuid) FROM anon, authenticated;

-- Check if user has submitted too many gems recently
-- Limit: 5 gems per 10 minutes
CREATE OR REPLACE FUNCTION public.is_gem_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 5
  FROM gems
  WHERE author_id = p_user_id
    AND created_at > now() - interval '10 minutes';
$$;
REVOKE EXECUTE ON FUNCTION public.is_gem_rate_limited(uuid) FROM anon, authenticated;

-- Check if user has submitted too many reports recently
-- Limit: 5 reports per 10 minutes
CREATE OR REPLACE FUNCTION public.is_report_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 5
  FROM reports
  WHERE reporter_id = p_user_id
    AND created_at > now() - interval '10 minutes';
$$;
REVOKE EXECUTE ON FUNCTION public.is_report_rate_limited(uuid) FROM anon, authenticated;

-- Check if user has submitted too many corrections recently
-- Limit: 10 corrections per 10 minutes
CREATE OR REPLACE FUNCTION public.is_correction_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 10
  FROM correction_suggestions
  WHERE suggested_by = p_user_id
    AND created_at > now() - interval '10 minutes';
$$;
REVOKE EXECUTE ON FUNCTION public.is_correction_rate_limited(uuid) FROM anon, authenticated;

-- ============================================================
-- Update INSERT policies to include rate-limit checks
-- ============================================================

-- Comments: add rate limit check
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own"
ON comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND can_see_gem(gem_id)
  AND NOT is_either_blocked(auth.uid(), (SELECT author_id FROM gems WHERE gems.id = comments.gem_id))
  AND NOT is_suspended(auth.uid(), (SELECT community_id FROM gems WHERE gems.id = comments.gem_id))
  AND EXISTS (
    SELECT 1 FROM gems g
    JOIN profiles p ON p.id = g.author_id
    WHERE g.id = comments.gem_id
      AND (g.author_id = auth.uid() OR p.allow_comments = true)
  )
  AND NOT is_comment_rate_limited(auth.uid())
);

-- Gems: add rate limit check
DROP POLICY IF EXISTS "gems_insert_own" ON gems;
CREATE POLICY "gems_insert_own"
ON gems FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND is_community_member(community_id)
  AND NOT is_suspended(auth.uid(), community_id)
  AND NOT is_gem_rate_limited(auth.uid())
);

-- Reports: add rate limit check
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
ON reports FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND NOT is_report_rate_limited(auth.uid())
);

-- Corrections: add rate limit check
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
  AND NOT is_correction_rate_limited(auth.uid())
);