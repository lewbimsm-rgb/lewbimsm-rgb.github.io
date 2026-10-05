# SmartSelect Labs — the site, in plain English

_Mom's side of the workflow (Google Docs folder → we publish) is in `..\MOM_PUBLISHING_GUIDE.md`; the post plan is in `..\GROWTH_PLAN.md`; the money blocks (review/affiliate boxes) are documented in `COMPONENTS.md`._

The website is a folder of text files that a small Python program turns into web pages. No WordPress, no Hostinger builder, nothing to log into. Everything lives in `Life & Planning\SmartSelect Labs (Mom)\`.

## The three things you'll actually do

**1. Add or edit a post** — open `content\posts\`, copy an existing `.md` file, change the top block (title, description, date, category, image) and write below it. Headings start with `##`, lists with `-`, bold is `**like this**`. A tip box is a line starting with `> **SmartSelect Tip:**`.

**2. Publish** — in a terminal, inside the `site` folder:

```
python publish.py
```

That rebuilds every page and pushes them live. About a minute later the change is on the site. To look before publishing: `python publish.py --preview`.

**3. Add a photo** — drop it in `content\images\photos\`, then reference it in a post as `/images/photos/filename.jpg`. Use your own photos or free-to-use ones (Pexels, Unsplash). Never Amazon screenshots.

## Changing the logo (Mom wants a new one later)

Replace `content\images\logo-wordmark.png` with the new logo (a wide PNG with a transparent background, roughly 1200 × 220 pixels, works best). Then run `python tools\make_images.py` to regenerate the favicon and share image, and `python site\publish.py`. That's it; the header, footer and share image all use that one file.

## Affiliate product boxes

Inside any post, one line like this becomes a product card with buttons:

```
::product Selkirk LUXX Control Air | /images/products/luxx.jpg | Best for: players who want control and a soft feel | amazon=https://amzn.to/xxxx | selkirk=https://selkirk.com/...
```

Links get `rel="sponsored"` automatically (what Google wants). The site-wide Amazon tag goes in `site\config.json` once Mom has it.

## Where settings live

`site\config.json`: site name, tagline, email, categories and their blurbs, the menu, the AdSense publisher ID (already in), Google Analytics ID (empty until connected), contact-form endpoint (empty = shows the email address), the featured post and hero image.

## Hosting and the domain

- The generated site (`site\docs\`) is its own tiny git repo pushed to **github.com/lewbimsm-rgb/lewbimsm-rgb.github.io**, served free by GitHub Pages at **https://lewbimsm-rgb.github.io/**.
- To put **smartselectlabs.com** on it: in Hostinger → Domains → DNS Zone Editor, delete the existing A records for `@` and add four A records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, plus a CNAME `www` → `lewbimsm-rgb.github.io`. Then publish once with the custom-domain file: `set SSL_CUSTOM_DOMAIN_LIVE=1` before `python publish.py`, and in the GitHub repo → Settings → Pages, enter the domain and tick "Enforce HTTPS". The old WordPress goes dark at that moment (its content is saved in `content\drafts_original_2026-10-05\`).

## What's already built in

Mobile-first design, sticky header with the logo, home page with featured guide + latest posts + categories, category pages, post pages with table of contents and related posts, About / Contact / Privacy / Affiliate Disclosure, `sitemap.xml`, `robots.txt`, `feed.xml` (RSS), `ads.txt` with the AdSense publisher ID, Open Graph share image, Article + Breadcrumb structured data, favicon set.

## Tools

`tools\make_images.py` regenerates the diagrams and brand assets in the site colors. `tools\make_edited_copies.py` and `tools\wp_api.py` are from the WordPress days and are no longer needed.
