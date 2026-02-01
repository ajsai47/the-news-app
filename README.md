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
