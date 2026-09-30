import { NextResponse } from 'next/server';
import { getLatestPluginVersion } from '@/lib/plugin-version';

export async function GET() {
  return NextResponse.json({ version: await getLatestPluginVersion() });
}
