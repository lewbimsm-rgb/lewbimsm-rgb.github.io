"""components.py - review/affiliate building blocks for SmartSelect Labs posts.

Why these exist (research/01 + research/02): the pickleball sites that earn put an "at a glance" box with
3 labelled picks before the third heading, one comparison table, measured specs, "buy if / pass if"
verdicts, two store buttons, and a short FAQ. Boxed product displays get ~50% more clicks than text links.

Hook-up (two lines, see COMPONENTS.md):
    build.py   ->  in render_markdown(), right after `out = MD.convert(body)`:   out = components.render(out)
    base.html  ->  <link rel="stylesheet" href="/assets/components.css">  (or append components.css to style.css)

Authors (Lewis/Claude at review time) write fenced blocks in the Markdown. Each is a few plain lines
separated by " | ". Markdown's own fenced-code output is what we transform, so nothing else changes.

    ```quick                     -> "Quick answer" box (what Google's AI box and featured snippets quote)
    The short answer: ...
    ```

    ```picks                     -> "At a glance" box, 2-4 cards. Label | Product | one-line why | URL | Store
    Best overall | Selkirk SLK Halo Control | Light, 16 mm, forgiving | https://... | Selkirk
    Best under $100 | Vatic Pro Prism Flash | Soft feel for sore elbows | https://... | Vatic Pro
    ```

    ```compare                   -> comparison table; a column of URLs becomes "Check price" buttons
    Paddle | Weight | Core | Grip | Best for | Link
    Selkirk SLK Halo | 7.8 oz | 16 mm | 4.25" | Most beginners | https://...
    ```

    ```specs                     -> "Measured specs" box. Name | value   (first line "Title: ..." optional)
    Title: Selkirk SLK Halo Control, as measured
    Weight on my kitchen scale | 7.9 oz
    Grip circumference | 4.25 in
    ```

    ```buyif                     -> Buy if / Pass if, two columns. Lines start with + or -
    + you have elbow or wrist pain
    - you already hit hard and want more pop
    ```

    ```verdict                   -> verdict box with stars. First line: rating | heading ; rest = text
    4.5 | Our verdict
    The paddle I would hand to any new player over 50...
    ```

    ```faq                       -> FAQ accordion + FAQPage JSON-LD. Q: / A: pairs
    Q: Is it OK to play pickleball with tennis elbow?
    A: Usually yes, if ...
    ```

    ```cta                       -> single big button. Text | URL | Store (optional note line after)
    Check today's price at Selkirk | https://... | Selkirk
    ```
"""
import html
import json
import re

REL = 'rel="sponsored nofollow noopener" target="_blank"'
BLOCK_RE = re.compile(r'<pre><code class="language-(quick|picks|compare|specs|buyif|verdict|faq|cta)">(.*?)</code></pre>', re.S)


