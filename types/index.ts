export interface Site {
  id: string;
  name: string;
  url: string;
  login_url: string | null;
  plugin_key_encrypted: string | null;
  wp_username: string | null;
  wp_password_encrypted: string | null;
  status: 'active' | 'error' | 'unchecked';
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImagePlanItem {
  n: number;
  prompt: string;
  alt: string;
  url: string | null;
}

export interface Article {
  id: string;
  image_plan: ImagePlanItem[];
  site_ids: string[];
  title: string;
  body: string;
  meta_description: string;
  tags: string[];
  category: string;
  status: 'draft' | 'scheduled' | 'published' | 'discarded';
  scheduled_at: string | null;
  published_at: string | null;
  removal_error: string | null;
  topic: string;
  tone: string;
  word_count_target: number;
  created_at: string;
  updated_at: string;
}

export interface PublishJob {
  id: string;
  article_id: string;
  site_id: string;
  status: 'pending' | 'success' | 'failed';
  wp_post_id: number | null;
  wp_post_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GenerateArticleInput {
  topic: string;
  site_ids: string[];
  tone: string;
  word_count_target: number;
  image_count: number;
  image_style: string;
  crosslink_site_id: string | null;
  crosslink_max: number;
}
