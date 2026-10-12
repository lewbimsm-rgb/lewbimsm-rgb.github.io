import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	 route('blog', 'routes/blog.tsx'),
	 route('blog/:slug', 'routes/blog-article.tsx'),
	 route('learn', 'routes/learn.tsx'),
	 route('gear', 'routes/gear.tsx'),
	 route('contact', 'routes/contact.tsx'),
	 route('admin', 'routes/admin.tsx'),
	 route('llms.txt', 'routes/llms.txt.ts'),
	 // ads.txt (Google AdSense ownership file) is served by the llms.txt module, which
	 // branches on the request path; the explicit id keeps the two routes distinct.
	 route('ads.txt', 'routes/llms.txt.ts', { id: 'ads-txt' }),
	 route(':page', 'routes/info.tsx'),
	route('sitemap.xml', 'routes/sitemap.xml.ts'),
	route('robots.txt', 'routes/robots.txt.ts'),
	route('api/health', 'routes/api.health.ts'),
	route('api/*', 'routes/api.$.ts'),
] satisfies RouteConfig;
