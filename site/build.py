"""build.py - turns content/ (Markdown) into a complete static website in site/docs/ (what GitHub Pages serves).

    python build.py            build everything into docs/
    python build.py --serve    build, then open a local preview at http://localhost:8765/

Layout
    config.json            site name, tagline, email, categories, nav, ad/affiliate IDs
    content/posts/*.md     one file per article (YAML front matter between --- lines, then Markdown)
    content/pages/*.md     about, contact, privacy policy, affiliate disclosure
    content/images/        photos + generated graphics (copied to docs/images/)
    templates/*.html       Jinja2 templates
    assets/                css + favicon (copied to docs/assets/)

Front matter is written either by hand or by Pages CMS (the admin screen), so it is parsed as real YAML:
quoted strings, true/false, and dates all work. A post with  draft: true  is skipped.

Markdown extras
    > **SmartSelect Tip:** ...          renders as a highlighted tip box
    ::product Name | /images/x.jpg | Best for: ... | amazon=URL | selkirk=URL | target=URL
                                        renders an affiliate product card (links get rel="sponsored")
    plus the fenced review blocks documented in COMPONENTS.md (quick / picks / compare / specs / buyif / verdict / faq / cta)
"""
import os, re, sys, json, shutil, datetime, html, http.server, socketserver
import markdown
import yaml
import components  # review/affiliate blocks (see COMPONENTS.md)
from jinja2 import Environment, FileSystemLoader, select_autoescape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
CONTENT = os.path.join(ROOT, "content")
OUT = os.path.join(HERE, "docs")
CFG = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))

env = Environment(loader=FileSystemLoader(os.path.join(HERE, "templates")), autoescape=select_autoescape(["html"]))
env.globals.update(site=CFG, now=datetime.datetime.now())

MD = markdown.Markdown(extensions=["extra", "toc", "smarty", "sane_lists", "attr_list"], extension_configs={"toc": {"toc_depth": "2-3"}})


