-- Users preferences (extends Supabase auth.users)
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  topics TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}',
  reading_time_preference TEXT DEFAULT 'medium', -- 'short', 'medium', 'long'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw articles fetched from sources
CREATE TABLE public.raw_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'rundown', 'neuron', 'tldr', 'agplus', 'chatgpt_central'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Deduplicated segments (after AI processing)
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  importance_score FLOAT DEFAULT 0.5,
  source_urls TEXT[] DEFAULT '{}',
  source_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link raw articles to segments (many-to-many)
CREATE TABLE public.article_segments (
  article_id UUID REFERENCES public.raw_articles(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, segment_id)
);

-- User interactions for implicit learning
CREATE TABLE public.user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- 'view', 'click', 'save', 'share', 'dismiss'
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personalized scores per user per segment
CREATE TABLE public.user_segment_scores (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  score FLOAT DEFAULT 0.5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, segment_id)
);

-- Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segment_scores ENABLE ROW LEVEL SECURITY;

-- Policies: user_preferences - users can only see/edit their own
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies: articles and segments - all authenticated users can read
CREATE POLICY "Authenticated users can view articles" ON public.raw_articles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view segments" ON public.segments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view article_segments" ON public.article_segments
  FOR SELECT TO authenticated USING (true);

-- Policies: user_interactions - users can only see/create their own
CREATE POLICY "Users can view own interactions" ON public.user_interactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own interactions" ON public.user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies: user_segment_scores - users can only see their own
CREATE POLICY "Users can view own scores" ON public.user_segment_scores
  FOR SELECT USING (auth.uid() = user_id);

-- Service role policies for cron jobs (insert/update articles, segments, scores)
CREATE POLICY "Service can insert articles" ON public.raw_articles
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update articles" ON public.raw_articles
  FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service can insert segments" ON public.segments
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can insert article_segments" ON public.article_segments
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can upsert user_segment_scores" ON public.user_segment_scores
  FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX idx_raw_articles_source ON public.raw_articles(source);
CREATE INDEX idx_raw_articles_processed ON public.raw_articles(processed);
CREATE INDEX idx_segments_topics ON public.segments USING GIN(topics);
CREATE INDEX idx_segments_importance ON public.segments(importance_score DESC);
CREATE INDEX idx_user_interactions_user ON public.user_interactions(user_id);
CREATE INDEX idx_user_segment_scores_user ON public.user_segment_scores(user_id);
CREATE INDEX idx_user_segment_scores_score ON public.user_segment_scores(score DESC);
