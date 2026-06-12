import PageHeader from '@/components/ui/page-header';
import SiteList from '@/components/sites/site-list';
import AddSiteButton from '@/components/sites/add-site-button';

export const dynamic = 'force-dynamic';

export default function SitesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Site Registry"
        description="Manage your WordPress sites and API credentials"
        action={<AddSiteButton />}
      />
      <div className="flex-1 overflow-auto p-6">
        <SiteList />
      </div>
    </div>
  );
}
