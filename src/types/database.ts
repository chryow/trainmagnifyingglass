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
  onboarding_completed: boolean;
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
  created_at: string;
  updated_at: string;
  // joined fields
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
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

export type NotificationType = 'comment' | 'reply' | 'gem_reaction' | 'comment_reaction' | 'follow' | 'collection_add';

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
