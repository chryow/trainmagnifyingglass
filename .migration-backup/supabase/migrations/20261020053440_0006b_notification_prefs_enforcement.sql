-- Update create_notification to respect per-user notification preferences.
-- Each notification type maps to a preference column on profiles.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs record;
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_actor_id THEN RETURN; END IF;

  -- Fetch recipient's notification preferences
  SELECT notify_comments, notify_reactions, notify_follows, notify_collections, notify_corrections
  INTO v_prefs
  FROM public.profiles WHERE id = p_recipient_id;

  -- Don't notify if recipient doesn't exist or is deleted
  IF NOT FOUND THEN RETURN; END IF;

  -- Check preference for this notification type
  IF p_type IN ('comment', 'reply') AND NOT v_prefs.notify_comments THEN RETURN; END IF;
  IF p_type IN ('gem_reaction', 'comment_reaction') AND NOT v_prefs.notify_reactions THEN RETURN; END IF;
  IF p_type = 'follow' AND NOT v_prefs.notify_follows THEN RETURN; END IF;
  IF p_type = 'collection_add' AND NOT v_prefs.notify_collections THEN RETURN; END IF;
  IF p_type IN ('correction_accepted', 'correction_rejected', 'correction_needs_info', 'correction_escalated') AND NOT v_prefs.notify_corrections THEN RETURN; END IF;

  INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  VALUES (p_recipient_id, p_actor_id, p_type, p_entity_type, p_entity_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, uuid) FROM anon, authenticated;