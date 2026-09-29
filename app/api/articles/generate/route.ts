import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateArticle } from '@/lib/anthropic';
import { fetchLinkCandidates, sanitizeInternalLinks, type LinkCandidate } from '@/lib/crosslinks';
import { z } from 'zod';

export const maxDuration = 300;

const GenerateSchema = z.object({
  topic: z.string().min(1),
  site_ids: z.array(z.string().uuid()),
  tone: z.string().min(1),
  word_count_target: z.number().int().min(100).max(10000),
  image_count: z.number().int().min(0).max(8).default(0),
  image_style: z.string().default('photographic'),
  crosslink_site_id: z.string().uuid().nullable().default(null),
  crosslink_max: z.number().int().min(0).max(10).default(3),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { topic, site_ids, tone, word_count_target, image_count, image_style, crosslink_site_id, crosslink_max } = parsed.data;

  let linkSite: { url: string; plugin_key_encrypted: string | null } | null = null;
  let candidates: LinkCandidate[] = [];
  if (crosslink_site_id && crosslink_max > 0) {
    const { data } = await supabase.from('sites').select('url, plugin_key_encrypted').eq('id', crosslink_site_id).single();
    if (data) {
      linkSite = data;
      candidates = await fetchLinkCandidates(data);
    }
  }

  let generated;
  try {
    generated = await generateArticle({
      topic, tone,
      wordCountTarget: word_count_target,
      imageCount: image_count,
      imageStyle: image_style,
      linkCandidates: candidates,
      maxLinks: crosslink_max,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 });
  }

  const articleBody = linkSite ? sanitizeInternalLinks(generated.body, linkSite.url, candidates) : generated.body;
  const imagePlan = generated.images.map((img, i) => ({ n: i + 1, prompt: img.prompt, alt: img.alt, url: null }));

  const { data, error } = await supabase
    .from('articles')
    .insert({
      site_ids,
      title: generated.title,
      body: articleBody,
      meta_description: generated.metaDescription,
      tags: generated.tags,
      category: generated.category,
      image_plan: imagePlan,
      status: 'draft',
      topic,
      tone,
      word_count_target,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, crosslink_candidates: candidates.length }, { status: 201 });
}
