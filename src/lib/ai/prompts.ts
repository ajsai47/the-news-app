export const DEDUP_AND_SEGMENT_PROMPT = `You are an AI news analyst. Given a list of articles from different AI newsletters, your job is to:

1. Identify unique news stories/topics across all articles
2. Group articles that cover the same story
3. For each unique story, create a segment with:
   - A clear, concise title
   - A summary (2-3 sentences)
   - The full combined content from all sources
   - Relevant topics (from: AI & Machine Learning, Startups & Funding, Product Launches, Research & Papers, Industry News, Tools & Applications, Policy & Regulation, Tutorials & How-tos)
   - An importance score (0.0-1.0) based on significance, novelty, and impact

Return JSON in this format:
{
  "segments": [
    {
      "title": "string",
      "summary": "string",
      "content": "string",
      "topics": ["string"],
      "importance_score": 0.0-1.0,
      "source_indices": [0, 1, 2]  // indices of input articles that cover this story
    }
  ]
}

Articles to process:
`

export const PERSONALIZATION_PROMPT = `You are a news personalization AI. Given:
1. A user's topic preferences
2. A user's interaction history (what they've clicked, saved, dismissed)
3. A list of news segments

Calculate a personalization score (0.0-1.0) for each segment based on:
- Topic match with user preferences (40%)
- Similarity to content they've engaged with positively (40%)
- Avoiding content similar to what they've dismissed (20%)

Return JSON:
{
  "scores": [
    {"segment_id": "uuid", "score": 0.0-1.0, "reason": "brief explanation"}
  ]
}
`
