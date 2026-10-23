/*
# Replace safe_profile_summary with relationship-aware follower RPCs

## Plain-English summary

The previous `safe_profile_summary(p_user_id uuid)` function was a
SECURITY DEFINER function that returned profile summary fields (id,
username, display_name, avatar_url) for an arbitrary user ID. Any
authenticated user could call it with the ID of a profile whose
profile_visibility is 'community_only' and retrieve that profile's
display data, completely bypassing the profiles SELECT RLS policy.
This is a security hole — profile_visibility must not be bypassed
merely because the returned fields are "summary" fields.

This migration drops the unsafe function and replaces it with two
relationship-aware RPCs:

1. `get_visible_following(p_target_user_id uuid)` — returns the people
   the target user is following (followee profiles), only for rows
   the caller is authorized to see.

2. `get_visible_followers(p_target_user_id uuid)` — returns the people
   following the target user (follower profiles), only for rows the
   caller is authorized to see.

## Security model

Both functions enforce ALL of the following before returning a profile:

### Caller authorization (relationship visibility)
The caller (`auth.uid()`) must be authorized to see the follow row
for the target user. This mirrors the follows SELECT RLS policy:

- If the caller IS the target user (viewing own following/followers):
  all follow rows are visible.
- If the caller is the follower_id (for following) or followee_id
  (for followers): the row is visible because it's their own relationship.
- If the target user's profile has show_following=true (for following)
  or show_followers=true (for followers): the row is visible to any
  authenticated caller.
- Platform admins can see all rows.

### Profile visibility (community_only check)
Even when a follow row is visible, the profile summary is only returned
if the caller is authorized to see the profile — mirroring the profiles
SELECT RLS policy:

- The profile is 'public' (profile_visibility = 'public'), OR
- The caller IS the profile owner (id = auth.uid()), OR
- The caller shares a community with the profile owner, OR
- The caller is a platform admin.

If the profile is 'community_only' and none of these conditions hold,
the follow row is returned but with NULL profile summary fields (just
like the joined query already returns null). The caller sees the
follow count but not the restricted profile's display data.

### Blocking
Profiles whose owner has blocked the caller (or whom the caller has
blocked) are excluded — the caller should not see blockers in their
follower/following lists. `is_either_blocked(auth.uid(), profile_id)`
is checked for each profile.

### Inactive profiles
Only active profiles (is_active = true) are returned.

## Function signatures

- `get_visible_following(p_target_user_id uuid) RETURNS TABLE(...)`
- `get_visible_followers(p_target_user_id uuid) RETURNS TABLE(...)`

Both return: follow_id uuid, profile_id uuid, username text,
display_name text, avatar_url text, created_at timestamptz.

## Privileges

- SECURITY DEFINER with fixed search_path = 'public'
- EXECUTE revoked from anon and PUBLIC
- EXECUTE granted to authenticated only

## Notes

- The old `safe_profile_summary` function is DROPPED.
- No changes to profiles or follows RLS policies — the functions
  enforce authorization internally via SECURITY DEFINER.
- Migration 0006k and all prior functionality is preserved.
*/

-- Drop the unsafe function
DROP FUNCTION IF EXISTS public.safe_profile_summary(uuid);

-- Create get_visible_following: returns people the target user follows
CREATE OR REPLACE FUNCTION public.get_visible_following(p_target_user_id uuid)
RETURNS TABLE (
  follow_id uuid,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    f.id            AS follow_id,
    p.id            AS profile_id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at
  FROM follows f
  JOIN profiles p ON p.id = f.followee_id
  WHERE f.follower_id = p_target_user_id
    AND p.is_active = true
    -- Caller is authorized to see this follow row (mirrors follows SELECT policy)
    AND (
      p_target_user_id = auth.uid()
      OR f.followee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles tp
        WHERE tp.id = p_target_user_id AND tp.show_following = true
      )
      OR public.is_platform_admin()
    )
    -- Profile visibility: only return profile data if caller can see it
    -- (mirrors profiles SELECT policy)
    AND (
      p.id = auth.uid()
      OR p.profile_visibility = 'public'
      OR public.shares_community(auth.uid(), p.id)
      OR public.is_platform_admin()
    )
    -- Blocking: exclude blocked relationships
    AND NOT public.is_either_blocked(auth.uid(), p.id)
  ORDER BY f.created_at DESC;
$$;

-- Create get_visible_followers: returns people following the target user
CREATE OR REPLACE FUNCTION public.get_visible_followers(p_target_user_id uuid)
RETURNS TABLE (
  follow_id uuid,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    f.id            AS follow_id,
    p.id            AS profile_id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at
  FROM follows f
  JOIN profiles p ON p.id = f.follower_id
  WHERE f.followee_id = p_target_user_id
    AND p.is_active = true
    -- Caller is authorized to see this follow row (mirrors follows SELECT policy)
    AND (
      p_target_user_id = auth.uid()
      OR f.follower_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles tp
        WHERE tp.id = p_target_user_id AND tp.show_followers = true
      )
      OR public.is_platform_admin()
    )
    -- Profile visibility: only return profile data if caller can see it
    -- (mirrors profiles SELECT policy)
    AND (
      p.id = auth.uid()
      OR p.profile_visibility = 'public'
      OR public.shares_community(auth.uid(), p.id)
      OR public.is_platform_admin()
    )
    -- Blocking: exclude blocked relationships
    AND NOT public.is_either_blocked(auth.uid(), p.id)
  ORDER BY f.created_at DESC;
$$;

-- Restrict execution to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_visible_following(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_visible_followers(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visible_following(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_followers(uuid) TO authenticated;
