import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/States';
import { uploadGemImage, validateImageFile, deleteGemImage } from '@/lib/upload';
import AccuracyPanel from '@/components/AccuracyPanel';
import ReportModal from '@/components/ReportModal';
import type { Gem, GemImage, Category, Comment, GemReaction, GemReactionType } from '@/types/database';
import { GEM_REACTION_TYPES, GEM_REACTION_LABELS, GEM_REACTION_EMOJIS } from '@/types/database';
import {
  ArrowLeft, MapPin, Edit3, Save, X, Trash2, Send, ImagePlus,
  Lock, Sparkles as SparkIcon, Calendar, Bookmark, MessageCircle,
  Heart, ChevronDown, Reply, CornerDownRight, Flag
} from 'lucide-react';

export default function GemDetailsPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const match = matchPath('/gems/:id', route.path);
  const gemId = match?.id ?? '';

  const [gem, setGem] = useState<Gem | null>(null);
  const [images, setImages] = useState<GemImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Edit form state
  const [title, setTitle] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);

  // Social state
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<GemReaction[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    if (!gemId || !profile) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: gErr } = await supabase
        .from('gems')
        .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, visibility), category:categories(id, name, slug, icon)')
        .eq('id', gemId)
        .maybeSingle();
      if (gErr || !data) { setError(true); return; }
      const g = data as Gem;
      setGem(g);

      const [imgsRes, catsRes, commentsRes, reactionsRes, savedRes] = await Promise.all([
        supabase.from('gem_images').select('*').eq('gem_id', gemId).order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('comments')
          .select('*, author:profiles(id, username, display_name, avatar_url)')
          .eq('gem_id', gemId)
          .order('created_at', { ascending: true }),
        supabase.from('gem_reactions').select('*').eq('gem_id', gemId),
        supabase.from('saved_gems').select('id').eq('gem_id', gemId).eq('user_id', profile.id).maybeSingle(),
      ]);
      setImages((imgsRes.data as GemImage[] | null) ?? []);
      setCategories((catsRes.data as Category[] | null) ?? []);
      setReactions((reactionsRes.data as GemReaction[] | null) ?? []);
      setIsSaved(!!savedRes.data);
      setComments(buildCommentTree((commentsRes.data as Comment[] | null) ?? []));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [gemId, profile]);

  useEffect(() => { load(); }, [load]);

  const isAuthor = gem?.author_id === profile?.id;

  const startEditing = () => {
    if (!gem) return;
    setTitle(gem.title);
    setPlaceName(gem.place_name);
    setCategoryId(gem.category_id ?? '');
    setArea(gem.area ?? '');
    setAddress(gem.address ?? '');
    setDescription(gem.description ?? '');
    setCoverImage(gem.cover_image_url);
    setFormError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!gem || !isAuthor) return;
    if (title.trim().length < 3) { setFormError('Title must be at least 3 characters.'); return; }
    if (!placeName.trim()) { setFormError('Place name is required.'); return; }
    setSaving(true);
    setFormError(null);
    const { error: updErr } = await supabase.from('gems').update({
      title: title.trim(),
      place_name: placeName.trim(),
      category_id: categoryId || null,
      area: area.trim() || null,
      address: address.trim() || null,
      description: description.trim() || null,
      cover_image_url: coverImage,
    }).eq('id', gem.id);
    setSaving(false);
    if (updErr) {
      if (updErr.code === '23505') setFormError('You already have a published gem for this place in this community.');
      else setFormError(updErr.message);
      return;
    }
    setEditing(false);
    await load();
  };

  const handlePublish = async () => {
    if (!gem || !isAuthor) return;
    setSaving(true);
    const { error: pubErr } = await supabase.from('gems').update({ status: 'published' }).eq('id', gem.id);
    setSaving(false);
    if (pubErr) {
      if (pubErr.code === '23505') setFormError('You already have a published gem for this place in this community.');
      else setFormError(pubErr.message);
      return;
    }
    await load();
  };

  const handleDelete = async () => {
    if (!gem || !isAuthor) return;
    if (!confirm('Delete this gem? This cannot be undone.')) return;
    await supabase.from('gems').delete().eq('id', gem.id);
    navigate('/discover');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gem) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    try {
      const { url } = await uploadGemImage(gem.id, file);
      setCoverImage(url);
      await supabase.from('gems').update({ cover_image_url: url }).eq('id', gem.id);
      await load();
    } catch {
      setImageError('Upload failed. Please try again.');
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gem) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    try {
      const { url } = await uploadGemImage(gem.id, file);
      const nextOrder = (images[images.length - 1]?.sort_order ?? 0) + 1;
      await supabase.from('gem_images').insert({ gem_id: gem.id, image_url: url, sort_order: nextOrder });
      await load();
    } catch {
      setImageError('Upload failed. Please try again.');
    }
  };

  const handleDeleteImage = async (img: GemImage) => {
    if (!gem) return;
    const path = img.image_url.split('/gem-images/')[1];
    if (path) {
      try { await deleteGemImage(path); } catch { /* ignore storage errors */ }
    }
    await supabase.from('gem_images').delete().eq('id', img.id);
    await load();
  };

  // --- Social handlers ---

  const handleToggleSave = async () => {
    if (!gem || !profile) return;
    if (isSaved) {
      await supabase.from('saved_gems').delete().eq('gem_id', gem.id).eq('user_id', profile.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_gems').insert({ gem_id: gem.id, user_id: profile.id });
      setIsSaved(true);
    }
  };

  const handleReact = async (type: GemReactionType) => {
    if (!gem || !profile) return;
    const existing = reactions.find((r) => r.user_id === profile.id && r.type === type);
    if (existing) {
      await supabase.from('gem_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('gem_reactions').insert({ gem_id: gem.id, user_id: profile.id, type });
    }
    await load();
  };

  const handleSubmitComment = async () => {
    if (!gem || !profile || !commentBody.trim()) return;
    setSubmittingComment(true);
    const { error: cErr } = await supabase.from('comments').insert({
      gem_id: gem.id,
      author_id: profile.id,
      body: commentBody.trim(),
    });
    setSubmittingComment(false);
    if (cErr) { setFormError(cErr.message); return; }
    setCommentBody('');
    await load();
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!gem || !profile || !replyBody.trim()) return;
    setSubmittingComment(true);
    const { error: cErr } = await supabase.from('comments').insert({
      gem_id: gem.id,
      author_id: profile.id,
      parent_id: parentId,
      body: replyBody.trim(),
    });
    setSubmittingComment(false);
    if (cErr) { setFormError(cErr.message); return; }
    setReplyBody('');
    setReplyingTo(null);
    setExpandedReplies((prev) => new Set(prev).add(parentId));
    await load();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    await supabase.from('comments').delete().eq('id', commentId);
    await load();
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading gem…</span></div>
      </div>
    );
  }

  if (error || !gem) {
    return (
      <div>
        <button onClick={() => navigate('/discover')} className="mb-4 flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Back</button>
        <ErrorState title="Gem not found" description="This gem may not exist or you don't have access to it." onRetry={() => navigate('/discover')} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
          <ArrowLeft className="h-4 w-4" /> Cancel edit
        </button>
        <PageHeader title="Edit gem" />

        <div className="card space-y-5 p-6">
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label">Place name</label>
            <input className="input" value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Area</label>
              <input className="input" value={area} onChange={(e) => setArea(e.target.value)} maxLength={100} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <span className="label">Cover image</span>
            {coverImage ? (
              <div className="relative overflow-hidden rounded-xl">
                <img src={coverImage} alt="Cover" className="h-48 w-full object-cover" />
                <button type="button" onClick={() => setCoverImage(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-6 text-stone-500 hover:border-primary-400 dark:border-stone-700">
                <ImagePlus className="h-6 w-6" />
                <span className="text-sm">Upload cover image</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
              </label>
            )}
          </div>
          {imageError && <p className="text-sm text-error-600 dark:text-error-400">{imageError}</p>}
          {formError && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{formError}</div>}
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <LoadingSpinner size={16} /> : <><Save className="h-4 w-4" /> Save changes</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate(`/communities/${gem.community_id}`)} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
        <ArrowLeft className="h-4 w-4" /> {gem.community?.name ?? 'Community'}
      </button>

      {/* Cover image */}
      {gem.cover_image_url && (
        <div className="overflow-hidden rounded-2xl">
          <img src={gem.cover_image_url} alt={gem.title} className="h-56 w-full object-cover sm:h-72" />
        </div>
      )}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {gem.status === 'draft' && <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>}
          {gem.community?.visibility === 'private' && <span className="badge bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"><Lock className="h-3 w-3" /> Private community</span>}
          {gem.category && <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{gem.category.name}</span>}
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{gem.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {gem.place_name}</span>
          {gem.area && <span className="flex items-center gap-1">{gem.area}</span>}
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(gem.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Author + actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {gem.author && (
          <button onClick={() => navigate(`/profile/${gem.author!.id}`)} className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800">
            <Avatar url={gem.author.avatar_url ?? null} name={gem.author.display_name} size={36} />
            <div>
              <p className="text-sm font-medium">{gem.author.display_name}</p>
              <p className="text-xs text-stone-400">@{gem.author.username}</p>
            </div>
          </button>
        )}
        <div className="flex items-center gap-2">
          <button onClick={handleToggleSave} className={`btn-outline ${isSaved ? 'text-primary-600 dark:text-primary-400' : ''}`}>
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
          {!isAuthor && (
            <button onClick={() => setShowReport(true)} className="btn-outline" title="Report this gem">
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {gem.description && (
        <div className="card p-5">
          <p className="whitespace-pre-line text-stone-700 dark:text-stone-300">{gem.description}</p>
        </div>
      )}

      {/* Address */}
      {gem.address && (
        <div className="card flex items-start gap-3 p-5">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
          <div>
            <p className="text-sm font-medium">Address</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{gem.address}</p>
          </div>
        </div>
      )}

      {/* Phase 4: Information Accuracy Panel */}
      <AccuracyPanel gem={gem} isAuthor={isAuthor} onGemUpdated={load} />

      {/* Reactions */}
      <div className="card p-5">
        <h2 className="mb-3 font-display text-base font-semibold">Reactions</h2>
        <div className="flex flex-wrap gap-2">
          {GEM_REACTION_TYPES.map((type) => {
            const count = reactions.filter((r) => r.type === type).length;
            const mine = reactions.some((r) => r.user_id === profile?.id && r.type === type);
            return (
              <button
                key={type}
                onClick={() => handleReact(type)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  mine
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                <span>{GEM_REACTION_EMOJIS[type]}</span>
                <span>{GEM_REACTION_LABELS[type]}</span>
                {count > 0 && <span className="text-xs text-stone-400">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h2 className="section-title text-lg">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-xl">
                <img src={img.image_url} alt="" className="aspect-square w-full object-cover" />
                {isAuthor && (
                  <button type="button" onClick={() => handleDeleteImage(img)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add image (author only) */}
      {isAuthor && (
        <div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-4 text-stone-500 hover:border-primary-400 dark:border-stone-700">
            <ImagePlus className="h-5 w-5" />
            <span className="text-sm">Add a photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAddImage} />
          </label>
          {imageError && <p className="mt-2 text-sm text-error-600 dark:text-error-400">{imageError}</p>}
        </div>
      )}

      {/* Comments */}
      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <MessageCircle className="h-5 w-5 text-stone-400" />
          Comments ({comments.length})
        </h2>

        {/* New comment */}
        <div className="mb-5 space-y-2">
          <textarea
            className="input min-h-[60px] resize-y"
            placeholder="Share your thoughts…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            maxLength={1000}
          />
          <button onClick={handleSubmitComment} disabled={submittingComment || !commentBody.trim()} className="btn-primary text-sm">
            {submittingComment ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Post comment</>}
          </button>
        </div>

        {/* Comment list */}
        {comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">No comments yet. Be the first to share!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={profile?.id ?? ''}
                onNavigate={(path) => navigate(path)}
                onDelete={handleDeleteComment}
                onReply={handleSubmitReply}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyBody={replyBody}
                setReplyBody={setReplyBody}
                expanded={expandedReplies.has(c.id)}
                onToggleExpand={() => toggleReplies(c.id)}
                submitting={submittingComment}
              />
            ))}
          </div>
        )}
      </div>

      {/* Owner actions */}
      {isAuthor && (
        <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
          <button onClick={startEditing} className="btn-outline"><Edit3 className="h-4 w-4" /> Edit</button>
          {gem.status === 'draft' && (
            <button onClick={handlePublish} disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Publish</>}
            </button>
          )}
          <button onClick={handleDelete} className="btn-danger ml-auto"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      )}

      {formError && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{formError}</div>}

      {showReport && gem && (
        <ReportModal
          targetType="gem"
          targetId={gem.id}
          communityId={gem.community_id}
          onClose={() => setShowReport(false)}
          onSubmitted={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Comment component
// ============================================================================

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onNavigate: (path: string) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyBody: string;
  setReplyBody: (body: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  submitting: boolean;
}

function CommentItem({
  comment, currentUserId, onNavigate, onDelete, onReply,
  replyingTo, setReplyingTo, replyBody, setReplyBody,
  expanded, onToggleExpand, submitting,
}: CommentItemProps) {
  const isMine = comment.author_id === currentUserId;
  const replies = comment.replies ?? [];
  const showReplies = expanded && replies.length > 0;
  const isReplying = replyingTo === comment.id;

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
        <div className="flex items-start gap-3">
          {comment.author && <Avatar url={comment.author.avatar_url ?? null} name={comment.author.display_name} size={32} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button onClick={() => onNavigate(`/profile/${comment.author_id}`)} className="text-sm font-medium hover:underline">
                {comment.author?.display_name ?? 'User'}
              </button>
              <span className="text-xs text-stone-400">{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-700 dark:text-stone-300">{comment.body}</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400"
              >
                <Reply className="h-3.5 w-3.5" /> Reply
              </button>
              {isMine && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-xs text-error-500 hover:text-error-700 dark:text-error-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 space-y-2 pl-11">
            <textarea
              className="input min-h-[50px] resize-y text-sm"
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              maxLength={1000}
            />
            <div className="flex gap-2">
              <button onClick={() => setReplyingTo(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => onReply(comment.id)} disabled={submitting || !replyBody.trim()} className="btn-primary text-xs">
                {submitting ? <LoadingSpinner size={14} /> : 'Post reply'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Replies toggle */}
      {replies.length > 0 && !comment.parent_id && (
        <>
          <button
            onClick={onToggleExpand}
            className="ml-4 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
            {replies.length} repl{replies.length !== 1 ? 'ies' : 'y'}
          </button>

          {showReplies && (
            <div className="ml-6 space-y-2 border-l-2 border-stone-200 pl-4 dark:border-stone-700">
              {replies.map((reply) => (
                <div key={reply.id} className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                  <div className="flex items-start gap-3">
                    <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-stone-300 dark:text-stone-600" />
                    {reply.author && <Avatar url={reply.author.avatar_url ?? null} name={reply.author.display_name} size={28} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate(`/profile/${reply.author_id}`)} className="text-sm font-medium hover:underline">
                          {reply.author?.display_name ?? 'User'}
                        </button>
                        <span className="text-xs text-stone-400">{new Date(reply.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-stone-700 dark:text-stone-300">{reply.body}</p>
                      {reply.author_id === currentUserId && (
                        <button
                          onClick={() => onDelete(reply.id)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-error-500 hover:text-error-700 dark:text-error-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function buildCommentTree(flat: Comment[]): Comment[] {
  const topLevel = flat.filter((c) => !c.parent_id);
  const replies = flat.filter((c) => c.parent_id);
  return topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parent_id === c.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  }));
}
