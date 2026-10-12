import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { articles } from '@/data/articles';
import { ArticleCard } from '@/components/article-card';
export function LatestStories(){return <section className="stories-section"><div className="section-heading"><div><span className="eyebrow">FRESH FROM THE LAB</span><h2>A good read. A better game.</h2></div><Link className="text-link" to="/blog">Explore all 15 stories <ArrowUpRight size={18}/></Link></div><div className="articles-grid">{[articles[0],articles[9],articles[13]].map(article=><ArticleCard key={article.slug} article={article}/>)}</div></section>;}
