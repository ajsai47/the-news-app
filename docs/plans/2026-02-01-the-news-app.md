# The News App - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered news aggregator that pulls from 5 AI newsletter sources, deduplicates content into segments, and provides personalized recommendations for each user.

**Architecture:** Next.js app with Supabase for auth/database, Claude API for AI processing (deduplication, summarization, ranking). System crontab fetches news daily. Users set explicit preferences on signup, system refines with implicit behavior tracking.

**Tech Stack:** Next.js 14, Supabase (Postgres + Auth), Claude API, MagicUI components, node-cron for scheduling, Cheerio/RSS for content fetching

**Sources:**
- The Rundown AI (newsletter)
- The Neuron (newsletter)
- TLDR AI (newsletter)
- AG+ AI Daily News (Substack)
- ChatGPT Central (Substack)

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `.env.local.example`

**Step 1: Create Next.js app with TypeScript**

```bash
cd ~/the-news-app
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Select: Yes to all defaults

**Step 2: Verify project structure**

```bash
ls -la src/app
```

Expected: `layout.tsx`, `page.tsx`, `globals.css`

**Step 3: Create environment template**

Create `.env.local.example`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# App
CRON_SECRET=your_cron_secret
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Supabase client**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2: Install Claude SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 3: Install content fetching libs**

```bash
npm install rss-parser cheerio
```

**Step 4: Install MagicUI dependencies**

```bash
npm install framer-motion clsx tailwind-merge class-variance-authority lucide-react
```

**Step 5: Verify installations**

```bash
npm ls @supabase/supabase-js @anthropic-ai/sdk rss-parser
```

Expected: All packages listed with versions

**Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Supabase, Claude, RSS, and MagicUI dependencies"
```

---

### Task 3: Set Up Supabase Client

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

**Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create server client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}
```

**Step 3: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Step 4: Create root middleware**

Create `src/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 5: Commit**

```bash
git add src/lib/supabase src/middleware.ts
git commit -m "feat: add Supabase client configuration for browser and server"
```

---

### Task 4: Create Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

**Step 2: Write schema migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
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
```

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema for articles, segments, and user preferences"
```

**Step 4: Apply migration in Supabase Dashboard**

Manual step: Copy the SQL and run it in Supabase SQL Editor, or use Supabase CLI if installed.

---

## Phase 2: Authentication

### Task 5: Create Auth Pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`
- Create: `src/app/auth/callback/route.ts`

**Step 1: Create login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">
            Sign in to The News App
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Your personalized AI news feed
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Create signup page**

Create `src/app/signup/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TOPICS = [
  'AI & Machine Learning',
  'Startups & Funding',
  'Product Launches',
  'Research & Papers',
  'Industry News',
  'Tools & Applications',
  'Policy & Regulation',
  'Tutorials & How-tos',
]

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Create user preferences
      const { error: prefError } = await supabase.from('user_preferences').insert({
        id: data.user.id,
        display_name: displayName,
        topics: selectedTopics,
        sources: ['rundown', 'neuron', 'tldr', 'agplus', 'chatgpt_central'],
      })

      if (prefError) {
        setError('Account created but failed to save preferences. Please update in settings.')
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Set up your personalized news feed
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topics you&apos;re interested in
              </label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTopics.includes(topic)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 3: Create auth callback route**

Create `src/app/auth/callback/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

**Step 4: Commit**

```bash
git add src/app/login src/app/signup src/app/auth
git commit -m "feat: add authentication pages with signup topic selection"
```

---

## Phase 3: Content Fetching

### Task 6: Create Source Fetchers

**Files:**
- Create: `src/lib/fetchers/base.ts`
- Create: `src/lib/fetchers/rss.ts`
- Create: `src/lib/fetchers/substack.ts`
- Create: `src/lib/fetchers/index.ts`

**Step 1: Create base fetcher interface**

Create `src/lib/fetchers/base.ts`:
```typescript
export interface RawArticle {
  source: string
  title: string
  content: string
  url: string
  publishedAt: Date | null
}

export interface Fetcher {
  source: string
  fetch(): Promise<RawArticle[]>
}
```

