/*
# Phase 5: User Blocking, Reporting, Community Moderation, and Audit History

## Overview
This migration adds safety and moderation features to the Hidden Gems platform.
All changes are additive — no existing tables, columns, or policies are modified.

## New Tables
1. blocked_users — User-to-user blocks
2. reports — User reports of profiles, gems, comments, collections, communities
3. community_suspensions — Community moderator suspensions
4. moderation_actions — Immutable audit log

## New Functions (all SECURITY DEFINER, safe search_path)
- is_community_moderator, is_blocked, is_either_blocked
- block_user, unblock_user, create_report
- moderator_hide_gem, moderator_restore_gem
- moderator_suspend_user, moderator_lift_suspension
- escalate_report, admin_resolve_report
- admin_deactivate_account, admin_reactivate_account
- log_moderation_action (internal)

## Security
- RLS on all new tables
- EXECUTE revoked from anon on privileged functions
- UPDATE/DELETE revoked on moderation_actions for immutability
- is_active column added to profiles (defaults true)

## Non-destructive
No existing tables, columns, or policies modified.
*/

-- ============================================================================
-- Add is_active column to profiles (non-destructive)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- Helper: is_community_moderator (depends on existing tables only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_community_moderator(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND user_id = auth.uid()
    AND role = 'moderator'
  ) OR EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id
    AND owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- blocked_users table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
CREATE POLICY "blocked_users_select_own" ON public.blocked_users
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- Helper functions that depend on blocked_users
CREATE OR REPLACE FUNCTION public.is_blocked(p_blocker_id uuid, p_blocked_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_either_blocked(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$;

-- ============================================================================
-- reports table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('profile', 'gem', 'comment', 'collection', 'community')),
  target_id uuid NOT NULL,
  community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'misinformation', 'inappropriate_content',
    'off_topic', 'duplicate', 'other'
  )),
  description text,
  evidence_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewing', 'resolved', 'dismissed', 'escalated'
  )),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  escalation_reason text,
  escalated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_community_mod" ON public.reports;
CREATE POLICY "reports_select_community_mod" ON public.reports
  FOR SELECT TO authenticated USING (
    community_id IS NOT NULL AND public.is_community_moderator(community_id)
  );

DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT TO authenticated USING (public.is_platform_admin());

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_community_mod" ON public.reports;
CREATE POLICY "reports_update_community_mod" ON public.reports
  FOR UPDATE TO authenticated USING (
    community_id IS NOT NULL AND public.is_community_moderator(community_id)
  ) WITH CHECK (
    community_id IS NOT NULL AND public.is_community_moderator(community_id)
  );

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE TO authenticated USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_community ON public.reports(community_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);

-- ============================================================================
-- community_suspensions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suspended_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  duration_hours integer,
  expires_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_at timestamptz,
  lift_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duration_hours IS NULL OR duration_hours > 0)
);

ALTER TABLE public.community_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suspensions_select_community_mod" ON public.community_suspensions;
CREATE POLICY "suspensions_select_community_mod" ON public.community_suspensions
  FOR SELECT TO authenticated USING (public.is_community_moderator(community_id));

DROP POLICY IF EXISTS "suspensions_select_own" ON public.community_suspensions;
CREATE POLICY "suspensions_select_own" ON public.community_suspensions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "suspensions_select_admin" ON public.community_suspensions;
CREATE POLICY "suspensions_select_admin" ON public.community_suspensions
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_suspensions_community ON public.community_suspensions(community_id);
CREATE INDEX IF NOT EXISTS idx_suspensions_user ON public.community_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_suspensions_active ON public.community_suspensions(community_id, user_id)
  WHERE lifted_at IS NULL;

-- ============================================================================
-- moderation_actions table (immutable audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN (
    'hide_gem', 'restore_gem', 'suspend_user', 'lift_suspension',
    'escalate_report', 'resolve_report', 'deactivate_account',
    'reactivate_account', 'dismiss_report'
  )),
  target_type text NOT NULL CHECK (target_type IN ('gem', 'user', 'report', 'suspension')),
  target_id uuid NOT NULL,
  moderator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mod_actions_select_community_mod" ON public.moderation_actions;