def _inline(text):
    """Tiny inline markup: **bold**, *italic*, [text](url)."""
    t = html.escape(text.strip(), quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", lambda m: '<a href="%s" %s>%s</a>' % (html.escape(m.group(2), True), REL, m.group(1)), t)
    return t


def _store_class(store):
    s = (store or "").strip().lower()
    if "amazon" in s:
        return "ss-btn-amazon"
    return "ss-btn-store"


def _button(label, url, store=None, cls="ss-btn"):
    return '<a class="%s %s" href="%s" %s>%s</a>' % (cls, _store_class(store), html.escape(url.strip(), True), REL, html.escape(label))


def _lines(body):
    return [l.rstrip() for l in html.unescape(body).strip("\n").splitlines() if l.strip()]


def _cells(line):
    return [c.strip() for c in line.split("|")]


# ----------------------------------------------------------------------------------------------------------
def quick(body):
    paras = "".join("<p>%s</p>" % _inline(l) for l in _lines(body))
    return '<aside class="ss-quick"><span class="ss-kicker">Quick answer</span>%s</aside>' % paras


def picks(body):
    cards = []
    for line in _lines(body):
        c = _cells(line) + ["", "", "", "", ""]
        label, product, why, url, store = c[0], c[1], c[2], c[3], c[4]
        btn = _button("Check price at %s" % (store or "store") if store else "Check price", url, store) if url.startswith("http") else ""
        cards.append('<div class="ss-pick"><span class="ss-pick-label">%s</span><h3 class="ss-pick-name">%s</h3><p>%s</p>%s</div>'
                     % (html.escape(label), html.escape(product), _inline(why), btn))
    return '<section class="ss-picks" aria-label="Our picks at a glance"><span class="ss-kicker">At a glance</span><div class="ss-picks-grid">%s</div></section>' % "".join(cards)


def compare(body):
    rows = [_cells(l) for l in _lines(body)]
    if len(rows) < 2:
        return ""
    head, data = rows[0], rows[1:]
    th = "".join("<th scope=\"col\">%s</th>" % html.escape(h) for h in head)
    trs = []
    for r in data:
        tds = []
        for i, cell in enumerate(r):
            if cell.startswith("http"):
                tds.append('<td class="ss-cell-action">%s</td>' % _button("Check price", cell, head[i] if i < len(head) else "", "ss-btn ss-btn-sm"))
            elif i == 0:
                tds.append('<th scope="row">%s</th>' % _inline(cell))
            else:
                tds.append("<td>%s</td>" % _inline(cell))
        trs.append("<tr>%s</tr>" % "".join(tds))
    return '<div class="ss-table-wrap"><table class="ss-compare"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (th, "".join(trs))


def specs(body):
    lines = _lines(body)
    title = "Measured specs"
    if lines and lines[0].lower().startswith("title:"):
        title = lines.pop(0).split(":", 1)[1].strip()
    items = "".join("<div class=\"ss-spec\"><dt>%s</dt><dd>%s</dd></div>" % (_inline(c[0]), _inline(c[1] if len(c) > 1 else ""))
                    for c in (_cells(l) for l in lines))
    return '<section class="ss-specs"><span class="ss-kicker">%s</span><dl>%s</dl></section>' % (html.escape(title), items)


def buyif(body):
    buy, skip = [], []
    for l in _lines(body):
        if l.startswith("+"):
            buy.append(l[1:].strip())
        elif l.startswith("-") or l.startswith("–"):
            skip.append(l[1:].strip())
    col = lambda title, cls, items: '<div class="ss-buyif-col %s"><h4>%s</h4><ul>%s</ul></div>' % (cls, title, "".join("<li>%s</li>" % _inline(i) for i in items))
    return '<section class="ss-buyif">%s%s</section>' % (col("Buy it if", "ss-buy", buy), col("Pass if", "ss-pass", skip))


def verdict(body):
    lines = _lines(body)
    if not lines:
        return ""
    first = _cells(lines[0])
    rating, heading = None, "Our verdict"
    try:
        rating = float(first[0].replace("/5", ""))
        heading = first[1] if len(first) > 1 and first[1] else heading
        text_lines = lines[1:]
    except ValueError:
        heading = first[0] if first[0] else heading
        text_lines = lines[1:] if len(first) == 1 and len(lines) > 1 else lines
    stars = ""
    if rating is not None:
        full = int(rating); half = 1 if rating - full >= 0.5 else 0
        stars = '<span class="ss-stars" aria-label="%s out of 5">%s%s%s <b>%s/5</b></span>' % (rating, "★" * full, "½" if half else "", "☆" * (5 - full - half), rating)
    paras = "".join("<p>%s</p>" % _inline(l) for l in text_lines)
    return '<aside class="ss-verdict"><div class="ss-verdict-head"><span class="ss-kicker">%s</span>%s</div>%s</aside>' % (html.escape(heading), stars, paras)


def faq(body):
    qa, q = [], None
    for l in _lines(body):
        if re.match(r"(?i)^q\s*[:.)]", l):
            q = re.sub(r"(?i)^q\s*[:.)]\s*", "", l); qa.append([q, ""])
        elif re.match(r"(?i)^a\s*[:.)]", l) and qa:
            qa[-1][1] = re.sub(r"(?i)^a\s*[:.)]\s*", "", l)
        elif qa:
            qa[-1][1] = (qa[-1][1] + " " + l).strip()
    if not qa:
        return ""
    items = "".join('<details class="ss-faq-item"><summary>%s</summary><p>%s</p></details>' % (_inline(q), _inline(a)) for q, a in qa)
    ld = {"@context": "https://schema.org", "@type": "FAQPage",
          "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", _inline(a))}} for q, a in qa]}
    return ('<section class="ss-faq"><h2 id="faq">Frequently asked questions</h2>%s</section>'
            '<script type="application/ld+json">%s</script>' % (items, json.dumps(ld, ensure_ascii=False)))


def cta(body):
    lines = _lines(body)
    if not lines:
        return ""
    c = _cells(lines[0]) + ["", ""]
    note = "".join("<p class=\"ss-cta-note\">%s</p>" % _inline(l) for l in lines[1:])
    return '<div class="ss-cta">%s%s</div>' % (_button(c[0], c[1], c[2], "ss-btn ss-btn-lg") if c[1].startswith("http") else "", note)


RENDERERS = {"quick": quick, "picks": picks, "compare": compare, "specs": specs, "buyif": buyif, "verdict": verdict, "faq": faq, "cta": cta}


def render(html_text):
    """Replace fenced component blocks in rendered Markdown HTML with the component markup."""
    def sub(m):
        try:
            return RENDERERS[m.group(1)](m.group(2))
        except Exception as e:  # never break a build over a component typo
            return '<p class="ss-error">[%s block could not be rendered: %s]</p>' % (m.group(1), html.escape(str(e)))
    out = BLOCK_RE.sub(sub, html_text)
    # plain Markdown tables (e.g. from a Google Doc) get the same responsive wrapper as the compare block
    out = re.sub(r"<table>(.*?)</table>", r'<div class="ss-table-wrap"><table class="ss-table">\1</table></div>', out, flags=re.S)
    return out


if __name__ == "__main__":  # quick self-test:  python components.py
    import markdown
    demo = open(__file__.replace("components.py", "COMPONENTS.md"), encoding="utf-8").read()
    demo = demo.split("<!-- demo -->", 1)[-1]
    print(render(markdown.markdown(demo, extensions=["extra"]))[:3000])
