import type { Route } from './+types/info';
import { seo } from '@/lib/seo';
import { sitePages } from '@/data/site-pages';
import { InformationPage } from '@/components/info/information-page';
export function loader({params}:Route.LoaderArgs){const page=sitePages[params.page||''];if(!page)throw new Response('Page not found',{status:404});return {page};}
export function meta({matches,location,loaderData}:Route.MetaArgs){return seo({matches,location},{title:loaderData?`${loaderData.page.kicker.split(' · ')[0]} — SmartSelectLabs`:'Page not found',description:loaderData?.page.description||'This page is unavailable. Explore SmartSelectLabs for pickleball lessons and guides.',noindex:!loaderData});}
export default function Info({loaderData}:Route.ComponentProps){return <InformationPage page={loaderData.page}/>;}
