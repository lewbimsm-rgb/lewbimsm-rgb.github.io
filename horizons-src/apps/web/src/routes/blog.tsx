import type { Route } from './+types/blog';
import { seo } from '@/lib/seo';
import { getPublishedArticles } from '@/lib/editorial.server';
import { StoryLibrary } from '@/components/blog/story-library';
import { courtImage } from '@/data/articles';
export async function loader(){return {posts:await getPublishedArticles()};}
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'The journal — Pickleball, gear & lifestyle guides',description:'Explore original SmartSelectLabs articles on pickleball skills, paddle comparisons, court clothing, and Korean skincare for outdoor play.',image:courtImage,jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:'The SmartSelectLabs Journal'}});}
export default function Blog({loaderData}:Route.ComponentProps){return <main><div className="page-intro"><span className="eyebrow">THE SMARTSELECT JOURNAL</span><h1>Curious minds.<br/>Better games.</h1><p>Your reading list for life on and off the court. Practical lessons, thoughtful comparisons, and fresh perspectives—all in one place.</p></div><StoryLibrary posts={loaderData.posts}/></main>;}
