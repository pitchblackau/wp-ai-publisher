import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { testConnectionPlugin, updatePluginNow } from '@/lib/wp-api';

export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: site, error } = await supabase
    .from('sites')
    .select('id, url, plugin_key_encrypted, plugin_version')
    .eq('id', id)
    .single();
  if (error || !site) return NextResponse.json({ ok: false, error: 'Site not found' }, { status: 404 });
  if (!site.plugin_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'This site connects with an Application Password — the plugin is not installed, so there is nothing to update.' });
  }

  let cfg: { url: string; pluginKey: string };
  try { cfg = { url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) }; }
  catch { return NextResponse.json({ ok: false, error: 'Failed to decrypt credentials' }); }

  const result = await updatePluginNow(cfg);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.unsupported
        ? 'This site runs an older plugin that cannot update itself yet. Upload the latest ZIP once (Plugins → Add New → Upload); after that it updates from here.'
        : result.error,
    });
  }

  // Re-read the version that is actually installed now rather than trusting the response.
  const status = await testConnectionPlugin(cfg);
  const version = status.version ?? result.version ?? site.plugin_version;
  if (version) await supabase.from('sites').update({ plugin_version: version }).eq('id', id);

  return NextResponse.json({ ok: true, updated: !!result.updated, previous: result.previous, version });
}
