import PageHeader from '@/components/ui/page-header';
import HealthTable from '@/components/health/health-table';

export const dynamic = 'force-dynamic';

export default function HealthPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Health Dashboard"
        description="Site uptime and API connection status"
      />
      <div className="flex-1 overflow-auto p-6">
        <HealthTable />
      </div>
    </div>
  );
}
