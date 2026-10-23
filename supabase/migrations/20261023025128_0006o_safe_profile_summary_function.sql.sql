/*
# Add safe profile summary function for follower/followee lists

## Plain-English summary
When viewing a followers or following list, the joined profile data may be
null for profiles with profile_visibility = 'community_only' that don't share
a community with the viewer. The follows RLS policy already authorized the
viewer to see the relationship row, but the profile join fails silently.

This function returns only safe public display fields (id, username,
display_name, avatar_url) for a given user ID, regardless of the viewer's
profile visibility access. These fields are already shown in other contexts
(notifications, community members, report targets) and contain no sensitive
information.

## Security
- SECURITY DEFINER with fixed search_path
- EXECUTE restricted to authenticated only
- Returns only safe public fields: id, username, display_name, avatar_url
- Does NOT expose: bio, home_area, show_area, show_following, show_followers,
  allow_followers, allow_comments, notification prefs, role, profile_visibility
- The caller must still pass RLS on the follows table to see the relationship
- Does not bypass follows RLS — only the profile visibility check for the
  safe summary fields
*/

CREATE OR REPLACE FUNCTION public.safe_profile_summary(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
SELECT id, username, display_name, avatar_url
FROM public.profiles
WHERE id = p_user_id AND is_active = true;
$$;

REVOKE EXECUTE ON FUNCTION public.safe_profile_summary(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_profile_summary(uuid) TO authenticated;
