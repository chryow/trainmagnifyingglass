/*
# Phase 2 — Hidden Gems: Recommendations, Drafts, Images

## Plain-English summary
Adds the core "Hidden Gem" feature — user-submitted place recommendations
inside a community. Supports drafts, published gems, image uploads, category
tagging, duplicate prevention, and full RLS.

## New Tables
1. `gems` — recommendation entity. Belongs to a community + author, has
   title, description, place info, category, status (draft/published).
2. `gem_images` — additional images beyond the cover image.

## Duplicate prevention
Partial unique index on (community_id, author_id, lower(place_name)) where
status='published' — prevents publishing the same place twice in one
community. Drafts are exempt.

## Storage
Public bucket `gem-images`. Path convention: `<gem_id>/<filename>`.
Read: public. Write/update/delete: gem author only (via path_tokens[1]).

## RLS
- gems SELECT: drafts → author; published → community members + admin.
- gems INSERT: community members only, author = self.
- gems UPDATE: author only.
- gems DELETE: author, community owner, or admin.
- gem_images: delegates ownership to parent gem's author.
- Private community gems stay private (SELECT requires community membership).
*/

CREATE TABLE IF NOT EXISTS public.gems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
  description text CHECK (char_length(description) <= 2000),
  place_name text NOT NULL CHECK (char_length(place_name) >= 1 AND char_length(place_name) <= 200),
  area text,
  address text,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  cover_image_url text,
  is_hidden boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gem_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gems_community ON public.gems (community_id);
CREATE INDEX IF NOT EXISTS idx_gems_author ON public.gems (author_id);
CREATE INDEX IF NOT EXISTS idx_gems_status ON public.gems (status);
CREATE INDEX IF NOT EXISTS idx_gems_category ON public.gems (category_id);
CREATE INDEX IF NOT EXISTS idx_gems_area ON public.gems (area);
CREATE INDEX IF NOT EXISTS idx_gems_published ON public.gems (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_gem_images_gem ON public.gem_images (gem_id);

-- Duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS uq_gems_published_per_community_author_place
  ON public.gems (community_id, author_id, lower(place_name))
  WHERE status = 'published';

-- RLS
ALTER TABLE public.gems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_images ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a member of the given community?
CREATE OR REPLACE FUNCTION public.is_community_member(comm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = comm_id
      AND user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid) TO authenticated;

-- gems SELECT
DROP POLICY IF EXISTS "gems_select" ON public.gems;
CREATE POLICY "gems_select"
ON public.gems FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR (status = 'published' AND public.is_community_member(community_id))
  OR public.is_platform_admin()
);

-- gems INSERT
DROP POLICY IF EXISTS "gems_insert" ON public.gems;
CREATE POLICY "gems_insert"
ON public.gems FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status IN ('draft','published')
  AND public.is_community_member(community_id)
);

-- gems UPDATE (author only)
DROP POLICY IF EXISTS "gems_update_own" ON public.gems;
CREATE POLICY "gems_update_own"
ON public.gems FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- gems DELETE (author, community owner, or admin)
DROP POLICY IF EXISTS "gems_delete" ON public.gems;
CREATE POLICY "gems_delete"
ON public.gems FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = gems.community_id AND c.owner_id = auth.uid()
  )
  OR public.is_platform_admin()
);

-- gem_images SELECT (delegate to gem visibility)
DROP POLICY IF EXISTS "gem_images_select" ON public.gem_images;
CREATE POLICY "gem_images_select"
ON public.gem_images FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = gem_images.gem_id
      AND (
        g.author_id = auth.uid()
        OR (g.status = 'published' AND public.is_community_member(g.community_id))
        OR public.is_platform_admin()
      )
  )
);

-- gem_images INSERT (gem author only)
DROP POLICY IF EXISTS "gem_images_insert" ON public.gem_images;
CREATE POLICY "gem_images_insert"
ON public.gem_images FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = gem_images.gem_id
      AND g.author_id = auth.uid()
  )
);

-- gem_images UPDATE (gem author only)
DROP POLICY IF EXISTS "gem_images_update_own" ON public.gem_images;
CREATE POLICY "gem_images_update_own"
ON public.gem_images FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = gem_images.gem_id
      AND g.author_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = gem_images.gem_id
      AND g.author_id = auth.uid()
  )
);

-- gem_images DELETE (gem author only)
DROP POLICY IF EXISTS "gem_images_delete_own" ON public.gem_images;
CREATE POLICY "gem_images_delete_own"
ON public.gem_images FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = gem_images.gem_id
      AND g.author_id = auth.uid()
  )
);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS trg_gems_updated ON public.gems;
CREATE TRIGGER trg_gems_updated
BEFORE UPDATE ON public.gems
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- STORAGE BUCKET — gem-images
-- ============================================================================
-- Path convention: gem-images/<gem_id>/<filename>
-- path_tokens[1] = gem_id, path_tokens[2] = filename

INSERT INTO storage.buckets (id, name, public)
VALUES ('gem-images', 'gem-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "gem_images_storage_read" ON storage.objects;
CREATE POLICY "gem_images_storage_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gem-images');

DROP POLICY IF EXISTS "gem_images_storage_insert" ON storage.objects;
CREATE POLICY "gem_images_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gem-images'
  AND EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id::text = path_tokens[1]
      AND g.author_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "gem_images_storage_update" ON storage.objects;
CREATE POLICY "gem_images_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gem-images'
  AND EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id::text = path_tokens[1]
      AND g.author_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "gem_images_storage_delete" ON storage.objects;
CREATE POLICY "gem_images_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gem-images'
  AND EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id::text = path_tokens[1]
      AND g.author_id = auth.uid()
  )
);
