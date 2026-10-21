export type CommunityType = 'location_based' | 'interest_based' | 'private_group';
export type Visibility = 'public' | 'private';
export type ProfileRole = 'user' | 'moderator' | 'admin';
export type MemberRole = 'member' | 'moderator';
export type ProfileVisibility = 'public' | 'community_only';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  home_area: string | null;
  avatar_url: string | null;
  role: ProfileRole;
  profile_visibility: ProfileVisibility;
  show_area: boolean;
  show_following: boolean;
  show_followers: boolean;
  allow_followers: boolean;
  allow_comments: boolean;
  notify_comments: boolean;
  notify_reactions: boolean;
  notify_follows: boolean;
  notify_collections: boolean;
  notify_corrections: boolean;
  onboarding_completed: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  community_type: CommunityType;
  general_area: string | null;
  owner_id: string;
  guidelines: string | null;
  visibility: Visibility;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined fields (optional, populated via RPC/select)
  member_count?: number;
  is_member?: boolean;
  member_role?: MemberRole | null;
  owner?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface CommunityInvitation {
  id: string;
  community_id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
}

export interface UserInterest {
  id: string;
  user_id: string;
  interest: string;
  created_at: string;
}

export const ONBOARDING_INTERESTS = [
  'Food and Drinks',
  'Cafés',
  'Study Spots',
  'Nature',
  'Scenic Views',
  'Photography',
  'Shopping',
  'Arts and Culture',
  'Books',
  'Sports and Recreation',
  'Family-Friendly Places',
  'Accessibility',
  'Budget-Friendly Places',
  'Remote Work',
  'Night Activities',
  'Other',
] as const;

export type OnboardingInterest = (typeof ONBOARDING_INTERESTS)[number];

export type GemStatus = 'draft' | 'published';
export type VerificationStatus = 'new' | 'community_confirmed' | 'may_be_outdated' | 'temporarily_unavailable' | 'permanently_closed' | 'under_review';

export interface Gem {
  id: string;
  community_id: string;
  author_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  place_name: string;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: GemStatus;
  cover_image_url: string | null;
  is_hidden: boolean;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
  // joined fields
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'allow_comments'> | null;
  community?: Pick<Community, 'id' | 'name' | 'visibility'> | null;
  category?: Pick<Category, 'id' | 'name' | 'slug' | 'icon'> | null;
  images?: GemImage[];
}

