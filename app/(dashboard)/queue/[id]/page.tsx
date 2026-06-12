import ArticleEditor from '@/components/queue/article-editor';
import PageHeader from '@/components/ui/page-header';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Edit Article"
        action={
          <Link
            href="/queue"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
          >
            <ArrowLeft size={13} />
            Back to Queue
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <ArticleEditor id={id} />
      </div>
    </div>
  );
}
