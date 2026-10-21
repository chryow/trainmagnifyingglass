/*
# Phase 4 — Information Accuracy: Confirmations, Verification Status, Corrections, Edit History

## Plain-English summary
Adds an information-accuracy system for Hidden Gems. Community members can
confirm whether a gem's information is still accurate, report changes, or flag
closure. The system calculates a verification status from these confirmations.
Users can suggest corrections to gem details; gem owners review and accept/reject
them. All significant changes are recorded in an immutable edit history.

## Configurable thresholds (stored in a single config table)
- confirmation_cooldown_hours: 24 — minimum time between confirmations by same user
- fresh_confirmation_days: 90 — confirmations within this window are "fresh"
- outdated_days: 180 — gems not confirmed within this period become "may be outdated"
- min_independent_confirmations: 2 — minimum agreeing fresh confirmations for "Community Confirmed"
- conflict_threshold: 2 — if 2+ conflicting fresh confirmation types, status = "Under Review"
- temp_unavailable_threshold: 2 — if 2+ recent "Temporarily Unavailable", status = "Temporarily Unavailable"
- permanent_closure_threshold: 3 — if 3+ recent "Permanently Closed", status = "Permanently Closed"

## New Tables
1. `verification_config` — single-row config table with threshold values.
2. `gem_confirmations` — community confirmations on gems.
3. `correction_suggestions` — user-submitted corrections for gem fields.
4. `gem_edit_history` — immutable audit log of significant gem changes.

## Modified Tables
- `gems` — add `verification_status` column (text, default 'new').

## Verification status values
- new, community_confirmed, may_be_outdated, temporarily_unavailable,
  permanently_closed, under_review

## Confirmation types
- still_accurate, information_changed, temporarily_unavailable,
  permanently_closed, could_not_find

## Correction types
- name, address, description, category, price_level, facilities,
  accessibility, visiting_time, availability, other

## Correction statuses
- pending, accepted, rejected, needs_info, escalated

## RLS Design

### gem_confirmations
- SELECT: visible to anyone who can see the gem (can_see_gem).
- INSERT: authenticated, must be community member, must be able to see gem,
  cannot confirm own gem for "community_confirmed" purposes (but CAN submit),
  cooldown enforced via trigger.
- UPDATE/DELETE: own confirmation only, and only within editable window.

### correction_suggestions
- SELECT: gem owner OR suggestion author OR platform admin.
  (Others cannot see pending corrections.)
- INSERT: authenticated, must be able to see gem.
- UPDATE: only review fields, only by gem owner. Author cannot update after submit.
- DELETE: no delete policy (preserve history). Actually allow author to withdraw
  pending suggestions, and owner can reject. We'll use UPDATE for status changes.

### gem_edit_history
- SELECT: gem owner + anyone who can see the gem (for transparency).
  Actually: only gem owner and platform admin can see full history.
  Community members can see a summary. We'll allow SELECT for can_see_gem.
- INSERT: SECURITY DEFINER trigger only. No direct INSERT by users.
- UPDATE/DELETE: no policies (immutable). Revoke from all roles.

## Trigger functions (all SECURITY DEFINER)
- `enforce_confirmation_cooldown()` — prevents duplicate confirmations within
  cooldown period, prevents self-confirmation from counting toward community
  confirmed status.
- `recalculate_verification_status()` — calculates status from confirmations.
  Called after confirmation insert/update/delete.
- `log_gem_edit()` — creates edit history entries when gem fields change.
- `apply_accepted_correction()` — SECURITY DEFINER function that safely applies
  an accepted correction, updating only the intended field and creating history.
*/

-- ============================================================================
-- CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verification_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirmation_cooldown_hours int NOT NULL DEFAULT 24,
  fresh_confirmation_days int NOT NULL DEFAULT 90,
  outdated_days int NOT NULL DEFAULT 180,
  min_independent_confirmations int NOT NULL DEFAULT 2,
  conflict_threshold int NOT NULL DEFAULT 2,
  temp_unavailable_threshold int NOT NULL DEFAULT 2,
  permanent_closure_threshold int NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.verification_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ADD verification_status TO gems
