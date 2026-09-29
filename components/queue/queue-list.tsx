'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Trash2, Send, Loader2, Pencil, Clock, ExternalLink, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import Badge from '@/components/ui/badge';
import type { Article } from '@/types';

interface Site { id: string; name: string; url: string; }
interface PublishJob { siteId: string; ok: boolean; postUrl?: string; }

type Tab = 'active' | 'published';

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
  const [sites, setSites] = useState<Site[]>([]);
  const [jobsByArticle, setJobsByArticle] = useState<Record<string, PublishJob[]>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [redoingId, setRedoingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      fetch('/api/articles').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
    ]);
    const articleList: Article[] = Array.isArray(a) ? a : [];
    setArticles(articleList);
    setSites(Array.isArray(s) ? s : []);

    const publishedIds = articleList.filter(x => x.status === 'published').map(x => x.id);
    if (publishedIds.length) {
      const jobLists = await Promise.all(
        publishedIds.map(id => fetch(`/api/articles/${id}/jobs`).then(r => r.ok ? r.json() : []).catch(() => []))
      );
      const map: Record<string, PublishJob[]> = {};
      publishedIds.forEach((id, i) => { map[id] = jobLists[i]; });
      setJobsByArticle(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const siteName = (id: string) => sites.find(s => s.id === id)?.name ?? 'Unknown site';

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

  async function quickPublish(article: Article) {
    if (!article.site_ids.length) {
      alert('No target sites selected for this article — open it to choose sites first.');
      return;
    }
    if (!confirm(`Publish "${article.title || 'this article'}" now to ${article.site_ids.length} site(s)?`)) return;
    setPublishingId(article.id);
    setNotice(null);
    const res = await fetch(`/api/articles/${article.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice({ ok: false, message: data.error ?? `Publish failed (${res.status})` });
    } else if (data.jobs) {
      const failed = data.jobs.filter((j: { ok: boolean }) => !j.ok);
      if (failed.length) {
        const detail = failed.map((j: { siteId: string; error?: string }) => `${siteName(j.siteId)}: ${j.error ?? 'failed'}`).join(' | ');
        setNotice({ ok: data.anyOk, message: data.anyOk ? `Published, but ${failed.length} site(s) failed — ${detail}` : `Failed on every site — ${detail}` });
      } else {
        setNotice({ ok: true, message: 'Published successfully' });
      }
    }
    await load();
    setPublishingId(null);
    setTimeout(() => setNotice(null), 8000);
  }

  async function deleteAndRedo(article: Article) {
    if (!confirm(`Remove "${article.title || 'this article'}" from every published site and move it back to draft? This cannot be undone on the WordPress side.`)) return;
    setRedoingId(article.id);
    setNotice(null);
    const res = await fetch(`/api/articles/${article.id}/publish`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice({ ok: false, message: data.error ?? `Could not remove the post (${res.status}) — it is still live and still shows as Published` });
    } else {
      const failed = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (failed.length) {
        const detail = failed.map((r: { siteId: string; error?: string }) => `${siteName(r.siteId)}: ${r.error ?? 'failed'}`).join(' | ');
        setNotice({ ok: false, message: `Could not remove from ${failed.length} site(s) — it will stay Published until this is fixed. ${detail}` });
      } else {
        setNotice({ ok: true, message: 'Removed from all sites — back to draft' });
      }
    }
    await load();
    setRedoingId(null);
    setTimeout(() => setNotice(null), 10000);
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const active = articles.filter(a => a.status === 'draft' || a.status === 'scheduled');
  const published = articles.filter(a => a.status === 'published');
  const visible = tab === 'active' ? active : published;

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--surface-2)' }}>
        <button
          onClick={() => setTab('active')}
          className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{ background: tab === 'active' ? 'var(--accent)' : 'transparent', color: tab === 'active' ? 'white' : 'var(--text-muted)' }}
        >
          Needs action ({active.length})
        </button>
        <button
          onClick={() => setTab('published')}
          className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{ background: tab === 'published' ? 'var(--accent)' : 'transparent', color: tab === 'published' ? 'white' : 'var(--text-muted)' }}
        >
          Published ({published.length})
        </button>
      </div>

      {notice && (
        <div
          className="flex items-start gap-2 px-4 py-2.5 rounded-lg border text-xs"
          style={{ background: notice.ok ? '#15803d15' : '#ef444415', borderColor: notice.ok ? '#15803d40' : '#ef444440', color: notice.ok ? '#4ade80' : '#f87171' }}
        >
          {notice.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {tab === 'active' && selected.size > 0 && (
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed" style={{ borderColor: 'var(--border)' }}>
          <FileText size={32} style={{ color: 'var(--text-dim)' }} className="mb-3" />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {tab === 'active' ? 'Nothing needs action' : 'Nothing published yet'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {tab === 'active' ? 'Generate an article to get started' : 'Published articles will show up here'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                {tab === 'active' && <th className="w-8 px-4 py-3" />}
                {['Title', 'Target sites', 'Status', tab === 'active' ? 'Created' : 'Published', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(article => (
                <tr key={article.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  {tab === 'active' && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(article.id)}
                        onChange={() => toggleSelect(article.id)}
                        className="rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--text)' }}>
                    <span className="line-clamp-1">{article.title || <span style={{ color: 'var(--text-dim)' }}>Untitled</span>}</span>
                    <span className="block text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-dim)' }}>{article.topic}</span>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[220px]">
                    {article.site_ids.length === 0 ? (
                      <span style={{ color: '#fbbf24' }}>No sites selected</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {article.site_ids.map(id => (
                          <span key={id} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                            {siteName(id)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(article.status)}
                    {article.status === 'scheduled' && article.scheduled_at && (
                      <span className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                        <Clock size={10} /> {new Date(article.scheduled_at).toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                    {new Date(tab === 'active' ? article.created_at : (article.published_at ?? article.created_at)).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {tab === 'active' ? (
                        <>
                          {article.status === 'draft' && (
                            <button
                              onClick={() => quickPublish(article)}
                              disabled={publishingId === article.id}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                              style={{ background: 'var(--accent)', color: 'white' }}
                              title={article.site_ids.length ? `Publish to ${article.site_ids.length} site(s)` : 'No sites selected'}
                            >
                              {publishingId === article.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Publish
                            </button>
                          )}
                          <Link
                            href={`/queue/${article.id}`}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-colors hover:opacity-80"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                          >
                            <Pencil size={12} /> Edit
                          </Link>
                        </>
                      ) : (
                        <>
                          {(jobsByArticle[article.id] ?? []).filter(j => j.ok && j.postUrl).map(j => (
                            <a
                              key={j.siteId}
                              href={j.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-colors hover:opacity-80"
                              style={{ background: 'var(--surface-2)', color: 'var(--accent-hover)' }}
                            >
                              {siteName(j.siteId)} <ExternalLink size={10} />
                            </a>
                          ))}
                          <Link
                            href={`/queue/${article.id}`}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-colors hover:opacity-80"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                          >
                            <Pencil size={12} /> View
                          </Link>
                          <button
                            onClick={() => deleteAndRedo(article)}
                            disabled={redoingId === article.id}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: '#ef444420', color: '#f87171' }}
                            title="Remove from every site and move back to draft"
                          >
                            {redoingId === article.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                            Delete & Redo
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
