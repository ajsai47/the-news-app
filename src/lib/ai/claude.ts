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