**Step 2: Create RSS fetcher**

Create `src/lib/fetchers/rss.ts`:
```typescript
import Parser from 'rss-parser'
import { Fetcher, RawArticle } from './base'

const parser = new Parser()

export class RSSFetcher implements Fetcher {
  constructor(
    public source: string,
    private feedUrl: string
  ) {}

  async fetch(): Promise<RawArticle[]> {
    try {
      const feed = await parser.parseURL(this.feedUrl)
      return feed.items.map((item) => ({
        source: this.source,
        title: item.title || 'Untitled',
        content: item.contentSnippet || item.content || '',
        url: item.link || '',
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      }))
    } catch (error) {
      console.error(`Failed to fetch RSS from ${this.source}:`, error)
      return []
    }
  }
}
```

**Step 3: Create Substack fetcher**

Create `src/lib/fetchers/substack.ts`:
```typescript
import * as cheerio from 'cheerio'
import { Fetcher, RawArticle } from './base'

export class SubstackFetcher implements Fetcher {
  constructor(
    public source: string,
    private substackUrl: string
  ) {}

  async fetch(): Promise<RawArticle[]> {
    try {
      // Substack provides RSS at /feed
      const feedUrl = `${this.substackUrl}/feed`
      const response = await fetch(feedUrl)
      const xml = await response.text()

      const $ = cheerio.load(xml, { xmlMode: true })
      const articles: RawArticle[] = []

      $('item').each((_, element) => {
        const $item = $(element)
        articles.push({
          source: this.source,
          title: $item.find('title').text() || 'Untitled',
          content: $item.find('description').text() || '',
          url: $item.find('link').text() || '',
          publishedAt: $item.find('pubDate').text()
            ? new Date($item.find('pubDate').text())
            : null,
        })
      })

      return articles
    } catch (error) {
      console.error(`Failed to fetch Substack from ${this.source}:`, error)
      return []
    }
  }
}
```

**Step 4: Create fetcher index with all sources**

Create `src/lib/fetchers/index.ts`:
```typescript
import { RSSFetcher } from './rss'
import { SubstackFetcher } from './substack'
import { Fetcher, RawArticle } from './base'

export const fetchers: Fetcher[] = [
  new RSSFetcher('rundown', 'https://www.therundown.ai/rss'),
  new RSSFetcher('neuron', 'https://www.theneurondaily.com/feed'),
  new RSSFetcher('tldr', 'https://tldr.tech/ai/rss'),
  new SubstackFetcher('agplus', 'https://agplusai.substack.com'),
  new SubstackFetcher('chatgpt_central', 'https://chatgptcentral.substack.com'),
]

export async function fetchAllSources(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    fetchers.map((fetcher) => fetcher.fetch())
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RawArticle[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}

export type { RawArticle, Fetcher }
```

**Step 5: Commit**

```bash
git add src/lib/fetchers
git commit -m "feat: add RSS and Substack fetchers for all news sources"
```

---

### Task 7: Create Fetch API Endpoint

**Files:**
- Create: `src/app/api/cron/fetch/route.ts`

**Step 1: Create the cron fetch endpoint**

Create `src/app/api/cron/fetch/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllSources } from '@/lib/fetchers'

// Use service role for cron operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch from all sources
    const articles = await fetchAllSources()
    console.log(`Fetched ${articles.length} articles from all sources`)

    // Insert into database, skipping duplicates (unique URL constraint)
    const { data, error } = await supabase
      .from('raw_articles')
      .upsert(
        articles.map((a) => ({
          source: a.source,
          title: a.title,
          content: a.content,
          url: a.url,
          published_at: a.publishedAt?.toISOString() || null,
          processed: false,
        })),
        { onConflict: 'url', ignoreDuplicates: true }
      )
      .select()

    if (error) {
      console.error('Database insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      fetched: articles.length,
      inserted: data?.length || 0,
    })
  } catch (error) {
    console.error('Fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/fetch
git commit -m "feat: add cron endpoint for fetching articles from all sources"
```

---

## Phase 4: AI Processing

### Task 8: Create Claude Processing Service

