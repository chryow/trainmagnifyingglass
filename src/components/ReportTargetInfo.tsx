import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReportTargetType } from '@/types/database';
import { MapPin, User, MessageCircle, Layers, Users, AlertCircle } from 'lucide-react';

interface Props {
  targetType: ReportTargetType;
  targetId: string;
}

interface TargetInfo {
  label: string;
  sublabel?: string;
  link?: string;
}

export default function ReportTargetInfo({ targetType, targetId }: Props) {
  const [info, setInfo] = useState<TargetInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (targetType === 'gem') {
          const { data } = await supabase
            .from('gems')
            .select('id, title, place_name')
            .eq('id', targetId)
            .maybeSingle();
          if (!cancelled) {
            if (data) {
              setInfo({ label: data.title, sublabel: data.place_name, link: `/gems/${data.id}` });
            } else {
              setInfo(null);
            }
          }
        } else if (targetType === 'profile') {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .eq('id', targetId)
            .maybeSingle();
          if (!cancelled) {
            if (data) {
              setInfo({ label: data.display_name, sublabel: `@${data.username}`, link: `/profile/${data.id}` });
            } else {
              setInfo(null);
            }
          }
        } else if (targetType === 'comment') {
          const { data } = await supabase
            .from('comments')
            .select('id, body, gem_id')
            .eq('id', targetId)
            .maybeSingle();
          if (!cancelled) {
            if (data) {
              setInfo({ label: data.body.slice(0, 80) + (data.body.length > 80 ? '…' : ''), sublabel: data.gem_id ? 'Comment on a gem' : 'Comment', link: data.gem_id ? `/gems/${data.gem_id}` : undefined });
            } else {
              setInfo(null);
            }
          }
        } else if (targetType === 'collection') {
          const { data } = await supabase
            .from('collections')
            .select('id, name')
            .eq('id', targetId)
            .maybeSingle();
          if (!cancelled) {
            if (data) {
              setInfo({ label: data.name, link: `/collections/${data.id}` });
            } else {
              setInfo(null);
            }
          }
        } else if (targetType === 'community') {
          const { data } = await supabase
            .from('communities')
            .select('id, name')
            .eq('id', targetId)
            .maybeSingle();
          if (!cancelled) {
            if (data) {
              setInfo({ label: data.name, link: `/communities/${data.id}` });
            } else {
              setInfo(null);
            }
          }
        }
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetType, targetId]);

  const icon = () => {
    switch (targetType) {
      case 'gem': return <MapPin className="h-3.5 w-3.5" />;
      case 'profile': return <User className="h-3.5 w-3.5" />;
      case 'comment': return <MessageCircle className="h-3.5 w-3.5" />;
      case 'collection': return <Layers className="h-3.5 w-3.5" />;
      case 'community': return <Users className="h-3.5 w-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
        {icon()}
        <span className="capitalize">{targetType}</span>
        <span>·</span>
        <span>Resolving target…</span>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="capitalize">{targetType}</span>
        <span>·</span>
        <span className="italic">Target no longer available</span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
      {icon()}
      <span className="font-medium text-stone-600 dark:text-stone-300">{info.label}</span>
      {info.sublabel && <><span>·</span><span>{info.sublabel}</span></>}
    </div>
  );
}
