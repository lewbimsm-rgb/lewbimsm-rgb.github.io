# smartselectlabs.com (Hostinger Horizons build) — fix list
_Written 2026-10-09 by blog chat #2 after finding the live site is a Horizons build (not the GitHub site). Everything here is done inside Hostinger: the Horizons editor (hPanel → Websites → smartselectlabs.com → Edit website) for design, scripts and files; the site's own editor at https://smartselectlabs.com/admin for posts and gear links. Nothing here needs code knowledge: paste the prompts into the Horizons chat box._

## 1. Money leak: Gear page Amazon buttons (do this first, 5 minutes)

Today's buttons:
- Paddles → `https://link.amazon/B03h1URWv` (not a real address; earns nothing)
- Court clothing → `https://www.amazon.com/s?k=pickleball+court+clothing&tag=your-amazon-tag-20` (placeholder tag; earns nothing)
- Korean skincare → `https://www.amazon.com/s?k=korean+skincare+spf&tag=your-amazon-tag-20` (placeholder tag; earns nothing)

Replace with (Mom's tag `smartselec0a7-20`):
- Paddles → `https://www.amazon.com/s?k=pickleball+paddle+set+beginner&tag=smartselec0a7-20`
- Court clothing → `https://www.amazon.com/s?k=pickleball+clothing+women&tag=smartselec0a7-20`
- Korean skincare → `https://www.amazon.com/s?k=korean+sunscreen+spf+50+sweat+resistant&tag=smartselec0a7-20`

Then delete the small-print sentence under the second and third cards that says "This link still uses a placeholder tracking ID (your-amazon-tag-20); replace it before going live."

Horizons prompt to paste:
> On the Gear page, change the three "Shop on Amazon" buttons: Paddles → https://www.amazon.com/s?k=pickleball+paddle+set+beginner&tag=smartselec0a7-20 ; Court clothing → https://www.amazon.com/s?k=pickleball+clothing+women&tag=smartselec0a7-20 ; Korean skincare → https://www.amazon.com/s?k=korean+sunscreen+spf+50+sweat+resistant&tag=smartselec0a7-20 . Remove the sentences that mention a placeholder tracking ID. All three buttons must open in a new tab with rel="sponsored nofollow noopener".

Later upgrade: replace the search links with specific products (Amazon product pages with `?tag=smartselec0a7-20`) once Mom has picked the exact paddle set, shoes and sunscreen she actually uses. Search links pay on anything bought within 24 hours; product links convert better.

## 2. Analytics + AdSense (10 minutes)

Both already exist; they just need to be on this site.
- Google Analytics measurement ID: `G-8DH9Y1Q2K5` (created Oct 6 in Lewis's Google account).
- AdSense publisher ID: `ca-pub-3242839684084183` (Mom's account).

Horizons prompt:
> Add Google Analytics 4 to every page using measurement ID G-8DH9Y1Q2K5 (the standard gtag.js snippet in the head). Also add the Google AdSense script to the head of every page: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3242839684084183" crossorigin="anonymous"></script>`. Do not place any ad units yet.

ads.txt must be served at https://smartselectlabs.com/ads.txt as a plain text file containing exactly:
```
google.com, pub-3242839684084183, DIRECT, f08c47fec0942fa0
```
Horizons prompt:
> Add a static file at /ads.txt (served as text/plain) with this single line: google.com, pub-3242839684084183, DIRECT, f08c47fec0942fa0

Check afterwards: open https://smartselectlabs.com/ads.txt in a browser; it must show that one line, not the website.

## 3. Logo (5 minutes)

The logo image is loaded from `https://dynamic.design.com/preview/logodraft/...` (a design-tool preview address that can stop working). Upload the lotus wordmark as a file inside the project instead.
Horizons prompt:
> Replace the external logo URL in the header and footer with the uploaded file /logo-smartselectlabs.png (attach the PNG). Keep the same size.
(Mom's logo files are in `content/images/photos/` in this folder if she needs the original.)

## 4. Author and trust (15 minutes)

Every post says "By SmartSelectLabs Editorial." Google's guidance for review sites asks for a real, identifiable author with first-hand experience. Decision made Oct 5: **Judy, with a court photo.**
Horizons prompt:
> Change the article byline from "SmartSelectLabs Editorial" to "Judy" with a small round author photo (attach it) and a one-line bio under each article: "Judy is a 60-something rec player who tests gear at open play in Las Vegas." Add the same photo and a short "About Judy" section to the About page.

Also add a visible "Updated" date to posts when they are revised (Google reads it).

## 5. Content: grow the thin posts into the five money posts

The 15 posts are about 560 words each. Keep them, but grow these five into the pillar posts from `GROWTH_PLAN.md` (1,500–2,500 words, her photos, measured specs, at-a-glance picks, buy-if/pass-if, FAQ):

| Existing post | Grow into | Why |
|---|---|---|
| Control or power? Pick the paddle for your game | Best first paddle for players over 50 (under $100) | The entry point for every reader; hub of the paddle cluster |
| Court shoes are not just running shoes in disguise | Best pickleball shoes for seniors (stability, cushion, wide toe box) | Shoes pay 4% on Amazon and get replaced yearly |
| Your first pickleball game starts here | What to bring to your first open play (printable checklist) | A confirmed gap in search results; best Pinterest asset |
| Weekly pickleball practice plan | Injury prevention over 50: a 10-minute warm-up and the gear that helps | 83% of pickleball ER visits are players 50+; hospitals rank but never recommend gear |
| (new) | Best pickleball paddles for tennis elbow (tested by a 60+ rec player) | Highest-ticket item, buyer in pain, one real competitor |

The K-skincare lane is Mom's and it fits: sunscreen and sun sleeves pay 4% (apparel/beauty) and page one for "pickleball sun protection" is weak. Keep it, but make it first-hand (what she actually uses on hot Vegas courts).

Writing stays in Google Docs per `MOM_PUBLISHING_GUIDE.md`; the finished text is pasted into the post in /admin.

## 6. Housekeeping
- The GitHub site at lewbimsm-rgb.github.io is now unused. Leave it; it costs nothing. Do not run `site/publish.py` again unless the domain goes back to GitHub.
- The Hostinger WordPress install is also unused. It can be deleted from hPanel later to stop its updates and emails.
- AdSense review: do not request it until the pillars are live and the posts have a named author.
