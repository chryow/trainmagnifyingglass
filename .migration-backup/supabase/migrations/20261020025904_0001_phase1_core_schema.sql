/*
# Phase 1 — Core Schema: Profiles, Interests, Categories, Communities

## Plain-English summary
This migration lays the foundation for the Hidden Gems community discovery app.
It creates the tables needed for authentication-related profile data, user
interests (for personalization), a category catalog managed by administrators,
location/interest-based communities, community membership, and invitation codes
for private communities.

## New Tables
1. `profiles` — public user profile data (one row per auth user). Holds display
   name, unique username, bio, home area, avatar URL, privacy settings, and
   role. Email is intentionally NOT stored here (it lives in auth.users).
2. `user_interests` — the interest categories each user selected during
   onboarding. Used to personalize the Discover feed.
3. `categories` — the platform-wide category catalog (Food and Drinks, Cafés,
   Nature, etc.). Seeded with defaults; managed by administrators.
4. `communities` — location-based, interest-based, or private-group
   communities. Each has an owner, moderators, visibility, guidelines, and
   an active/archived status.
5. `community_members` — the join table between users and communities, with a
   role per membership (member / moderator). Unique per (user, community).
6. `community_invitations` — single-use invitation codes for joining private
   communities. Tracks created_by, used_by, and expires_at.

## Security (Row Level Security)
- `profiles`: anyone authenticated can read public profile fields; users can
  update only their own row. Email is never stored here.
- `user_interests`: users read and manage only their own interests.
- `categories`: readable by all (anon + authenticated) since it is a shared
  catalog; writes restricted to platform administrators via is_platform_admin().
- `communities`: public communities readable by all authenticated users;
  private communities readable only by members. Owners can insert/update/delete
  their own communities; admins can manage all.
- `community_members`: members of a community can read the roster; users can
  insert only their own membership (join public communities); owners can update
  /delete memberships; users may delete their own row (leave).
- `community_invitations`: owner/moderators can manage and read invitations.

## Role management
- `profiles.role` defaults to 'user'. The update policy allows users to update
  their own row; role escalation is prevented in application logic and the
  set_user_role SECURITY DEFINER function (service-role only).
- `is_platform_admin()` helper reads the JWT app_metadata.role.

## Important notes
1. A trigger auto-creates a `profiles` row on sign-up.
2. `communities.owner_id` defaults to auth.uid() so client inserts succeed.
3. Unique constraints prevent duplicate memberships, interests, category slugs.
4. Community creator is auto-added as a moderator member via trigger.
5. Categories seeded with the 15 platform categories (demonstration catalog).
*/

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TABLES (all created before any policies that reference them)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  home_area text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  profile_visibility text NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public','community_only')),
  show_area boolean NOT NULL DEFAULT true,
  show_following boolean NOT NULL DEFAULT true,
  show_followers boolean NOT NULL DEFAULT true,
  allow_followers boolean NOT NULL DEFAULT true,
  allow_comments boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, interest)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_image_url text,
  community_type text NOT NULL CHECK (community_type IN ('location_based','interest_based','private_group')),
  general_area text,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  guidelines text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(9), 'hex'),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON public.user_interests (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);
CREATE INDEX IF NOT EXISTS idx_communities_owner ON public.communities (owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON public.communities (visibility);
CREATE INDEX IF NOT EXISTS idx_communities_general_area ON public.communities (general_area);
CREATE INDEX IF NOT EXISTS idx_cm_community ON public.community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON public.community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_inv_community ON public.community_invitations (community_id);
CREATE INDEX IF NOT EXISTS idx_inv_code ON public.community_invitations (code);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES
-- ============================================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- user_interests
DROP POLICY IF EXISTS "user_interests_select_own" ON public.user_interests;
CREATE POLICY "user_interests_select_own"
ON public.user_interests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_interests_insert_own" ON public.user_interests;
CREATE POLICY "user_interests_insert_own"
ON public.user_interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_interests_delete_own" ON public.user_interests;
CREATE POLICY "user_interests_delete_own"
ON public.user_interests FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_interests_update_own" ON public.user_interests;
CREATE POLICY "user_interests_update_own"
ON public.user_interests FOR UPDATE
TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- categories (shared catalog)
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
CREATE POLICY "categories_select_all"
ON public.categories FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
CREATE POLICY "categories_insert_admin"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
CREATE POLICY "categories_update_admin"
ON public.categories FOR UPDATE
TO authenticated
USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;
CREATE POLICY "categories_delete_admin"
ON public.categories FOR DELETE
TO authenticated
USING (public.is_platform_admin());

-- communities
DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select"
ON public.communities FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = communities.id AND cm.user_id = auth.uid()
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "communities_insert_own" ON public.communities;
CREATE POLICY "communities_insert_own"
ON public.communities FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "communities_update_owner_or_admin" ON public.communities;
CREATE POLICY "communities_update_owner_or_admin"
ON public.communities FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.is_platform_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "communities_delete_owner_or_admin" ON public.communities;
CREATE POLICY "communities_delete_owner_or_admin"
ON public.communities FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR public.is_platform_admin());

