-- Fix create_report to auto-resolve community_id for comment and collection targets
-- Comments: resolve via gem -> community_id
-- Collections: resolve via collection -> community_id (if collection has one)

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
SET search_path TO 'public'
AS $function$
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
    v_community_id := p_community_id;

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
    IF p_community_id IS NULL THEN
      SELECT g.community_id INTO v_community_id
      FROM comments c JOIN gems g ON g.id = c.gem_id
      WHERE c.id = p_target_id;
    ELSE
      v_community_id := p_community_id;
    END IF;

  ELSIF p_target_type = 'collection' THEN
    IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_target_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target collection not found');
    END IF;
    IF p_community_id IS NULL THEN
      SELECT community_id INTO v_community_id FROM collections WHERE id = p_target_id;
    ELSE
      v_community_id := p_community_id;
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
$function$;