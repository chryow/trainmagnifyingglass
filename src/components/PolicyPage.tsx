import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { ArrowLeft, FileText } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function PolicyPage({ title, subtitle, children }: Props) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/discover')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card space-y-4 p-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {children}
        </div>
        <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
          <p className="flex items-center gap-2 text-xs text-stone-400">
            <FileText className="h-3.5 w-3.5" />
            This page is placeholder legal wording and should be reviewed by the application owner before a broad public release.
          </p>
        </div>
      </div>
    </div>
  );
}
