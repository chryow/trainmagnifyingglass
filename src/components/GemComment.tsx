import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import type { Comment } from '@/types/database';
import { Trash2, ChevronDown, Reply, CornerDownRight, Flag } from 'lucide-react';

export interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onNavigate: (path: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onReply: (parentId: string) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyBody: string;
  setReplyBody: (body: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  submitting: boolean;
}

export function CommentItem({
  comment, currentUserId, onNavigate, onDelete, onReport, onReply,
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
              {isMine ? (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-xs text-error-500 hover:text-error-700 dark:text-error-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              ) : (
                <button
                  onClick={() => onReport(comment.id)}
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400"
                >
                  <Flag className="h-3.5 w-3.5" /> Report
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
                      {reply.author_id === currentUserId ? (
                        <button
                          onClick={() => onDelete(reply.id)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-error-500 hover:text-error-700 dark:text-error-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => onReport(reply.id)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400"
                        >
                          <Flag className="h-3.5 w-3.5" /> Report
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

export function buildCommentTree(flat: Comment[]): Comment[] {
  const topLevel = flat.filter((c) => !c.parent_id);
  const replies = flat.filter((c) => c.parent_id);
  return topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parent_id === c.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  }));
}
