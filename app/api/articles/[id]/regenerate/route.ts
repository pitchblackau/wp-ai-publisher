import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateArticle } from '@/lib/anthropic';

export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: article, error } = await supabase
    .from('articles')
    .select('id, topic, tone, word_count_target, image_plan, status')
    .eq('id', id)
    .single();

  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  if (article.status === 'published' || article.status === 'scheduled') {
    return NextResponse.json({ error: 'Remove the live post(s) first (Delete & Redo) before regenerating' }, { status: 400 });
  }

  const priorImageCount = Math.max((article.image_plan ?? []).length, 0);

  let generated;
  try {
    generated = await generateArticle({
      topic: article.topic,
      tone: article.tone,
      wordCountTarget: article.word_count_target,
      imageCount: priorImageCount,
      imageStyle: 'photographic',
      linkCandidates: [],
      maxLinks: 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Regeneration failed' }, { status: 500 });
  }

  const imagePlan = generated.images.map((img, i) => ({ n: i + 1, prompt: img.prompt, alt: img.alt, url: null }));

  const { data, error: upErr } = await supabase
    .from('articles')
    .update({
      title: generated.title,
      body: generated.body,
      meta_description: generated.metaDescription,
      tags: generated.tags,
      category: generated.category,
      image_plan: imagePlan,
      status: 'draft',
    })
    .eq('id', id)
    .select('*')
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json(data);
}
