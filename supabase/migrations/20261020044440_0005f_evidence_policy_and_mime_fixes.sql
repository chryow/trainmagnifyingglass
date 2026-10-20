-- Fix Report-Evidence Storage Policies + Server-Side MIME Validation
-- 1. Report-evidence INSERT: check report exists and uploader is reporter
-- 2. Report-evidence SELECT: reporter + mods + admins
-- 3. MIME validation trigger on gem-evidence bucket

-- Fix report-evidence INSERT policy
DROP POLICY IF EXISTS "evidence_insert_report" ON storage.objects;
CREATE POLICY "evidence_insert_report"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'reports'
  AND EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id::text = objects.path_tokens[2]
      AND r.reporter_id = auth.uid()
  )
);

-- Fix report-evidence SELECT policy
DROP POLICY IF EXISTS "evidence_select_report" ON storage.objects;
CREATE POLICY "evidence_select_report"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gem-evidence'
  AND path_tokens[1] = 'reports'
  AND (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id::text = objects.path_tokens[2]
        AND r.reporter_id = auth.uid()
    )
    OR is_platform_admin()
    OR (
      EXISTS (
        SELECT 1 FROM reports r
        WHERE r.id::text = objects.path_tokens[2]
          AND r.community_id IS NOT NULL
          AND is_community_moderator(r.community_id)
      )
    )
  )
);

-- MIME validation trigger function for gem-evidence bucket
CREATE OR REPLACE FUNCTION public.validate_evidence_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mime text;
  v_bucket text;
  v_allowed_mimes text[] := ARRAY['image/jpeg', 'image/png', 'image/webp'];
BEGIN
  v_bucket := NEW.bucket_id;
  v_mime := NEW.mime_type;

  IF v_bucket = 'gem-evidence' THEN
    IF v_mime IS NULL OR NOT (v_mime = ANY(v_allowed_mimes)) THEN
      RAISE EXCEPTION 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_evidence_upload() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_evidence_upload() TO authenticated;

-- Trigger to enforce MIME type on evidence uploads
DROP TRIGGER IF EXISTS enforce_evidence_mime_type ON storage.objects;
CREATE TRIGGER enforce_evidence_mime_type
BEFORE INSERT ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.validate_evidence_upload();