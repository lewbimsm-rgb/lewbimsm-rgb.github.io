import type { Route } from './+types/gear';
import { seo } from '@/lib/seo';
import { getPublishedArticles, getRecommendations } from '@/lib/editorial.server';
import { ComparisonGuide } from '@/components/gear/comparison-guide';
import { gearImage } from '@/data/articles';
export async function loader(){const [posts,links]=await Promise.all([getPublishedArticles(),getRecommendations()]);return {posts,links};}
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Smart pickleball picks — Gear, clothing & K-skincare',description:'Compare paddle styles, court shoes, clothing, and outdoor skincare with independent buying guidance and clearly disclosed retailer recommendations.',image:gearImage});}
export default function Gear({loaderData}:Route.ComponentProps){return <main><div className="page-intro"><span className="eyebrow">THE SMART PICKS EDIT</span><h1>Good gear.<br/>No guesswork.</h1><p>Understand the trade-offs before you buy. Practical comparisons for your paddle, your court wardrobe, and your post-game routine—without the hype.</p></div><ComparisonGuide posts={loaderData.posts} links={loaderData.links}/></main>;}