export interface GemImage {
  id: string;
  gem_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export type CollectionVisibility = 'public' | 'followers' | 'private';

export interface SavedGem {
  id: string;
  user_id: string;
  gem_id: string;
  created_at: string;
  gem?: Gem;
}

export interface Collection {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: CollectionVisibility;
  created_at: string;
  updated_at: string;
  owner?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  item_count?: number;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  gem_id: string;
  added_by: string;
  note: string | null;
  sort_order: number;
  created_at: string;
  gem?: Gem;
}

export interface Comment {
  id: string;
  gem_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  replies?: Comment[];
  reactions?: CommentReaction[];
}

export interface GemReaction {
  id: string;
  gem_id: string;
  user_id: string;
  type: string;
  created_at: string;
}

export interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  type: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  followee_id: string;
  created_at: string;
  followee?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  follower?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export type NotificationType = 'comment' | 'reply' | 'gem_reaction' | 'comment_reaction' | 'follow' | 'collection_add' | 'correction_accepted' | 'correction_rejected' | 'correction_needs_info' | 'correction_escalated';

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export const GEM_REACTION_TYPES = ['love', 'want_to_go', 'been_there'] as const;
export type GemReactionType = (typeof GEM_REACTION_TYPES)[number];

export const GEM_REACTION_LABELS: Record<string, string> = {
  love: 'Love',
  want_to_go: 'Want to go',
  been_there: 'Been there',
};

export const GEM_REACTION_EMOJIS: Record<string, string> = {
  love: '❤️',
  want_to_go: '🔖',
  been_there: '✅',
};

// ============================================================
// Phase 4 — Information Accuracy
// ============================================================

export type ConfirmationType = 'still_accurate' | 'information_changed' | 'temporarily_unavailable' | 'permanently_closed' | 'could_not_find';

export const CONFIRMATION_TYPES: ConfirmationType[] = ['still_accurate', 'information_changed', 'temporarily_unavailable', 'permanently_closed', 'could_not_find'];

export const CONFIRMATION_LABELS: Record<ConfirmationType, string> = {
  still_accurate: 'Still Accurate',
  information_changed: 'Information Has Changed',
  temporarily_unavailable: 'Temporarily Unavailable',
  permanently_closed: 'Permanently Closed',
  could_not_find: 'Could Not Find It',
};

export const CONFIRMATION_DESCRIPTIONS: Record<ConfirmationType, string> = {
  still_accurate: 'I visited recently and the information is still correct.',
  information_changed: 'Some details have changed since this was posted.',
  temporarily_unavailable: 'The place is temporarily closed or unavailable.',
  permanently_closed: 'The place appears to be permanently closed.',
  could_not_find: 'I could not find this place at the listed location.',
};

export interface GemConfirmation {
  id: string;
  gem_id: string;
  user_id: string;
  confirmation_type: ConfirmationType;
  note: string | null;
  evidence_image_url: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export type CorrectionType = 'name' | 'address' | 'description' | 'category' | 'price_level' | 'facilities' | 'accessibility' | 'visiting_time' | 'availability' | 'other';

export const CORRECTION_TYPES: CorrectionType[] = ['name', 'address', 'description', 'category', 'price_level', 'facilities', 'accessibility', 'visiting_time', 'availability', 'other'];

export const CORRECTION_LABELS: Record<CorrectionType, string> = {
  name: 'Name',
  address: 'Address',
  description: 'Description',
  category: 'Category',
  price_level: 'Price Level',
  facilities: 'Facilities',
  accessibility: 'Accessibility Information',
  visiting_time: 'Recommended Visiting Time',
  availability: 'Availability or Closure Information',
  other: 'Other',
};

export type CorrectionStatus = 'pending' | 'accepted' | 'rejected' | 'needs_info' | 'escalated';

export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  pending: 'Pending Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  needs_info: 'Needs More Information',
  escalated: 'Escalated for Review',
};

export interface CorrectionSuggestion {
  id: string;
  gem_id: string;
  suggested_by: string;
  correction_type: CorrectionType;
  current_value: string | null;
  suggested_value: string;
  explanation: string;
  evidence_url: string | null;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  suggester?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  reviewer?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export type ChangeSource = 'owner_edit' | 'accepted_correction' | 'verification_calculation' | 'system_update';

export interface GemEditHistory {
  id: string;
  gem_id: string;
  changed_field: string;
  previous_value: string | null;
  new_value: string | null;
  change_source: ChangeSource;
  changed_by: string | null;
  related_correction_id: string | null;
  reason: string | null;
  created_at: string;
  changed_by_user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  new: 'New',
  community_confirmed: 'Community Confirmed',
  may_be_outdated: 'Information May Be Outdated',
  temporarily_unavailable: 'Temporarily Unavailable',
  permanently_closed: 'Permanently Closed',
  under_review: 'Under Review',
};

export const VERIFICATION_STATUS_DESCRIPTIONS: Record<VerificationStatus, string> = {
  new: 'This gem was recently added and has not yet been confirmed by the community.',
  community_confirmed: 'Recently confirmed by community members.',
  may_be_outdated: 'Information may be outdated. No recent confirmations.',
  temporarily_unavailable: 'Reported as temporarily unavailable by community members.',
  permanently_closed: 'Reported as permanently closed by multiple community members.',
  under_review: 'Recent reports conflict. This gem needs review.',
};

export const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: 'Name',
  description: 'Description',
  place_name: 'Place Name',
  area: 'Area',
  address: 'Address',
  category_id: 'Category',
  cover_image_url: 'Cover Image',
  verification_status: 'Verification Status',
};

export const CHANGE_SOURCE_LABELS: Record<ChangeSource, string> = {
  owner_edit: 'Owner Edit',
  accepted_correction: 'Accepted Correction',
  verification_calculation: 'Status Recalculation',
  system_update: 'System Update',
};

// ============================================================
// Phase 5 — Safety & Moderation
// ============================================================

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocked?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export type ReportTargetType = 'profile' | 'gem' | 'comment' | 'collection' | 'community';
export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate_content' | 'off_topic' | 'duplicate' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated';

export const REPORT_REASONS: ReportReason[] = ['spam', 'harassment', 'misinformation', 'inappropriate_content', 'off_topic', 'duplicate', 'other'];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or repetitive content',
  harassment: 'Harassment or bullying',
  misinformation: 'Misinformation',
  inappropriate_content: 'Inappropriate content',
  off_topic: 'Off-topic content',
  duplicate: 'Duplicate',
  other: 'Other',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  reviewing: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  escalated: 'Escalated',
};

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  community_id: string | null;
  reason: ReportReason;
  description: string | null;
  evidence_path: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  escalation_reason: string | null;
  escalated_by: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
  reporter?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export interface CommunitySuspension {
  id: string;
  community_id: string;
  user_id: string;
  suspended_by: string;
  reason: string;
  duration_hours: number | null;
  expires_at: string | null;
  lifted_by: string | null;
  lifted_at: string | null;
  lift_reason: string | null;
  created_at: string;
  user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  suspended_by_user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export type ModerationActionType = 'hide_gem' | 'restore_gem' | 'suspend_user' | 'lift_suspension' | 'escalate_report' | 'resolve_report' | 'deactivate_account' | 'reactivate_account' | 'dismiss_report';

export const MODERATION_ACTION_LABELS: Record<ModerationActionType, string> = {
  hide_gem: 'Hidden a gem',
  restore_gem: 'Restored a gem',
  suspend_user: 'Suspended a user',
  lift_suspension: 'Lifted a suspension',
  escalate_report: 'Escalated a report',
  resolve_report: 'Resolved a report',
  deactivate_account: 'Deactivated an account',
  reactivate_account: 'Reactivated an account',
  dismiss_report: 'Dismissed a report',
};

export interface ModerationAction {
  id: string;
  action_type: ModerationActionType;
  target_type: string;
  target_id: string;
  moderator_id: string;
  community_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  moderator?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}
