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
