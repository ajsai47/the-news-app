import { RSSFetcher } from './rss'
import { SubstackFetcher } from './substack'
import { Fetcher, RawArticle } from './base'

export const fetchers: Fetcher[] = [
  new RSSFetcher('rundown', 'https://www.therundown.ai/rss'),
  new RSSFetcher('neuron', 'https://www.theneurondaily.com/feed'),
  new RSSFetcher('tldr', 'https://tldr.tech/ai/rss'),
  new SubstackFetcher('agplus', 'https://agplusai.substack.com'),
  new SubstackFetcher('chatgpt_central', 'https://chatgptcentral.substack.com'),
]

export async function fetchAllSources(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    fetchers.map((fetcher) => fetcher.fetch())
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RawArticle[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}

export type { RawArticle, Fetcher }
