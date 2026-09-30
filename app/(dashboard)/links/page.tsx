import PageHeader from '@/components/ui/page-header';
import LinksTool from '@/components/links/links-tool';

export const dynamic = 'force-dynamic';

export default function LinksPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Internal links"
        description="Scan a site's published posts, review suggested internal links, and apply the ones you approve"
      />
      <div className="flex-1 overflow-auto p-6">
        <LinksTool />
      </div>
    </div>
  );
}