**Files:**
- Create: `src/lib/ai/claude.ts`
- Create: `src/lib/ai/prompts.ts`

**Step 1: Create prompts**

Create `src/lib/ai/prompts.ts`:
```typescript
export const DEDUP_AND_SEGMENT_PROMPT = `You are an AI news analyst. Given a list of articles from different AI newsletters, your job is to:

1. Identify unique news stories/topics across all articles
2. Group articles that cover the same story
3. For each unique story, create a segment with:
   - A clear, concise title
   - A summary (2-3 sentences)
   - The full combined content from all sources
   - Relevant topics (from: AI & Machine Learning, Startups & Funding, Product Launches, Research & Papers, Industry News, Tools & Applications, Policy & Regulation, Tutorials & How-tos)
   - An importance score (0.0-1.0) based on significance, novelty, and impact

Return JSON in this format:
{
  "segments": [
    {
      "title": "string",
      "summary": "string",
      "content": "string",
      "topics": ["string"],
      "importance_score": 0.0-1.0,
      "source_indices": [0, 1, 2]  // indices of input articles that cover this story
    }
  ]
}

Articles to process:
`

export const PERSONALIZATION_PROMPT = `You are a news personalization AI. Given:
1. A user's topic preferences
2. A user's interaction history (what they've clicked, saved, dismissed)
3. A list of news segments

Calculate a personalization score (0.0-1.0) for each segment based on:
- Topic match with user preferences (40%)
- Similarity to content they've engaged with positively (40%)
- Avoiding content similar to what they've dismissed (20%)

Return JSON:
{
  "scores": [
    {"segment_id": "uuid", "score": 0.0-1.0, "reason": "brief explanation"}
  ]
}
`
```

**Step 2: Create Claude service**

Create `src/lib/ai/claude.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { DEDUP_AND_SEGMENT_PROMPT } from './prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface ArticleInput {
  id: string
  source: string
  title: string
  content: string
  url: string
}

interface SegmentOutput {
  title: string
  summary: string
  content: string
  topics: string[]
  importance_score: number
  source_indices: number[]
}

interface DeduplicationResult {
  segments: SegmentOutput[]
}

export async function deduplicateAndSegment(
  articles: ArticleInput[]
): Promise<{ segments: SegmentOutput[]; articleMapping: Map<number, string[]> }> {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i}] Source: ${a.source}\nTitle: ${a.title}\nContent: ${a.content}\nURL: ${a.url}`
    )
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: DEDUP_AND_SEGMENT_PROMPT + articleList,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Extract JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response')
  }

  const result: DeduplicationResult = JSON.parse(jsonMatch[0])

  // Create mapping from article index to segment
  const articleMapping = new Map<number, string[]>()
  result.segments.forEach((segment, segmentIndex) => {
    segment.source_indices.forEach((articleIndex) => {
      if (!articleMapping.has(articleIndex)) {
        articleMapping.set(articleIndex, [])
      }
      articleMapping.get(articleIndex)!.push(String(segmentIndex))
    })
  })

  return { segments: result.segments, articleMapping }
}