# ----------------------------------------------------------------------------------------------------------
def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def truthy(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("true", "yes", "1", "on")


def as_date(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    s = str(v or "").strip()
    try:
        return datetime.date.fromisoformat(s[:10])
    except ValueError:
        return datetime.date.today()


def parse_front_matter(text):
    """YAML front matter (what Pages CMS writes) with a forgiving fallback for hand-typed  key: value  lines."""
    meta, body = {}, text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            raw = text[3:end]
            try:
                meta = yaml.safe_load(raw) or {}
                if not isinstance(meta, dict):
                    raise ValueError("front matter is not a mapping")
            except Exception:
                meta = {}
                for line in raw.strip("\n").split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meta[k.strip()] = v.strip().strip('"').strip("'")
            body = text[end + 4:]
    meta = {k: ("" if v is None else v) for k, v in meta.items()}
    return meta, body.lstrip("\n")


def product_card(m):
    parts = [p.strip() for p in m.group(1).split("|")]
    name = parts[0]; image = ""; best = ""; links = []
    for p in parts[1:]:
        if p.startswith("/") or p.startswith("http"):
            image = p
        elif "=" in p and p.split("=", 1)[0] in ("amazon", "selkirk", "target", "link"):
            store, url = p.split("=", 1)
            label = {"amazon": "Check price on Amazon", "selkirk": "See it at Selkirk", "target": "See it at Target", "link": "See it"}[store]
            links.append((store, url, label))
        else:
            best = p
    btns = "".join('<a class="btn btn-%s" href="%s" rel="sponsored nofollow noopener" target="_blank">%s</a>' % (s, html.escape(u, True), l) for s, u, l in links)
    img = '<img src="%s" alt="%s" loading="lazy" width="320" height="320">' % (html.escape(image, True), html.escape(name, True)) if image else ""
    return ('<div class="product-card">%s<div class="product-body"><h4>%s</h4>%s<div class="product-actions">%s</div>'
            '<p class="product-note">We may earn a commission if you buy through these links. It never changes what you pay.</p></div></div>'
            % (img, html.escape(name), ("<p>%s</p>" % html.escape(best)) if best else "", btns))


def render_markdown(body):
    body = re.sub(r"^::product (.+)$", product_card, body, flags=re.M)
    MD.reset()
    out = MD.convert(body)
    out = components.render(out)
    # tip boxes: blockquotes whose first bold text ends with "Tip:" or similar
    out = re.sub(r'<blockquote>\s*<p><strong>([^<]*?(Tip|Checklist|Note)[^<]*?)</strong>', r'<blockquote class="tip"><p><strong>\1</strong>', out)
    # external links open in a new tab
    out = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', out)
    return out, MD.toc_tokens


def image_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return (None, None)


def reading_time(html_text):
    words = len(re.sub(r"<[^>]+>", " ", html_text).split())
    return max(1, round(words / 220)), words


def display_date(d):
    return d.strftime("%B %d, %Y").replace(" 0", " ")


# ----------------------------------------------------------------------------------------------------------
def load_posts():
    posts = []
    pdir = os.path.join(CONTENT, "posts")
    for fn in sorted(os.listdir(pdir)):
        if not fn.endswith(".md"):
            continue
        meta, body = parse_front_matter(open(os.path.join(pdir, fn), encoding="utf-8").read())
        if truthy(meta.get("draft", False)):
            continue
        if not str(meta.get("title", "")).strip():
            print("skipping %s: no title" % fn); continue
        html_body, toc = render_markdown(body)
        minutes, words = reading_time(html_body)
        slug = slugify(meta.get("slug") or fn[:-3])
        cat = str(meta.get("category") or "Beginner Guides")
        catcfg = CFG["categories"].get(cat, {"slug": slugify(cat), "blurb": ""})
        img = str(meta.get("image") or "")
        w, h = image_size(os.path.join(CONTENT, img.lstrip("/"))) if img else (None, None)
        date = as_date(meta.get("date"))
        posts.append(dict(
            meta=meta, slug=slug, url="/%s/" % slug, title=str(meta["title"]), seo_title=str(meta.get("seo_title") or meta["title"]),
            description=str(meta.get("description") or ""), date=date, date_display=display_date(date),
            category=cat, category_slug=catcfg["slug"], category_url="/category/%s/" % catcfg["slug"],
            image=img, image_alt=str(meta.get("image_alt") or meta["title"]), image_w=w, image_h=h,
            body=html_body, toc=toc, minutes=minutes, words=words, affiliate=truthy(meta.get("affiliate", False)),
            author=str(meta.get("author") or CFG["author"]), updated=str(meta.get("updated") or "")))
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return posts


def load_pages():
    pages = []
    pdir = os.path.join(CONTENT, "pages")
    for fn in sorted(os.listdir(pdir)):
        if not fn.endswith(".md"):
            continue
        meta, body = parse_front_matter(open(os.path.join(pdir, fn), encoding="utf-8").read())
        if truthy(meta.get("draft", False)):
            continue
        html_body, _ = render_markdown(body)
        slug = slugify(meta.get("slug") or fn[:-3])
        pages.append(dict(meta=meta, slug=slug, url="/%s/" % slug, title=str(meta.get("title") or slug), description=str(meta.get("description") or ""),
                          body=html_body, template=str(meta.get("template") or "page.html")))
    return pages


def write(path, text):
    full = os.path.join(OUT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def copytree(src, dst):
    if os.path.isdir(src):
        shutil.copytree(src, dst, dirs_exist_ok=True)


# ----------------------------------------------------------------------------------------------------------
def build():
    # clear docs/ but keep a .git if one is there (older deploy model); the GitHub Action builds into a clean checkout
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name == ".git":
            continue
        p = os.path.join(OUT, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    copytree(os.path.join(CONTENT, "images"), os.path.join(OUT, "images"))
    copytree(os.path.join(HERE, "assets"), os.path.join(OUT, "assets"))

    posts = load_posts(); pages = load_pages()
    cats = []
    for name, c in CFG["categories"].items():
        cats.append(dict(name=name, slug=c["slug"], url="/category/%s/" % c["slug"], blurb=c["blurb"], posts=[p for p in posts if p["category"] == name]))
    ctx = dict(posts=posts, pages=pages, cats=cats)

    featured = next((p for p in posts if p["slug"] == CFG.get("featured_slug")), posts[0] if posts else None)
    write("index.html", env.get_template("home.html").render(featured=featured, latest=posts[:6], page_url="/", **ctx))
    for p in posts:
        related = [q for q in posts if q["slug"] != p["slug"] and q["category"] == p["category"]][:3] or [q for q in posts if q["slug"] != p["slug"]][:3]
        write(p["url"] + "index.html", env.get_template("post.html").render(post=p, related=related, page_url=p["url"], **ctx))
    for c in cats:
        write(c["url"] + "index.html", env.get_template("category.html").render(cat=c, page_url=c["url"], **ctx))
    for pg in pages:
        write(pg["url"] + "index.html", env.get_template(pg["template"]).render(page=pg, page_url=pg["url"], **ctx))
    write("404.html", env.get_template("404.html").render(page_url="/404.html", **ctx))

    # machine files
    base = CFG["url"].rstrip("/")
    urls = ["/"] + [p["url"] for p in posts] + [c["url"] for c in cats] + [pg["url"] for pg in pages]
    today = datetime.date.today().isoformat()
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (base, u, today) for u in urls) + "</urlset>\n")
    write("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % base)
    if CFG.get("adsense_client"):
        write("ads.txt", "google.com, %s, DIRECT, f08c47fec0942fa0\n" % CFG["adsense_client"].replace("ca-", ""))
    items = "".join("  <item><title>%s</title><link>%s%s</link><guid>%s%s</guid><pubDate>%s</pubDate><description>%s</description></item>\n"
                    % (html.escape(p["title"]), base, p["url"], base, p["url"], p["date"].strftime("%a, %d %b %Y 08:00:00 GMT"), html.escape(p["description"])) for p in posts)
    write("feed.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>%s</title><link>%s/</link><description>%s</description>\n%s</channel></rss>\n'
          % (html.escape(CFG["site_name"]), base, html.escape(CFG["description"]), items))
    host = CFG["url"].split("//", 1)[1].strip("/")
    write("CNAME", host + "\n")
    write(".nojekyll", "")
    write("site.webmanifest", json.dumps({"name": CFG["site_name"], "short_name": "SmartSelect", "icons": [{"src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png"}],
                                          "theme_color": "#0b0f2a", "background_color": "#ffffff", "display": "browser", "start_url": "/"}, indent=1))
    print("built %d posts, %d pages, %d categories -> %s" % (len(posts), len(pages), len(cats), OUT))
    return posts


def serve():
    os.chdir(OUT)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    with socketserver.TCPServer(("127.0.0.1", 8765), Handler) as httpd:
        print("preview at http://127.0.0.1:8765/  (Ctrl+C to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    build()
    if "--serve" in sys.argv:
        serve()
