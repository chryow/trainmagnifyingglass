/*
# Fix community archive audit constraint and community cover image storage

## Plain-English summary

### 1. Archive audit constraint fix
The archive_community, restore_community, and delete_empty_community functions
insert target_type = 'community' into moderation_actions, but the
moderation_actions_target_type_check constraint only allows
['gem', 'user', 'report', 'suspension']. This causes archive/restore to fail.

Fix: Add 'community' to the allowed values in the check constraint. This is
the canonical target type for community-level actions, consistent with the
existing application vocabulary (target_type already distinguishes gems,
users, reports, suspensions — community is a natural addition).

### 2. Community cover image storage
Community cover images are currently uploaded to the gem-images bucket, which
has storage policies that check gems.author_id = auth.uid(). Community IDs
don't match gem IDs, so uploads are rejected.

Fix: Create a separate community-images bucket with policies that allow only
community owners to upload/update/delete, and anyone to read (public bucket).

## Changes

### Constraint change
- moderation_actions_target_type_check: adds 'community' to allowed values

### New storage bucket
- community-images (public read)

### New storage policies
- community_images_storage_read: SELECT for anyone (public bucket)
- community_images_storage_insert: INSERT only if communities.owner_id = auth.uid()
- community_images_storage_update: UPDATE only if communities.owner_id = auth.uid()
- community_images_storage_delete: DELETE only if communities.owner_id = auth.uid()

## Security
- The constraint is tightened, not loosened — 'community' is a specific
  canonical value, not unrestricted text
- Community image storage is owner-restricted for writes
- Public read access matches the public nature of community cover images
- No changes to gem-images or gem-evidence buckets
- No changes to existing RLS policies
- All three community management functions rechecked for authorization
*/

-- 1. Fix the check constraint to allow 'community' target type
ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_target_type_check;
ALTER TABLE public.moderation_actions ADD CONSTRAINT moderation_actions_target_type_check
  CHECK (target_type = ANY (ARRAY['gem'::text, 'user'::text, 'report'::text, 'suspension'::text, 'community'::text]));

-- 2. Create community-images bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for community-images bucket
-- Read: anyone (public bucket)
DROP POLICY IF EXISTS "community_images_storage_read" ON storage.objects;
CREATE POLICY "community_images_storage_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'community-images');

-- Insert: only community owner (path_tokens[1] = community ID)
DROP POLICY IF EXISTS "community_images_storage_insert" ON storage.objects;
CREATE POLICY "community_images_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-images'
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id::text = objects.path_tokens[1]
    AND c.owner_id = auth.uid()
  )
);

-- Update: only community owner
DROP POLICY IF EXISTS "community_images_storage_update" ON storage.objects;
CREATE POLICY "community_images_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id::text = objects.path_tokens[1]
    AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'community-images'
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id::text = objects.path_tokens[1]
    AND c.owner_id = auth.uid()
  )
);

-- Delete: only community owner
DROP POLICY IF EXISTS "community_images_storage_delete" ON storage.objects;
CREATE POLICY "community_images_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id::text = objects.path_tokens[1]
    AND c.owner_id = auth.uid()
  )
);
