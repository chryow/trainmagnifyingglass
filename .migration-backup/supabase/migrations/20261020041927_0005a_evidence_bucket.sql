/*
# Phase 5a — Private evidence storage bucket

## Purpose
Creates a separate PRIVATE storage bucket `gem-evidence` for confirmation
and correction evidence photos. Unlike `gem-images` (public, author-only),
this bucket is private and uses signed URLs for retrieval.

## Path conventions
- Confirmation evidence: `confirmations/<gem_id>/<confirmation_id>/<filename>`
- Correction evidence: `corrections/<gem_id>/<correction_id>/<filename>`
- Report evidence: `reports/<report_id>/<filename>`

## Storage policies

### Confirmation evidence INSERT
- User must be authenticated
- User must be a member of the gem's community
- User must be able to see the gem
- Path must start with `confirmations/`

### Correction evidence INSERT
- User must be authenticated
- User must be able to see the gem
- User must NOT be the gem author (authors can't suggest corrections)
- Path must start with `corrections/`

### Evidence SELECT (read)
- Private bucket: no public access
- Confirmation evidence: visible to the confirmation author, community moderators,
  and platform admins
- Correction evidence: visible to the correction author, gem owner, and platform admins
- Report evidence: visible to the reporter and platform admins only

### Evidence DELETE
- Confirmation: author only
- Correction: author only
- Report: reporter only (within cooldown) or admin

## Important
- The existing `gem-images` bucket and its policies are NOT modified.
- Evidence files use generated UUID filenames to prevent path guessing.
- The bucket is private (public=false), so no public URLs are available.
- Signed URLs are used for retrieval in the application.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('gem-evidence', 'gem-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Helper: can user view confirmation evidence at a given path?
-- Path: confirmations/<gem_id>/<confirmation_id>/<filename>
-- ============================================================================

-- ============================================================================
-- STORAGE POLICIES — gem-evidence bucket
-- ============================================================================

-- INSERT: confirmation evidence
-- Path: confirmations/<gem_id>/<confirmation_id>/<filename>
DROP POLICY IF EXISTS "evidence_insert_confirmation" ON storage.objects;
CREATE POLICY "evidence_insert_confirmation"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'confirmations'
  AND EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id::text = path_tokens[2]
      AND public.is_community_member(g.community_id)
      AND public.can_see_gem(g.id)
  )
);

-- INSERT: correction evidence
-- Path: corrections/<gem_id>/<correction_id>/<filename>
DROP POLICY IF EXISTS "evidence_insert_correction" ON storage.objects;
CREATE POLICY "evidence_insert_correction"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'corrections'
  AND EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id::text = path_tokens[2]
      AND g.author_id != auth.uid()
      AND public.can_see_gem(g.id)
  )
);

-- INSERT: report evidence
-- Path: reports/<report_id>/<filename>
DROP POLICY IF EXISTS "evidence_insert_report" ON storage.objects;
CREATE POLICY "evidence_insert_report"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'reports'
);

-- SELECT: confirmation evidence
-- Visible to: confirmation author, community moderators, platform admins
DROP POLICY IF EXISTS "evidence_select_confirmation" ON storage.objects;
CREATE POLICY "evidence_select_confirmation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'confirmations'
  AND (
    -- Confirmation author (check if this path's confirmation belongs to user)
    EXISTS (
      SELECT 1 FROM public.gem_confirmations gc
      WHERE gc.id::text = path_tokens[3]
        AND gc.user_id = auth.uid()
    )
    -- Platform admin
    OR public.is_platform_admin()
    -- Community moderator of the gem's community
    OR EXISTS (
      SELECT 1 FROM public.gem_confirmations gc
      JOIN public.gems g ON g.id = gc.gem_id
      JOIN public.community_members cm ON cm.community_id = g.community_id
      WHERE gc.id::text = path_tokens[3]
        AND cm.user_id = auth.uid()
        AND cm.role = 'moderator'
    )
  )
);

-- SELECT: correction evidence
-- Visible to: correction author, gem owner, platform admins
DROP POLICY IF EXISTS "evidence_select_correction" ON storage.objects;
CREATE POLICY "evidence_select_correction"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'corrections'
  AND (
    -- Correction author
    EXISTS (
      SELECT 1 FROM public.correction_suggestions cs
      WHERE cs.id::text = path_tokens[3]
        AND cs.suggested_by = auth.uid()
    )
    -- Gem owner
    OR EXISTS (
      SELECT 1 FROM public.correction_suggestions cs
      JOIN public.gems g ON g.id = cs.gem_id
      WHERE cs.id::text = path_tokens[3]
        AND g.author_id = auth.uid()
    )
    -- Platform admin
    OR public.is_platform_admin()
  )
);

-- SELECT: report evidence
-- Visible to: reporter and platform admins only
DROP POLICY IF EXISTS "evidence_select_report" ON storage.objects;
CREATE POLICY "evidence_select_report"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'reports'
  AND (
    public.is_platform_admin()
    -- Reporter: we'll check via the reports table once it exists
    -- For now, admin-only; report SELECT will be added after reports table
  )
);

-- DELETE: confirmation evidence (author only)
DROP POLICY IF EXISTS "evidence_delete_confirmation" ON storage.objects;
CREATE POLICY "evidence_delete_confirmation"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'confirmations'
  AND EXISTS (
    SELECT 1 FROM public.gem_confirmations gc
    WHERE gc.id::text = path_tokens[3]
      AND gc.user_id = auth.uid()
  )
);

-- DELETE: correction evidence (author only)
DROP POLICY IF EXISTS "evidence_delete_correction" ON storage.objects;
CREATE POLICY "evidence_delete_correction"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'corrections'
  AND EXISTS (
    SELECT 1 FROM public.correction_suggestions cs
    WHERE cs.id::text = path_tokens[3]
        AND cs.suggested_by = auth.uid()
  )
);

-- DELETE: report evidence (reporter or admin)
DROP POLICY IF EXISTS "evidence_delete_report" ON storage.objects;
CREATE POLICY "evidence_delete_report"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'reports'
  AND public.is_platform_admin()
);

-- UPDATE: no update policy for evidence (immutable once uploaded)
