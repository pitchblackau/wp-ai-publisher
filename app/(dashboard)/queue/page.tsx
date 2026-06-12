import PageHeader from '@/components/ui/page-header';
import QueueList from '@/components/queue/queue-list';

export const dynamic = 'force-dynamic';

export default function QueuePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Review Queue"
        description="Edit and publish AI-generated articles"
      />
      <div className="flex-1 overflow-auto p-6">
        <QueueList />
      </div>
    </div>
  );
}
