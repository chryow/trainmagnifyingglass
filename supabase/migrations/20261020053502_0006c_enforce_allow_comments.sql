-- Enforce allow_comments at the RLS level: if a gem author has disabled comments,
-- no one else can comment on their gems.

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
);