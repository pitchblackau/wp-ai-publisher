import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GenerateArticleParams {
  topic: string;
  tone: string;
  wordCountTarget: number;
}

export interface GeneratedArticle {
  title: string;
  body: string;
  metaDescription: string;
  tags: string[];
  category: string;
}

export async function generateArticle(params: GenerateArticleParams): Promise<GeneratedArticle> {
  const { topic, tone, wordCountTarget } = params;

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
  "category": "Single most relevant category name"
}

Requirements:
- The body should be approximately ${wordCountTarget} words
- Use proper HTML formatting with headings, paragraphs, and lists
- The meta description must be under 160 characters
- Provide 3-6 relevant tags
- Suggest one specific category

Return only the JSON object, no markdown code blocks or other text.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const parsed = JSON.parse(text.trim()) as GeneratedArticle;
    if (!parsed.title || !parsed.body || !parsed.metaDescription) {
      throw new Error('Missing required fields in AI response');
    }
    return parsed;
  } catch {
    throw new Error(`Failed to parse AI response: ${text.slice(0, 200)}`);
  }
}
