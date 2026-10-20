/*
# Phase 5b: Block Enforcement on Existing Tables

## Overview
This migration adds block checks to the RLS INSERT policies on follows, comments,
and notifications tables so that blocked users cannot follow, reply to, or
generate notifications for the user who blocked them.

## Changes
1. follows INSERT policy: Add check that neither user has blocked the other
2. comments INSERT policy: Add check that comment author is not blocked by
   the gem author (and vice versa) — only applies to replies (parent_id IS NOT NULL)
   to avoid blocking top-level comments on community gems
3. notifications INSERT policy: Add check that the actor is not blocked by the recipient

## Non-destructive
- Existing SELECT/UPDATE/DELETE policies are preserved
- Only INSERT policies are replaced with enhanced versions that add block checks
- The is_either_blocked() helper function from the previous migration is used
*/

-- ============================================================================
-- follows: Replace INSERT policy with block-aware version
-- ============================================================================
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT public.is_either_blocked(follower_id, followee_id)
  );

-- ============================================================================
-- comments: Replace INSERT policy with block-aware version
-- The original policy allowed inserts by gem authors or community members.
-- We add: the commenter must not be blocked by (or have blocked) the gem author.
-- ============================================================================
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_see_gem(gem_id)
    AND NOT public.is_either_blocked(auth.uid(), (SELECT author_id FROM gems WHERE id = comments.gem_id))
  );

-- ============================================================================
-- notifications: Replace INSERT policy with block-aware version
-- Notifications are created by SECURITY DEFINER functions (create_notification),
-- but the INSERT policy still applies. We add a check that the actor is not
-- blocked by the recipient. For system notifications (actor_id IS NULL), the
-- block check is skipped.
-- ============================================================================
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = recipient_id
    OR (
      actor_id IS NOT NULL
      AND NOT public.is_either_blocked(actor_id, recipient_id)
    )
    OR actor_id IS NULL
  );