import { articles, type Article } from '@/data/articles';
export type Recommendation = { id: string; title: string; category: string; url: string; affiliate: boolean };
export async function getPublishedArticles(): Promise<Article[]> {
  try {
    const response = await fetch(`${process.env.POCKETBASE_URL || 'http://localhost:8090'}/api/collections/lab_posts/records?perPage=500&filter=live%3Dtrue`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return articles;
    const result = await response.json() as { items: Article[] };
    const custom = result.items.filter(p => p.slug && Array.isArray(p.sections));
    return [...custom, ...articles.filter(p => !custom.some(c => c.slug === p.slug))];
  } catch { return articles; }
}
export async function getRecommendations(): Promise<Recommendation[]> {
  try {
    const response = await fetch(`${process.env.POCKETBASE_URL || 'http://localhost:8090'}/api/collections/lab_links/records?perPage=100`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const result = await response.json() as { items: Recommendation[] };
    return result.items;
  } catch { return []; }
}
