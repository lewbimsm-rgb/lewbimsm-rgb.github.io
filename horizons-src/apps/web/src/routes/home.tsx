import type { Route } from './+types/home';
import { seo, absoluteUrl, siteOriginFrom } from '@/lib/seo';
import { Hero } from '@/components/home/hero';
import { LevelPaths } from '@/components/home/level-paths';
import { LatestStories } from '@/components/home/latest-stories';
import { GearFeature } from '@/components/home/gear-feature';
import { courtImage } from '@/data/articles';
export function meta({matches,location}:Route.MetaArgs){const origin=siteOriginFrom(matches);return seo({matches,location},{title:'SmartSelectLabs — Your next level of pickleball',description:'Build your pickleball game with beginner-to-advanced lessons, independent gear comparisons, court style, and thoughtful K-skincare guides.',image:courtImage,jsonLd:[{'@context':'https://schema.org','@type':'WebSite',name:'SmartSelectLabs',url:absoluteUrl(origin,'/')},{'@context':'https://schema.org','@type':'Organization',name:'SmartSelectLabs',url:absoluteUrl(origin,'/'),description:'Independent pickleball education and gear guidance.'}]});}
export default function HomePage(){return <main><Hero/><LevelPaths/><LatestStories/><GearFeature/></main>;}
