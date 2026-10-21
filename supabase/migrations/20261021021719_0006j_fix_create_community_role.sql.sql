/*
# Fix create_community role constraint violation

## Root cause
The create_community() RPC inserts the owner into community_members
with role = 'owner'. The community_members_role_check constraint only
allows 'member' and 'moderator'. This caused HTTP 400 on community
creation.

The application's canonical role vocabulary for community_members is:
- 'member' — a regular community member
- 'moderator' — a community moderator (also used for the community
  owner, since ownership is tracked separately via communities.owner_id)

The existing add_owner_as_member() trigger (from the original schema)
already inserts the owner as a community_member with role = 'moderator'.
The create_community RPC must use the same role.

## Fix
Update create_community() to insert the owner membership with
role = 'moderator' and ON CONFLICT (community_id, user_id) DO NOTHING,
so it cooperates with the existing trg_community_owner_member trigger
without duplicate-key errors.

## Security
- create_community still requires auth.uid() (rejects anon).
- Owner is still derived server-side from auth.uid().
- Community and owner-membership inserts are still in one function
  (one transaction); if either fails, both roll back.
- EXECUTE remains restricted to authenticated only.
- search_path remains fixed to public.
- The role CHECK constraint is NOT modified.
- No existing data required migration (no communities existed).
- No orphan rows found.

## Non-destructive
- No tables or columns changed.
- No constraints added or removed.
- No data deleted.
*/

CREATE OR REPLACE FUNCTION public.create_community(
  p_name text,
  p_description text DEFAULT NULL,
  p_community_type text DEFAULT 'interest_based',
  p_visibility text DEFAULT 'public',
  p_general_area text DEFAULT NULL,
  p_guidelines text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_community_id uuid;
BEGIN
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_community_type NOT IN ('location_based', 'interest_based', 'private_group') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid community type');
  END IF;

  IF p_visibility NOT IN ('public', 'private') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid visibility');
  END IF;

  INSERT INTO public.communities (name, description, community_type, visibility, general_area, guidelines, owner_id)
  VALUES (p_name, p_description, p_community_type, p_visibility, p_general_area, p_guidelines, v_owner_id)
  RETURNING id INTO v_community_id;

  -- Insert owner membership with 'moderator' role (the canonical owner
  -- role per the existing add_owner_as_member trigger and the
  -- community_members_role_check constraint). ON CONFLICT handles the
  -- case where trg_community_owner_member already inserted the row.
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, v_owner_id, 'moderator')
  ON CONFLICT (community_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'community_id', v_community_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_community(text, text, text, text, text, text) TO authenticated;
