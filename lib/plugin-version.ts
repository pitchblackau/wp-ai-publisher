const MANIFEST_URL = 'https://raw.githubusercontent.com/pitchblackau/wp-ai-publisher/master/plugin/update.json';

export async function getLatestPluginVersion(): Promise<string | null> {
  try {
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}
