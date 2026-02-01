import * as cheerio from 'cheerio'
import { Fetcher, RawArticle } from './base'

export class SubstackFetcher implements Fetcher {
  constructor(
    public source: string,
    private substackUrl: string
  ) {}

  async fetch(): Promise<RawArticle[]> {
    try {
      // Substack provides RSS at /feed
      const feedUrl = `${this.substackUrl}/feed`
      const response = await fetch(feedUrl)
      const xml = await response.text()

      const $ = cheerio.load(xml, { xmlMode: true })
      const articles: RawArticle[] = []

      $('item').each((_, element) => {
        const $item = $(element)
        articles.push({
          source: this.source,
          title: $item.find('title').text() || 'Untitled',
          content: $item.find('description').text() || '',
          url: $item.find('link').text() || '',
          publishedAt: $item.find('pubDate').text()
            ? new Date($item.find('pubDate').text())
            : null,
        })
      })

      return articles
    } catch (error) {
      console.error(`Failed to fetch Substack from ${this.source}:`, error)
      return []
    }
  }
}
