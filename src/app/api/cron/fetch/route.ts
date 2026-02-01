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
