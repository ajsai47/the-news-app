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
