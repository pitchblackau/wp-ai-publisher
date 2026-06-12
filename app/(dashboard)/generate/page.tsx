import PageHeader from '@/components/ui/page-header';
import GenerateForm from '@/components/generate/generate-form';

export const dynamic = 'force-dynamic';

export default function GeneratePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI Article Generator"
        description="Generate SEO-optimised articles with Claude AI"
      />
      <div className="flex-1 overflow-auto p-6">
        <GenerateForm />
      </div>
    </div>
  );
}
