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
