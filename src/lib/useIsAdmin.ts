import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// One lookup per signed-in user, shared by every component that asks
let cache: { userId: string; value: Promise<boolean> } | null = null;

/** Whether the signed-in user is a platform admin (false while loading). */
export function useIsAdmin(): boolean {
  const { profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!profile) { setIsAdmin(false); return; }
    if (!cache || cache.userId !== profile.id) {
      cache = {
        userId: profile.id,
        value: Promise.resolve(supabase.rpc('is_platform_admin')).then(({ data }) => !!data, () => false),
      };
    }
    let active = true;
    cache.value.then((v) => active && setIsAdmin(v));
    return () => { active = false; };
  }, [profile]);
  return isAdmin;
}
