import Parser from 'rss-parser'
import { Fetcher, RawArticle } from './base'

const parser = new Parser()

export class RSSFetcher implements Fetcher {
  constructor(
    public source: string,
    private feedUrl: string
  ) {}

  async fetch(): Promise<RawArticle[]> {
    try {
      const feed = await parser.parseURL(this.feedUrl)
      return feed.items.map((item) => ({
        source: this.source,
        title: item.title || 'Untitled',
        content: item.contentSnippet || item.content || '',
        url: item.link || '',
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      }))
    } catch (error) {
      console.error(`Failed to fetch RSS from ${this.source}:`, error)
      return []
    }
  }
}
