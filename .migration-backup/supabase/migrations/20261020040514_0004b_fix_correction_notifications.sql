/*
# Phase 4b — Fix correction notification types

Update the accept/reject/request_info/escalate functions to use proper
notification types instead of the generic 'comment' type.
*/

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
  SELECT * INTO corr FROM public.correction_suggestions WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction not found'; END IF;
  IF corr.status != 'pending' THEN RAISE EXCEPTION 'Correction is no longer pending (current status: %)', corr.status; END IF;

  SELECT * INTO g FROM public.gems WHERE id = corr.gem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gem not found'; END IF;
  IF g.author_id != auth.uid() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You are not authorized to review this correction';
  END IF;
  IF corr.suggested_by = auth.uid() THEN
    RAISE EXCEPTION 'You cannot approve your own correction';
  END IF;

  field_name := CASE corr.correction_type
    WHEN 'name' THEN 'title'
    WHEN 'address' THEN 'address'
    WHEN 'description' THEN 'description'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

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
    new_val := corr.suggested_value;
    UPDATE public.gems SET category_id = new_val::uuid WHERE id = g.id;
  END IF;

  UPDATE public.correction_suggestions
  SET status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  IF field_name IS NOT NULL THEN
    INSERT INTO public.gem_edit_history (gem_id, changed_field, previous_value, new_value, change_source, changed_by, related_correction_id, reason)
    VALUES (g.id, field_name, old_val, new_val, 'accepted_correction', auth.uid(), p_correction_id, p_resolution_note);
  END IF;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'correction_accepted', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_correction(uuid, text) TO authenticated;

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
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'correction_rejected', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_correction(uuid, text) TO authenticated;

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
  SET status = 'needs_info', reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'correction_needs_info', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_more_info(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_more_info(uuid, text) TO authenticated;

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
  SET status = 'escalated', reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = p_resolution_note
  WHERE id = p_correction_id;

  PERFORM public.create_notification(corr.suggested_by, auth.uid(), 'correction_escalated', 'correction', p_correction_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.escalate_correction(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_correction(uuid, text) TO authenticated;
