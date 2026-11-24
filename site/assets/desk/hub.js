/* SmartSelect Labs "My blog" page - smartselectlabs.com/admin/hub/
   One screen that answers: is anyone reading, what are they reading, what is coming up, and are we ready for Google's ads.
   Numbers come from our own visit counter (Supabase function hub_stats, editors only) and from /hub-data.json,
   which the site builder writes on every build (live posts, scheduled posts, which posts carry Judy's own photos).
   Built 2026-11-24. */
(function () {
  "use strict";
  const CFG = window.DESK_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const $app = document.getElementById("app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Number(n || 0).toLocaleString();
  const plural = (n, one, many) => num(n) + " " + (Number(n) === 1 ? one : many);
  const dayDate = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00");
  const niceDay = (iso, long) => dayDate(iso).toLocaleDateString(undefined, long ? { weekday: "long", month: "long", day: "numeric" } : { month: "short", day: "numeric" });
  const daysBetween = (a, b) => Math.round((dayDate(b) - dayDate(a)) / 86400000);

  function bar(name) {
    return '<header class="bar"><div class="bar-in">' +
      '<a class="brand" href="/admin/"><img src="' + esc(CFG.logo) + '" alt="SmartSelect Labs"><span>My blog</span></a><div class="spacer"></div>' +
      (name ? '<span class="who">Hi, ' + esc(name) + "</span>" : "") +
      '<a class="link-btn" href="/admin/">Writing desk</a><a class="link-btn" href="/" target="_blank" rel="noopener">View site ↗</a></div></header>';
  }

  function signedOut() {
    $app.innerHTML = bar("") + '<main class="signin"><div class="signin-card"><h1>My blog</h1><p>Sign in at the writing desk first, then come back to this page.</p><a class="btn primary" href="/admin/">Go to the writing desk</a></div></main>';
  }

  // ------------------------------------------------------------ pieces
  function tile(label, visits, views, note) {
    return '<div class="hub-tile"><span class="hub-tile-label">' + esc(label) + '</span><strong>' + num(visits) + '</strong><span class="hub-tile-unit">' + (Number(visits) === 1 ? "visit" : "visits") + "</span>" +
      '<span class="hub-tile-sub">' + plural(views, "page opened", "pages opened") + (note ? " · " + esc(note) : "") + "</span></div>";
  }

  function chart(daily) {
    const W = 760, H = 190, padL = 30, padB = 26, padT = 12, n = daily.length;
    const max = Math.max(4, ...daily.map((d) => d.visits));
    const top = Math.ceil(max / 4) * 4, step = (W - padL - 8) / n, bw = Math.max(6, step - 5);
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    let g = "";
    [0, top / 2, top].forEach((v) => { g += '<line x1="' + padL + '" x2="' + (W - 4) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="hub-grid"/><text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" class="hub-axis" text-anchor="end">' + v + "</text>"; });
    daily.forEach((d, i) => {
      const x = padL + i * step + (step - bw) / 2, h = Math.max(d.visits ? 3 : 0, (H - padT - padB) * (d.visits / top));
      g += '<rect x="' + x.toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" class="hub-bar' + (i === n - 1 ? " today" : "") + '"><title>' + esc(niceDay(d.day)) + ": " + plural(d.visits, "visit", "visits") + ", " + plural(d.views, "page", "pages") + "</title></rect>";
      if (i === 0 || i === n - 1 || i % 7 === 0) g += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" class="hub-axis" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '">' + esc(i === n - 1 ? "Today" : niceDay(d.day)) + "</text>";
    });
    const total = daily.reduce((s, d) => s + d.visits, 0);
    return '<svg class="hub-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Visits per day for the last 28 days, ' + total + ' in total">' + g + "</svg>";
  }

  function rows(items, labelOf, valueOf, hrefOf) {
    if (!items.length) return '<p class="hub-empty">Nothing here yet. It fills in as people visit.</p>';
    const max = Math.max(1, ...items.map(valueOf));
    return '<ol class="hub-rows">' + items.map((it) => {
      const label = esc(labelOf(it)), href = hrefOf ? hrefOf(it) : "";
      return '<li><span class="hub-row-bar" style="width:' + Math.max(4, Math.round((valueOf(it) / max) * 100)) + '%"></span><span class="hub-row-label">' + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + label + "</a>" : label) + '</span><span class="hub-row-val">' + num(valueOf(it)) + "</span></li>";
    }).join("") + "</ol>";
  }

  const REF_NAMES = { "google.com": "Google search", "bing.com": "Bing search", "duckduckgo.com": "DuckDuckGo search", "pinterest.com": "Pinterest", "facebook.com": "Facebook", "m.facebook.com": "Facebook", "l.facebook.com": "Facebook", "instagram.com": "Instagram", "l.instagram.com": "Instagram", "t.co": "X (Twitter)", "youtube.com": "YouTube", "smartselectlabs.blogspot.com": "Your Blogspot page", "nextdoor.com": "Nextdoor", "chatgpt.com": "ChatGPT", "perplexity.ai": "Perplexity" };
  const refName = (r) => REF_NAMES[r] || (/^(www\.)?google\./.test(r) ? "Google search" : /pinterest\./.test(r) ? "Pinterest" : r);

  function check(done, title, detail, extra) {
    return '<li class="' + (done ? "done" : "todo") + '"><span class="hub-tick" aria-hidden="true">' + (done ? "✓" : "") + '</span><div><strong>' + esc(title) + "</strong><p>" + detail + "</p>" + (extra || "") + "</div></li>";
  }

  // ------------------------------------------------------------ the page
  function render(name, s, site) {
    const posts = site.posts || [], sched = site.scheduled || [], today = site.today || new Date().toISOString().slice(0, 10);
    const titleOf = {}; posts.forEach((p) => { titleOf[p.url] = p.title; });
    const pageName = (path) => titleOf[path] || ({ "/": "Home page", "/blog/": "All posts page", "/about/": "About page", "/contact/": "Contact page" }[path]) || path;
    const own = posts.filter((p) => p.own_photo).length;
    const newest = posts.length ? posts.map((p) => p.date).sort().pop() : null;
    const newestAge = newest ? daysBetween(newest, today) : 999;
    const g = (s.status && s.status.google) || {};
    const blogspotGone = !!(s.status && s.status.blogspot_copy_removed && s.status.blogspot_copy_removed.done);
    const reviewAsked = !!(s.status && s.status.review_requested && s.status.review_requested.done);
    const articlesInGoogle = Number(g.articles_indexed || 0), articlesTotal = Number(g.articles || posts.length);

    // the one sentence at the top
    const top = (s.top || []).filter((t) => titleOf[t.path])[0];
    const counting = s.since ? daysBetween(s.since, today) : 0;
    let headline;
    if (!s.d28.visits) headline = "The visit counter started " + (s.since ? "on " + niceDay(s.since, true) : "today") + ". Numbers will appear here as people find the blog.";
    else headline = plural(s.d7.visits, "visit", "visits") + " in the last 7 days." + (top ? " Most read: “" + titleOf[top.path] + "”." : "");

    // what to do next: the first thing that is not done
    let next;
    if (!blogspotGone) next = { t: "Delete the copied post on Blogspot", d: "The long post on smartselectlabs.blogspot.com is a copy of one that lives here. Google's reviewers turn sites down for copies. Delete it there, then press the button.", b: '<button class="btn small go" data-flag="blogspot_copy_removed">I deleted it</button> <a class="btn small" href="https://www.blogger.com/" target="_blank" rel="noopener">Open Blogger ↗</a>' };
    else if (sched.length) next = { t: "Nothing to do today", d: "Your next post, “" + esc(sched[0].title) + "”, goes live by itself on " + esc(niceDay(sched[0].date, true)) + ".", b: '<a class="btn small" href="/admin/">Open the writing desk</a>' };
    else if (newestAge > 6) next = { t: "Time for a new post", d: "Your newest post is " + newestAge + " days old. One short post with one of your own photos keeps the blog looking alive.", b: '<a class="btn small go" href="/admin/#/new">Start a post</a>' };
    else next = { t: "You are all caught up", d: "A new post went up " + (newestAge <= 0 ? "today" : newestAge === 1 ? "yesterday" : newestAge + " days ago") + ". Come back in a few days.", b: "" };

    // ready-for-ads checklist
    const items = [
      check(true, "The technical parts", "Ad code on every page, a privacy page that explains cookies and ads, a clear menu, and the site loads for everyone."),
      check(site.about_photo, "A real person on the About page", site.about_photo ? "Your photo and your story are on the About page and under every post." : "The About page still needs your photo."),
      check(site.contact_form, "A contact form", site.contact_form ? "Readers can write to you from the Contact page. Their notes arrive at the bottom of this page." : "The Contact page still shows only an email address."),
      check(own >= 5, "Your own photos on at least 5 posts", own + " of " + posts.length + " live posts carry a photo of yours."),
      check(posts.length >= 18, "At least 18 posts", posts.length + " posts are live" + (sched.length ? ", and " + sched.length + " more " + (sched.length === 1 ? "is" : "are") + " scheduled." : ".")),
      check(newestAge <= 7, "A post from the last week", newest ? "Your newest post went up " + niceDay(newest, true) + "." : "No posts yet."),
      check(blogspotGone, "No copies on other websites", blogspotGone ? "The Blogspot copy is gone." : "The copied post on Blogspot is still up."),
      check(articlesInGoogle >= Math.min(10, articlesTotal), "Google has read the articles", "Google shows " + articlesInGoogle + " of " + articlesTotal + " articles in its search results" + (g.requested ? " (we asked it to read " + g.requested + ")" : "") + (g.checked ? ". Last checked " + niceDay(g.checked) + "." : ".")),
    ];
    const left = items.filter((i) => i.indexOf('class="todo"') > 0).length;
    const verdict = reviewAsked ? "You asked Google to review the site. An answer usually takes a few days, sometimes two weeks."
      : left === 0 ? "Everything is ticked. This is a good moment to press “Request review” in AdSense."
      : left + (left === 1 ? " thing" : " things") + " left before pressing “Request review” in AdSense.";

    const msgs = s.messages || [];
    $app.innerHTML = bar(name) + '<main class="wrap hub">' +
      '<section class="hub-hero"><h1>How the blog is doing</h1><p class="hub-lede">' + esc(headline) + "</p></section>" +

      '<section class="hub-next"><span class="hub-kicker">Next step</span><h2>' + esc(next.t) + "</h2><p>" + next.d + "</p>" + (next.b ? '<div class="hub-actions">' + next.b + "</div>" : "") + "</section>" +

      '<section class="hub-tiles">' + tile("Today", s.today.visits, s.today.views) + tile("Last 7 days", s.d7.visits, s.d7.views) +
        tile("Last 28 days", s.d28.visits, s.d28.views, s.prev28.visits ? "the 28 days before: " + num(s.prev28.visits) : "") + "</section>" +
      '<p class="hub-note">A visit is one person reading in one sitting. Your own visits from this computer are not counted, and neither are search-engine robots.' + (counting < 28 && s.since ? " Counting started " + esc(niceDay(s.since, true)) + "." : "") + "</p>" +

      '<section class="hub-card"><h2>Visits per day</h2>' + chart(s.daily || []) + "</section>" +

      '<div class="hub-two"><section class="hub-card"><h2>Most read</h2><p class="hub-sub">Last 28 days</p>' + rows(s.top || [], (t) => pageName(t.path), (t) => t.visits, (t) => t.path) + "</section>" +
      '<section class="hub-card"><h2>How readers found you</h2><p class="hub-sub">Last 28 days</p>' + rows(s.refs || [], (r) => refName(r.ref), (r) => r.visits) + "</section></div>" +

      '<section class="hub-card"><h2>Coming up</h2>' + (sched.length ? '<ul class="hub-sched">' + sched.map((p) => "<li><time>" + esc(niceDay(p.date, true)) + "</time><span>" + esc(p.title) + "</span></li>").join("") + '</ul><p class="hub-sub">These are written and waiting. Each one appears on the site by itself on its day. To change one, open it in the writing desk.</p>' : '<p class="hub-empty">No posts are scheduled. In the writing desk, give a post a date in the future and it will wait until that day.</p>') + "</section>" +

      '<section class="hub-card"><h2>Ready for Google ads?</h2><p class="hub-verdict">' + esc(verdict) + '</p><ul class="hub-check">' + items.join("") + "</ul>" +
        (left === 0 && !reviewAsked ? '<div class="hub-actions"><a class="btn go" href="https://adsense.google.com/adsense/u/0/pub-3242839684084183/sites/list" target="_blank" rel="noopener">Open AdSense ↗</a> <button class="btn small" data-flag="review_requested">I pressed Request review</button></div>' : "") + "</section>" +

      '<section class="hub-card"><h2>Notes from readers' + (s.unread ? ' <span class="hub-badge">' + num(s.unread) + " new</span>" : "") + "</h2>" +
        (msgs.length ? '<ul class="hub-msgs">' + msgs.map((m) => '<li class="' + (m.is_read ? "read" : "new") + '"><div class="hub-msg-head"><strong>' + esc(m.name) + '</strong><a href="mailto:' + esc(m.email) + "?subject=" + encodeURIComponent("Your note to SmartSelect Labs") + '">' + esc(m.email) + "</a><time>" + esc(new Date(m.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })) + '</time></div><p>' + esc(m.message).replace(/\n/g, "<br>") + '</p><div class="hub-actions"><a class="btn small" href="mailto:' + esc(m.email) + "?subject=" + encodeURIComponent("Your note to SmartSelect Labs") + '">Reply by email</a> <button class="btn small ghost" data-read="' + m.id + '" data-to="' + (m.is_read ? "0" : "1") + '">' + (m.is_read ? "Mark as new" : "Mark as read") + "</button></div></li>").join("") + "</ul>"
          : '<p class="hub-empty">No notes yet. When a reader uses the form on the Contact page, the note shows up here.</p>') + "</section>" +

      '<p class="hub-foot">Site last rebuilt ' + esc(new Date(site.built).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + '. <button class="link-btn" data-refresh>Refresh the numbers</button></p></main>';

    $app.querySelectorAll("[data-flag]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const { error } = await sb.rpc("hub_set_flag", { p_key: b.dataset.flag, p_value: { done: true } });
      if (error) { b.disabled = false; alert("That did not save. Please try again."); return; }
      load();
    }));
    $app.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      await sb.rpc("hub_mark_read", { p_id: Number(b.dataset.read), p_read: b.dataset.to === "1" });
      load();
    }));
    const r = $app.querySelector("[data-refresh]"); if (r) r.addEventListener("click", load);
  }

  let who = "";
  async function load() {
    const [{ data: stats, error }, site] = await Promise.all([
      sb.rpc("hub_stats"),
      fetch("/hub-data.json?t=" + Date.now()).then((r) => r.json()).catch(() => ({ posts: [], scheduled: [], built: new Date().toISOString() })),
    ]);
    if (error || !stats) {
      $app.innerHTML = bar(who) + '<main class="wrap hub"><section class="hub-card"><h2>The numbers did not load</h2><p>Please refresh the page. If it keeps happening, tell Lewis.</p></section></main>';
      return;
    }
    render(who, stats, site);
  }

  async function boot() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return signedOut();
    const email = (data.session.user.email || "").toLowerCase();
    const { data: ed } = await sb.from("editors").select("name,email");
    const me = (ed || []).find((e) => (e.email || "").toLowerCase() === email);
    if (!me) return signedOut();
    who = me.name || "";
    load();
  }
  boot();
})();
