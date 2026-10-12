import type { Route } from './+types/contact';
import { seo } from '@/lib/seo';
import { ContactForm } from '@/components/contact/contact-form';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Contact SmartSelectLabs — Questions & story ideas',description:'Send the SmartSelectLabs editorial team a question, correction, partnership inquiry, or idea for a future pickleball, gear, or lifestyle story.'});}
export default function Contact(){return <main><div className="page-intro"><span className="eyebrow">OPEN TO GOOD CONVERSATIONS</span><h1>Let’s talk court.</h1><p>A story idea? A rule that needs another look? A partnership inquiry? Send us a note. Your message goes directly into our editorial inbox.</p></div><ContactForm/></main>;}
