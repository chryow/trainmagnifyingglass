/*
# Link previews for shared gems + make "hide gem" actually hide

## Part A: hidden gems
moderator_hide_gem() set gems.is_hidden = true, but no visibility rule ever
checked that column, so hidden gems stayed visible to everyone. The column
also defaulted to TRUE, so every gem was already flagged hidden.
- Default is now false; existing gems are reset unless their most recent
  moderation action was 'hide_gem'.
- Hidden gems are visible only to their author, the community's moderators
  and platform admins (gems SELECT policy + can_see_gem(), which comments,
  reactions and photos rely on).
- Platform admins may hide/restore too, not only community moderators.

## Part B: link previews

When someone shares /g/<gem id> on WhatsApp, Instagram etc., the preview
server function needs a title, place and photo without anyone being signed
in. get_gem_preview() returns ONLY those display fields, and ONLY for
published, non-hidden gems in active public communities. Everything else
(private communities, drafts, hidden gems, unknown ids) returns no row.
*/

CREATE OR REPLACE FUNCTION public.get_gem_preview(p_gem_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  place_name text,
  area text,
  summary text,
  cover_image_url text,
  category_name text,
  community_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.title,
    g.place_name,
    g.area,
    left(regexp_replace(coalesce(g.description, ''), '\s+', ' ', 'g'), 180),
    g.cover_image_url,
    cat.name,
    c.name
  FROM public.gems g
  JOIN public.communities c ON c.id = g.community_id
  LEFT JOIN public.categories cat ON cat.id = g.category_id
  WHERE g.id = p_gem_id
    AND g.status = 'published'
    AND coalesce(g.is_hidden, false) = false
    AND c.visibility = 'public'
    AND c.is_active;
$$;

REVOKE ALL ON FUNCTION public.get_gem_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gem_preview(uuid) TO anon, authenticated;

-- ===========================================================================
-- Part A: hidden gems
-- ===========================================================================
ALTER TABLE public.gems ALTER COLUMN is_hidden SET DEFAULT false;

UPDATE public.gems g
SET is_hidden = false
WHERE g.is_hidden
  AND coalesce((
    SELECT ma.action_type FROM public.moderation_actions ma
    WHERE ma.target_type = 'gem' AND ma.target_id = g.id
      AND ma.action_type IN ('hide_gem', 'restore_gem')
    ORDER BY ma.created_at DESC
    LIMIT 1
  ), 'restore_gem') <> 'hide_gem';

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
    OR public.is_platform_admin()
    OR public.is_community_moderator(g.community_id)
    OR (
      g.status = 'published' AND NOT g.is_hidden
      AND (public.is_community_member(g.community_id) OR public.is_community_public(g.community_id))
    )
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_gem(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_gem(uuid) TO authenticated;

DROP POLICY IF EXISTS "gems_select" ON public.gems;
CREATE POLICY "gems_select"
ON public.gems FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_platform_admin()
  OR public.is_community_moderator(community_id)
  OR (
    status = 'published' AND NOT is_hidden
    AND (public.is_community_member(community_id) OR public.is_community_public(community_id))
  )
);

-- Let platform admins hide/restore as well as community moderators
CREATE OR REPLACE FUNCTION public.moderator_hide_gem(p_gem_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gem_community_id uuid;
BEGIN
  SELECT community_id INTO v_gem_community_id FROM gems WHERE id = p_gem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gem not found');
  END IF;
  IF NOT (public.is_community_moderator(v_gem_community_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE gems SET is_hidden = true, updated_at = now() WHERE id = p_gem_id;
  PERFORM public.log_moderation_action('hide_gem', 'gem', p_gem_id, p_reason, v_gem_community_id);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_restore_gem(p_gem_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gem_community_id uuid;
BEGIN
  SELECT community_id INTO v_gem_community_id FROM gems WHERE id = p_gem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gem not found');
  END IF;
  IF NOT (public.is_community_moderator(v_gem_community_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE gems SET is_hidden = false, updated_at = now() WHERE id = p_gem_id;
  PERFORM public.log_moderation_action('restore_gem', 'gem', p_gem_id, p_reason, v_gem_community_id);
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) TO authenticated;
