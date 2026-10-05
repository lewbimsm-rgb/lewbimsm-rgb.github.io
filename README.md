# smartselectlabs.com

Source for [SmartSelect Labs](https://smartselectlabs.com), a pickleball blog: plain-English beginner guides and honest gear reviews.

- `content/posts/` — articles (Markdown with YAML front matter)
- `content/pages/` — About, Contact, Privacy Policy, Affiliate Disclosure
- `content/images/` — photos and diagrams
- `site/` — the generator (`build.py`), templates, styles and `config.json`
- `.pages.yml` — [Pages CMS](https://pagescms.org) configuration (the editing screen)
- `.github/workflows/build.yml` — builds and deploys to GitHub Pages on every push to `main`

Build locally: `pip install -r requirements.txt && python site/build.py` (output in `site/docs/`).
