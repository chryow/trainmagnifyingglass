-- ============================================================
-- Fix authenticated access to rate-limit helper functions
-- ============================================================
--
-- The original rate-limit migration uses these functions inside
-- INSERT policies for authenticated users, but it also revoked
-- EXECUTE permission from the authenticated role.
--
-- This migration keeps PUBLIC and anonymous users blocked while
-- allowing authenticated users to execute the helpers required
-- by the existing RLS policies.
--
-- Each helper is restricted to the currently authenticated user's
-- own activity through auth.uid().
-- ============================================================


-- ------------------------------------------------------------
-- Comment rate limit: 10 comments per 5 minutes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_comment_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id = auth.uid()
    AND (
      SELECT count(*) >= 10
      FROM public.comments
      WHERE author_id = auth.uid()
        AND created_at > now() - interval '5 minutes'
    );
$function$;

REVOKE ALL
ON FUNCTION public.is_comment_rate_limited(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_comment_rate_limited(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_comment_rate_limited(uuid)
TO authenticated;


-- ------------------------------------------------------------
-- Gem rate limit: 5 Gems per 10 minutes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_gem_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id = auth.uid()
    AND (
      SELECT count(*) >= 5
      FROM public.gems
      WHERE author_id = auth.uid()
        AND created_at > now() - interval '10 minutes'
    );
$function$;

REVOKE ALL
ON FUNCTION public.is_gem_rate_limited(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_gem_rate_limited(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_gem_rate_limited(uuid)
TO authenticated;


-- ------------------------------------------------------------
-- Report rate limit: 5 reports per 10 minutes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_report_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id = auth.uid()
    AND (
      SELECT count(*) >= 5
      FROM public.reports
      WHERE reporter_id = auth.uid()
        AND created_at > now() - interval '10 minutes'
    );
$function$;

REVOKE ALL
ON FUNCTION public.is_report_rate_limited(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_report_rate_limited(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_report_rate_limited(uuid)
TO authenticated;


-- ------------------------------------------------------------
-- Correction rate limit: 10 corrections per 10 minutes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_correction_rate_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id = auth.uid()
    AND (
      SELECT count(*) >= 10
      FROM public.correction_suggestions
      WHERE suggested_by = auth.uid()
        AND created_at > now() - interval '10 minutes'
    );
$function$;

REVOKE ALL
ON FUNCTION public.is_correction_rate_limited(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.is_correction_rate_limited(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.is_correction_rate_limited(uuid)
TO authenticated;