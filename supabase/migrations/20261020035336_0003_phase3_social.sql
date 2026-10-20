/*
# Phase 3 — Social Layer: Saved Gems, Collections, Comments, Reactions, Follows, Notifications

## Plain-English summary
Adds the full social experience on top of Phase 2 gems: users can save gems
for later, create curated collections (public, followers-only, or private),
add gems to collections, comment with threaded replies, react to gems and
comments, follow other users, see a following feed, and receive in-app
notifications. Special attention is paid to collection privacy — direct URL
access to private/followers-only collections is blocked at the database level.

## New Tables
1. `saved_gems` — bookmark/bookmark table. One row per (user, gem).
   - user_id, gem_id, created_at. Unique(user_id, gem_id).

2. `collections` — curated lists of gems. Owner-scoped.
   - id, owner_id (DEFAULT auth.uid()), name, description, cover_image_url,
     visibility ('public' | 'followers' | 'private'), created_at, updated_at.

3. `collection_items` — gems inside a collection.
   - id, collection_id, gem_id, added_by, note (optional), sort_order, created_at.
   - Unique(collection_id, gem_id).

4. `comments` — comments on gems, with threaded replies.
   - id, gem_id, author_id (DEFAULT auth.uid()), parent_id (self-ref for
     replies), body (1-1000 chars), created_at, updated_at.
   - parent_id NULL = top-level comment; non-NULL = reply.

5. `gem_reactions` — reactions on gems.
   - id, gem_id, user_id (DEFAULT auth.uid()), type (e.g. 'love', 'want_to_go',
     'been_there'), created_at. Unique(gem_id, user_id, type).

6. `comment_reactions` — reactions on comments.
   - id, comment_id, user_id (DEFAULT auth.uid()), type, created_at.
   - Unique(comment_id, user_id, type).

7. `follows` — follow relationships.
   - id, follower_id (DEFAULT auth.uid()), followee_id, created_at.
   - Unique(follower_id, followee_id). CHECK(follower_id != followee_id).

8. `notifications` — in-app notifications.
   - id, recipient_id, actor_id, type ('comment', 'reply', 'reaction',
     'follow', 'collection_add'), entity_type, entity_id, read, created_at.
   - recipient_id is the user being notified; actor_id is who triggered it.

## RLS Design — key privacy guarantees

### Collections (the critical privacy surface)
- SELECT: owner always sees their own; 'public' collections visible to all
  authenticated; 'followers' collections visible only to users who follow the
  owner; 'private' visible only to the owner.
- INSERT/UPDATE/DELETE: owner only.

This means a direct URL to a private collection returns no rows for anyone but
the owner. A followers-only collection returns no rows unless the viewer has a
row in `follows` where follower_id = viewer and followee_id = owner.

### Collection items
- SELECT: visible only if the parent collection is visible to the user
  (delegates to the collection SELECT logic via EXISTS).
- INSERT/UPDATE/DELETE: collection owner only.

### Saved_gems
- SELECT/INSERT/DELETE: own user only.

### Comments
- SELECT: visible to anyone who can see the gem (delegates to gems SELECT).
  Since gems are already community-membership-scoped, comments inherit that.
- INSERT: any authenticated user who can see the gem (i.e., community member
  for published gems, or author for drafts). The gem author can always comment.
- UPDATE/DELETE: comment author only.

### Replies (comments with parent_id)
- Same policies as comments — they ARE comments, just with a parent_id.

### Gem reactions
- SELECT: visible to anyone who can see the gem.
- INSERT: any authenticated user who can see the gem. Unique constraint
  prevents duplicate reaction types per user per gem.
- DELETE: own reaction only.

### Comment reactions
- SELECT: visible to anyone who can see the comment's gem.
- INSERT: any authenticated user who can see the comment's gem.
- DELETE: own reaction only.

### Follows
- SELECT: follower or followee can see (both parties know about the follow).
  Additionally, if followee has show_followers=true, anyone can see their
  followers; if follower has show_following=true, anyone can see who they
  follow. This respects the profile privacy settings.
- INSERT: follower must be auth.uid(); followee must allow_followers (checked
  via the followee's profile).
- DELETE: follower only (you can unfollow, but the followee can't force-unfollow).

### Notifications
- SELECT/UPDATE: recipient only (auth.uid() = recipient_id).
- DELETE: recipient only.
- INSERT: we use a SECURITY DEFINER trigger function that inserts notifications
  on comment/reaction/follow events, so the actor doesn't need INSERT privileges
  on the notifications table directly. We revoke INSERT from anon/authenticated.

## Triggers for notifications
A SECURITY DEFINER function `notify_on_event` is called via triggers on:
- comments INSERT → notifies gem author (unless commenting on own gem).
- gem_reactions INSERT → notifies gem author (unless reacting to own gem).
- follows INSERT → notifies the followee.
- collection_items INSERT → notifies the gem author (unless adding own gem).

## Important notes
1. Collection 'followers' visibility checks follows table at query time, so if
   a user unfollows, the collection immediately becomes invisible to them.
2. The CHECK on follows prevents self-follows.
3. Notification INSERT is via SECURITY DEFINER function only — users cannot
   insert notifications directly.
4. All owner columns default to auth.uid() for client insert convenience.
5. Comment body max 1000 chars; collection name max 80 chars.
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_gems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gem_id)
);

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 80),
  description text CHECK (char_length(description) <= 500),
  cover_image_url text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','followers','private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  added_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text CHECK (char_length(note) <= 300),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, gem_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gem_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gem_id uuid NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (char_length(type) >= 1 AND char_length(type) <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gem_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (char_length(type) >= 1 AND char_length(type) <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('comment','reply','gem_reaction','comment_reaction','follow','collection_add')),
  entity_type text,
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_saved_gems_user ON public.saved_gems (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_gems_gem ON public.saved_gems (gem_id);
CREATE INDEX IF NOT EXISTS idx_collections_owner ON public.collections (owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_visibility ON public.collections (visibility);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON public.collection_items (collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_gem ON public.collection_items (gem_id);
CREATE INDEX IF NOT EXISTS idx_comments_gem ON public.comments (gem_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments (author_id);
CREATE INDEX IF NOT EXISTS idx_gem_reactions_gem ON public.gem_reactions (gem_id);
CREATE INDEX IF NOT EXISTS idx_gem_reactions_user ON public.gem_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON public.comment_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON public.follows (followee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_id, read, created_at DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.saved_gems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER: can the current user see a given gem?
-- (Mirrors the gems SELECT policy so comments/reactions inherit gem visibility)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_see_gem(g_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gems g
    WHERE g.id = g_id
      AND (
        g.author_id = auth.uid()
        OR (g.status = 'published' AND public.is_community_member(g.community_id))
        OR public.is_platform_admin()
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_gem(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_see_gem(uuid) TO authenticated;

-- ============================================================================
-- POLICIES — saved_gems (own user only)
-- ============================================================================

DROP POLICY IF EXISTS "saved_gems_select_own" ON public.saved_gems;
CREATE POLICY "saved_gems_select_own"
ON public.saved_gems FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_gems_insert_own" ON public.saved_gems;
CREATE POLICY "saved_gems_insert_own"
ON public.saved_gems FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_gems_delete_own" ON public.saved_gems;
CREATE POLICY "saved_gems_delete_own"
ON public.saved_gems FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- POLICIES — collections (privacy-critical)
-- ============================================================================

DROP POLICY IF EXISTS "collections_select" ON public.collections;
CREATE POLICY "collections_select"
ON public.collections FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR (visibility = 'followers' AND EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid() AND f.followee_id = collections.owner_id
  ))
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "collections_insert_own" ON public.collections;
CREATE POLICY "collections_insert_own"
ON public.collections FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "collections_update_own" ON public.collections;
CREATE POLICY "collections_update_own"
ON public.collections FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "collections_delete_own" ON public.collections;
CREATE POLICY "collections_delete_own"
ON public.collections FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ============================================================================
-- POLICIES — collection_items (inherit collection visibility)
-- ============================================================================

DROP POLICY IF EXISTS "collection_items_select" ON public.collection_items;
CREATE POLICY "collection_items_select"
ON public.collection_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND (
        c.owner_id = auth.uid()
        OR c.visibility = 'public'
        OR (c.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.followee_id = c.owner_id
        ))
        OR public.is_platform_admin()
      )
  )
);

DROP POLICY IF EXISTS "collection_items_insert_owner" ON public.collection_items;
CREATE POLICY "collection_items_insert_owner"
ON public.collection_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "collection_items_update_owner" ON public.collection_items;
CREATE POLICY "collection_items_update_owner"
ON public.collection_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "collection_items_delete_owner" ON public.collection_items;
CREATE POLICY "collection_items_delete_owner"
ON public.collection_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.owner_id = auth.uid()
  )
);

-- ============================================================================
-- POLICIES — comments (inherit gem visibility)
-- ============================================================================

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select"
ON public.comments FOR SELECT
TO authenticated
USING (public.can_see_gem(gem_id));

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_see_gem(gem_id)
);

DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own"
ON public.comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own"
ON public.comments FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- ============================================================================
-- POLICIES — gem_reactions (inherit gem visibility)
-- ============================================================================

DROP POLICY IF EXISTS "gem_reactions_select" ON public.gem_reactions;
CREATE POLICY "gem_reactions_select"
ON public.gem_reactions FOR SELECT
TO authenticated
USING (public.can_see_gem(gem_id));

DROP POLICY IF EXISTS "gem_reactions_insert" ON public.gem_reactions;
CREATE POLICY "gem_reactions_insert"
ON public.gem_reactions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_see_gem(gem_id)
);

DROP POLICY IF EXISTS "gem_reactions_delete_own" ON public.gem_reactions;
CREATE POLICY "gem_reactions_delete_own"
ON public.gem_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- POLICIES — comment_reactions (inherit gem visibility via comment)
-- ============================================================================

DROP POLICY IF EXISTS "comment_reactions_select" ON public.comment_reactions;
CREATE POLICY "comment_reactions_select"
ON public.comment_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = comment_reactions.comment_id
      AND public.can_see_gem(c.gem_id)
  )
);

DROP POLICY IF EXISTS "comment_reactions_insert" ON public.comment_reactions;
CREATE POLICY "comment_reactions_insert"
ON public.comment_reactions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = comment_reactions.comment_id
      AND public.can_see_gem(c.gem_id)
  )
);

DROP POLICY IF EXISTS "comment_reactions_delete_own" ON public.comment_reactions;
CREATE POLICY "comment_reactions_delete_own"
ON public.comment_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- POLICIES — follows
-- ============================================================================

DROP POLICY IF EXISTS "follows_select" ON public.follows;
CREATE POLICY "follows_select"
ON public.follows FOR SELECT
TO authenticated
USING (
  -- You can always see your own follows
  follower_id = auth.uid()
  OR followee_id = auth.uid()
  -- Anyone can see who a user follows, IF that user allows it
  OR (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = follows.follower_id AND p.show_following = true
    )
  )
  -- Anyone can see who follows a user, IF that user allows it
  OR (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = follows.followee_id AND p.show_followers = true
    )
  )
  OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
ON public.follows FOR INSERT
TO authenticated
WITH CHECK (
  follower_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = follows.followee_id AND p.allow_followers = true
  )
);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own"
ON public.follows FOR DELETE
TO authenticated
USING (follower_id = auth.uid());

-- ============================================================================
-- POLICIES — notifications (recipient only)
-- ============================================================================

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
ON public.notifications FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

-- No INSERT policy: notifications are created by SECURITY DEFINER triggers only.
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- ============================================================================
-- NOTIFICATION TRIGGER FUNCTION (SECURITY DEFINER)
-- ============================================================================

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
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_actor_id THEN RETURN; END IF;
  -- Don't notify if recipient doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN RETURN; END IF;
  INSERT INTO public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  VALUES (p_recipient_id, p_actor_id, p_type, p_entity_type, p_entity_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, uuid) FROM anon, authenticated;

-- Trigger: notify gem author on new comment (top-level only; replies handled too)
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gem_author uuid;
  parent_author uuid;
  is_reply boolean;
BEGIN
  SELECT author_id INTO gem_author FROM public.gems WHERE id = NEW.gem_id;
  is_reply := NEW.parent_id IS NOT NULL;
  IF is_reply THEN
    SELECT author_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    -- Notify the parent comment author about the reply
    PERFORM public.create_notification(parent_author, NEW.author_id, 'reply', 'comment', NEW.id);
  END IF;
  -- Notify the gem author about the comment (unless they commented themselves)
  PERFORM public.create_notification(gem_author, NEW.author_id, 'comment', 'gem', NEW.gem_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_comment ON public.comments;
CREATE TRIGGER trg_notify_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Trigger: notify gem author on reaction
CREATE OR REPLACE FUNCTION public.notify_on_gem_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gem_author uuid;
BEGIN
  SELECT author_id INTO gem_author FROM public.gems WHERE id = NEW.gem_id;
  PERFORM public.create_notification(gem_author, NEW.user_id, 'gem_reaction', 'gem', NEW.gem_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_gem_reaction() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_gem_reaction ON public.gem_reactions;
CREATE TRIGGER trg_notify_gem_reaction
AFTER INSERT ON public.gem_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_gem_reaction();

-- Trigger: notify followee on new follow
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(NEW.followee_id, NEW.follower_id, 'follow', 'profile', NEW.followee_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Trigger: notify gem author when their gem is added to a collection
CREATE OR REPLACE FUNCTION public.notify_on_collection_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gem_author uuid;
BEGIN
  SELECT author_id INTO gem_author FROM public.gems WHERE id = NEW.gem_id;
  PERFORM public.create_notification(gem_author, NEW.added_by, 'collection_add', 'collection', NEW.collection_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_collection_add() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_collection_add ON public.collection_items;
CREATE TRIGGER trg_notify_collection_add
AFTER INSERT ON public.collection_items
FOR EACH ROW EXECUTE FUNCTION public.notify_on_collection_add();

-- ============================================================================
-- TRIGGERS — updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS trg_collections_updated ON public.collections;
CREATE TRIGGER trg_collections_updated
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated ON public.comments;
CREATE TRIGGER trg_comments_updated
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
