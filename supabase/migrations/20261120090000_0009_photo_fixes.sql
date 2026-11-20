/*
# Photo fixes

1. Gem gallery photos invisible to non-members
   Migration 0006l made published gems in PUBLIC communities visible to every
   signed-in user, but the gem_images SELECT policy still required community
   membership. Non-members saw the gem and its cover but an empty gallery.
   The policy now uses can_see_gem(), the same rule as the gem itself.

2. Profile photo uploads
   Profiles only supported pasting an image URL. Adds a public `avatars`
   bucket; users can only write inside their own folder (avatars/<user id>/).
*/

-- 1. Gallery photos follow the gem's own visibility
DROP POLICY IF EXISTS "gem_images_select" ON public.gem_images;
CREATE POLICY "gem_images_select"
ON public.gem_images FOR SELECT
TO authenticated
USING (public.can_see_gem(gem_id));

-- 2. Avatars bucket: 2 MB, images only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
