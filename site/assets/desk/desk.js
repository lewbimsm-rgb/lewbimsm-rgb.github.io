/* SmartSelect Labs writing desk - smartselectlabs.com/admin
   Data: Supabase project smartselectlabs-desk (tables templates, posts; bucket desk-images; edge function desk-publish).
   Screens: sign in -> My posts (#/) -> pick a template (#/new) -> write (#/post/<id>). Autosaves; Publish sends the post to the site. */
(function () {
  "use strict";
  const CFG = window.DESK_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const $app = document.getElementById("app");
  const SITE = CFG.site || "";
  const state = { user: null, name: "", templates: [], posts: [], tab: "drafts", q: "", post: null, dirty: false, saving: false, saveTimer: null, lastSaved: null, saveError: false };

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

  // ------------------------------------------------------------ top bar
  function bar() {
    return '<header class="bar"><div class="bar-in">' +
      '<a class="brand" href="#/"><img src="' + esc(CFG.logo) + '" alt="SmartSelect Labs"><span>Writing desk</span></a><div class="spacer"></div>' +
      (state.user ? '<span class="who">Hi, ' + esc(state.name || state.user.email) + '</span><a class="link-btn" href="' + esc(SITE + "/") + '" target="_blank" rel="noopener">View site ↗</a><button class="link-btn" data-act="help">Help</button><button class="link-btn" data-act="signout">Sign out</button>' : "") +
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
    const { data, error } = await sb.from("posts").select("id,title,template,status,source,cover_url,updated_at,last_published_at,slug,created_at").order("updated_at", { ascending: false });
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
        '<div class="meta">Edited ' + esc(ago(p.updated_at)) + "</div>" +
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
  function viewNew() {
    $app.innerHTML = bar() + '<main class="wrap"><a class="link-btn" href="#/">← My posts</a>' +
      '<div class="home-head" style="margin-top:10px"><div><h1>What kind of post?</h1><p>Pick a template. Each one opens with an outline and grey hints in every box, so you only fill in your words.</p></div></div>' +
      '<div class="tgrid">' + state.templates.map((t) =>
        '<button class="tcard c-' + esc(t.color) + '" data-tpl="' + esc(t.key) + '"><span class="emoji">' + esc(t.emoji) + "</span><h3>" + esc(t.label) + "</h3><p>" + esc(t.description) + "</p>" +
        (t.example_url ? '<a class="ex" href="' + esc(SITE + t.example_url) + '" target="_blank" rel="noopener" data-stop>See a finished example ↗</a>' : '<span class="ex">&nbsp;</span>') + "</button>").join("") +
      "</div></main>";
  }
  async function createFromTemplate(key) {
    const t = tplOf(key);
    const { data, error } = await sb.from("posts").insert({ template: key, category: t.category, affiliate: t.affiliate, blocks: t.blocks, title: "" }).select("id").single();
    if (error) { toast("Couldn't start the post. Check the internet and try again."); return; }
    location.hash = "#/post/" + data.id;
  }

  // ------------------------------------------------------------ editor: block forms
  const BLOCK_NAMES = { text: "Section", quick: "Short answer box", picks: "Your top picks", compare: "Comparison table", specs: "Measurements", buyif: "Who should buy / skip", cta: "Button to a store", faq: "Questions & answers", verdict: "Your verdict", tip: "Tip box", image: "Picture", product: "Product box (special)", raw: "Special box" };
  const ADD_MENU = [
    ["text", "Section", "A heading and paragraphs"], ["picks", "Top picks", "2-4 labelled picks with links"], ["compare", "Comparison table", "Products side by side"],
    ["buyif", "Buy / skip", "Who should buy it, who should skip"], ["cta", "Store button", "A big button to a product"], ["faq", "Questions", "Q&A people ask you"],
    ["verdict", "Verdict", "Your final word (with stars)"], ["quick", "Short answer", "The quick takeaway box"], ["tip", "Tip box", "A highlighted tip"],
    ["specs", "Measurements", "What you measured yourself"], ["image", "Picture", "A photo inside the post"],
  ];
  function newBlock(type) {
    return {
      text: { type, heading: "", level: 2, text: "", hint: "" }, quick: { type, text: "", hint: "" },
      picks: { type, items: [{ label: "Best overall", product: "", why: "", url: "", store: "" }], hint: "" },
      compare: { type, headers: ["Product", "Best for", "Amazon"], rows: [["", "", ""], ["", "", ""]], hint: "Last column: paste a store link for each row; it becomes a button." },
      specs: { type, title: "As measured", items: [{ name: "", value: "" }], hint: "" }, buyif: { type, buy: "", pass: "", hint: "One reason per line." },
      cta: { type, text: "See it on Amazon", url: "", store: "Amazon", note: "", hint: "" }, faq: { type, items: [{ q: "", a: "" }], hint: "" },
      verdict: { type, rating: "", heading: "Our verdict", text: "", hint: "" }, tip: { type, label: "SmartSelect Tip", text: "", hint: "" }, image: { type, url: "", alt: "", hint: "" },
    }[type];
  }
  const inp = (attrs, val, ph, cls) => '<input class="input ' + (cls || "") + '" ' + attrs + ' value="' + esc(val) + '" placeholder="' + esc(ph || "") + '">';
  const area = (attrs, val, ph) => '<textarea class="textarea" ' + attrs + ' placeholder="' + esc(ph || "") + '">' + esc(val) + "</textarea>";
  function blockForm(b, i) {
    const B = 'data-b="' + i + '"';
    const hint = b.hint ? '<p class="hint">' + esc(b.hint) + "</p>" : "";
    let body = "";
    switch (b.type) {
      case "text":
        body = '<input class="h-input" ' + B + ' data-k="heading" value="' + esc(b.heading) + '" placeholder="Section heading (optional)">' + hint +
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
        body = hint + '<div class="item-grid"><select class="select" ' + B + ' data-k="rating">' + [["", "No stars"], ["5", "★★★★★ 5"], ["4.5", "★★★★½ 4.5"], ["4", "★★★★ 4"], ["3.5", "★★★½ 3.5"], ["3", "★★★ 3"], ["2", "★★ 2"], ["1", "★ 1"]]
          .map(([v, l]) => '<option value="' + v + '"' + (String(b.rating || "") === v ? " selected" : "") + ">" + l + "</option>").join("") + "</select>" + inp(B + ' data-k="heading"', b.heading, "Heading, e.g. Our verdict") + "</div>" +
          '<div style="margin-top:8px">' + area(B + ' data-k="text"', b.text, "Two or three sentences: what to buy, and for whom.") + "</div>";
        break;
      case "tip": body = hint + inp(B + ' data-k="label"', b.label, "Label, e.g. SmartSelect Tip") + '<div style="margin-top:8px">' + area(B + ' data-k="text"', b.text, "The tip") + "</div>"; break;
      case "image":
        body = hint + '<div class="photo"><div class="photo-box">' + (b.url ? '<img src="' + esc(imgSrc(b.url)) + '" alt="">' : "No picture yet") + "</div>" +
          '<div class="photo-side"><label class="btn small" style="width:max-content">' + (b.url ? "Change picture" : "Add a picture") + '<input type="file" accept="image/*" class="hidden" data-upload-block="' + i + '"></label>' +
          inp(B + ' data-k="alt"', b.alt, "Describe the picture in a few words") + "</div></div>";
        break;
      default:
        body = '<p class="hint">A special box from an earlier post. You can leave it as it is.</p>' + area(B + ' data-k="' + (b.type === "product" ? "line" : "text") + '"', b.type === "product" ? b.line : b.text, "");
    }
    return '<section class="blk k-' + esc(b.type) + '"><div class="blk-head"><span class="blk-name">' + esc(BLOCK_NAMES[b.type] || "Box") + "</span>" +
      '<button class="icon-btn" data-up="' + i + '" title="Move up">↑</button><button class="icon-btn" data-down="' + i + '" title="Move down">↓</button><button class="icon-btn" data-del="' + i + '" title="Remove this box">✕</button></div>' + body + "</section>";
  }

  function wordCount(p) {
    const parts = [p.title, p.summary];
    (p.blocks || []).forEach((b) => { parts.push(b.heading, b.text, b.buy, b.pass); (b.items || []).forEach((it) => parts.push(it.why, it.q, it.a)); });
    return parts.join(" ").split(/\s+/).filter((w) => /\w/.test(w)).length;
  }

  // ------------------------------------------------------------ editor: view
  async function viewEditor(id) {
    $app.innerHTML = bar() + '<main class="wrap"><p class="hint">Opening your post…</p></main>';
    const { data, error } = await sb.from("posts").select("*").eq("id", id).single();
    if (error || !data) { $app.innerHTML = bar() + '<main class="wrap"><div class="empty">This post could not be found. <a href="#/">Back to My posts</a></div></main>'; return; }
    state.post = data; state.dirty = false; state.saveError = false; state.lastSaved = data.updated_at;
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
    $app.innerHTML = bar() +
      '<div class="ed-bar"><div class="ed-bar-in"><a class="link-btn" href="#/">← My posts</a><span id="pill">' + statusPill(p) + '</span><span class="saved" id="saved"></span><div style="flex:1"></div>' +
      '<button class="btn" data-act="preview">Preview</button><span id="pubwrap">' + publishLabel(p) + "</span>" +
      '<div class="rel"><button class="btn ghost" data-act="more" title="More">⋯</button><div class="menu hidden" id="more">' +
      (p.status === "published" && p.slug ? '<button data-act="viewlive">Open the live page ↗</button><button data-act="unpublish">Take it off the website</button>' : "") +
      (p.status === "trash" ? '<button data-act="restore">Restore from the trash</button>' : '<button data-act="trash">Move to the trash</button>') + "</div></div></div></div>" +
      '<main class="ed"><p class="hint" style="margin:0 0 6px"><span class="chip">' + esc(t.emoji + " " + t.label) + '</span> &nbsp;<span class="words" id="words"></span></p>' +
      '<input class="title-input" data-f="title" value="' + esc(p.title) + '" placeholder="Your headline, e.g. Best Pickleball Shoes for Women">' +
      '<section class="panel"><h3>Main picture</h3><p class="hint">Shows at the top of the post and on the home page. Your own photo is best, wider than tall.</p><div class="photo"><div class="photo-box" id="cover">' +
      (p.cover_url ? '<img src="' + esc(imgSrc(p.cover_url)) + '" alt="">' : "No picture yet.<br>If you skip it, the site uses a court photo.") + "</div>" +
      '<div class="photo-side"><label class="btn small" style="width:max-content">' + (p.cover_url ? "Change picture" : "Add a picture") + '<input type="file" accept="image/*" class="hidden" id="coverfile"></label>' +
      (p.cover_url ? '<button class="btn small ghost" style="width:max-content" data-act="rmcover">Remove picture</button>' : "") +
      inp('data-f="cover_alt"', p.cover_alt, "Describe the picture in a few words") + "</div></div></section>" +
      '<section class="panel"><h3>Short summary <span class="hint">(optional)</span></h3><p class="hint">One or two sentences. Shows under the title and in Google. If you skip it, the site uses your first paragraph.</p>' +
      area('data-f="summary"', p.summary, "e.g. Court shoes that protect your ankles and knees, from Nike, ASICS and New Balance.") +
      '<div class="row2" style="margin-top:12px"><div><span class="lbl">Section of the site</span><select class="select" data-f="category">' + cats.map((c) => '<option' + (p.category === c ? " selected" : "") + ">" + c + "</option>").join("") + "</select></div>" +
      '<div style="display:flex;align-items:flex-end"><label class="check"><input type="checkbox" data-f="affiliate"' + (p.affiliate ? " checked" : "") + "> This post has shopping links</label></div></div></section>" +
      '<div class="blocks-title"><h2>Your post</h2><span class="hint">Fill in the boxes. Empty boxes are left out when you publish.</span></div>' +
      '<div id="blocks">' + (p.blocks || []).map(blockForm).join("") + "</div>" +
      '<div class="panel"><h3>Add a box</h3><div class="add-menu">' + ADD_MENU.map(([k, l, d]) => '<button data-addblock="' + k + '">' + esc(l) + "<small>" + esc(d) + "</small></button>").join("") + "</div></div>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><button class="btn" data-act="preview">Preview</button>' + publishLabel(p) + "</div></main>";
    document.querySelectorAll(".textarea").forEach(autosize);
    updateSaved(); updateWords();
    document.getElementById("coverfile").addEventListener("change", (e) => uploadPicture(e.target.files[0], (url) => { state.post.cover_url = url; markDirty(true); renderEditor(); }));
    document.querySelectorAll("[data-upload-block]").forEach((el) => el.addEventListener("change", (e) => {
      const i = +el.dataset.uploadBlock; uploadPicture(e.target.files[0], (url) => { state.post.blocks[i].url = url; markDirty(true); renderEditor(); });
    }));
  }
  function updateWords() { const w = document.getElementById("words"); if (w) w.textContent = wordCount(state.post) + " words"; }
  function updateSaved() {
    const el = document.getElementById("saved"); if (!el) return;
    el.classList.toggle("bad", state.saveError);
    el.textContent = state.saveError ? "Not saved yet. Check the internet; retrying…" : state.saving ? "Saving…" : state.dirty ? "Editing…" : "Saved ✓ " + ago(state.lastSaved);
  }
  setInterval(updateSaved, 30000);

  // ------------------------------------------------------------ editor: saving
  function markDirty(now) {
    state.dirty = true; updateSaved(); updateWords();
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(save, now ? 50 : 1200);
  }
  async function save() {
    if (!state.post || state.saving) { if (state.dirty) { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(save, 800); } return; }
    if (!state.dirty) return;
    state.saving = true; state.dirty = false; updateSaved();
    const p = state.post;
    const patch = { title: p.title, summary: p.summary, cover_url: p.cover_url, cover_alt: p.cover_alt, category: p.category, affiliate: p.affiliate, keyphrase: p.keyphrase, blocks: p.blocks };
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
  window.addEventListener("beforeunload", (e) => { if (state.dirty || state.saving) { save(); e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && state.dirty) save(); });

  // ------------------------------------------------------------ pictures
  async function uploadPicture(file, done) {
    if (!file) return;
    toast("Adding your picture…", 4000);
    try {
      let blob = file;
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
      } catch (_) { /* browser could not resize (e.g. HEIC on a PC): upload the original */ }
      const base = (file.name || "photo").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "photo";
      const path = state.post.id + "/" + Date.now() + "-" + base + ".jpg";
      const { error } = await sb.storage.from("desk-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      done(sb.storage.from("desk-images").getPublicUrl(path).data.publicUrl);
      toast("Picture added ✓");
    } catch (e) { toast("Couldn't add the picture. Try a different photo, or try again."); }
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
      case "image": return S(b.url) ? '<img src="' + esc(imgSrc(b.url)) + '" alt="' + esc(b.alt) + '">' : "";
      case "product": return '<p style="padding:12px;border:1px dashed #ccc;border-radius:8px;color:#5c6b80">Product box: ' + esc(String(b.line || "").replace(/^::product\s*/, "").split("|")[0]) + "</p>";
      default: return "";
    }
  }
  async function showPreview() {
    await flush();
    const p = state.post;
    const body = (p.blocks || []).map(previewBlock).join("\n");
    const doc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + esc(SITE + "/") + '"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/components.css"></head><body>' +
      '<article class="post"><header class="article-header"><span class="eyebrow">' + esc(p.category) + ' / The journal</span><h1>' + esc(p.title || "Untitled draft") + "</h1><p>" + esc(p.summary) + '</p><div class="article-byline">Preview · not published yet</div></header>' +
      '<img class="article-cover" src="' + esc(imgSrc(p.cover_url || CFG.defaultImage)) + '" alt=""><div class="article-body">' + body + "</div></article></body></html>";
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
      "<p>" + (again ? "Your new edits will replace what readers see now." : "It will appear on smartselectlabs.com about two minutes after you press Publish.") + "</p>" +
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

  // ------------------------------------------------------------ events
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-stop]"); if (t) { e.stopPropagation(); return; }
    const a = e.target.closest("[data-act],[data-open],[data-tab],[data-tpl],[data-addblock],[data-up],[data-down],[data-del],[data-add-item],[data-rm-item],[data-add-row],[data-rm-row],[data-add-col],[data-rm-col],[data-fmt]");
    if (!a) { const m = document.getElementById("more"); if (m && !e.target.closest(".rel")) m.classList.add("hidden"); return; }
    const d = a.dataset, p = state.post;
    if (d.open) { location.hash = "#/post/" + d.open; return; }
    if (d.tab) { state.tab = d.tab; viewHome(); return; }
    if (d.tpl) { e.preventDefault(); createFromTemplate(d.tpl); return; }
    if (d.addblock) { p.blocks.push(newBlock(d.addblock)); markDirty(true); renderEditor(); setTimeout(() => { const all = document.querySelectorAll(".blk"); all[all.length - 1].scrollIntoView({ behavior: "smooth", block: "center" }); }, 50); return; }
    if (d.up !== undefined) { const i = +d.up; if (i > 0) { [p.blocks[i - 1], p.blocks[i]] = [p.blocks[i], p.blocks[i - 1]]; markDirty(true); renderEditor(); } return; }
    if (d.down !== undefined) { const i = +d.down; if (i < p.blocks.length - 1) { [p.blocks[i + 1], p.blocks[i]] = [p.blocks[i], p.blocks[i + 1]]; markDirty(true); renderEditor(); } return; }
    if (d.del !== undefined) { if (confirm("Remove this box and what's in it?")) { p.blocks.splice(+d.del, 1); markDirty(true); renderEditor(); } return; }
    if (d.addItem !== undefined) { const b = p.blocks[+d.b]; b.items = b.items || []; b.items.push(b.type === "faq" ? { q: "", a: "" } : b.type === "specs" ? { name: "", value: "" } : { label: "", product: "", why: "", url: "", store: "" }); markDirty(true); renderEditor(); return; }
    if (d.rmItem !== undefined) { p.blocks[+d.b].items.splice(+d.rmItem, 1); markDirty(true); renderEditor(); return; }
    if (d.addRow !== undefined) { const b = p.blocks[+d.b]; b.rows.push(b.headers.map(() => "")); markDirty(true); renderEditor(); return; }
    if (d.rmRow !== undefined) { p.blocks[+d.b].rows.splice(+d.rmRow, 1); markDirty(true); renderEditor(); return; }
    if (d.addCol !== undefined) { const b = p.blocks[+d.b]; b.headers.splice(b.headers.length - 1, 0, ""); b.rows.forEach((r) => r.splice(b.headers.length - 2, 0, "")); markDirty(true); renderEditor(); return; }
    if (d.rmCol !== undefined) { const b = p.blocks[+d.b]; const c = b.headers.length - 2; b.headers.splice(c, 1); b.rows.forEach((r) => r.splice(c, 1)); markDirty(true); renderEditor(); return; }
    if (d.fmt) {
      const ta = document.querySelector('textarea[data-b="' + d.b + '"][data-k="text"]'); if (!ta) return;
      const s0 = ta.selectionStart, s1 = ta.selectionEnd, sel = ta.value.slice(s0, s1);
      let rep = sel;
      if (d.fmt === "bold") rep = "**" + (sel || "bold words") + "**";
      if (d.fmt === "link") { const u = prompt("Paste the link (https://…)"); if (!u) return; rep = "[" + (sel || "link words") + "](" + u.trim() + ")"; }
      if (d.fmt === "list") rep = (sel || "first item\nsecond item").split("\n").map((l) => "- " + l.replace(/^[-•]\s*/, "")).join("\n");
      ta.setRangeText(rep, s0, s1, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); return;
    }
    switch (d.act) {
      case "new": location.hash = "#/new"; break;
      case "signout": await flush(); await sb.auth.signOut(); state.user = null; viewSignIn(); break;
      case "help":
        dialog("<h2>How the writing desk works</h2><ul><li>1. <b>Write a new post</b> → pick a template.</li><li>2. Fill in the boxes. The grey text is just a hint.</li><li>3. Everything <b>saves by itself</b> (top bar says “Saved ✓”).</li><li>4. Come back any time: <b>My posts</b> → your draft → Continue writing.</li><li>5. <b>Preview</b> shows how it will look. <b>Publish</b> puts it on the site in about two minutes.</li><li>6. Changed a live post? Press <b>Update the live post</b>.</li></ul><p class=\"hint\">Your own photos only. No exact Amazon prices (“about $90” is fine). Stuck? Message Lewis; nothing here can break the website.</p><div class=\"acts\"><button class=\"btn primary\" data-close>Got it</button></div>");
        break;
      case "preview": showPreview(); break;
      case "publish": askPublish(); break;
      case "more": document.getElementById("more").classList.toggle("hidden"); break;
      case "viewlive": window.open(SITE + "/" + p.slug + "/", "_blank"); break;
      case "unpublish": takeDown("unpublish"); break;
      case "trash": takeDown("trash"); break;
      case "restore": { const { error } = await sb.from("posts").update({ status: "draft" }).eq("id", p.id); if (!error) { toast("Restored. It's a draft again."); state.tab = "drafts"; location.hash = "#/"; } break; }
      case "rmcover": p.cover_url = ""; markDirty(true); renderEditor(); break;
    }
  });
  document.addEventListener("input", (e) => {
    const el = e.target, p = state.post; if (!p) return;
    const d = el.dataset;
    if (el.classList.contains("textarea")) autosize(el);
    if (d.f) { p[d.f] = el.type === "checkbox" ? el.checked : el.value; markDirty(); return; }
    if (d.b === undefined) return;
    const b = p.blocks[+d.b];
    if (d.hcol !== undefined) b.headers[+d.hcol] = el.value;
    else if (d.row !== undefined) b.rows[+d.row][+d.col] = el.value;
    else if (d.list) b[d.list][+d.i][d.k] = el.value;
    else if (d.k) b[d.k] = el.value;
    markDirty();
  });
  document.addEventListener("change", (e) => { const el = e.target; if (el.matches("select[data-b],select[data-f],input[type=checkbox][data-f]")) el.dispatchEvent(new Event("input", { bubbles: true })); });

  // ------------------------------------------------------------ router + boot
  async function render() {
    if (!state.user) return viewSignIn();
    const r = route();
    if (state.post && !r.startsWith("/post/")) { await flush(); state.post = null; }
    if (r === "/new") return viewNew();
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
