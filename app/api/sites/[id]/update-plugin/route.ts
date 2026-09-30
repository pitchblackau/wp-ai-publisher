import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { testConnectionPlugin, updatePluginNow } from '@/lib/wp-api';
import { getLatestPluginVersion, versionCmp } from '@/lib/plugin-version';

export const maxDuration = 120;

async function refresh(id: string, cfg: { url: string; pluginKey: string }) {
  const s = await testConnectionPlugin(cfg);
  await supabase.from('sites').update({
    status: s.ok ? 'active' : 'error',
    last_checked_at: new Date().toISOString(),
    last_error: s.ok ? null : s.message,
    ...(s.version ? { plugin_version: s.version } : {}),
  }).eq('id', id);
  return s;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: site, error } = await supabase.from('sites').select('id, url, plugin_key_encrypted').eq('id', id).single();
  if (error || !site) return NextResponse.json({ ok: false, error: 'Site not found' }, { status: 404 });
  if (!site.plugin_key_encrypted) {
    return NextResponse.json({ ok: false, error: 'This site connects with an Application Password — the plugin is not installed, so there is nothing to update.' });
  }

  let cfg: { url: string; pluginKey: string };
  try { cfg = { url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) }; }
  catch { return NextResponse.json({ ok: false, error: 'Failed to decrypt credentials' }); }

  // Establish what is really installed before doing anything — stored values can be stale.
  const before = await refresh(id, cfg);
  if (!before.ok) return NextResponse.json({ ok: false, error: before.message });

  const latest = await getLatestPluginVersion();
  if (before.version && latest && versionCmp(before.version, latest) >= 0) {
    return NextResponse.json({ ok: true, updated: false, version: before.version, message: `Already on v${before.version}` });
  }

  const result = await updatePluginNow(cfg);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.unsupported
        ? `This site runs plugin v${before.version ?? 'older than 1.2.0'}, which cannot update itself. Upload the latest ZIP once (delete the old plugin first on WordPress older than 5.5); after that it updates from here.`
        : result.error,
    });
  }

  const after = await refresh(id, cfg);
  if (after.version && before.version && versionCmp(after.version, before.version) <= 0 && latest && versionCmp(after.version, latest) < 0) {
    return NextResponse.json({
      ok: false,
      error: `WordPress did not install the update (still v${after.version}). Automatic updates may be disabled on this site (AUTOMATIC_UPDATER_DISABLED, file permissions, or a hosting restriction) — update it manually from WP Admin → Plugins.`,
    });
  }

  return NextResponse.json({ ok: true, updated: true, previous: before.version, version: after.version ?? result.version, message: `Updated to v${after.version ?? result.version}` });
}
