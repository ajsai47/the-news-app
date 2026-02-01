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
