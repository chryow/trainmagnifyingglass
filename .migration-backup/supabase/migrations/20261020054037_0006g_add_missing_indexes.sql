-- Add missing indexes for foreign keys flagged by performance advisor

CREATE INDEX IF NOT EXISTS idx_collection_items_added_by ON collection_items(added_by);
CREATE INDEX IF NOT EXISTS idx_community_invitations_created_by ON community_invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_community_invitations_used_by ON community_invitations(used_by);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_suspensions_user_id ON community_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_community_suspensions_suspended_by ON community_suspensions(suspended_by);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_gem_reactions_user_id ON gem_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_saved_gems_user_id ON saved_gems(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_gems_gem_id ON saved_gems(gem_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target_id ON reports(target_id);
CREATE INDEX IF NOT EXISTS idx_gem_confirmations_user_id ON gem_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_correction_suggestions_suggested_by ON correction_suggestions(suggested_by);
CREATE INDEX IF NOT EXISTS idx_gem_edit_history_gem_id ON gem_edit_history(gem_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_id ON moderation_actions(target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id ON moderation_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);