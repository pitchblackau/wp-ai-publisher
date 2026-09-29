import Anthropic from '@anthropic-ai/sdk';
import type { LinkCandidate } from '@/lib/crosslinks';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GenerateArticleParams {
  topic: string;
  tone: string;
  wordCountTarget: number;
  imageCount: number;
  imageStyle: string;
  linkCandidates: LinkCandidate[];
  maxLinks: number;
}

export interface GeneratedArticle {
  title: string;
  body: string;
  metaDescription: string;
  tags: string[];
  category: string;
  images: { prompt: string; alt: string }[];
}

export async function generateArticle(params: GenerateArticleParams): Promise<GeneratedArticle> {
  const { topic, tone, wordCountTarget, imageCount, imageStyle, linkCandidates, maxLinks } = params;

  const imageRules = imageCount > 0 ? `
Images:
- Plan exactly ${imageCount} images in the "images" array. Image 1 is the featured/hero image and must NOT appear in the body.
- For images 2 to ${imageCount}, place the marker [[IMAGE:n]] (n = the image number) on its own line in the body, between sections where it fits best. Use each marker exactly once.
- Each image needs "prompt" (a detailed text-to-image prompt: subject, setting, lighting, composition; visual style: ${imageStyle}; no text, logos, watermarks or UI screenshots in the image; natural anatomy with no distorted hands or faces) and "alt" (descriptive alt text under 125 characters).` : '';

  const linkRules = linkCandidates.length > 0 && maxLinks > 0 ? `
Internal linking — existing posts on the same website:
${linkCandidates.map(c => `- ${c.title} | ${c.url}${c.excerpt ? ` | ${c.excerpt.slice(0, 100)}` : ''}`).join('\n')}

- Link to between 1 and ${maxLinks} of these posts from the body using <a href="URL">descriptive anchor text</a>.
- Only link where the post is genuinely relevant to the sentence; skip it otherwise. If none are relevant, add no links.
- Use the exact URLs listed above. Never invent or modify URLs. Link each URL at most once.
- Anchor text must be natural and descriptive (never "click here" or "read more").` : '';

  const prompt = `You are an expert content writer. Generate a complete, publish-ready blog article with the following specifications:

Topic: ${topic}
Tone: ${tone}
Target word count: ${wordCountTarget} words

Return your response as a valid JSON object with exactly these fields:
{
  "title": "Article title (compelling, SEO-friendly)",
  "body": "Full article body as HTML (use <h2>, <h3>, <p>, <ul>, <li> tags, ready for WordPress)",
  "metaDescription": "SEO meta description under 160 characters",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "Single most relevant category name",
  "images": [{ "prompt": "...", "alt": "..." }]
}

Requirements:
- The body should be approximately ${wordCountTarget} words
- Use proper HTML formatting with headings, paragraphs, and lists
- The meta description must be under 160 characters
- Provide 3-6 relevant tags
- Suggest one specific category
- "images" must be an empty array when no images are requested
${imageRules}
${linkRules}

Return only the JSON object, no markdown code blocks or other text.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 12000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(text) as GeneratedArticle;
    if (!parsed.title || !parsed.body || !parsed.metaDescription) {
      throw new Error('Missing required fields in AI response');
    }
    parsed.images = Array.isArray(parsed.images) ? parsed.images.slice(0, imageCount) : [];
    return parsed;
  } catch {
    throw new Error(`Failed to parse AI response: ${raw.slice(0, 200)}`);
  }
}
