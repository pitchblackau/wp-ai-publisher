import Anthropic from '@anthropic-ai/sdk';
import type { LinkCandidate } from '@/lib/crosslinks';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

export type LinkEdit =
  | { type: 'add'; anchor: string; url: string; target_title?: string }
  | { type: 'replace'; old_url: string; new_url: string; target_title?: string }
  | { type: 'remove'; old_url: string };

const norm = (u: string) => u.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();

export function visibleText(html: string, max = 7000): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function linkedUrls(html: string): string[] {
  return [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
}

export function internalLinks(html: string, siteUrl: string): string[] {
  let host: string;
  try { host = new URL(siteUrl).hostname.replace(/^www\./, ''); } catch { return []; }
  const out = new Set<string>();
  for (const href of linkedUrls(html)) {
    try {
      const u = new URL(href, siteUrl);
      if (u.hostname.replace(/^www\./, '') === host && /^https?:$/.test(u.protocol)) out.add(u.toString());
    } catch { /* ignore */ }
  }
  return [...out];
}

// Internal links that no longer resolve (404/410). Only these are ever proposed for change/removal.
export async function findBrokenLinks(urls: string[]): Promise<string[]> {
  const broken: string[] = [];
  await Promise.all(urls.slice(0, 15).map(async url => {
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (res.status === 405 || res.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (res.status === 404 || res.status === 410) broken.push(url);
    } catch { /* unreachable is not proof it is broken */ }
  }));
  return broken;
}

// Rank candidates by simple word overlap so each prompt only carries the ~40 most plausible targets.
function rankCandidates(text: string, candidates: LinkCandidate[], limit = 40): LinkCandidate[] {
  const words = new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  return candidates
    .map(c => {
      const t = (c.title + ' ' + c.excerpt).toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
      return { c, score: t.filter(w => words.has(w)).length };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.c);
}

interface Proposal { add: { anchor: string; target: number }[]; fix: { broken: number; action: 'replace' | 'remove'; target?: number }[]; }

export async function proposeEdits(opts: {
  title: string;
  html: string;
  candidates: LinkCandidate[];
  broken: string[];
  maxLinks: number;
}): Promise<LinkEdit[]> {
  const text = visibleText(opts.html);
  const alreadyLinked = new Set(linkedUrls(opts.html).map(norm));
  const pool = rankCandidates(text, opts.candidates).filter(c => !alreadyLinked.has(norm(c.url)));
  if (!pool.length && !opts.broken.length) return [];

  const prompt = `You improve internal linking on a WordPress post.

POST TITLE: ${opts.title}
POST TEXT:
${text}

CANDIDATE POSTS TO LINK TO (choose by number):
${pool.map((c, i) => `${i + 1}. ${c.title}${c.excerpt ? ` — ${c.excerpt.slice(0, 90)}` : ''}`).join('\n')}
${opts.broken.length ? `\nBROKEN INTERNAL LINKS ALREADY IN THE POST (404):\n${opts.broken.map((u, i) => `b${i + 1}. ${u}`).join('\n')}\n` : ''}
Rules:
- "add": up to ${opts.maxLinks} new links. "anchor" MUST be an exact, contiguous 2-6 word phrase copied verbatim from POST TEXT (case-sensitive) that naturally describes the target. "target" is a candidate number.
- Only link where the candidate is clearly relevant to that sentence. Adding fewer (or none) is better than a weak link. Never use the same target twice. Never anchor on generic words like "click here".
- "fix": for each broken link, either {"broken": <number after b>, "action": "replace", "target": <candidate number>} if a candidate is a good replacement, or {"broken": <n>, "action": "remove"}.
- Return ONLY JSON: {"add":[{"anchor":"...","target":1}],"fix":[]}`;

  const msg = await client.messages.create({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '';
  let parsed: Proposal;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch { return []; }

  const edits: LinkEdit[] = [];
  const usedTargets = new Set<number>();
  for (const a of parsed.add ?? []) {
    const c = pool[(a.target ?? 0) - 1];
    if (!c || typeof a.anchor !== 'string' || usedTargets.has(a.target) || edits.filter(e => e.type === 'add').length >= opts.maxLinks) continue;
    usedTargets.add(a.target);
    edits.push({ type: 'add', anchor: a.anchor, url: c.url, target_title: c.title });
  }
  for (const f of parsed.fix ?? []) {
    const old = opts.broken[(f.broken ?? 0) - 1];
    if (!old) continue;
    if (f.action === 'replace') {
      const c = pool[(f.target ?? 0) - 1];
      if (c) edits.push({ type: 'replace', old_url: old, new_url: c.url, target_title: c.title });
    } else if (f.action === 'remove') {
      edits.push({ type: 'remove', old_url: old });
    }
  }
  return edits;
}

const SKIP_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'script', 'style', 'pre', 'code', 'textarea', 'button', 'figcaption']);
const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);

// Applies edits deterministically; returns only the edits that actually changed something.
export function applyEdits(html: string, edits: LinkEdit[]): { html: string; applied: LinkEdit[] } {
  const applied: LinkEdit[] = [];
  let out = html;

  for (const e of edits) {
    if (e.type === 'replace') {
      const next = out.split(`href="${e.old_url}"`).join(`href="${e.new_url}"`).split(`href='${e.old_url}'`).join(`href='${e.new_url}'`);
      if (next !== out) { out = next; applied.push(e); }
    } else if (e.type === 'remove') {
      const esc = e.old_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const next = out.replace(new RegExp(`<a\\s[^>]*href=["']${esc}["'][^>]*>([\\s\\S]*?)</a>`, 'gi'), '$1');
      if (next !== out) { out = next; applied.push(e); }
    }
  }

  for (const e of edits) {
    if (e.type !== 'add') continue;
    if (!e.anchor.trim()) continue;
    if (linkedUrls(out).map(norm).includes(norm(e.url))) continue; // already linked somewhere in the post

    const tokens = out.split(/(<!--[\s\S]*?-->|<[^>]*>)/);
    const depth = new Map<string, number>();
    let inSkip = 0;
    let done = false;

    for (let i = 0; i < tokens.length && !done; i++) {
      const t = tokens[i];
      if (t.startsWith('<')) {
        const m = /^<(\/?)([a-zA-Z0-9]+)/.exec(t);
        if (m && SKIP_TAGS.has(m[2].toLowerCase()) && !t.endsWith('/>')) {
          const tag = m[2].toLowerCase();
          const d = (depth.get(tag) ?? 0) + (m[1] ? -1 : 1);
          depth.set(tag, Math.max(d, 0));
          inSkip = [...depth.values()].reduce((a, b) => a + b, 0);
        }
        continue;
      }
      if (inSkip > 0) continue;
      let from = 0;
      for (;;) {
        const at = t.indexOf(e.anchor, from);
        if (at === -1) break;
        if (!isWordChar(t[at - 1]) && !isWordChar(t[at + e.anchor.length])) {
          tokens[i] = t.slice(0, at) + `<a href="${e.url}">${e.anchor}</a>` + t.slice(at + e.anchor.length);
          done = true;
          break;
        }
        from = at + 1;
      }
    }
    if (done) { out = tokens.join(''); applied.push(e); }
  }

  return { html: out, applied };
}

export function contextFor(html: string, anchor: string): string {
  const text = visibleText(html, 200000);
  const at = text.indexOf(anchor);
  if (at === -1) return anchor;
  return (at > 60 ? '…' : '') + text.slice(Math.max(0, at - 60), at + anchor.length + 60) + '…';
}