-- community_members
DROP POLICY IF EXISTS "cm_select" ON public.community_members;
CREATE POLICY "cm_select"
ON public.community_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id
      AND (c.owner_id = auth.uid() OR c.visibility = 'public')
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "cm_insert_own" ON public.community_members;
CREATE POLICY "cm_insert_own"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id
      AND (c.visibility = 'public' OR c.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "cm_update_owner" ON public.community_members;
CREATE POLICY "cm_update_owner"
ON public.community_members FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()
  )
  OR public.is_platform_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "cm_delete" ON public.community_members;
CREATE POLICY "cm_delete"
ON public.community_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.owner_id = auth.uid()
  )
  OR public.is_platform_admin()
);

-- community_invitations
DROP POLICY IF EXISTS "inv_select" ON public.community_invitations;
CREATE POLICY "inv_select"
ON public.community_invitations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_invitations.community_id AND c.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_invitations.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "inv_insert_owner_mod" ON public.community_invitations;
CREATE POLICY "inv_insert_owner_mod"
ON public.community_invitations FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id AND c.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_invitations.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'moderator'
    )
  )
);

DROP POLICY IF EXISTS "inv_update_owner_mod" ON public.community_invitations;
CREATE POLICY "inv_update_owner_mod"
ON public.community_invitations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_invitations.community_id AND c.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_invitations.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
  )
  OR public.is_platform_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_invitations.community_id AND c.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_invitations.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "inv_delete_owner_mod" ON public.community_invitations;
CREATE POLICY "inv_delete_owner_mod"
ON public.community_invitations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_invitations.community_id AND c.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_invitations.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
  )
  OR public.is_platform_admin()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_communities_updated ON public.communities;
CREATE TRIGGER trg_communities_updated
BEFORE UPDATE ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON public.categories;
CREATE TRIGGER trg_categories_updated
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio, home_area)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    coalesce(NEW.raw_user_meta_data ->> 'display_name', 'New Explorer'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'bio',
    NEW.raw_user_meta_data ->> 'home_area'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add community owner as moderator member on community creation
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'moderator')
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET role = 'moderator', joined_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_owner_member ON public.communities;
CREATE TRIGGER trg_community_owner_member
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- ============================================================================
-- SECURE ROLE SETTER (service-role only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_role NOT IN ('user','moderator','admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon, authenticated;

-- ============================================================================
-- SEED CATEGORIES (demonstration catalog data)
-- ============================================================================

INSERT INTO public.categories (slug, name, sort_order, icon) VALUES
  ('food-and-drinks', 'Food and Drinks', 1, 'utensils'),
  ('cafes', 'Cafés', 2, 'coffee'),
  ('nature', 'Nature', 3, 'trees'),
  ('scenic-views', 'Scenic Views', 4, 'mountain'),
  ('study-spots', 'Study Spots', 5, 'book-open'),
  ('remote-work', 'Remote Work', 6, 'laptop'),
  ('arts-and-culture', 'Arts and Culture', 7, 'palette'),
  ('books-and-reading', 'Books and Reading', 8, 'book'),
  ('shopping', 'Shopping', 9, 'shopping-bag'),
  ('sports-and-recreation', 'Sports and Recreation', 10, 'bike'),
  ('family-activities', 'Family Activities', 11, 'users'),
  ('photography', 'Photography', 12, 'camera'),
  ('local-experiences', 'Local Experiences', 13, 'compass'),
  ('night-activities', 'Night Activities', 14, 'moon'),
  ('other', 'Other', 15, 'sparkles')
ON CONFLICT (slug) DO NOTHING;