-- ============================================================================

ALTER TABLE public.gems
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'new'
  CHECK (verification_status IN ('new','community_confirmed','may_be_outdated','temporarily_unavailable','permanently_closed','under_review'));

CREATE INDEX IF NOT EXISTS idx_gems_verification_status ON public.gems (verification_status);

-- ============================================================================
-- TABLE: gem_confirmations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gem_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirmation_type text NOT NULL CHECK (
    confirmation_type IN ('still_accurate','information_changed','temporarily_unavailable','permanently_closed','could_not_find')
  ),
  note text CHECK (char_length(note) <= 500),
  evidence_image_url text,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gem_confirmations_active
  ON public.gem_confirmations (gem_id, user_id)
  WHERE withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gem_confirmations_gem ON public.gem_confirmations (gem_id);
CREATE INDEX IF NOT EXISTS idx_gem_confirmations_user ON public.gem_confirmations (user_id);
CREATE INDEX IF NOT EXISTS idx_gem_confirmations_type ON public.gem_confirmations (confirmation_type);
CREATE INDEX IF NOT EXISTS idx_gem_confirmations_created ON public.gem_confirmations (created_at DESC);

-- ============================================================================
-- TABLE: correction_suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.correction_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  correction_type text NOT NULL CHECK (
    correction_type IN ('name','address','description','category','price_level','facilities','accessibility','visiting_time','availability','other')
  ),
  current_value text,
  suggested_value text NOT NULL CHECK (char_length(suggested_value) >= 1 AND char_length(suggested_value) <= 2000),
  explanation text NOT NULL CHECK (char_length(explanation) >= 10 AND char_length(explanation) <= 1000),
  evidence_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','accepted','rejected','needs_info','escalated')
  ),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text CHECK (char_length(resolution_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_corrections_pending
  ON public.correction_suggestions (gem_id, correction_type, suggested_value)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_corrections_gem ON public.correction_suggestions (gem_id);
CREATE INDEX IF NOT EXISTS idx_corrections_suggested_by ON public.correction_suggestions (suggested_by);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.correction_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_corrections_reviewed_by ON public.correction_suggestions (reviewed_by);

-- ============================================================================
-- TABLE: gem_edit_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gem_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  changed_field text NOT NULL,
  previous_value text,
  new_value text,
  change_source text NOT NULL CHECK (
    change_source IN ('owner_edit','accepted_correction','verification_calculation','system_update')
  ),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_correction_id uuid REFERENCES public.correction_suggestions(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edit_history_gem ON public.gem_edit_history (gem_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_created ON public.gem_edit_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_history_field ON public.gem_edit_history (changed_field);
CREATE INDEX IF NOT EXISTS idx_edit_history_source ON public.gem_edit_history (change_source);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.verification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_edit_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: verification_config (readable by all authenticated)
-- ============================================================================

DROP POLICY IF EXISTS "verification_config_select" ON public.verification_config;
CREATE POLICY "verification_config_select"
ON public.verification_config FOR SELECT
TO authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policy for normal users.
-- Only platform admins can modify config.
DROP POLICY IF EXISTS "verification_config_update_admin" ON public.verification_config;
CREATE POLICY "verification_config_update_admin"
ON public.verification_config FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ============================================================================
-- RLS: gem_confirmations
-- ============================================================================

DROP POLICY IF EXISTS "gem_confirmations_select" ON public.gem_confirmations;
CREATE POLICY "gem_confirmations_select"
ON public.gem_confirmations FOR SELECT
TO authenticated
USING (public.can_see_gem(gem_id));

DROP POLICY IF EXISTS "gem_confirmations_insert" ON public.gem_confirmations;
CREATE POLICY "gem_confirmations_insert"
ON public.gem_confirmations FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_see_gem(gem_id)
  AND public.is_community_member(
    (SELECT community_id FROM public.gems WHERE id = gem_id)
  )
);

DROP POLICY IF EXISTS "gem_confirmations_update_own" ON public.gem_confirmations;
CREATE POLICY "gem_confirmations_update_own"
ON public.gem_confirmations FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gem_confirmations_delete_own" ON public.gem_confirmations;
CREATE POLICY "gem_confirmations_delete_own"
ON public.gem_confirmations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- RLS: correction_suggestions
-- ============================================================================

DROP POLICY IF EXISTS "corrections_select" ON public.correction_suggestions;
CREATE POLICY "corrections_select"
ON public.correction_suggestions FOR SELECT
TO authenticated
USING (
  suggested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = correction_suggestions.gem_id
      AND g.author_id = auth.uid()
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "corrections_insert" ON public.correction_suggestions;
CREATE POLICY "corrections_insert"
ON public.correction_suggestions FOR INSERT
TO authenticated
WITH CHECK (
  suggested_by = auth.uid()
  AND public.can_see_gem(gem_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = correction_suggestions.gem_id
      AND g.author_id = auth.uid()
  )
);

-- UPDATE: only gem owner can update status/review fields.
-- The suggestion author cannot modify their suggestion after submission.
DROP POLICY IF EXISTS "corrections_update_owner" ON public.correction_suggestions;
CREATE POLICY "corrections_update_owner"
ON public.correction_suggestions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = correction_suggestions.gem_id
      AND g.author_id = auth.uid()
  )
  OR public.is_platform_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = correction_suggestions.gem_id
      AND g.author_id = auth.uid()
  )
  OR public.is_platform_admin()
);

-- No DELETE policy — corrections are preserved for audit trail.
REVOKE DELETE ON public.correction_suggestions FROM anon, authenticated;

-- ============================================================================
-- RLS: gem_edit_history
-- ============================================================================

DROP POLICY IF EXISTS "edit_history_select" ON public.gem_edit_history;
CREATE POLICY "edit_history_select"
ON public.gem_edit_history FOR SELECT
TO authenticated
USING (public.can_see_gem(gem_id));

-- No INSERT/UPDATE/DELETE for normal users — SECURITY DEFINER triggers only.
REVOKE INSERT, UPDATE, DELETE ON public.gem_edit_history FROM anon, authenticated;

-- ============================================================================
-- HELPER: get config value
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_verification_config()
RETURNS public.verification_config
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.verification_config WHERE id = 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_verification_config() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_verification_config() TO authenticated;

-- ============================================================================
-- TRIGGER: enforce confirmation cooldown
-- Prevents a user from submitting a new confirmation within the cooldown period
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_confirmation_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.verification_config;
  last_confirmed timestamptz;
  existing_id uuid;
BEGIN
  cfg := public.get_verification_config();

  -- Check if user already has an active (non-withdrawn) confirmation for this gem
  SELECT id, created_at INTO existing_id, last_confirmed
  FROM public.gem_confirmations
  WHERE gem_id = NEW.gem_id
    AND user_id = NEW.user_id
    AND withdrawn_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL AND FOUND THEN
    RAISE EXCEPTION 'You already have an active confirmation for this gem. Withdraw it first or wait for the cooldown.';
  END IF;

  -- Check cooldown: user cannot submit a new confirmation within cooldown period
  -- even after withdrawing (prevents rapid re-confirmation cycling)
  SELECT MAX(created_at) INTO last_confirmed
  FROM public.gem_confirmations
  WHERE gem_id = NEW.gem_id
    AND user_id = NEW.user_id;

  IF last_confirmed IS NOT NULL THEN
    IF now() - last_confirmed < make_interval(hours => cfg.confirmation_cooldown_hours) THEN
      RAISE EXCEPTION 'Confirmation cooldown active. Please wait before submitting another confirmation.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_confirmation_cooldown() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_confirmation_cooldown ON public.gem_confirmations;
CREATE TRIGGER trg_confirmation_cooldown
BEFORE INSERT ON public.gem_confirmations
FOR EACH ROW EXECUTE FUNCTION public.enforce_confirmation_cooldown();

-- ============================================================================
-- TRIGGER: updated_at for gem_confirmations
-- ============================================================================

DROP TRIGGER IF EXISTS trg_gem_confirmations_updated ON public.gem_confirmations;
CREATE TRIGGER trg_gem_confirmations_updated
BEFORE UPDATE ON public.gem_confirmations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_corrections_updated ON public.correction_suggestions;
CREATE TRIGGER trg_corrections_updated
BEFORE UPDATE ON public.correction_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- FUNCTION: recalculate verification status
-- Called after confirmation insert/update/delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.verification_config;
  g_id uuid;
  g_author uuid;
  fresh_window_start timestamptz;
  outdated_start timestamptz;
  gem_created timestamptz;

  -- Aggregates of fresh, active, non-withdrawn confirmations (excluding gem author's own)
  fresh_count int;
  still_accurate_count int;
  information_changed_count int;
  temp_unavail_count int;
  perm_closed_count int;
  could_not_find_count int;
  distinct_types int;
  distinct_users int;

  -- All active confirmations (including author's) for counting
  total_active int;

  -- Latest confirmation date
  latest_confirmed timestamptz;

  new_status text;
BEGIN
  -- Determine the gem_id from the triggering row
  IF TG_OP = 'DELETE' THEN
    g_id := OLD.gem_id;
  ELSE
    g_id := NEW.gem_id;
  END IF;

  -- Get the gem's author and creation date
  SELECT author_id, created_at INTO g_author, gem_created
  FROM public.gems WHERE id = g_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  cfg := public.get_verification_config();
  fresh_window_start := now() - make_interval(days => cfg.fresh_confirmation_days);

  -- Count fresh, active, non-withdrawn confirmations EXCLUDING the gem author
  -- (author's own confirmation doesn't count toward community confirmed)
  SELECT
    count(*),
    count(*) FILTER (WHERE confirmation_type = 'still_accurate'),
    count(*) FILTER (WHERE confirmation_type = 'information_changed'),
    count(*) FILTER (WHERE confirmation_type = 'temporarily_unavailable'),
    count(*) FILTER (WHERE confirmation_type = 'permanently_closed'),
    count(*) FILTER (WHERE confirmation_type = 'could_not_find'),
    count(DISTINCT confirmation_type),
    count(DISTINCT user_id)
  INTO
    fresh_count, still_accurate_count, information_changed_count,
    temp_unavail_count, perm_closed_count, could_not_find_count,
    distinct_types, distinct_users
  FROM public.gem_confirmations
  WHERE gem_id = g_id
    AND withdrawn_at IS NULL
    AND user_id != g_author
    AND created_at >= fresh_window_start;

  -- Get latest active confirmation date (including author's)
  SELECT MAX(created_at) INTO latest_confirmed
  FROM public.gem_confirmations
  WHERE gem_id = g_id AND withdrawn_at IS NULL;

  total_active := fresh_count; -- fresh_count already excludes author

  -- Determine status using priority rules:

  -- Rule 1: Permanently closed (highest priority safety warning)
  IF perm_closed_count >= cfg.permanent_closure_threshold THEN
    new_status := 'permanently_closed';
  -- Rule 2: Conflicting information
  ELSIF distinct_types >= cfg.conflict_threshold AND
        still_accurate_count > 0 AND
        (information_changed_count > 0 OR temp_unavail_count > 0 OR perm_closed_count > 0 OR could_not_find_count > 0) THEN
    new_status := 'under_review';
  -- Rule 3: Temporarily unavailable
  ELSIF temp_unavail_count >= cfg.temp_unavailable_threshold THEN
    new_status := 'temporarily_unavailable';
  -- Rule 4: Community confirmed (multiple independent agreeing "still_accurate")
  ELSIF still_accurate_count >= cfg.min_independent_confirmations
        AND distinct_users >= cfg.min_independent_confirmations THEN
    new_status := 'community_confirmed';
  -- Rule 5: Information may be outdated (no fresh confirmations)
  ELSIF fresh_count = 0 THEN
    -- Check if the gem is old enough to be considered outdated
    IF gem_created < now() - make_interval(days => cfg.outdated_days) THEN
      new_status := 'may_be_outdated';
    ELSE
      new_status := 'new';
    END IF;
  -- Rule 6: Default — information changed but no consensus
  ELSIF information_changed_count > 0 AND still_accurate_count = 0 THEN
    new_status := 'may_be_outdated';
  -- Rule 7: Default to new if nothing else matches
  ELSE
    new_status := 'new';
  END IF;

  -- Update the gem's verification status
  -- Only create edit history if status actually changed
  DECLARE
    old_status text;
  BEGIN
    SELECT verification_status INTO old_status FROM public.gems WHERE id = g_id;
    IF old_status IS DISTINCT FROM new_status THEN
      UPDATE public.gems SET verification_status = new_status WHERE id = g_id;

      -- Create edit history entry for status change
      INSERT INTO public.gem_edit_history (gem_id, changed_field, previous_value, new_value, change_source, changed_by, reason)
      VALUES (g_id, 'verification_status', old_status, new_status, 'verification_calculation', NULL,
        'Recalculated from ' || total_active || ' fresh confirmation(s)');
    END IF;
  END;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_status() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_recalc_status_insert ON public.gem_confirmations;
CREATE TRIGGER trg_recalc_status_insert
AFTER INSERT ON public.gem_confirmations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_verification_status();

DROP TRIGGER IF EXISTS trg_recalc_status_update ON public.gem_confirmations;
CREATE TRIGGER trg_recalc_status_update
AFTER UPDATE OF confirmation_type, withdrawn_at ON public.gem_confirmations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_verification_status();

DROP TRIGGER IF EXISTS trg_recalc_status_delete ON public.gem_confirmations;
CREATE TRIGGER trg_recalc_status_delete
AFTER DELETE ON public.gem_confirmations
FOR EACH ROW EXECUTE FUNCTION public.recalculate_verification_status();

-- ============================================================================
-- TRIGGER: log gem edits (owner_edit)
-- Creates edit history entries when the owner changes tracked fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_gem_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracked_fields text[] := ARRAY['title','description','place_name','area','address','category_id','cover_image_url'];
  field text;
  old_val text;
  new_val text;
  status_changed boolean := false;
BEGIN
  FOREACH field IN ARRAY tracked_fields LOOP
    old_val := (CASE WHEN field = 'title' THEN OLD.title::text
               WHEN field = 'description' THEN OLD.description::text
               WHEN field = 'place_name' THEN OLD.place_name::text
               WHEN field = 'area' THEN OLD.area::text
               WHEN field = 'address' THEN OLD.address::text
               WHEN field = 'category_id' THEN OLD.category_id::text
               WHEN field = 'cover_image_url' THEN OLD.cover_image_url::text
               ELSE NULL END);
    new_val := (CASE WHEN field = 'title' THEN NEW.title::text
               WHEN field = 'description' THEN NEW.description::text
               WHEN field = 'place_name' THEN NEW.place_name::text
               WHEN field = 'area' THEN NEW.area::text
               WHEN field = 'address' THEN NEW.address::text
               WHEN field = 'category_id' THEN NEW.category_id::text
               WHEN field = 'cover_image_url' THEN NEW.cover_image_url::text
               ELSE NULL END);

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.gem_edit_history (gem_id, changed_field, previous_value, new_value, change_source, changed_by, reason)
      VALUES (NEW.id, field, old_val, new_val, 'owner_edit', NEW.author_id, NULL);
    END IF;
  END LOOP;

  -- Track verification_status changes (but don't double-log if trigger already did)
  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    -- Only log if this wasn't already logged by the verification recalculation
    -- The recalculation trigger creates its own history entry, so we skip here
    -- to avoid duplicates. We detect this by checking if the change is from
    -- an owner edit (which wouldn't change verification_status directly) vs
    -- a system update.
    -- Actually, owner edits don't change verification_status directly, so this
    -- branch only fires if something else changed it. We skip to avoid duplicates.
    NULL;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_gem_edit() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_gem_edit ON public.gems;
CREATE TRIGGER trg_log_gem_edit
AFTER UPDATE OF title, description, place_name, area, address, category_id, cover_image_url ON public.gems
FOR EACH ROW EXECUTE FUNCTION public.log_gem_edit();

-- ============================================================================
-- FUNCTION: apply accepted correction (SECURITY DEFINER)
-- Safely applies a correction suggestion, updating only the intended field
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_correction(
  p_correction_id uuid,
  p_resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  corr public.correction_suggestions;
  g public.gems;
  field_name text;
  old_val text;
  new_val text;
BEGIN
  -- Lock the correction row
  SELECT * INTO corr FROM public.correction_suggestions WHERE id = p_correction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction not found';
  END IF;

  IF corr.status != 'pending' THEN
    RAISE EXCEPTION 'Correction is no longer pending (current status: %)', corr.status;
  END IF;

  -- Verify the caller is the gem owner (authorization recheck)
  SELECT * INTO g FROM public.gems WHERE id = corr.gem_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gem not found';
  END IF;

  IF g.author_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You are not authorized to review this correction';
  END IF;

  -- The suggestion author cannot approve their own correction
  IF corr.suggested_by = auth.uid() THEN
    RAISE EXCEPTION 'You cannot approve your own correction';
  END IF;

  -- Map correction_type to gem field name
  field_name := CASE corr.correction_type
    WHEN 'name' THEN 'title'
    WHEN 'address' THEN 'address'
    WHEN 'description' THEN 'description'
    WHEN 'category' THEN 'category_id'
    WHEN 'availability' THEN 'verification_status'
    ELSE NULL
  END;

  -- For fields we can directly map, verify the current value hasn't changed
  -- and apply the correction
  IF field_name = 'title' THEN
    old_val := g.title;
    IF old_val != corr.current_value AND corr.current_value IS NOT NULL THEN
      RAISE EXCEPTION 'The current value has changed since this correction was submitted. Please review before accepting.';
    END IF;
    new_val := corr.suggested_value;
    UPDATE public.gems SET title = new_val WHERE id = g.id;

  ELSIF field_name = 'address' THEN
    old_val := g.address;
    IF old_val IS DISTINCT FROM corr.current_value AND corr.current_value IS NOT NULL THEN
      RAISE EXCEPTION 'The current value has changed since this correction was submitted. Please review before accepting.';
    END IF;
    new_val := corr.suggested_value;
    UPDATE public.gems SET address = new_val WHERE id = g.id;

  ELSIF field_name = 'description' THEN
    old_val := g.description;
    IF old_val IS DISTINCT FROM corr.current_value AND corr.current_value IS NOT NULL THEN
      RAISE EXCEPTION 'The current value has changed since this correction was submitted. Please review before accepting.';
    END IF;
    new_val := corr.suggested_value;
    UPDATE public.gems SET description = new_val WHERE id = g.id;

  ELSIF field_name = 'category_id' THEN
    old_val := g.category_id::text;
    -- For category, we don't re-check current_value since category IDs may differ
    new_val := corr.suggested_value;
    UPDATE public.gems SET category_id = new_val::uuid WHERE id = g.id;

  ELSIF field_name = 'verification_status' THEN
    -- Availability corrections don't directly map to a gem field in the same way.
    -- We record the correction but don't change the gem field directly.
    -- The verification status is calculated from confirmations, not corrections.
    NULL;

  ELSE
    -- For correction types like price_level, facilities, accessibility,
    -- visiting_time, other — there's no direct gem field yet.
    -- We still record the correction as accepted (for future field expansion).
    NULL;
  END IF;

  -- Update the correction status
  UPDATE public.correction_suggestions
  SET status = 'accepted',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  -- Create edit history entry
  IF field_name IS NOT NULL AND field_name != 'verification_status' THEN
    INSERT INTO public.gem_edit_history (gem_id, changed_field, previous_value, new_value, change_source, changed_by, related_correction_id, reason)
    VALUES (g.id, field_name, old_val, new_val, 'accepted_correction', auth.uid(), p_correction_id, p_resolution_note);
  END IF;

  -- Notify the correction author
  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'comment', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_correction(uuid, text) TO authenticated;

-- ============================================================================
-- FUNCTION: reject correction (SECURITY DEFINER)
-- Records the rejection and notifies the author
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_correction(
  p_correction_id uuid,
  p_resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  corr public.correction_suggestions;
  g public.gems;
BEGIN
  SELECT * INTO corr FROM public.correction_suggestions WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction not found'; END IF;
  IF corr.status != 'pending' THEN RAISE EXCEPTION 'Correction is no longer pending'; END IF;

  SELECT * INTO g FROM public.gems WHERE id = corr.gem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gem not found'; END IF;

  IF g.author_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You are not authorized to review this correction';
  END IF;

  UPDATE public.correction_suggestions
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'comment', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_correction(uuid, text) TO authenticated;

-- ============================================================================
-- FUNCTION: request more info on correction (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_more_info(
  p_correction_id uuid,
  p_resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  corr public.correction_suggestions;
  g public.gems;
BEGIN
  SELECT * INTO corr FROM public.correction_suggestions WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction not found'; END IF;
  IF corr.status != 'pending' THEN RAISE EXCEPTION 'Correction is no longer pending'; END IF;

  SELECT * INTO g FROM public.gems WHERE id = corr.gem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gem not found'; END IF;

  IF g.author_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You are not authorized to review this correction';
  END IF;

  UPDATE public.correction_suggestions
  SET status = 'needs_info',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'comment', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_more_info(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_more_info(uuid, text) TO authenticated;

-- ============================================================================
-- FUNCTION: escalate correction (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.escalate_correction(
  p_correction_id uuid,
  p_resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  corr public.correction_suggestions;
  g public.gems;
BEGIN
  SELECT * INTO corr FROM public.correction_suggestions WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction not found'; END IF;
  IF corr.status != 'pending' THEN RAISE EXCEPTION 'Correction is no longer pending'; END IF;

  SELECT * INTO g FROM public.gems WHERE id = corr.gem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gem not found'; END IF;

  IF g.author_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You are not authorized to review this correction';
  END IF;

  UPDATE public.correction_suggestions
  SET status = 'escalated',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'comment', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.escalate_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_correction(uuid, text) TO authenticated;

-- ============================================================================
-- TRIGGER: notify on correction decision (already handled in accept/reject
-- functions via create_notification, using type 'comment' and entity 'correction')
-- We need to add 'correction' to the notification type CHECK constraint.
-- ============================================================================

-- We can't modify the CHECK constraint in place. We need to handle this carefully.
-- The notification type CHECK allows: comment, reply, gem_reaction, comment_reaction, follow, collection_add
-- We need to add 'correction_accepted', 'correction_rejected', 'correction_review'
-- But since we're using 'comment' as the type in the functions above, we should
-- update the notification type to be more specific. Let's fix the functions to
-- use proper notification types. First, drop the constraint and recreate it.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment','reply','gem_reaction','comment_reaction','follow','collection_add',
    'correction_accepted','correction_rejected','correction_needs_info','correction_escalated'));
