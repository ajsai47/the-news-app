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
