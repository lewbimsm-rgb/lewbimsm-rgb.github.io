import type { Route } from './+types/admin';
import { seo } from '@/lib/seo';
import { EditorDashboard } from '@/components/admin/editor-dashboard';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Editorial dashboard — SmartSelectLabs',description:'Private SmartSelectLabs publishing tools for managing original articles, drafts, and disclosed affiliate recommendations.',noindex:true});}
export default function Admin(){return <main><div className="page-intro"><span className="eyebrow">BEHIND THE STORIES</span><h1>The editorial lab.</h1><p>Publish original stories, refine the launch guides, and manage your retailer recommendations.</p></div><EditorDashboard/></main>;}
