import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { getPostPlugin, updatePostContentPlugin } from '@/lib/wp-api';
import { applyEdits, type LinkEdit } from '@/lib/internal-links';

export const maxDuration = 60;

const EditSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add'), anchor: z.string().min(1), url: z.string().url() }),
  z.object({ type: z.literal('replace'), old_url: z.string().url(), new_url: z.string().url() }),
  z.object({ type: z.literal('remove'), old_url: z.string().url() }),
]);
const Schema = z.object({ site_id: z.string().uuid(), post_id: z.number().int(), edits: z.array(EditSchema).min(1) });

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  const { site_id, post_id, edits } = parsed.data;

  const { data: site } = await supabase.from('sites').select('id, url, plugin_key_encrypted').eq('id', site_id).single();
  if (!site?.plugin_key_encrypted) return NextResponse.json({ ok: false, error: 'Site not found or has no plugin key' }, { status: 404 });

  let cfg: { url: string; pluginKey: string };
  try { cfg = { url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) }; }
  catch { return NextResponse.json({ ok: false, error: 'Failed to decrypt credentials' }, { status: 500 }); }

  // Re-read the live post so edits apply to what is there now, not to what was scanned earlier.
  const current = await getPostPlugin(cfg, post_id);
  if (!current.ok || !current.post) return NextResponse.json({ ok: false, error: current.error ?? 'Could not read post' });
  if (current.post.builder === 'elementor') return NextResponse.json({ ok: false, error: 'Built with Elementor — edit in Elementor' });

  const { html, applied } = applyEdits(current.post.content ?? '', edits as LinkEdit[]);
  if (!applied.length) return NextResponse.json({ ok: false, error: 'Nothing to change — the post was edited since the scan, or the links are already in place' });

  const saved = await updatePostContentPlugin(cfg, post_id, html);
  if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error });
  return NextResponse.json({ ok: true, applied: applied.length });
}
