import type { Route } from './+types/learn';
import { seo } from '@/lib/seo';
import { getPublishedArticles } from '@/lib/editorial.server';
import { LessonLibrary } from '@/components/learn/lesson-library';
import { courtImage } from '@/data/articles';
export async function loader(){return {posts:await getPublishedArticles()};}
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Pickleball lessons — Beginner to competitive play',description:'Choose your pickleball level and build a focused practice session with free beginner lessons, intermediate drills, and advanced tactical guides.',image:courtImage});}
export default function Learn({loaderData}:Route.ComponentProps){return <main><div className="page-intro"><span className="eyebrow">THE COURT IS YOUR CLASSROOM</span><h1>Less overthinking.<br/>More good rallies.</h1><p>Start where you are. Our free lesson paths pair practical reading with focused drills, from first-time players to competitors sharpening their edge.</p></div><LessonLibrary posts={loaderData.posts}/></main>;}
