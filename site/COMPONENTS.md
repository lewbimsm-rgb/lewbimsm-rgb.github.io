# Post components (the money blocks)

These are the building blocks that make a review page earn: the research in `research/01_monetization_and_landscape.md` found that boxed product displays get about 50% more clicks than text links, that the first product box should appear **before the third heading**, and that the sites that earn use measured specs, "buy if / pass if" verdicts and two store buttons. `components.py` renders them; `assets/components.css` styles them in the site's own colors.

## Hook-up (one time, two lines)

1. `build.py`, inside `render_markdown()`, right after `out = MD.convert(body)`:
   ```python
   import components           # top of file
   out = components.render(out)
   ```
2. `templates/base.html`, after the `style.css` link:
   ```html
   <link rel="stylesheet" href="/assets/components.css">
   ```
   (or paste `components.css` onto the end of `style.css`; the file only uses the site's existing variables).

Everything is a fenced block in the post's Markdown. Mom does not write these; Lewis or Claude adds them during the review step after `tools/docx_to_post.py` has converted her doc.

## The blocks

**Quick answer** (top of every money post; this is the paragraph Google's AI box and featured snippets quote)
````
```quick
**The short answer:** if you are over 50 and buying your first paddle, get a 7.5–8.0 oz, 16 mm paddle with a 4.25" grip. Our pick is the **Selkirk SLK Halo Control**; the $35 Niupipo set is fine for your first month.
```
````

**At a glance picks** (2–4 lines; place before the third heading). `Label | Product | one-line why | URL | Store`
````
```picks
Best overall | Selkirk SLK Halo Control | Light, 16 mm, forgiving; the one most new 50+ players should buy | https://www.selkirk.com/... | Selkirk
Best under $100 | Vatic Pro Prism Flash | Soft feel that is easy on sore elbows | https://vaticpro.com/... | Vatic Pro
Best starter set | Niupipo 2-paddle set | Two paddles and balls for the price of a lesson | https://www.amazon.com/dp/XXXX?tag=TAG | Amazon
```
````

**Comparison table** (first line = headers; any cell that is a URL becomes a "Check price" button; the header of that column should be the store name)
````
```compare
Paddle | Weight | Core | Grip | Best for | Selkirk
SLK Halo Control | 7.8 oz | 16 mm | 4.25" | Most beginners | https://www.selkirk.com/...
Prism Flash | 7.6 oz | 16 mm | 4.25" | Sore elbows | https://vaticpro.com/...
```
````

**Measured specs** (one per product reviewed; Google's review guidance asks for "quantitative measurements")
````
```specs
Title: Selkirk SLK Halo Control, as measured
Weight on my kitchen scale | 7.9 oz
Grip circumference | 4.25 in
Core thickness | 16 mm
Sessions played | 6 (outdoor, October 2026)
```
````

**Buy if / Pass if** (replaces generic pros/cons; lines start with `+` or `-`)
````
```buyif
+ you have elbow or wrist pain
+ you want control more than power
- you already hit hard and want more pop
- you only play indoors with a soft ball
```
````

**Verdict** (first line `rating | heading`, rest is text; rating out of 5, or `- | Heading` for no stars)
````
```verdict
4.5 | Our verdict
The paddle I would hand to any new player over 50. Light enough for a long session, forgiving on off-center hits, and the grip fit the three of us who tried it.
```
````

**FAQ** (3–6 real questions; the block also writes the FAQPage schema for you)
````
```faq
Q: Is it OK to play pickleball with tennis elbow?
A: Usually yes, with a lighter paddle, a looser grip and rest days. Stop if pain changes how you swing.
Q: Is a heavier or lighter paddle better for tennis elbow?
A: Lighter, within reason: 7.5 to 8.0 oz with a 16 mm core.
```
````

**Single call to action** (`Text | URL | Store`, optional note line)
````
```cta
Check today's price at Selkirk | https://www.selkirk.com/... | Selkirk
Prices change; the button shows the current one.
```
````

Chat #1's existing `::product Name | /images/x.jpg | Best for: ... | amazon=URL | selkirk=URL` card still works and is the right block for a single product with a photo.

## Rules baked in
- Every store link gets `rel="sponsored nofollow noopener"` and opens in a new tab (Google asks for `sponsored` on paid links).
- Amazon buttons are orange, brand-store buttons green, so a reader always knows where a click goes.
- Never type an Amazon price into a block; "about $90" in the text is fine.
- Plain Markdown tables (for example from a Google Doc) get the same responsive styling automatically.

## Where each block goes in a money post
1. Title, lede, byline (template) → **Quick answer** → **At a glance picks** → why it matters (1–2 headings) → **Comparison table** → per product: photo, text, **Measured specs**, **Buy if / Pass if**, `::product` or **CTA** → "What I'd avoid" → **FAQ** → **Verdict** → author box (template).

<!-- demo -->
```quick
**The short answer:** a 7.5–8.0 oz, 16 mm paddle with a 4.25" grip.
```
```picks
Best overall | Selkirk SLK Halo Control | Light, forgiving, easy on the elbow | https://www.selkirk.com/ | Selkirk
Best under $100 | Vatic Pro Prism Flash | Soft feel for sore elbows | https://vaticpro.com/ | Vatic Pro
Best starter set | Niupipo 2-paddle set | Two paddles and balls for the price of a lesson | https://www.amazon.com/ | Amazon
```
```compare
Paddle | Weight | Core | Grip | Best for | Selkirk
SLK Halo Control | 7.8 oz | 16 mm | 4.25" | Most beginners | https://www.selkirk.com/
Prism Flash | 7.6 oz | 16 mm | 4.25" | Sore elbows | https://vaticpro.com/
```
```specs
Title: Selkirk SLK Halo Control, as measured
Weight on my kitchen scale | 7.9 oz
Grip circumference | 4.25 in
Core thickness | 16 mm
```
```buyif
+ you have elbow or wrist pain
+ you want control more than power
- you already hit hard and want more pop
```
```verdict
4.5 | Our verdict
The paddle I would hand to any new player over 50.
```
```faq
Q: Is it OK to play pickleball with tennis elbow?
A: Usually yes, with a lighter paddle, a looser grip and rest days.
Q: Lighter or heavier for tennis elbow?
A: Lighter: 7.5 to 8.0 oz with a 16 mm core.
```
```cta
Check today's price at Selkirk | https://www.selkirk.com/ | Selkirk
Prices change; the button shows the current one.
```
