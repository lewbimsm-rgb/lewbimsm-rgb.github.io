/* SmartSelect Labs writing desk - smartselectlabs.com/admin
   Data: Supabase project smartselectlabs-desk (tables templates, posts; bucket desk-images; edge functions desk-publish, desk-photos).
   Screens: sign in -> My posts (#/) -> pick a template (#/new) -> write (#/post/<id>) -> Templates (#/templates, #/template/<key>).
   Autosaves; "Save now" forces it; Publish sends the post to the site.
   2026-10-21: picture sizes + captions, heading sizes, main-picture size, photo library (your photos, site photos,
   free licensed photos), editable templates ("Save as template", duplicate, edit boxes and hints). */
(function () {
  "use strict";
  const CFG = window.DESK_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const $app = document.getElementById("app");
  const SITE = CFG.site || "";
  const state = { user: null, name: "", templates: [], posts: [], tab: "drafts", q: "", post: null, dirty: false, saving: false, saveTimer: null, lastSaved: null, saveError: false,
    tpl: null, tplDirty: false, library: { mine: null, site: null } };

  // ------------------------------------------------------------ helpers
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tplOf = (key) => state.templates.find((t) => t.key === key) || { label: "Post", emoji: "📝", color: "white" };
  const imgSrc = (u) => (u && u.startsWith("/") ? SITE + u : u || "");
  function ago(iso) {
    if (!iso) return "";
    const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " hr ago";
    if (s < 172800) return "yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  }
  const niceDate = (iso) => (iso ? new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "");
  const changedSincePublish = (p) => p.status === "published" && p.last_published_at && new Date(p.updated_at) - new Date(p.last_published_at) > 3000;
  function statusPill(p) {
    if (p.status === "trash") return '<span class="pill trash">In the trash</span>';
    if (p.status === "published") return changedSincePublish(p) ? '<span class="pill changed">● Live · new edits not published</span>' : '<span class="pill live">● Live on the site</span>';
    return '<span class="pill draft">Draft</span>';
  }
  function toast(msg, ms) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  function dialog(html) {
    const v = document.createElement("div"); v.className = "veil"; v.innerHTML = '<div class="dialog">' + html + "</div>";
    document.body.appendChild(v);
    v.addEventListener("click", (e) => { if (e.target === v || e.target.closest("[data-close]")) v.remove(); });
    return v;
  }
  function autosize(el) { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight + 2, 70) + "px"; }
  const route = () => (location.hash || "#/").slice(1);
  const slugify = (t) => String(t || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // ------------------------------------------------------------ top bar
  function bar() {
    return '<header class="bar"><div class="bar-in">' +
      '<a class="brand" href="#/"><img src="' + esc(CFG.logo) + '" alt="SmartSelect Labs"><span>Writing desk</span></a><div class="spacer"></div>' +
      (state.user ? '<span class="who">Hi, ' + esc(state.name || state.user.email) + '</span><a class="link-btn" href="#/templates">Templates</a><a class="link-btn" href="' + esc(SITE + "/") + '" target="_blank" rel="noopener">View site ↗</a><button class="link-btn" data-act="help">Help</button><button class="link-btn" data-act="signout">Sign out</button>' : "") +
      "</div></header>";
  }

  // ------------------------------------------------------------ sign in
  function viewSignIn(msg) {
    $app.innerHTML = bar() + '<main class="signin"><form class="signin-card" id="signin">' +
      "<h1>Welcome back</h1><p>Sign in to write and publish posts on SmartSelect Labs.</p>" +
      '<div class="field"><label for="em">Email</label><input class="input" id="em" type="email" autocomplete="username" required></div>' +
      '<div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>' +
      '<div class="err" id="err">' + esc(msg || "") + "</div>" +
      '<button class="btn primary big" style="width:100%" type="submit">Sign in</button>' +
      '<p class="hint" style="margin-top:16px">You stay signed in on this device. Forgot your password? Ask Lewis.</p></form></main>';
    document.getElementById("signin").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Signing in…";
      const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("em").value.trim(), password: document.getElementById("pw").value });
      if (error) { btn.disabled = false; btn.textContent = "Sign in"; document.getElementById("err").textContent = "That email and password didn't match. Try again, or ask Lewis."; return; }
      await boot();
    });
  }

  // ------------------------------------------------------------ data
  async function loadTemplates() {
    const { data } = await sb.from("templates").select("*").order("sort");
    state.templates = data || [];
  }
  async function loadPosts() {
    const { data, error } = await sb.from("posts").select("id,title,template,status,source,cover_url,updated_at,last_published_at,slug,created_at,post_date").order("updated_at", { ascending: false });
    if (error) throw error;
    state.posts = data || [];
  }

  // ------------------------------------------------------------ home
  const TABS = [
    ["drafts", "Drafts", (p) => p.status === "draft" && p.source !== "hostinger"],
    ["live", "Live on the site", (p) => p.status === "published"],
    ["old", "Old posts to rewrite", (p) => p.status === "draft" && p.source === "hostinger"],
    ["trash", "Trash", (p) => p.status === "trash"],
  ];
  async function viewHome() {
    $app.innerHTML = bar() + '<main class="wrap"><p class="hint">Loading your posts…</p></main>';
    await loadPosts();
    const counts = Object.fromEntries(TABS.map(([k, , f]) => [k, state.posts.filter(f).length]));
    const f = TABS.find((t) => t[0] === state.tab)[2];
    const q = state.q.toLowerCase();
    const list = state.posts.filter(f).filter((p) => !q || (p.title || "").toLowerCase().includes(q));
    const cards = list.map((p) => {
      const t = tplOf(p.template);
      const thumb = p.cover_url ? '<img src="' + esc(imgSrc(p.cover_url)) + '" alt="" loading="lazy">' : esc(t.emoji);
      return '<article class="card" data-open="' + p.id + '"><div class="thumb c-' + esc(t.color) + '">' + thumb + "</div>" +
        '<div class="card-body"><div class="card-title' + (p.title ? "" : " untitled") + '">' + esc(p.title || "Untitled draft") + "</div>" +
        '<div class="meta">' + statusPill(p) + '<span class="chip">' + esc(t.label) + "</span></div>" +
        '<div class="meta">' + (p.status === "published" ? "Posted " + esc(niceDate(p.post_date)) + " · " : "") + "Edited " + esc(ago(p.updated_at)) + "</div>" +
        '<div class="card-actions"><button class="btn small primary" data-open="' + p.id + '">' + (p.status === "trash" ? "Open" : "Continue writing") + "</button>" +
        (p.status === "published" && p.slug ? '<a class="btn small" href="' + esc(SITE + "/" + p.slug + "/") + '" target="_blank" rel="noopener" data-stop>View on site ↗</a>' : "") +
        "</div></div></article>";
    }).join("");
    const emptyMsg = { drafts: "No drafts yet. Press “Write a new post” to start one.", live: "Nothing published yet.", old: "No old posts left to rewrite.", trash: "The trash is empty." }[state.tab];
    $app.innerHTML = bar() + '<main class="wrap">' +
      '<div class="home-head"><div><h1>My posts</h1><p>Everything you have written, saved automatically. Pick up any draft where you left off.</p></div>' +
      '<button class="btn lime big" data-act="new">＋ Write a new post</button></div>' +
      '<div class="tabs">' + TABS.map(([k, label]) => '<button class="tab' + (state.tab === k ? " on" : "") + '" data-tab="' + k + '">' + esc(label) + '<span class="n">' + counts[k] + "</span></button>").join("") + "</div>" +
      '<div class="search"><input class="input" id="q" type="search" placeholder="Find a post by its title" value="' + esc(state.q) + '"></div>' +
      (list.length ? '<div class="grid">' + cards + "</div>" : '<div class="empty">' + esc(emptyMsg) + "</div>") + "</main>";
    const qi = document.getElementById("q");
    qi.addEventListener("input", () => { state.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { viewHome().then(() => { const n = document.getElementById("q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 250); });
  }

  // ------------------------------------------------------------ new post: template gallery
  function tplCard(t, extraHtml) {
    return '<button class="tcard c-' + esc(t.color) + '" data-tpl="' + esc(t.key) + '"><span class="emoji">' + esc(t.emoji) + "</span><h3>" + esc(t.label) + (t.custom ? ' <span class="chip">yours</span>' : "") + "</h3><p>" + esc(t.description) + "</p>" +
      (extraHtml || (t.example_url ? '<a class="ex" href="' + esc(SITE + t.example_url) + '" target="_blank" rel="noopener" data-stop>See a finished example ↗</a>' : '<span class="ex">&nbsp;</span>')) + "</button>";
  }
  function viewNew() {
    $app.innerHTML = bar() + '<main class="wrap"><a class="link-btn" href="#/">← My posts</a>' +
      '<div class="home-head" style="margin-top:10px"><div><h1>What kind of post?</h1><p>Pick a template. Each one opens with an outline and grey hints in every box, so you only fill in your words.</p></div><a class="btn" href="#/templates">Edit the templates</a></div>' +
      '<div class="tgrid">' + state.templates.map((t) => tplCard(t)).join("") + "</div></main>";
  }
  async function createFromTemplate(key) {
    const t = tplOf(key);
    const { data, error } = await sb.from("posts").insert({ template: key, category: t.category, affiliate: t.affiliate, blocks: t.blocks, title: "" }).select("id").single();
    if (error) { toast("Couldn't start the post. Check the internet and try again."); return; }
    location.hash = "#/post/" + data.id;
  }

  // ------------------------------------------------------------ editor: block forms (shared by posts and templates)
  const BLOCK_NAMES = { text: "Section", quick: "Short answer box", picks: "Your top picks", compare: "Comparison table", specs: "Measurements", buyif: "Who should buy / skip", cta: "Button to a store", faq: "Questions & answers", verdict: "Your verdict", tip: "Tip box", image: "Picture", product: "Product box (special)", raw: "Special box" };
  const ADD_MENU = [
    ["text", "Section", "A heading and paragraphs"], ["image", "Picture", "A photo, with size and caption"], ["picks", "Top picks", "2-4 labelled picks with links"], ["compare", "Comparison table", "Products side by side"],
    ["buyif", "Buy / skip", "Who should buy it, who should skip"], ["cta", "Store button", "A big button to a product"], ["faq", "Questions", "Q&A people ask you"],
    ["verdict", "Verdict", "Your final word (with stars)"], ["quick", "Short answer", "The quick takeaway box"], ["tip", "Tip box", "A highlighted tip"],
    ["specs", "Measurements", "What you measured yourself"],
  ];
  const SIZES = [["full", "Full width"], ["medium", "Medium (centered)"], ["small", "Small (centered)"], ["left", "Small, text wraps on the right"], ["right", "Small, text wraps on the left"]];
  function newBlock(type) {
    return {
      text: { type, heading: "", level: 2, text: "", hint: "" }, quick: { type, text: "", hint: "" },
      picks: { type, items: [{ label: "Best overall", product: "", why: "", url: "", store: "" }], hint: "" },
      compare: { type, headers: ["Product", "Best for", "Amazon"], rows: [["", "", ""], ["", "", ""]], hint: "Last column: paste a store link for each row; it becomes a button." },
      specs: { type, title: "As measured", items: [{ name: "", value: "" }], hint: "" }, buyif: { type, buy: "", pass: "", hint: "One reason per line." },
      cta: { type, text: "See it on Amazon", url: "", store: "Amazon", note: "", hint: "" }, faq: { type, items: [{ q: "", a: "" }], hint: "" },
      verdict: { type, rating: "", heading: "Our verdict", text: "", hint: "" }, tip: { type, label: "SmartSelect Tip", text: "", hint: "" }, image: { type, url: "", alt: "", size: "full", caption: "", hint: "" },
    }[type];
  }
  const inp = (attrs, val, ph, cls) => '<input class="input ' + (cls || "") + '" ' + attrs + ' value="' + esc(val) + '" placeholder="' + esc(ph || "") + '">';
  const area = (attrs, val, ph) => '<textarea class="textarea" ' + attrs + ' placeholder="' + esc(ph || "") + '">' + esc(val) + "</textarea>";
  const sel = (attrs, options, val) => '<select class="select" ' + attrs + ">" + options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(val == null ? "" : val) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>").join("") + "</select>";
  // tplMode: editing a template; the grey hint becomes an editable field and empty content is expected
  function blockForm(b, i, tplMode) {
    const B = 'data-b="' + i + '"';
    const hint = tplMode ? '<label class="lbl" style="margin-top:6px">Grey hint shown to the writer</label>' + inp(B + ' data-k="hint"', b.hint, "e.g. Who this post is for, in two sentences") : (b.hint ? '<p class="hint">' + esc(b.hint) + "</p>" : "");
    let body = "";
    switch (b.type) {
      case "text":
        body = '<div class="h-row"><input class="h-input" ' + B + ' data-k="heading" value="' + esc(b.heading) + '" placeholder="Section heading (optional)">' +
          sel(B + ' data-k="level"', [["2", "Big heading"], ["3", "Smaller heading"]], b.level || 2) + "</div>" + hint +
          '<div class="mini-tools"><button type="button" data-fmt="bold" ' + B + "><b>B</b> Bold</button><button type=\"button\" data-fmt=\"link\" " + B + '>🔗 Link</button><button type="button" data-fmt="list" ' + B + ">• List</button></div>" +
          area(B + ' data-k="text"', b.text, "Write here. Leave a blank line between paragraphs.");
        break;
      case "quick": body = hint + area(B + ' data-k="text"', b.text, "The short answer, in one or two sentences."); break;
      case "picks":
        body = hint + '<div class="items">' + (b.items || []).map((it, j) => {
          const I = B + ' data-list="items" data-i="' + j + '"';
          return '<div class="item"><button class="icon-btn x" data-rm-item="' + j + '" ' + B + ' title="Remove">✕</button><div class="item-grid">' +
            inp(I + ' data-k="label"', it.label, "Label, e.g. Best overall") + inp(I + ' data-k="product"', it.product, "Product name") + "</div>" +
            inp(I + ' data-k="why"', it.why, "One line on why") + '<div class="item-grid">' + inp(I + ' data-k="url"', it.url, "Link (https://…)") + inp(I + ' data-k="store"', it.store, "Store name, e.g. Amazon") + "</div></div>";
        }).join("") + '</div><div class="add-row"><button class="btn small" data-add-item ' + B + ">＋ Add a pick</button></div>";
        break;
      case "compare": {
        const heads = b.headers || [], rows = b.rows || [];
        body = hint + '<div class="cmp"><table><thead><tr>' + heads.map((h, c) => '<th><input class="input" ' + B + ' data-hcol="' + c + '" value="' + esc(h) + '" placeholder="Column"></th>').join("") + "<th></th></tr></thead><tbody>" +
          rows.map((r, ri) => "<tr>" + heads.map((_, c) => '<td><input class="input" ' + B + ' data-row="' + ri + '" data-col="' + c + '" value="' + esc(r[c] || "") + '"></td>').join("") +
            '<td><button class="icon-btn" data-rm-row="' + ri + '" ' + B + ' title="Remove row">✕</button></td></tr>').join("") + "</tbody></table></div>" +
          '<div class="add-row"><button class="btn small" data-add-row ' + B + '>＋ Add a row</button><button class="btn small" data-add-col ' + B + '>＋ Add a column</button>' +
          (heads.length > 2 ? '<button class="btn small ghost" data-rm-col ' + B + ">Remove a column</button>" : "") + "</div>";
        break;
      }
      case "specs":
        body = hint + inp(B + ' data-k="title"', b.title, "Box title, e.g. As measured") + '<div class="items" style="margin-top:8px">' + (b.items || []).map((it, j) => {
          const I = B + ' data-list="items" data-i="' + j + '"';
          return '<div class="item"><button class="icon-btn x" data-rm-item="' + j + '" ' + B + ' title="Remove">✕</button><div class="item-grid">' + inp(I + ' data-k="name"', it.name, "What, e.g. Weight on my kitchen scale") + inp(I + ' data-k="value"', it.value, "Value, e.g. 7.9 oz") + "</div></div>";
        }).join("") + '</div><div class="add-row"><button class="btn small" data-add-item ' + B + ">＋ Add a line</button></div>";
        break;
      case "buyif":
        body = hint + '<div class="row2"><div><span class="lbl">Buy it if… (one per line)</span>' + area(B + ' data-k="buy"', b.buy, "you have sore elbows\nyou want control more than power") +
          '</div><div><span class="lbl">Skip it if… (one per line)</span>' + area(B + ' data-k="pass"', b.pass, "you already hit hard\nyou only play indoors") + "</div></div>";
        break;
      case "cta":
        body = hint + '<div class="item-grid">' + inp(B + ' data-k="text"', b.text, "Button words, e.g. See it on Amazon") + inp(B + ' data-k="store"', b.store, "Store name") + "</div>" +
          '<div style="margin-top:8px">' + inp(B + ' data-k="url"', b.url, "Link (https://…)") + '</div><div style="margin-top:8px">' + inp(B + ' data-k="note"', b.note, "Small note under the button (optional)") + "</div>";
        break;
      case "faq":
        body = hint + '<div class="items">' + (b.items || []).map((it, j) => {
          const I = B + ' data-list="items" data-i="' + j + '"';
          return '<div class="item"><button class="icon-btn x" data-rm-item="' + j + '" ' + B + ' title="Remove">✕</button>' + inp(I + ' data-k="q"', it.q, "The question people ask") + area(I + ' data-k="a"', it.a, "Your short answer") + "</div>";
        }).join("") + '</div><div class="add-row"><button class="btn small" data-add-item ' + B + ">＋ Add a question</button></div>";
        break;
      case "verdict":
        body = hint + '<div class="item-grid">' + sel(B + ' data-k="rating"', [["", "No stars"], ["5", "★★★★★ 5"], ["4.5", "★★★★½ 4.5"], ["4", "★★★★ 4"], ["3.5", "★★★½ 3.5"], ["3", "★★★ 3"], ["2", "★★ 2"], ["1", "★ 1"]], b.rating || "") +
          inp(B + ' data-k="heading"', b.heading, "Heading, e.g. Our verdict") + "</div>" +
          '<div style="margin-top:8px">' + area(B + ' data-k="text"', b.text, "Two or three sentences: what to buy, and for whom.") + "</div>";
        break;
      case "tip": body = hint + inp(B + ' data-k="label"', b.label, "Label, e.g. SmartSelect Tip") + '<div style="margin-top:8px">' + area(B + ' data-k="text"', b.text, "The tip") + "</div>"; break;
      case "image":
        body = hint + '<div class="photo"><div class="photo-box' + (b.size && b.size !== "full" ? " is-" + esc(b.size) : "") + '">' + (b.url ? '<img src="' + esc(imgSrc(b.url)) + '" alt="">' : "No picture yet") + "</div>" +
          '<div class="photo-side"><div class="photo-btns"><button type="button" class="btn small primary" data-lib-block="' + i + '">Choose a photo</button><label class="btn small">' + (b.url ? "Upload a different one" : "Upload from this device") + '<input type="file" accept="image/*" class="hidden" data-upload-block="' + i + '"></label>' +
          (b.url ? '<button type="button" class="btn small ghost" data-rm-img="' + i + '">Remove</button>' : "") + "</div>" +
          '<label class="lbl">Size on the page</label>' + sel(B + ' data-k="size"', SIZES, b.size || "full") +
          '<label class="lbl">Caption (optional)</label>' + inp(B + ' data-k="caption"', b.caption, "A line under the picture") +
          '<label class="lbl">What is in the picture?</label>' + inp(B + ' data-k="alt"', b.alt, "A few words, for people who cannot see it") + "</div></div>";
        break;
      default:
        body = '<p class="hint">A special box from an earlier post. You can leave it as it is.</p>' + area(B + ' data-k="' + (b.type === "product" ? "line" : "text") + '"', b.type === "product" ? b.line : b.text, "");
    }
    return '<section class="blk k-' + esc(b.type) + '"><div class="blk-head"><span class="blk-name">' + esc(BLOCK_NAMES[b.type] || "Box") + "</span>" +
      '<button class="icon-btn" data-up="' + i + '" title="Move up">↑</button><button class="icon-btn" data-down="' + i + '" title="Move down">↓</button><button class="icon-btn" data-del="' + i + '" title="Remove this box">✕</button></div>' + body + "</section>";
  }
  const addMenuHtml = () => '<div class="panel"><h3>Add a box</h3><div class="add-menu">' + ADD_MENU.map(([k, l, d]) => '<button data-addblock="' + k + '">' + esc(l) + "<small>" + esc(d) + "</small></button>").join("") + "</div></div>";

  function wordCount(p) {
    const parts = [p.title, p.summary];
    (p.blocks || []).forEach((b) => { parts.push(b.heading, b.text, b.buy, b.pass, b.caption); (b.items || []).forEach((it) => parts.push(it.why, it.q, it.a)); });
    return parts.join(" ").split(/\s+/).filter((w) => /\w/.test(w)).length;
  }
  // the object whose blocks the open screen edits (a post, or a template)
  const doc = () => state.tpl || state.post;

  // ------------------------------------------------------------ editor: view
  async function viewEditor(id) {
    $app.innerHTML = bar() + '<main class="wrap"><p class="hint">Opening your post…</p></main>';
    const { data, error } = await sb.from("posts").select("*").eq("id", id).single();
    if (error || !data) { $app.innerHTML = bar() + '<main class="wrap"><div class="empty">This post could not be found. <a href="#/">Back to My posts</a></div></main>'; return; }
    data.extra = data.extra || {};
    state.post = data; state.tpl = null; state.dirty = false; state.saveError = false; state.lastSaved = data.updated_at;
    renderEditor();
  }
  function publishLabel(p) {
    if (p.status === "trash") return "";
    if (p.status === "published") return changedSincePublish(p) ? '<button class="btn go" data-act="publish">Update the live post</button>' : '<button class="btn" disabled>✓ Live on the site</button>';
    return '<button class="btn go" data-act="publish">Publish</button>';
  }
  function renderEditor() {
    const p = state.post, t = tplOf(p.template);
    const cats = ["Beginner Guides", "Gear Reviews", "Health & Recovery"];
    const coverSize = (p.extra && p.extra.image_size) || "full";
    $app.innerHTML = bar() +
      '<div class="ed-bar"><div class="ed-bar-in"><a class="link-btn" href="#/">← My posts</a><span id="pill">' + statusPill(p) + '</span><span class="saved" id="saved"></span><button class="btn small" data-act="savenow" id="savenow">Save now</button><div style="flex:1"></div>' +
      '<button class="btn" data-act="preview">Preview</button><span id="pubwrap">' + publishLabel(p) + "</span>" +
      '<div class="rel"><button class="btn ghost" data-act="more" title="More">⋯</button><div class="menu hidden" id="more">' +
      (p.status === "published" && p.slug ? '<button data-act="viewlive">Open the live page ↗</button><button data-act="unpublish">Take it off the website</button>' : "") +
      '<button data-act="astemplate">Save as a template…</button>' +
      (p.status === "trash" ? '<button data-act="restore">Restore from the trash</button>' : '<button data-act="trash">Move to the trash</button>') + "</div></div></div></div>" +
      '<main class="ed"><p class="hint" style="margin:0 0 6px"><span class="chip">' + esc(t.emoji + " " + t.label) + '</span> &nbsp;<span class="words" id="words"></span></p>' +
      '<input class="title-input" data-f="title" value="' + esc(p.title) + '" placeholder="Your headline, e.g. Best Pickleball Shoes for Women">' +
      '<section class="panel"><h3>Main picture</h3><p class="hint">Shows at the top of the post and on the home page. Your own photo is best, wider than tall.</p><div class="photo"><div class="photo-box" id="cover">' +
      (p.cover_url ? '<img src="' + esc(imgSrc(p.cover_url)) + '" alt="">' : "No picture yet.<br>If you skip it, the site uses a court photo.") + "</div>" +
      '<div class="photo-side"><div class="photo-btns"><button type="button" class="btn small primary" data-act="libcover">Choose a photo</button><label class="btn small">' + (p.cover_url ? "Upload a different one" : "Upload from this device") + '<input type="file" accept="image/*" class="hidden" id="coverfile"></label>' +
      (p.cover_url ? '<button class="btn small ghost" data-act="rmcover">Remove</button>' : "") + "</div>" +
      '<label class="lbl">Size at the top of the post</label>' + sel('data-x="image_size"', [["full", "Big banner (default)"], ["smaller", "Smaller banner"], ["none", "Do not show it on the post (cards only)"]], coverSize) +
      '<label class="lbl">What is in the picture?</label>' + inp('data-f="cover_alt"', p.cover_alt, "Describe the picture in a few words") +
      (p.extra && p.extra.image_credit ? '<p class="hint">Credit line (shown under the picture): ' + esc(p.extra.image_credit) + "</p>" : "") + "</div></div></section>" +
      '<section class="panel"><h3>Short summary <span class="hint">(optional)</span></h3><p class="hint">One or two sentences. Shows under the title and in Google. If you skip it, the site uses your first paragraph.</p>' +
      area('data-f="summary"', p.summary, "e.g. Court shoes that protect your ankles and knees, from Nike, ASICS and New Balance.") +
      '<div class="row3" style="margin-top:12px"><div><span class="lbl">Section of the site</span><select class="select" data-f="category">' + cats.map((c) => '<option' + (p.category === c ? " selected" : "") + ">" + c + "</option>").join("") + "</select></div>" +
      '<div><span class="lbl">Post date</span><input class="input" type="date" data-f="post_date" value="' + esc((p.post_date || "").slice(0, 10)) + '"></div>' +
      '<div style="display:flex;align-items:flex-end"><label class="check"><input type="checkbox" data-f="affiliate"' + (p.affiliate ? " checked" : "") + "> This post has shopping links</label></div></div></section>" +
      '<div class="blocks-title"><h2>Your post</h2><span class="hint">Fill in the boxes. Empty boxes are left out when you publish.</span></div>' +
      '<div id="blocks">' + (p.blocks || []).map((b, i) => blockForm(b, i, false)).join("") + "</div>" + addMenuHtml() +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><button class="btn" data-act="preview">Preview</button>' + publishLabel(p) + "</div></main>";
    document.querySelectorAll(".textarea").forEach(autosize);
    updateSaved(); updateWords();
    document.getElementById("coverfile").addEventListener("change", (e) => uploadPicture(e.target.files[0], (url) => { state.post.cover_url = url; delete state.post.extra.image_credit; markDirty(true); renderEditor(); }));
    bindBlockUploads();
  }
  function bindBlockUploads() {
    document.querySelectorAll("[data-upload-block]").forEach((el) => el.addEventListener("change", (e) => {
      const i = +el.dataset.uploadBlock; uploadPicture(e.target.files[0], (url) => { doc().blocks[i].url = url; markDirty(true); rerender(); });
    }));
  }
  const rerender = () => (state.tpl ? renderTemplateEditor() : renderEditor());
  function updateWords() { const w = document.getElementById("words"); if (w && state.post) w.textContent = wordCount(state.post) + " words"; }
  function updateSaved() {
    const el = document.getElementById("saved"); if (!el) return;
    el.classList.toggle("bad", state.saveError);
    el.textContent = state.saveError ? "Not saved yet. Check the internet; retrying…" : state.saving ? "Saving…" : state.dirty ? "Editing…" : "All changes saved ✓ " + ago(state.lastSaved);
    const sn = document.getElementById("savenow"); if (sn) sn.disabled = !state.dirty && !state.saveError;
  }
  setInterval(updateSaved, 30000);

  // ------------------------------------------------------------ editor: saving (posts and templates)
  function markDirty(now) {
    if (state.tpl) { state.tplDirty = true; const el = document.getElementById("saved"); if (el) el.textContent = "Not saved yet"; return; }
    state.dirty = true; updateSaved(); updateWords();
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(save, now ? 50 : 1200);
  }
  async function save() {
    if (!state.post || state.saving) { if (state.dirty) { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(save, 800); } return; }
    if (!state.dirty) return;
    state.saving = true; state.dirty = false; updateSaved();
    const p = state.post;
    const patch = { title: p.title, summary: p.summary, cover_url: p.cover_url, cover_alt: p.cover_alt, category: p.category, affiliate: p.affiliate, keyphrase: p.keyphrase, blocks: p.blocks, extra: p.extra || {}, post_date: (p.post_date || "").slice(0, 10) || null };
    const { data, error } = await sb.from("posts").update(patch).eq("id", p.id).select("updated_at,status,last_published_at").single();
    state.saving = false;
    if (error) { state.saveError = true; state.dirty = true; updateSaved(); clearTimeout(state.saveTimer); state.saveTimer = setTimeout(save, 4000); return; }
    state.saveError = false; state.lastSaved = data.updated_at;
    Object.assign(state.post, data);
    const pill = document.getElementById("pill"); if (pill) pill.innerHTML = statusPill(state.post);
    const pw = document.getElementById("pubwrap"); if (pw) pw.innerHTML = publishLabel(state.post);
    updateSaved();
    if (state.dirty) { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(save, 600); }
  }
  async function flush() { clearTimeout(state.saveTimer); if (state.dirty || state.saving) { while (state.saving) await new Promise((r) => setTimeout(r, 150)); await save(); } }
  window.addEventListener("beforeunload", (e) => { if (state.dirty || state.saving || state.tplDirty) { save(); e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && state.dirty) save(); });

  // ------------------------------------------------------------ pictures: upload + library
  async function shrinkToJpeg(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    } catch (_) { return file; } /* browser could not resize (e.g. HEIC on a PC): upload the original */
  }
  async function uploadPicture(file, done) {
    if (!file) return;
    toast("Adding your picture…", 4000);
    try {
      const blob = await shrinkToJpeg(file);
      const base = (file.name || "photo").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "photo";
      const path = (state.post ? state.post.id : "library") + "/" + Date.now() + "-" + base + ".jpg";
      const { error } = await sb.storage.from("desk-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      state.library.mine = null;
      done(sb.storage.from("desk-images").getPublicUrl(path).data.publicUrl);
      toast("Picture added ✓");
    } catch (e) { toast("Couldn't add the picture. Try a different photo, or try again."); }
  }
  async function loadMine() {
    if (state.library.mine) return state.library.mine;
    const out = [];
    const { data: top } = await sb.storage.from("desk-images").list("", { limit: 200 });
    const folders = (top || []).filter((x) => !x.id).map((x) => x.name);
    const files = (top || []).filter((x) => x.id).map((x) => ({ path: x.name, created: x.created_at }));
    await Promise.all(folders.map(async (f) => { const { data } = await sb.storage.from("desk-images").list(f, { limit: 200 }); (data || []).filter((x) => x.id).forEach((x) => files.push({ path: f + "/" + x.name, created: x.created_at })); }));
    files.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
    state.library.mine = files.map((f) => ({ url: sb.storage.from("desk-images").getPublicUrl(f.path).data.publicUrl, title: f.path.split("/").pop().replace(/^\d+-/, "").replace(/\.[a-z]+$/, "").replace(/-/g, " "), credit: "" }));
    return state.library.mine;
  }
  async function loadSitePhotos() {
    if (state.library.site) return state.library.site;
    try { const r = await fetch(SITE + "/photos.json", { cache: "no-store" }); state.library.site = (await r.json()).map((x) => ({ url: SITE + x.url, title: x.title, credit: x.credit || "", alt: x.alt || "" })); }
    catch (_) { state.library.site = []; }
    return state.library.site;
  }
  const tile = (ph, extra) => '<button type="button" class="ptile" data-pick="' + esc(ph.url) + '" data-credit="' + esc(ph.credit || "") + '" data-title="' + esc(ph.title || "") + '" data-alt="' + esc(ph.alt || "") + '"' + (extra || "") + '><img src="' + esc(ph.thumb || ph.url) + '" alt="" loading="lazy"><span>' + esc(ph.title || "") + (ph.license ? " · " + esc(ph.license) : "") + "</span></button>";
  // onPick({url, credit, alt})
  function openLibrary(onPick) {
    const v = document.createElement("div"); v.className = "veil";
    v.innerHTML = '<div class="dialog lib"><div class="lib-head"><h2>Choose a photo</h2><button class="icon-btn" data-close title="Close">✕</button></div>' +
      '<div class="tabs"><button class="tab on" data-ltab="mine">Your photos</button><button class="tab" data-ltab="site">Site photos</button><button class="tab" data-ltab="find">Find a free photo</button></div>' +
      '<div id="lib-body"><p class="hint">Loading…</p></div></div>';
    document.body.appendChild(v);
    let tab = "mine", page = 1, q = "pickleball";
    async function show() {
      const body = v.querySelector("#lib-body");
      v.querySelectorAll("[data-ltab]").forEach((b) => b.classList.toggle("on", b.dataset.ltab === tab));
      if (tab === "find") {
        body.innerHTML = '<form class="lib-search" id="libsearch"><input class="input" id="libq" value="' + esc(q) + '" placeholder="e.g. pickleball court, paddle, sunscreen"><button class="btn primary">Search</button></form>' +
          '<p class="hint">Free photos you may use on the site (public domain, CC0 and CC BY). A credit line is added automatically when the licence asks for one.</p><div class="pgrid" id="libres"><p class="hint">Searching…</p></div>';
        body.querySelector("#libsearch").addEventListener("submit", (e) => { e.preventDefault(); q = body.querySelector("#libq").value.trim() || "pickleball"; page = 1; runSearch(); });
        runSearch();
        return;
      }
      const list = tab === "mine" ? await loadMine() : await loadSitePhotos();
      body.innerHTML = list.length ? '<div class="pgrid">' + list.map((ph) => tile(ph)).join("") + "</div>" : '<div class="empty">' + (tab === "mine" ? "No uploads yet. Use “Upload from this device”, or find a free photo." : "No site photos found.") + "</div>";
    }
    async function runSearch() {
      const res = v.querySelector("#libres"); if (!res) return;
      res.innerHTML = '<p class="hint">Searching…</p>';
      const { data, error } = await sb.functions.invoke("desk-photos", { body: { action: "search", q, page } });
      if (error || !data || data.error) { res.innerHTML = '<div class="empty">The photo search is not answering right now. Try again in a minute, or upload your own photo.</div>'; return; }
      if (!data.results.length) { res.innerHTML = '<div class="empty">Nothing found for “' + esc(q) + "”. Try another word.</div>"; return; }
      res.innerHTML = data.results.map((ph) => tile(ph, ' data-import=\'' + esc(JSON.stringify(ph)) + "'")).join("") +
        '<div class="lib-more"><button type="button" class="btn small" id="libmore">More photos</button></div>';
      res.querySelector("#libmore").addEventListener("click", () => { page += 1; runSearch(); });
    }
    v.addEventListener("click", async (e) => {
      if (e.target === v || e.target.closest("[data-close]")) { v.remove(); return; }
      const lt = e.target.closest("[data-ltab]"); if (lt) { tab = lt.dataset.ltab; show(); return; }
      const t = e.target.closest("[data-pick]"); if (!t) return;
      if (t.dataset.import) {
        const ph = JSON.parse(t.dataset.import);
        t.classList.add("busy"); toast("Saving that photo to your library…", 5000);
        const { data, error } = await sb.functions.invoke("desk-photos", { body: { action: "import", url: ph.url, title: ph.title, creator: ph.creator, license: ph.license, license_url: ph.license_url, source: ph.source, page_url: ph.page_url, needs_credit: ph.needs_credit, post_id: state.post ? state.post.id : "library" } });
        if (error || !data || data.error) { t.classList.remove("busy"); toast("Couldn't save that photo. Try another one."); return; }
        state.library.mine = null;
        v.remove(); onPick({ url: data.url, credit: data.credit || "", alt: ph.title || "" }); return;
      }
      v.remove(); onPick({ url: t.dataset.pick, credit: t.dataset.credit || "", alt: t.dataset.alt || t.dataset.title || "" });
    });
    show();
  }

  // ------------------------------------------------------------ preview (rendered like the site, in an isolated frame)
  function md(s) { return window.marked ? window.marked.parse(String(s || ""), { breaks: false }) : "<p>" + esc(s) + "</p>"; }
  const btnCls = (store) => (/amazon/i.test(store || "") ? "ss-btn-amazon" : "ss-btn-store");
  function previewBlock(b) {
    const S = (x) => String(x || "").trim();
    switch (b.type) {
      case "text": return (S(b.heading) ? (b.level == 3 ? "<h3>" : "<h2>") + esc(b.heading) + (b.level == 3 ? "</h3>" : "</h2>") : "") + (S(b.text) ? md(b.text) : "");
      case "quick": return S(b.text) ? '<aside class="ss-quick"><span class="ss-kicker">Quick answer</span>' + md(b.text) + "</aside>" : "";
      case "picks": { const it = (b.items || []).filter((i) => S(i.product)); return it.length ? '<section class="ss-picks"><span class="ss-kicker">At a glance</span><div class="ss-picks-grid">' + it.map((i) => '<div class="ss-pick"><span class="ss-pick-label">' + esc(i.label) + '</span><h3 class="ss-pick-name">' + esc(i.product) + "</h3><p>" + esc(i.why) + "</p>" + (S(i.url) ? '<a class="ss-btn ' + btnCls(i.store) + '">Check price at ' + esc(i.store || "store") + "</a>" : "") + "</div>").join("") + "</div></section>" : ""; }
      case "compare": { const rows = (b.rows || []).filter((r) => r.some((c) => S(c))); if (!rows.length) return ""; const h = b.headers || []; return '<div class="ss-table-wrap"><table class="ss-compare"><thead><tr>' + h.map((x) => "<th>" + esc(x) + "</th>").join("") + "</tr></thead><tbody>" + rows.map((r) => "<tr>" + h.map((_, c) => { const v = S(r[c]); return v.startsWith("http") ? '<td class="ss-cell-action"><a class="ss-btn ss-btn-sm ' + btnCls(h[c]) + '">Check price</a></td>' : c === 0 ? "<th>" + esc(v) + "</th>" : "<td>" + esc(v) + "</td>"; }).join("") + "</tr>").join("") + "</tbody></table></div>"; }
      case "specs": { const it = (b.items || []).filter((i) => S(i.name) && S(i.value)); return it.length ? '<section class="ss-specs"><span class="ss-kicker">' + esc(b.title || "Measured specs") + "</span><dl>" + it.map((i) => '<div class="ss-spec"><dt>' + esc(i.name) + "</dt><dd>" + esc(i.value) + "</dd></div>").join("") + "</dl></section>" : ""; }
      case "buyif": { const L = (x) => String(x || "").split("\n").map((l) => l.trim()).filter((l) => l); const a = L(b.buy), c = L(b.pass); if (!a.length && !c.length) return ""; const col = (t, k, xs) => '<div class="ss-buyif-col ' + k + '"><h4>' + t + "</h4><ul>" + xs.map((x) => "<li>" + esc(x.replace(/^[+-]\s*/, "")) + "</li>").join("") + "</ul></div>"; return '<section class="ss-buyif">' + col("Buy it if", "ss-buy", a) + col("Pass if", "ss-pass", c) + "</section>"; }
      case "cta": return S(b.url) && S(b.text) ? '<div class="ss-cta"><a class="ss-btn ss-btn-lg ' + btnCls(b.store) + '">' + esc(b.text) + "</a>" + (S(b.note) ? '<p class="ss-cta-note">' + esc(b.note) + "</p>" : "") + "</div>" : "";
      case "faq": { const it = (b.items || []).filter((i) => S(i.q) && S(i.a)); return it.length ? '<section class="ss-faq"><h2>Frequently asked questions</h2>' + it.map((i) => '<details class="ss-faq-item" open><summary>' + esc(i.q) + "</summary><p>" + esc(i.a) + "</p></details>").join("") + "</section>" : ""; }
      case "verdict": { if (!S(b.text)) return ""; const r = parseFloat(b.rating); const stars = isNaN(r) ? "" : '<span class="ss-stars">' + "★".repeat(Math.floor(r)) + (r % 1 >= 0.5 ? "½" : "") + "☆".repeat(5 - Math.floor(r) - (r % 1 >= 0.5 ? 1 : 0)) + " <b>" + r + "/5</b></span>"; return '<aside class="ss-verdict"><div class="ss-verdict-head"><span class="ss-kicker">' + esc(b.heading || "Our verdict") + "</span>" + stars + "</div>" + md(b.text) + "</aside>"; }
      case "tip": return S(b.text) ? '<blockquote class="tip"><p><strong>' + esc(b.label || "SmartSelect Tip") + ":</strong> " + esc(b.text) + "</p></blockquote>" : "";
      case "image": return S(b.url) ? '<img class="' + (b.size && b.size !== "full" ? "img-" + esc(b.size) : "") + '" src="' + esc(imgSrc(b.url)) + '" alt="' + esc(b.alt) + '">' + (S(b.caption) ? '<p class="caption">' + md(b.caption).replace(/^<p>|<\/p>\s*$/g, "") + "</p>" : "") : "";
      case "product": return '<p style="padding:12px;border:1px dashed #ccc;border-radius:8px;color:#5c6b80">Product box: ' + esc(String(b.line || "").replace(/^::product\s*/, "").split("|")[0]) + "</p>";
      default: return "";
    }
  }
  async function showPreview() {
    await flush();
    const p = state.post || Object.assign({ title: state.tpl.label + " (template)", summary: state.tpl.description, category: state.tpl.category, blocks: state.tpl.blocks, extra: {} });
    const body = (p.blocks || []).map(previewBlock).join("\n");
    const size = (p.extra && p.extra.image_size) || "full";
    const cover = size === "none" ? "" : '<img class="article-cover' + (size !== "full" ? " cover-" + esc(size) : "") + '" src="' + esc(imgSrc(p.cover_url || CFG.defaultImage)) + '" alt="">' + (p.extra && p.extra.image_credit ? '<p class="caption cover-caption">' + md(p.extra.image_credit).replace(/^<p>|<\/p>\s*$/g, "") + "</p>" : "");
    const doc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + esc(SITE + "/") + '"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/components.css"></head><body>' +
      '<article class="post"><header class="article-header"><span class="eyebrow">' + esc(p.category) + ' / The journal</span><h1>' + esc(p.title || "Untitled draft") + "</h1><p>" + esc(p.summary) + '</p><div class="article-byline"><span>By ' + esc(state.name || "Judy") + "</span><span>·</span><time>" + esc(niceDate((p.post_date || new Date().toISOString()).slice(0, 10))) + '</time><span>·</span><span>Preview · not published yet</span></div></header>' +
      cover + '<div class="article-body">' + body + "</div></article></body></html>";
    const v = document.createElement("div"); v.className = "preview-veil";
    v.innerHTML = '<div class="pbar"><strong>Preview</strong><span class="hint" style="margin:0">This is how your post will look. Links are switched off here.</span><div style="flex:1"></div><button class="btn primary">Back to writing</button></div><iframe title="Preview"></iframe>';
    document.body.appendChild(v);
    v.querySelector("iframe").srcdoc = doc;
    v.querySelector("button").addEventListener("click", () => v.remove());
  }

  // ------------------------------------------------------------ publish / take down / trash
  async function callPublish(action) {
    await flush();
    const { data, error } = await sb.functions.invoke("desk-publish", { body: { id: state.post.id, action } });
    if (error || !data || data.error) {
      let msg = (data && data.error) || "";
      try { if (!msg && error && error.context) msg = (await error.context.json()).error; } catch (_) { /* ignore */ }
      throw new Error(msg || "Something went wrong. Try again in a minute.");
    }
    return data;
  }
  function askPublish() {
    const p = state.post, again = p.status === "published";
    const checks = [[!!p.title.trim(), "A title"], [!!p.cover_url, "A main picture (optional: a court photo is used if you skip it)"], [!!p.summary.trim(), "A short summary (optional: your first paragraph is used)"], [wordCount(p) >= 250, "At least about 250 words (" + wordCount(p) + " now)"]];
    const v = dialog("<h2>" + (again ? "Update the live post?" : "Put this post on the website?") + "</h2>" +
      "<p>" + (again ? "Your new edits will replace what readers see now, and the post will show today as its “Updated” date." : "It will appear on smartselectlabs.com about two minutes after you press Publish.") + "</p>" +
      "<ul>" + checks.map(([ok, l]) => "<li>" + (ok ? "✅ " : "⚪ ") + esc(l) + "</li>").join("") + "</ul>" +
      '<div class="err" id="perr"></div><div class="acts"><button class="btn" data-close>Not yet</button><button class="btn go" id="dopub"' + (p.title.trim() ? "" : " disabled") + ">" + (again ? "Update it" : "Publish") + "</button></div>");
    v.querySelector("#dopub").addEventListener("click", async (e) => {
      e.target.disabled = true; e.target.textContent = "Sending to the website…";
      try {
        const r = await callPublish("publish");
        v.remove();
        state.post.status = "published"; state.post.slug = r.url.split("/").slice(-2)[0]; state.post.last_published_at = new Date().toISOString();
        renderEditor();
        dialog('<h2>🎉 It\'s on its way!</h2><p>Your post will be live in about two minutes at:</p><p><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url.replace("https://", "")) + "</a></p><p class=\"hint\">If the page says “not found”, wait a minute and refresh. To change anything later, open the post from My posts, edit, and press “Update the live post”.</p>" +
          '<div class="acts"><a class="btn" href="#/" data-close>Back to My posts</a><button class="btn primary" data-close>Keep editing</button></div>');
      } catch (err) { e.target.disabled = false; e.target.textContent = again ? "Update it" : "Publish"; v.querySelector("#perr").textContent = err.message; }
    });
  }
  async function takeDown(action) {
    const live = state.post.status === "published";
    const words = action === "trash" ? (live ? "This takes the post off the website and moves it to the trash. You can restore it later." : "Move this draft to the trash? You can restore it later.") : "Take this post off the website? It stays here as a draft, and you can publish it again any time.";
    const v = dialog("<h2>" + (action === "trash" ? "Move to the trash?" : "Take it off the website?") + "</h2><p>" + esc(words) + '</p><div class="err" id="terr"></div><div class="acts"><button class="btn" data-close>Cancel</button><button class="btn danger" id="dotd">' + (action === "trash" ? "Move to the trash" : "Take it off") + "</button></div>");
    v.querySelector("#dotd").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try { await callPublish(action); v.remove(); toast(action === "trash" ? "Moved to the trash" : "Taken off the website. It's a draft again."); state.tab = action === "trash" ? "trash" : "drafts"; location.hash = "#/"; }
      catch (err) { e.target.disabled = false; v.querySelector("#terr").textContent = err.message; }
    });
  }

  // ------------------------------------------------------------ templates: list, edit, save-as
  const COLORS = [["lime", "Lime"], ["blue", "Blue"], ["coral", "Coral"], ["white", "White"]];
  function viewTemplates() {
    $app.innerHTML = bar() + '<main class="wrap"><a class="link-btn" href="#/">← My posts</a>' +
      '<div class="home-head" style="margin-top:10px"><div><h1>Templates</h1><p>The outlines a new post starts from. Change the boxes, the headings and the grey hints; your posts already written are not affected.</p></div>' +
      '<button class="btn lime big" data-act="newtpl">＋ New blank template</button></div>' +
      '<div class="tgrid">' + state.templates.map((t) => tplCard(t, '<span class="tcard-acts"><a class="btn small primary" href="#/template/' + esc(t.key) + '" data-stop>Edit</a><button type="button" class="btn small" data-dup="' + esc(t.key) + '" data-stop>Duplicate</button>' + (t.custom ? '<button type="button" class="btn small ghost" data-deltpl="' + esc(t.key) + '" data-stop>Delete</button>' : "") + "</span>")).join("") + "</div></main>";
  }
  async function viewTemplateEditor(key) {
    await loadTemplates();
    const t = state.templates.find((x) => x.key === key);
    if (!t) { $app.innerHTML = bar() + '<main class="wrap"><div class="empty">That template was not found. <a href="#/templates">Back to templates</a></div></main>'; return; }
    state.tpl = JSON.parse(JSON.stringify(t)); state.post = null; state.tplDirty = false;
    renderTemplateEditor();
  }
  function renderTemplateEditor() {
    const t = state.tpl;
    const cats = ["Beginner Guides", "Gear Reviews", "Health & Recovery"];
    $app.innerHTML = bar() +
      '<div class="ed-bar"><div class="ed-bar-in"><a class="link-btn" href="#/templates">← Templates</a><span class="chip">' + (t.custom ? "Your template" : "Built-in template") + '</span><span class="saved" id="saved">' + (state.tplDirty ? "Not saved yet" : "Saved ✓") + '</span><div style="flex:1"></div>' +
      '<button class="btn" data-act="preview">Preview</button><button class="btn go" data-act="savetpl">Save template</button></div></div>' +
      '<main class="ed"><section class="panel"><h3>About this template</h3><div class="row2">' +
      '<div><span class="lbl">Name</span>' + inp('data-t="label"', t.label, "e.g. Best ___ for ___") + "</div>" +
      '<div><span class="lbl">Emoji</span>' + inp('data-t="emoji"', t.emoji, "🏆") + "</div></div>" +
      '<div style="margin-top:10px"><span class="lbl">One-line description (shown on the template card)</span>' + inp('data-t="description"', t.description, "") + "</div>" +
      '<div class="row3" style="margin-top:10px"><div><span class="lbl">Card colour</span>' + sel('data-t="color"', COLORS, t.color) + "</div>" +
      '<div><span class="lbl">Section of the site</span>' + sel('data-t="category"', cats.map((c) => [c, c]), t.category) + "</div>" +
      '<div style="display:flex;align-items:flex-end"><label class="check"><input type="checkbox" data-t="affiliate"' + (t.affiliate ? " checked" : "") + "> Starts with shopping links on</label></div></div>" +
      '<div style="margin-top:10px"><span class="lbl">Example post to show (optional, e.g. /best-water-bottles-for-pickleball/)</span>' + inp('data-t="example_url"', t.example_url || "", "/some-post/") + "</div></section>" +
      '<div class="blocks-title"><h2>The boxes a new post starts with</h2><span class="hint">Headings and hints here become the starting outline. Leave text empty unless you want starter words in every post.</span></div>' +
      '<div id="blocks">' + (t.blocks || []).map((b, i) => blockForm(b, i, true)).join("") + "</div>" + addMenuHtml() +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><button class="btn go" data-act="savetpl">Save template</button><a class="btn" href="#/templates">Back without saving</a></div></main>';
    document.querySelectorAll(".textarea").forEach(autosize);
    bindBlockUploads();
  }
  async function saveTemplate() {
    const t = state.tpl;
    if (!String(t.label || "").trim()) { toast("Give the template a name first."); return; }
    const row = { key: t.key, label: t.label, emoji: t.emoji || "📝", color: t.color || "white", description: t.description || "", folder: t.folder, category: t.category, affiliate: !!t.affiliate, sort: t.sort, blocks: t.blocks, example_url: t.example_url || "", custom: !!t.custom, updated_at: new Date().toISOString() };
    const { error } = t._new ? await sb.from("templates").insert(row) : await sb.from("templates").update(row).eq("key", t.key);
    if (error) { toast("Couldn't save the template: " + error.message); return; }
    delete t._new; state.tplDirty = false; await loadTemplates(); toast("Template saved ✓");
    const el = document.getElementById("saved"); if (el) el.textContent = "Saved ✓";
    if (route() !== "/template/" + t.key) location.hash = "#/template/" + t.key;
  }
  function blankTemplate(label, blocks, from) {
    const key = (slugify(label) || "template") + "-" + Math.random().toString(36).slice(2, 6);
    const maxSort = Math.max(0, ...state.templates.map((x) => x.sort || 0));
    return { key, label, emoji: (from && from.emoji) || "📝", color: (from && from.color) || "white", description: from ? ("A copy of " + from.label) : "My own outline.", folder: key, category: (from && from.category) || "Beginner Guides", affiliate: !!(from && from.affiliate), sort: maxSort + 1, blocks, example_url: "", custom: true, owner: state.user ? state.user.email : null, _new: true };
  }
  function clearedBlocks(blocks, keepWords) {
    return JSON.parse(JSON.stringify(blocks || [])).map((b) => {
      if (keepWords) return b;
      if ("text" in b && b.type !== "cta") b.text = "";
      if (b.type === "image") { b.url = ""; b.caption = ""; b.alt = ""; }
      if (b.type === "buyif") { b.buy = ""; b.pass = ""; }
      if (b.type === "cta") { b.url = ""; b.note = ""; }
      if (b.type === "compare") b.rows = (b.rows || []).map((r) => r.map((c, i) => (i === 0 ? c : "")));
      (b.items || []).forEach((it) => { ["product", "why", "url", "store", "value", "q", "a"].forEach((k) => { if (k in it) it[k] = ""; }); });
      return b;
    });
  }
  function askSaveAsTemplate() {
    const p = state.post;
    const v = dialog("<h2>Save this post as a template</h2><p>New posts can start from this outline. Your headings, boxes and their order are kept.</p>" +
      '<div class="field"><label class="lbl" for="tplname">Template name</label><input class="input" id="tplname" value="' + esc((p.title || "My template").slice(0, 60)) + '"></div>' +
      '<label class="check"><input type="checkbox" id="keepwords"> Keep my words as starter text (otherwise only headings and hints are kept)</label>' +
      '<div class="acts"><button class="btn" data-close>Cancel</button><button class="btn go" id="dotpl">Save template</button></div>');
    v.querySelector("#dotpl").addEventListener("click", async () => {
      const name = v.querySelector("#tplname").value.trim() || "My template";
      const keep = v.querySelector("#keepwords").checked;
      state.tpl = blankTemplate(name, clearedBlocks(p.blocks, keep), tplOf(p.template)); state.tpl.category = p.category; state.tpl.affiliate = !!p.affiliate;
      await saveTemplate(); state.tpl = null; v.remove();
      dialog("<h2>Template saved</h2><p>You will see “" + esc(name) + "” when you press “Write a new post”. You can tidy it up any time under Templates.</p><div class=\"acts\"><button class=\"btn primary\" data-close>OK</button></div>");
    });
  }

  // ------------------------------------------------------------ events
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-stop]"); if (t && !t.closest("[data-dup],[data-deltpl]")) { e.stopPropagation(); if (t.tagName !== "A") return; }
    const a = e.target.closest("[data-act],[data-open],[data-tab],[data-tpl],[data-addblock],[data-up],[data-down],[data-del],[data-add-item],[data-rm-item],[data-add-row],[data-rm-row],[data-add-col],[data-rm-col],[data-fmt],[data-lib-block],[data-rm-img],[data-dup],[data-deltpl]");
    if (!a) { const m = document.getElementById("more"); if (m && !e.target.closest(".rel")) m.classList.add("hidden"); return; }
    const d = a.dataset, p = doc();
    if (d.dup !== undefined) { e.preventDefault(); e.stopPropagation(); const src = tplOf(d.dup); state.tpl = blankTemplate(src.label + " (copy)", JSON.parse(JSON.stringify(src.blocks || [])), src); state.tpl.description = src.description; await saveTemplate(); return; }
    if (d.deltpl !== undefined) { e.preventDefault(); e.stopPropagation(); if (!confirm("Delete this template? Posts already written from it are not affected.")) return; const { error } = await sb.from("templates").delete().eq("key", d.deltpl); if (error) { toast("Couldn't delete it: " + error.message); return; } await loadTemplates(); viewTemplates(); return; }
    if (d.open) { location.hash = "#/post/" + d.open; return; }
    if (d.tab) { state.tab = d.tab; viewHome(); return; }
    if (d.tpl && route() === "/new") { e.preventDefault(); createFromTemplate(d.tpl); return; }
    if (d.tpl) { return; }
    if (d.addblock) { p.blocks.push(newBlock(d.addblock)); markDirty(true); rerender(); setTimeout(() => { const all = document.querySelectorAll(".blk"); all[all.length - 1].scrollIntoView({ behavior: "smooth", block: "center" }); }, 50); return; }
    if (d.up !== undefined) { const i = +d.up; if (i > 0) { [p.blocks[i - 1], p.blocks[i]] = [p.blocks[i], p.blocks[i - 1]]; markDirty(true); rerender(); } return; }
    if (d.down !== undefined) { const i = +d.down; if (i < p.blocks.length - 1) { [p.blocks[i + 1], p.blocks[i]] = [p.blocks[i], p.blocks[i + 1]]; markDirty(true); rerender(); } return; }
    if (d.del !== undefined) { if (confirm("Remove this box and what's in it?")) { p.blocks.splice(+d.del, 1); markDirty(true); rerender(); } return; }
    if (d.addItem !== undefined) { const b = p.blocks[+d.b]; b.items = b.items || []; b.items.push(b.type === "faq" ? { q: "", a: "" } : b.type === "specs" ? { name: "", value: "" } : { label: "", product: "", why: "", url: "", store: "" }); markDirty(true); rerender(); return; }
    if (d.rmItem !== undefined) { p.blocks[+d.b].items.splice(+d.rmItem, 1); markDirty(true); rerender(); return; }
    if (d.addRow !== undefined) { const b = p.blocks[+d.b]; b.rows.push(b.headers.map(() => "")); markDirty(true); rerender(); return; }
    if (d.rmRow !== undefined) { p.blocks[+d.b].rows.splice(+d.rmRow, 1); markDirty(true); rerender(); return; }
    if (d.addCol !== undefined) { const b = p.blocks[+d.b]; b.headers.splice(b.headers.length - 1, 0, ""); b.rows.forEach((r) => r.splice(b.headers.length - 2, 0, "")); markDirty(true); rerender(); return; }
    if (d.rmCol !== undefined) { const b = p.blocks[+d.b]; const c = b.headers.length - 2; b.headers.splice(c, 1); b.rows.forEach((r) => r.splice(c, 1)); markDirty(true); rerender(); return; }
    if (d.libBlock !== undefined) { const i = +d.libBlock; openLibrary((ph) => { p.blocks[i].url = ph.url; if (ph.credit && !p.blocks[i].caption) p.blocks[i].caption = ph.credit; if (ph.alt && !p.blocks[i].alt) p.blocks[i].alt = ph.alt; markDirty(true); rerender(); }); return; }
    if (d.rmImg !== undefined) { p.blocks[+d.rmImg].url = ""; markDirty(true); rerender(); return; }
    if (d.fmt) {
      const ta = document.querySelector('textarea[data-b="' + d.b + '"][data-k="text"]'); if (!ta) return;
      const s0 = ta.selectionStart, s1 = ta.selectionEnd, sel0 = ta.value.slice(s0, s1);
      let rep = sel0;
      if (d.fmt === "bold") rep = "**" + (sel0 || "bold words") + "**";
      if (d.fmt === "link") { const u = prompt("Paste the link (https://…)"); if (!u) return; rep = "[" + (sel0 || "link words") + "](" + u.trim() + ")"; }
      if (d.fmt === "list") rep = (sel0 || "first item\nsecond item").split("\n").map((l) => "- " + l.replace(/^[-•]\s*/, "")).join("\n");
      ta.setRangeText(rep, s0, s1, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); return;
    }
    switch (d.act) {
      case "new": location.hash = "#/new"; break;
      case "newtpl": state.tpl = blankTemplate("My template", [newBlock("text"), newBlock("text"), newBlock("faq")]); state.tpl.description = "My own outline."; await saveTemplate(); break;
      case "savetpl": await saveTemplate(); break;
      case "savenow": clearTimeout(state.saveTimer); state.dirty = true; await save(); toast("Saved ✓"); break;
      case "signout": await flush(); await sb.auth.signOut(); state.user = null; viewSignIn(); break;
      case "help":
        dialog("<h2>How the writing desk works</h2><ul><li>1. <b>Write a new post</b> → pick a template.</li><li>2. Fill in the boxes. The grey text is just a hint.</li><li>3. Everything <b>saves by itself</b> (top bar says “All changes saved ✓”). “Save now” forces it.</li><li>4. Pictures: <b>Choose a photo</b> opens your photos, the site’s photos, and a search for free licensed photos. Pick a size and add a caption.</li><li>5. Come back any time: <b>My posts</b> → your draft → Continue writing.</li><li>6. <b>Preview</b> shows how it will look. <b>Publish</b> puts it on the site in about two minutes.</li><li>7. Changed a live post? Press <b>Update the live post</b>.</li><li>8. <b>Templates</b> (top bar) lets you change the outlines, or save any post as your own template.</li></ul><p class=\"hint\">Your own or licensed photos only, never saved from Google Images or Amazon. No exact Amazon prices (“about $90” is fine). Stuck? Message Lewis; nothing here can break the website.</p><div class=\"acts\"><button class=\"btn primary\" data-close>Got it</button></div>");
        break;
      case "preview": showPreview(); break;
      case "publish": askPublish(); break;
      case "more": document.getElementById("more").classList.toggle("hidden"); break;
      case "viewlive": window.open(SITE + "/" + p.slug + "/", "_blank"); break;
      case "unpublish": takeDown("unpublish"); break;
      case "trash": takeDown("trash"); break;
      case "astemplate": document.getElementById("more").classList.add("hidden"); askSaveAsTemplate(); break;
      case "restore": { const { error } = await sb.from("posts").update({ status: "draft" }).eq("id", p.id); if (!error) { toast("Restored. It's a draft again."); state.tab = "drafts"; location.hash = "#/"; } break; }
      case "rmcover": p.cover_url = ""; delete p.extra.image_credit; markDirty(true); renderEditor(); break;
      case "libcover": openLibrary((ph) => { p.cover_url = ph.url; if (ph.credit) p.extra.image_credit = ph.credit; else delete p.extra.image_credit; if (ph.alt && !p.cover_alt) p.cover_alt = ph.alt; markDirty(true); renderEditor(); }); break;
    }
  });
  document.addEventListener("input", (e) => {
    const el = e.target, p = doc(); if (!p) return;
    const d = el.dataset;
    if (el.classList.contains("textarea")) autosize(el);
    if (d.t !== undefined && state.tpl) { state.tpl[d.t] = el.type === "checkbox" ? el.checked : el.value; markDirty(); return; }
    if (d.x) { p.extra = p.extra || {}; if (el.value === "full" || el.value === "") delete p.extra[d.x]; else p.extra[d.x] = el.value; markDirty(); return; }
    if (d.f) { p[d.f] = el.type === "checkbox" ? el.checked : el.value; markDirty(); return; }
    if (d.b === undefined) return;
    const b = p.blocks[+d.b];
    if (d.hcol !== undefined) b.headers[+d.hcol] = el.value;
    else if (d.row !== undefined) b.rows[+d.row][+d.col] = el.value;
    else if (d.list) b[d.list][+d.i][d.k] = el.value;
    else if (d.k === "level") b.level = Number(el.value) === 3 ? 3 : 2;
    else if (d.k) b[d.k] = el.value;
    markDirty();
    if (d.k === "size") { const box = el.closest(".blk").querySelector(".photo-box"); if (box) box.className = "photo-box" + (el.value !== "full" ? " is-" + el.value : ""); }
  });
  document.addEventListener("change", (e) => { const el = e.target; if (el.matches("select[data-b],select[data-f],select[data-t],select[data-x],input[type=checkbox][data-f],input[type=checkbox][data-t],input[type=date][data-f]")) el.dispatchEvent(new Event("input", { bubbles: true })); });

  // ------------------------------------------------------------ router + boot
  async function render() {
    if (!state.user) return viewSignIn();
    const r = route();
    if (state.post && !r.startsWith("/post/")) { await flush(); state.post = null; }
    if (state.tpl && !r.startsWith("/template/")) { if (state.tplDirty && !confirm("Leave without saving the template?")) { location.hash = "#/template/" + state.tpl.key; return; } state.tpl = null; state.tplDirty = false; }
    if (r === "/new") return viewNew();
    if (r === "/templates") return viewTemplates();
    if (r.startsWith("/template/")) return viewTemplateEditor(r.split("/")[2]);
    if (r.startsWith("/post/")) return viewEditor(r.split("/")[2]);
    return viewHome();
  }
  window.addEventListener("hashchange", render);
  async function boot() {
    const { data } = await sb.auth.getSession();
    state.user = data.session ? data.session.user : null;
    if (!state.user) return viewSignIn();
    const { data: ed } = await sb.from("editors").select("name,email");
    const me = (ed || []).find((x) => (x.email || "").toLowerCase() === (state.user.email || "").toLowerCase());
    if (!me) { await sb.auth.signOut(); state.user = null; return viewSignIn("This account isn't set up as an editor yet. Ask Lewis."); }
    state.name = me.name || "";
    await loadTemplates();
    render();
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { state.user = null; } });
  boot();
})();