CREATE POLICY "mod_actions_select_community_mod" ON public.moderation_actions
  FOR SELECT TO authenticated USING (
    community_id IS NOT NULL AND public.is_community_moderator(community_id)
  );

DROP POLICY IF EXISTS "mod_actions_select_admin" ON public.moderation_actions;
CREATE POLICY "mod_actions_select_admin" ON public.moderation_actions
  FOR SELECT TO authenticated USING (public.is_platform_admin());

REVOKE UPDATE, DELETE ON public.moderation_actions FROM authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_mod_actions_community ON public.moderation_actions(community_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON public.moderation_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON public.moderation_actions(target_type, target_id);

-- ============================================================================
-- log_moderation_action (internal helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_moderation_action(
  p_action_type text,
  p_target_type text,
  p_target_id uuid,
  p_reason text DEFAULT NULL,
  p_community_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO moderation_actions (action_type, target_type, target_id, moderator_id, community_id, reason, metadata)
  VALUES (p_action_type, p_target_type, p_target_id, auth.uid(), p_community_id, p_reason, p_metadata);
END;
$$;

-- ============================================================================
-- block_user / unblock_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocker_id uuid := auth.uid();
BEGIN
  IF v_blocker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_blocker_id = p_blocked_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot block yourself');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_blocked_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_id)
  VALUES (v_blocker_id, p_blocked_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  DELETE FROM follows WHERE follower_id = v_blocker_id AND followee_id = p_blocked_user_id;
  DELETE FROM follows WHERE follower_id = p_blocked_user_id AND followee_id = v_blocker_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocker_id uuid := auth.uid();
BEGIN
  IF v_blocker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM blocked_users
  WHERE blocker_id = v_blocker_id AND blocked_id = p_blocked_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- create_report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_description text DEFAULT NULL,
  p_community_id uuid DEFAULT NULL,
  p_evidence_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id uuid := auth.uid();
  v_report_id uuid;
  v_community_id uuid;
BEGIN
  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_target_type = 'profile' THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target profile not found');
    END IF;
  ELSIF p_target_type = 'gem' THEN
    IF NOT EXISTS (SELECT 1 FROM gems WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target gem not found');
    END IF;
    IF p_community_id IS NULL THEN
      SELECT community_id INTO v_community_id FROM gems WHERE id = p_target_id;
    ELSE
      v_community_id := p_community_id;
    END IF;
  ELSIF p_target_type = 'comment' THEN
    IF NOT EXISTS (SELECT 1 FROM comments WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target comment not found');
    END IF;
  ELSIF p_target_type = 'collection' THEN
    IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target collection not found');
    END IF;
  ELSIF p_target_type = 'community' THEN
    IF NOT EXISTS (SELECT 1 FROM communities WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target community not found');
    END IF;
    v_community_id := p_target_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid target type');
  END IF;

  IF EXISTS (
    SELECT 1 FROM reports
    WHERE reporter_id = v_reporter_id
    AND target_type = p_target_type
    AND target_id = p_target_id
    AND status IN ('pending', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending report for this target');
  END IF;

  INSERT INTO reports (reporter_id, target_type, target_id, reason, description, community_id, evidence_path)
  VALUES (v_reporter_id, p_target_type, p_target_id, p_reason, p_description, v_community_id, p_evidence_path)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- ============================================================================
-- moderator_hide_gem / moderator_restore_gem
-- ============================================================================
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
  IF NOT public.is_community_moderator(v_gem_community_id) THEN
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
  IF NOT public.is_community_moderator(v_gem_community_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE gems SET is_hidden = false, updated_at = now() WHERE id = p_gem_id;
  PERFORM public.log_moderation_action('restore_gem', 'gem', p_gem_id, p_reason, v_gem_community_id);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- moderator_suspend_user / moderator_lift_suspension
-- ============================================================================
CREATE OR REPLACE FUNCTION public.moderator_suspend_user(
  p_community_id uuid,
  p_user_id uuid,
  p_reason text,
  p_duration_hours integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspension_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF NOT public.is_community_moderator(p_community_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF auth.uid() = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot suspend yourself');
  END IF;

  IF EXISTS (
    SELECT 1 FROM community_suspensions
    WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND lifted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is already suspended');
  END IF;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    v_expires_at := now() + (p_duration_hours || ' hours')::interval;
  END IF;

  INSERT INTO community_suspensions (community_id, user_id, suspended_by, reason, duration_hours, expires_at)
  VALUES (p_community_id, p_user_id, auth.uid(), p_reason, p_duration_hours, v_expires_at)
  RETURNING id INTO v_suspension_id;

  PERFORM public.log_moderation_action(
    'suspend_user', 'user', p_user_id, p_reason, p_community_id,
    jsonb_build_object('suspension_id', v_suspension_id, 'duration_hours', p_duration_hours)
  );

  RETURN jsonb_build_object('success', true, 'suspension_id', v_suspension_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_lift_suspension(p_suspension_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspension community_suspensions%ROWTYPE;
BEGIN
  SELECT * INTO v_suspension FROM community_suspensions WHERE id = p_suspension_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suspension not found');
  END IF;
  IF NOT public.is_community_moderator(v_suspension.community_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE community_suspensions
  SET lifted_by = auth.uid(), lifted_at = now(), lift_reason = p_reason
  WHERE id = p_suspension_id;
  PERFORM public.log_moderation_action(
    'lift_suspension', 'suspension', p_suspension_id, p_reason, v_suspension.community_id
  );
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- escalate_report / admin_resolve_report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.escalate_report(p_report_id uuid, p_escalation_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report reports%ROWTYPE;
BEGIN
  SELECT * INTO v_report FROM reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  IF v_report.community_id IS NOT NULL THEN
    IF NOT public.is_community_moderator(v_report.community_id) AND NOT public.is_platform_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  ELSE
    IF NOT public.is_platform_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  UPDATE reports
  SET status = 'escalated', escalation_reason = p_escalation_reason,
      escalated_by = auth.uid(), escalated_at = now(), updated_at = now()
  WHERE id = p_report_id;

  PERFORM public.log_moderation_action(
    'escalate_report', 'report', p_report_id, p_escalation_reason, v_report.community_id
  );
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id uuid, p_resolution text, p_action_taken text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report reports%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO v_report FROM reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  UPDATE reports
  SET status = CASE WHEN p_resolution = 'dismissed' THEN 'dismissed' ELSE 'resolved' END,
      reviewed_by = auth.uid(), reviewed_at = now(),
      resolution_note = p_resolution, updated_at = now()
  WHERE id = p_report_id;
  PERFORM public.log_moderation_action(
    CASE WHEN p_resolution = 'dismissed' THEN 'dismiss_report' ELSE 'resolve_report' END,
    'report', p_report_id, p_resolution, v_report.community_id,
    jsonb_build_object('action_taken', p_action_taken)
  );
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- admin_deactivate_account / admin_reactivate_account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_deactivate_account(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF auth.uid() = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot deactivate your own account');
  END IF;
  UPDATE profiles SET is_active = false, updated_at = now() WHERE id = p_user_id;
  PERFORM public.log_moderation_action('deactivate_account', 'user', p_user_id, p_reason);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_account(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE profiles SET is_active = true, updated_at = now() WHERE id = p_user_id;
  PERFORM public.log_moderation_action('reactivate_account', 'user', p_user_id, p_reason);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- Revoke EXECUTE from anon on privileged functions
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderator_suspend_user(uuid, uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderator_lift_suspension(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.escalate_report(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_account(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_account(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_moderation_action(text, text, uuid, text, uuid, jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_report(text, uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_either_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_hide_gem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_restore_gem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_suspend_user(uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_lift_suspension(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_report(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_account(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_account(uuid, text) TO authenticated;