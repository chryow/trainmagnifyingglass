/*
# Gem details, smarter search, featured picks

1. Practical details on gems: opening hours (free text), price level
   (1 = free … 4 = pricey) and "good for" tags.

2. Search that tolerates typos and ranks by relevance: pg_trgm similarity
   over title / place / area / description. search_gems() runs as the
   caller (SECURITY INVOKER), so the normal gem visibility rules still apply.

3. Featured picks chosen by platform admins: a "gem of the week" and a
   featured community, shown on Discover. Stored in their own table so gem
   authors (who can update their gems) can't feature themselves.
*/

-- ---------------------------------------------------------------------------
-- 1. Gem details
-- ---------------------------------------------------------------------------
ALTER TABLE public.gems
  ADD COLUMN IF NOT EXISTS opening_hours text CHECK (char_length(opening_hours) <= 200),
  ADD COLUMN IF NOT EXISTS price_level smallint CHECK (price_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS good_for text[] NOT NULL DEFAULT '{}'
    CHECK (good_for <@ ARRAY['rainy_days','working','dates','families','groups','solo','pets','late_night','budget','accessible']::text[]);

-- ---------------------------------------------------------------------------
-- 2. Search
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_gems_title_trgm ON public.gems USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gems_place_trgm ON public.gems USING gin (place_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gems_area_trgm ON public.gems USING gin (area extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_gems(
  p_query text DEFAULT '',
  p_category_id uuid DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_sort text DEFAULT 'relevance',
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.gems
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT lower(trim(coalesce(p_query, ''))) AS term)
  SELECT g.*
  FROM public.gems g, q
  WHERE g.status = 'published'
    AND (p_category_id IS NULL OR g.category_id = p_category_id)
    AND (p_area IS NULL OR p_area = '' OR g.area ILIKE '%' || p_area || '%')
    AND (
      q.term = ''
      OR g.title ILIKE '%' || q.term || '%'
      OR g.place_name ILIKE '%' || q.term || '%'
      OR g.area ILIKE '%' || q.term || '%'
      OR g.description ILIKE '%' || q.term || '%'
      OR q.term <% g.title
      OR q.term <% g.place_name
      OR q.term <% coalesce(g.area, '')
    )
  ORDER BY
    CASE WHEN p_sort = 'title' THEN lower(g.title) END ASC,
    CASE WHEN p_sort = 'recent' OR q.term = '' THEN g.created_at END DESC,
    greatest(
      word_similarity(q.term, g.title) * 1.5,
      word_similarity(q.term, g.place_name) * 1.2,
      word_similarity(q.term, coalesce(g.area, '')),
      CASE WHEN g.description ILIKE '%' || q.term || '%' THEN 0.3 ELSE 0 END
    ) DESC,
    g.created_at DESC
  LIMIT least(greatest(p_limit, 1), 50)
  OFFSET greatest(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.search_gems(text, uuid, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_gems(text, uuid, text, text, int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Featured picks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.featured_items (
  kind text PRIMARY KEY CHECK (kind IN ('gem', 'community')),
  item_id uuid NOT NULL,
  note text CHECK (char_length(note) <= 200),
  featured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  featured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "featured_select" ON public.featured_items;
CREATE POLICY "featured_select"
ON public.featured_items FOR SELECT
TO authenticated
USING (true);
-- No insert/update/delete policies: changes go through the admin RPCs below.

CREATE OR REPLACE FUNCTION public.admin_set_featured(p_kind text, p_item_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can feature content';
  END IF;
  IF p_kind NOT IN ('gem', 'community') THEN
    RAISE EXCEPTION 'Unknown kind %', p_kind;
  END IF;
  IF p_item_id IS NULL THEN
    DELETE FROM public.featured_items WHERE kind = p_kind;
    RETURN;
  END IF;
  IF p_kind = 'gem' AND NOT EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = p_item_id AND g.status = 'published' AND public.is_community_public(g.community_id)
  ) THEN
    RAISE EXCEPTION 'Only published gems in public communities can be featured';
  END IF;
  IF p_kind = 'community' AND NOT EXISTS (
    SELECT 1 FROM public.communities c WHERE c.id = p_item_id AND c.visibility = 'public' AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Only active public communities can be featured';
  END IF;

  INSERT INTO public.featured_items (kind, item_id, note, featured_by, featured_at)
  VALUES (p_kind, p_item_id, nullif(trim(p_note), ''), auth.uid(), now())
  ON CONFLICT (kind) DO UPDATE
    SET item_id = EXCLUDED.item_id, note = EXCLUDED.note,
        featured_by = EXCLUDED.featured_by, featured_at = EXCLUDED.featured_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_featured(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_featured(text, uuid, text) TO authenticated;
