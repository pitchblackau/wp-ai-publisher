'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, CheckCircle, AlertCircle, ExternalLink, Link2 } from 'lucide-react';

interface Site { id: string; name: string; plugin_key_encrypted: string | null; plugin_version: string | null; }

type Edit =
  | { type: 'add'; anchor: string; url: string; target_title?: string; context?: string }
  | { type: 'replace'; old_url: string; new_url: string; target_title?: string }
  | { type: 'remove'; old_url: string };

interface PostResult { post_id: number; title: string; url: string; edits: Edit[]; skipped?: string; }

const SCAN_LIMITS = [10, 25, 50, 100, 200];
const PAGE = 5;

function describe(e: Edit) {
  if (e.type === 'add') return { label: 'Add link', text: `“${e.anchor}” → ${e.target_title ?? e.url}`, sub: e.context };
  if (e.type === 'replace') return { label: 'Fix broken link', text: `${e.old_url} → ${e.target_title ?? e.new_url}`, sub: undefined };
  return { label: 'Remove broken link', text: e.old_url, sub: undefined };
}

export default function LinksTool() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [limit, setLimit] = useState(25);
  const [maxLinks, setMaxLinks] = useState(3);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({}); // `${post_id}:${index}`
  const [applying, setApplying] = useState(false);
  const [applyLog, setApplyLog] = useState<Record<number, { ok: boolean; message: string }>>({});

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(d => {
      const list: Site[] = (Array.isArray(d) ? d : []).filter((s: Site) => s.plugin_key_encrypted);
      setSites(list);
      if (list[0]) setSiteId(list[0].id);
    });
  }, []);

  async function scan() {
    setScanning(true); setError(''); setResults(null); setChosen({}); setApplyLog({}); setProgress(0);
    const all: PostResult[] = [];
    for (let page = 1; all.length < limit; page++) {
      const res = await fetch('/api/links/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, page, per_page: PAGE, max_links: maxLinks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `Scan failed (${res.status})`); break; }
      all.push(...data.posts);
      setProgress(all.length);
      setResults([...all]);
      if (!data.has_more) break;
    }
    const pre: Record<string, boolean> = {};
    all.forEach(p => p.edits.forEach((_, i) => { pre[`${p.post_id}:${i}`] = true; }));
    setChosen(pre);
    setScanning(false);
  }

  const withEdits = (results ?? []).filter(p => p.edits.length);
  const selectedCount = withEdits.reduce((n, p) => n + p.edits.filter((_, i) => chosen[`${p.post_id}:${i}`]).length, 0);

  async function apply() {
    if (!selectedCount) return;
    if (!confirm(`Apply ${selectedCount} link change(s) across ${withEdits.filter(p => p.edits.some((_, i) => chosen[`${p.post_id}:${i}`])).length} live post(s)? WordPress keeps a revision of each post so changes can be rolled back.`)) return;
    setApplying(true); setApplyLog({});
    for (const p of withEdits) {
      const edits = p.edits.filter((_, i) => chosen[`${p.post_id}:${i}`]);
      if (!edits.length) continue;
      const res = await fetch('/api/links/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, post_id: p.post_id, edits }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: 'Request failed' }));
      setApplyLog(l => ({ ...l, [p.post_id]: data.ok ? { ok: true, message: `${data.applied} change(s) applied` } : { ok: false, message: data.error ?? 'Failed' } }));
    }
    setApplying(false);
  }

  const site = sites.find(s => s.id === siteId);
  const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-1.5 min-w-[220px]">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Website</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} className="px-3 py-2 rounded-md text-sm border outline-none" style={inputStyle}>
            {sites.length === 0 && <option value="">No plugin-key sites</option>}
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.plugin_version ? ` (plugin v${s.plugin_version})` : ''}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Posts to scan (newest first)</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="px-3 py-2 rounded-md text-sm border outline-none" style={inputStyle}>
            {SCAN_LIMITS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Max new links per post</label>
          <select value={maxLinks} onChange={e => setMaxLinks(Number(e.target.value))} className="px-3 py-2 rounded-md text-sm border outline-none" style={inputStyle}>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button
          onClick={scan}
          disabled={!siteId || scanning || applying}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {scanning ? `Scanning… ${progress} posts` : 'Scan for link opportunities'}
        </button>
      </div>

      {site && site.plugin_version && site.plugin_version.localeCompare('1.2.0', undefined, { numeric: true }) < 0 && (
        <p className="text-xs px-3 py-2 rounded-md" style={{ background: '#f59e0b15', color: '#fbbf24' }}>
          This site&apos;s plugin is v{site.plugin_version}. Scanning needs v1.2.0 or newer — update it on the Sites page first.
        </p>
      )}
      {error && <p className="text-xs px-3 py-2 rounded-md" style={{ background: '#ef444420', color: '#f87171' }}>{error}</p>}

      {results && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {results.length} post(s) scanned · {withEdits.length} with suggestions · {results.filter(p => p.skipped).length} skipped
            </span>
            {withEdits.length > 0 && (
              <button
                onClick={apply}
                disabled={applying || scanning || !selectedCount}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Apply {selectedCount} selected change(s)
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {withEdits.map(p => (
              <div key={p.post_id} className="p-4 rounded-lg border flex flex-col gap-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--text)' }}>
                    {p.title} <ExternalLink size={11} />
                  </a>
                  {applyLog[p.post_id] && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: applyLog[p.post_id].ok ? '#4ade80' : '#f87171' }}>
                      {applyLog[p.post_id].ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {applyLog[p.post_id].message}
                    </span>
                  )}
                </div>
                {p.edits.map((e, i) => {
                  const d = describe(e);
                  return (
                    <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!chosen[`${p.post_id}:${i}`]}
                        onChange={ev => setChosen(c => ({ ...c, [`${p.post_id}:${i}`]: ev.target.checked }))}
                        className="mt-0.5"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span style={{ color: 'var(--text)' }}><b style={{ color: e.type === 'add' ? 'var(--accent-hover)' : '#fbbf24' }}>{d.label}:</b> {d.text}</span>
                        {d.sub && <span style={{ color: 'var(--text-dim)' }}>{d.sub}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
            {!scanning && withEdits.length === 0 && (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No worthwhile link changes found in the posts scanned.</p>
            )}
          </div>

          {results.some(p => p.skipped) && (
            <details className="text-xs" style={{ color: 'var(--text-dim)' }}>
              <summary className="cursor-pointer">{results.filter(p => p.skipped).length} post(s) skipped</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {results.filter(p => p.skipped).map(p => <li key={p.post_id}>{p.title} — {p.skipped}</li>)}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
