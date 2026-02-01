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
