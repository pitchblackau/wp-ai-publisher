'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Trash2 } from 'lucide-react';
import Badge from '@/components/ui/badge';
import type { Article } from '@/types';

function statusBadge(status: Article['status']) {
  const map = {
    draft: 'neutral',
    scheduled: 'warning',
    published: 'success',
    discarded: 'error',
  } as const;
  return <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} variant={map[status]} />;
}

export default function QueueList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/articles');
    const data = await res.json();
    setArticles(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function discardSelected() {
    if (!selected.size) return;
    if (!confirm(`Discard ${selected.size} article(s)?`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id =>
      fetch(`/api/articles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'discarded' }) })
    ));
    setSelected(new Set());
    await load();
    setDeleting(false);
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const visible = articles.filter(a => a.status !== 'discarded');

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed" style={{ borderColor: 'var(--border)' }}>
        <FileText size={32} style={{ color: 'var(--text-dim)' }} className="mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Queue is empty</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Generate an article to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.size} selected</span>
          <button
            onClick={discardSelected}
            disabled={deleting}
            className="text-xs px-2.5 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: '#ef444420', color: '#f87171' }}
          >
            <Trash2 size={12} className="inline mr-1" />
            Discard selected
          </button>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid var(--border)` }}>
              <th className="w-8 px-4 py-3" />
              {['Title', 'Topic', 'Status', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(article => (
              <tr key={article.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(article.id)}
                    onChange={() => toggleSelect(article.id)}
                    className="rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </td>
                <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--text)' }}>
                  <span className="line-clamp-1">{article.title || <span style={{ color: 'var(--text-dim)' }}>Untitled</span>}</span>
                </td>
                <td className="px-4 py-3 text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="line-clamp-1">{article.topic}</span>
                </td>
                <td className="px-4 py-3">{statusBadge(article.status)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {new Date(article.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/queue/${article.id}`}
                    className="text-xs px-2.5 py-1 rounded transition-colors hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