export async function calculatePersonalizationScores(
  userTopics: string[],
  interactions: { segment_id: string; type: string }[],
  segments: { id: string; topics: string[]; summary: string }[]
): Promise<Map<string, number>> {
  // Simple scoring without AI call for cost efficiency
  // Can be upgraded to use Claude for more sophisticated matching
  const scores = new Map<string, number>()

  const positiveSegments = new Set(
    interactions.filter((i) => ['click', 'save'].includes(i.type)).map((i) => i.segment_id)
  )
  const negativeSegments = new Set(
    interactions.filter((i) => i.type === 'dismiss').map((i) => i.segment_id)
  )

  for (const segment of segments) {
    let score = 0.5 // Base score

    // Topic match (40%)
    const topicMatch = segment.topics.filter((t) => userTopics.includes(t)).length
    score += (topicMatch / Math.max(segment.topics.length, 1)) * 0.4

    // Positive engagement boost
    if (positiveSegments.has(segment.id)) {
      score += 0.2
    }

    // Negative engagement penalty
    if (negativeSegments.has(segment.id)) {
      score -= 0.3
    }

    scores.set(segment.id, Math.max(0, Math.min(1, score)))
  }

  return scores
}
```

**Step 3: Commit**

```bash
git add src/lib/ai
git commit -m "feat: add Claude service for article deduplication and segmentation"
```

---

### Task 9: Create Process API Endpoint

**Files:**
- Create: `src/app/api/cron/process/route.ts`

**Step 1: Create the processing endpoint**

Create `src/app/api/cron/process/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deduplicateAndSegment } from '@/lib/ai/claude'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get unprocessed articles from last 24 hours
    const { data: articles, error: fetchError } = await supabase
      .from('raw_articles')
      .select('*')
      .eq('processed', false)
      .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({ success: true, message: 'No articles to process' })
    }

    // Process with Claude
    const { segments, articleMapping } = await deduplicateAndSegment(
      articles.map((a) => ({
        id: a.id,
        source: a.source,
        title: a.title,
        content: a.content,
        url: a.url,
      }))
    )

    // Insert segments
    const { data: insertedSegments, error: segmentError } = await supabase
      .from('segments')
      .insert(
        segments.map((s) => ({
          title: s.title,
          summary: s.summary,
          content: s.content,
          topics: s.topics,
          importance_score: s.importance_score,
          source_urls: s.source_indices.map((i) => articles[i].url),
          source_names: s.source_indices.map((i) => articles[i].source),
        }))
      )
      .select()

    if (segmentError) {
      return NextResponse.json({ error: segmentError.message }, { status: 500 })
    }

    // Link articles to segments
    const articleSegmentLinks: { article_id: string; segment_id: string }[] = []
    articleMapping.forEach((segmentIndices, articleIndex) => {
      segmentIndices.forEach((segmentIndexStr) => {
        const segmentIndex = parseInt(segmentIndexStr)
        if (insertedSegments && insertedSegments[segmentIndex]) {
          articleSegmentLinks.push({
            article_id: articles[articleIndex].id,
            segment_id: insertedSegments[segmentIndex].id,
          })
        }
      })
    })

    if (articleSegmentLinks.length > 0) {
      await supabase.from('article_segments').insert(articleSegmentLinks)
    }

    // Mark articles as processed
    await supabase
      .from('raw_articles')
      .update({ processed: true })
      .in(
        'id',
        articles.map((a) => a.id)
      )

    // Calculate personalized scores for all users
    const { data: users } = await supabase.from('user_preferences').select('id, topics')

    if (users && insertedSegments) {
      for (const user of users) {
        const scores = insertedSegments.map((segment) => {
          const topicMatch = segment.topics.filter((t: string) =>
            user.topics.includes(t)
          ).length
          const baseScore = segment.importance_score * 0.6
          const topicScore = (topicMatch / Math.max(segment.topics.length, 1)) * 0.4
          return {
            user_id: user.id,
            segment_id: segment.id,
            score: Math.min(1, baseScore + topicScore),
          }
        })

        await supabase.from('user_segment_scores').upsert(scores)
      }
    }

    return NextResponse.json({
      success: true,
      processed: articles.length,
      segments: insertedSegments?.length || 0,
    })
  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json({ error: 'Failed to process articles' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/process
git commit -m "feat: add cron endpoint for AI processing and segmentation"
```

---

## Phase 5: Feed UI

### Task 10: Create MagicUI Components

**Files:**
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/skeleton.tsx`

**Step 1: Create Card component**

Create `src/components/ui/card.tsx`:
```tsx
import { cn } from '@/lib/utils'
import { HTMLAttributes, forwardRef } from 'react'

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border bg-white shadow-sm transition-all hover:shadow-md',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

**Step 2: Create Badge component**

Create `src/components/ui/badge.tsx`:
```tsx
import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        {
          'bg-blue-100 text-blue-800': variant === 'default',
          'bg-gray-100 text-gray-800': variant === 'secondary',
          'border border-gray-200 text-gray-600': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
```

**Step 3: Create Skeleton component**

Create `src/components/ui/skeleton.tsx`:
```tsx
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  )
}
```

**Step 4: Create utils file**

Create `src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 5: Commit**

```bash
git add src/components/ui src/lib/utils.ts
git commit -m "feat: add MagicUI Card, Badge, and Skeleton components"
```

---

### Task 11: Create News Feed Components

**Files:**
- Create: `src/components/feed/segment-card.tsx`
- Create: `src/components/feed/feed-list.tsx`

**Step 1: Create SegmentCard component**

Create `src/components/feed/segment-card.tsx`:
```tsx
'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Bookmark, ExternalLink, X } from 'lucide-react'

interface Segment {
  id: string
  title: string
  summary: string
  topics: string[]
  importance_score: number
  source_names: string[]
  source_urls: string[]
  created_at: string
}

interface SegmentCardProps {
  segment: Segment
  userId: string
  onDismiss?: () => void
}

export function SegmentCard({ segment, userId, onDismiss }: SegmentCardProps) {
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function trackInteraction(type: 'view' | 'click' | 'save' | 'dismiss') {
    await supabase.from('user_interactions').insert({
      user_id: userId,
      segment_id: segment.id,
      interaction_type: type,
    })
  }

  async function handleSave() {
    setSaved(!saved)
    await trackInteraction('save')
  }

  async function handleDismiss() {
    await trackInteraction('dismiss')
    onDismiss?.()
  }

  async function handleClick(url: string) {
    await trackInteraction('click')
    window.open(url, '_blank')
  }

  const importanceColor =
    segment.importance_score > 0.7
      ? 'bg-red-100 text-red-800'
      : segment.importance_score > 0.4
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-green-100 text-green-800'

  return (
    <Card className="group relative">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-100"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="pr-8">{segment.title}</CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${importanceColor}`}>
            {Math.round(segment.importance_score * 100)}%
          </span>
        </div>
        <CardDescription>{segment.summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {segment.topics.map((topic) => (
            <Badge key={topic} variant="secondary">
              {topic}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {segment.source_urls.map((url, i) => (
              <button
                key={url}
                onClick={() => handleClick(url)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {segment.source_names[i]}
                <ExternalLink className="w-3 h-3" />
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            className={`p-2 rounded-full transition-colors ${
              saved ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'
            }`}
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            <Bookmark className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create FeedList component**

Create `src/components/feed/feed-list.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SegmentCard } from './segment-card'
import { Skeleton } from '@/components/ui/skeleton'

interface Segment {
  id: string
  title: string
  summary: string
  topics: string[]
  importance_score: number
  source_names: string[]
  source_urls: string[]
  created_at: string
  score?: number
}

interface FeedListProps {
  userId: string
}

export function FeedList({ userId }: FeedListProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    async function loadFeed() {
      // Get personalized scores
      const { data: scores } = await supabase
        .from('user_segment_scores')
        .select('segment_id, score')
        .eq('user_id', userId)

      const scoreMap = new Map(scores?.map((s) => [s.segment_id, s.score]) || [])

      // Get recent segments
      const { data: segmentData } = await supabase
        .from('segments')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (segmentData) {
        // Combine with scores and sort
        const withScores = segmentData.map((s) => ({
          ...s,
          score: scoreMap.get(s.id) ?? s.importance_score,
        }))

        // Sort by combined score (personalization + importance)
        withScores.sort((a, b) => {
          const aScore = (a.score || 0.5) * 0.6 + a.importance_score * 0.4
          const bScore = (b.score || 0.5) * 0.6 + b.importance_score * 0.4
          return bScore - aScore
        })

        setSegments(withScores)
      }
      setLoading(false)
    }

    loadFeed()
  }, [userId, supabase])

  function handleDismiss(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]))
  }

  const visibleSegments = segments.filter((s) => !dismissedIds.has(s.id))

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (visibleSegments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No news yet. Check back later!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleSegments.map((segment) => (
        <SegmentCard
          key={segment.id}
          segment={segment}
          userId={userId}
          onDismiss={() => handleDismiss(segment.id)}
        />
      ))}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/feed
git commit -m "feat: add SegmentCard and FeedList components with interaction tracking"
```

---

### Task 12: Create Main Feed Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/layout-client.tsx`

**Step 1: Create client layout for header**

Create `src/app/layout-client.tsx`:
```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LayoutClientProps {
  children: React.ReactNode
  user: { email?: string } | null
}

export function LayoutClient({ children, user }: LayoutClientProps) {
  const supabase = createClient()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            The News App
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link
                href="/settings"
                className="text-sm text-blue-600 hover:underline"
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

**Step 2: Update main page**

Replace `src/app/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { FeedList } from '@/components/feed/feed-list'
import { LayoutClient } from './layout-client'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <LayoutClient user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <p className="text-gray-600">
            Personalized AI news from across the web
          </p>
        </div>
        <FeedList userId={user.id} />
      </div>
    </LayoutClient>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/app/layout-client.tsx
git commit -m "feat: add main feed page with personalized news display"
```

---

### Task 13: Create Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

**Step 1: Create settings page**

Create `src/app/settings/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LayoutClient } from '../layout-client'

const TOPICS = [
  'AI & Machine Learning',
  'Startups & Funding',
  'Product Launches',
  'Research & Papers',
  'Industry News',
  'Tools & Applications',
  'Policy & Regulation',
  'Tutorials & How-tos',
]

const SOURCES = [
  { id: 'rundown', name: 'The Rundown AI' },
  { id: 'neuron', name: 'The Neuron' },
  { id: 'tldr', name: 'TLDR AI' },
  { id: 'agplus', name: 'AG+ AI Daily News' },
  { id: 'chatgpt_central', name: 'ChatGPT Central' },
]

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadPreferences() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('id', user.id)
        .single()

      if (prefs) {
        setDisplayName(prefs.display_name || '')
        setSelectedTopics(prefs.topics || [])
        setSelectedSources(prefs.sources || [])
      }
      setLoading(false)
    }

    loadPreferences()
  }, [supabase, router])

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  function toggleSource(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)

    await supabase
      .from('user_preferences')
      .update({
        display_name: displayName,
        topics: selectedTopics,
        sources: selectedSources,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    setSaving(false)
    router.push('/')
  }

  if (loading) {
    return (
      <LayoutClient user={user}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </LayoutClient>
    )
  }

  return (
    <LayoutClient user={user}>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        <div className="bg-white rounded-xl border p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topics you&apos;re interested in
            </label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTopics.includes(topic)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              News Sources
            </label>
            <div className="space-y-2">
              {SOURCES.map((source) => (
                <label key={source.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{source.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </LayoutClient>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/settings
git commit -m "feat: add settings page for user preferences"
```

---

## Phase 6: Cron Setup

### Task 14: Create Cron Script

**Files:**
- Create: `scripts/cron.sh`

**Step 1: Create the cron script**

Create `scripts/cron.sh`:
```bash
#!/bin/bash

# The News App - Daily Fetch and Process Cron Script
# Add to crontab: 0 6 * * * /path/to/the-news-app/scripts/cron.sh

set -e

# Load environment variables
if [ -f ~/.env.news-app ]; then
  export $(cat ~/.env.news-app | xargs)
fi

BASE_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date)] Starting daily news fetch..."

# Fetch articles from all sources
curl -X POST "${BASE_URL}/api/cron/fetch" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo "[$(date)] Fetch complete. Starting processing..."

# Process and deduplicate articles
curl -X POST "${BASE_URL}/api/cron/process" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo "[$(date)] Daily news update complete."
```

**Step 2: Make script executable**

```bash
chmod +x scripts/cron.sh
```

**Step 3: Create environment template**

Create `scripts/env.template`:
```bash
# Copy to ~/.env.news-app and fill in values
APP_URL=http://localhost:3000
CRON_SECRET=your_cron_secret_here
```

**Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add cron script for daily news fetching and processing"
```

---

### Task 15: Update README with Setup Instructions

**Files:**
- Create: `README.md`

**Step 1: Create README**

Create `README.md`:
```markdown
# The News App

An AI-powered news aggregator that provides personalized AI news recommendations from multiple sources.

## Sources

- The Rundown AI
- The Neuron
- TLDR AI
- AG+ AI Daily News (Substack)
- ChatGPT Central (Substack)

## Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, MagicUI components
- **Backend:** Next.js API routes
- **Database:** Supabase (PostgreSQL)
- **AI:** Claude API (Anthropic)
- **Auth:** Supabase Auth

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the SQL Editor
3. Copy your project URL and keys

### 3. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_claude_api_key
CRON_SECRET=generate_a_random_string
```

### 4. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Set up cron job

For daily news updates, add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 6 AM daily)
0 6 * * * /path/to/the-news-app/scripts/cron.sh
```

Create `~/.env.news-app` with:

```bash
APP_URL=http://localhost:3000
CRON_SECRET=your_cron_secret
```

### Manual Fetch (Testing)

```bash
# Fetch articles
curl -X POST http://localhost:3000/api/cron/fetch \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Process articles
curl -X POST http://localhost:3000/api/cron/process \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Features

- **Personalized Feed:** Articles ranked by your topic preferences and reading behavior
- **AI Deduplication:** Same stories from multiple sources combined into single segments
- **Importance Scoring:** AI rates story significance
- **Implicit Learning:** System learns from your clicks, saves, and dismisses
- **Multiple Sources:** Aggregates from 5 top AI newsletters

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with setup instructions"
```

---

## Phase 7: Final Polish

### Task 16: Add Type Definitions

**Files:**
- Create: `src/types/database.ts`

**Step 1: Create database types**

Create `src/types/database.ts`:
```typescript
export interface UserPreferences {
  id: string
  display_name: string | null
  topics: string[]
  sources: string[]
  reading_time_preference: 'short' | 'medium' | 'long'
  created_at: string
  updated_at: string
}

export interface RawArticle {
  id: string
  source: string
  title: string
  content: string
  url: string
  published_at: string | null
  fetched_at: string
  processed: boolean
}

export interface Segment {
  id: string
  title: string
  summary: string
  content: string
  topics: string[]
  importance_score: number
  source_urls: string[]
  source_names: string[]
  created_at: string
}

export interface UserInteraction {
  id: string
  user_id: string
  segment_id: string
  interaction_type: 'view' | 'click' | 'save' | 'share' | 'dismiss'
  duration_seconds: number | null
  created_at: string
}

export interface UserSegmentScore {
  user_id: string
  segment_id: string
  score: number
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      user_preferences: {
        Row: UserPreferences
        Insert: Omit<UserPreferences, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserPreferences, 'id'>>
      }
      raw_articles: {
        Row: RawArticle
        Insert: Omit<RawArticle, 'id' | 'fetched_at'>
        Update: Partial<Omit<RawArticle, 'id'>>
      }
      segments: {
        Row: Segment
        Insert: Omit<Segment, 'id' | 'created_at'>
        Update: Partial<Omit<Segment, 'id'>>
      }
      user_interactions: {
        Row: UserInteraction
        Insert: Omit<UserInteraction, 'id' | 'created_at'>
        Update: never
      }
      user_segment_scores: {
        Row: UserSegmentScore
        Insert: Omit<UserSegmentScore, 'updated_at'>
        Update: Partial<Omit<UserSegmentScore, 'user_id' | 'segment_id'>>
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/types
git commit -m "feat: add TypeScript database type definitions"
```

---

### Task 17: Create GitHub Repository

**Step 1: Create .gitignore**

Verify `.gitignore` includes:
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

**Step 2: Create repository on GitHub**

```bash
gh repo create the-news-app --public --description "AI-powered personalized news aggregator" --source=. --remote=origin
```

**Step 3: Push initial commit**

```bash
git push -u origin main
```

**Step 4: Verify repository**

```bash
gh repo view --web
```

---

## Summary

This plan creates a complete AI news aggregator with:

1. **Next.js app** with TypeScript and Tailwind
2. **Supabase** for auth and database
3. **5 news sources** (RSS + Substack fetchers)
4. **Claude API** for intelligent deduplication and segmentation
5. **Personalized feed** with explicit preferences + implicit learning
6. **MagicUI components** for clean design
7. **System crontab** for daily updates
8. **Interaction tracking** for continuous personalization

Total: 17 tasks across 7 phases
