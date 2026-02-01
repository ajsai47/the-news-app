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
