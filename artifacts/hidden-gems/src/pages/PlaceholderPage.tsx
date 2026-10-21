import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { EmptyState } from '@/components/States';
import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
}

export default function PlaceholderPage({ title, description, icon: Icon = Construction, backTo = '/discover', backLabel = 'Back to Discover' }: PlaceholderProps) {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title={title} />
      <div className="card">
        <EmptyState
          icon={<Icon className="h-6 w-6" />}
          title="Coming in a later phase"
          description={description}
          action={<button onClick={() => navigate(backTo)} className="btn-primary">{backLabel}</button>}
        />
      </div>
    </div>
  );
}
