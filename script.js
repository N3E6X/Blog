/* =============================================================
   N3E6X BLOG ENGINE  ·  v2.0
   =============================================================
   SETUP
   ─────
   1. Edit CONFIG below (username + repo).
   2. Drop .md files in /posts with frontmatter:

      ---
      title: Your Title
      date: 2025-06-01
      description: Short summary.
      tags: code, design
      ---

      Content here…

   3. Push → GitHub Pages → done.
   ============================================================= */

'use strict';

/* ─── CONFIG ─────────────────────────────────────────────────── */

const CONFIG = Object.freeze({
  github: {
    username: 'N3E6X',   // ← your GitHub username
    repo:     'Blog',    // ← your repository name
    branch:   'main'
  },
  postsDir:        'posts',
  blogName:        'N3E6X',
  blogDescription: 'Thoughts, code, and everything between.'
});

/* ─── STATE ───────────────────────────────────────────────────── */

const state = {
  posts:   [],
  loading: true,
  error:   null
};

/* ─── INIT ────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initReadingProgress();

  // Render skeleton immediately, then load real data
  renderRoute();
  window.addEventListener('hashchange', renderRoute);

  await loadPosts();
  renderRoute();
});

/* ─── THEME ───────────────────────────────────────────────────── */

function initTheme() {
  const stored = localStorage.getItem('n3e6x-theme');
  if (stored === 'light') document.body.classList.add('light');

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const mode = document.body.classList.contains('light') ? 'light' : 'dark';
    localStorage.setItem('n3e6x-theme', mode);
  });
}

/* ─── READING PROGRESS ────────────────────────────────────────── */

function initReadingProgress() {
  const bar = document.getElementById('reading-progress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const docH   = document.documentElement.scrollHeight - window.innerHeight;
    const pct    = docH > 0 ? (window.scrollY / docH) * 100 : 0;
    bar.style.width = pct.toFixed(1) + '%';
  }, { passive: true });
}

/* ─── ROUTING ─────────────────────────────────────────────────── */

function renderRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';

  if (hash.startsWith('/post/')) {
    const slug = hash.slice('/post/'.length);
    renderPost(slug);
  } else {
    renderHome();
  }
}

/* ─── DATA LOADING ────────────────────────────────────────────── */

async function loadPosts() {
  state.loading = true;
  state.error   = null;

  try {
    await loadViaGitHubAPI();
  } catch (apiErr) {
    console.warn('[N3E6X] GitHub API failed:', apiErr.message);
    try {
      await loadViaManifest();
    } catch (manErr) {
      console.warn('[N3E6X] Manifest fallback failed:', manErr.message);
      state.error = 'Could not load posts. Check CONFIG or add a posts/posts.json file.';
    }
  }

  state.loading = false;
}

async function loadViaGitHubAPI() {
  const { username, repo, branch } = CONFIG.github;
  const url = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(CONFIG.postsDir)}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    throw new Error(info.message || `HTTP ${res.status}`);
  }

  const files = await res.json();
  if (!Array.isArray(files)) throw new Error('Unexpected API response shape');

  const mdFiles = files.filter(f =>
    f.type === 'file' &&
    typeof f.name === 'string' &&
    f.name.toLowerCase().endsWith('.md')
  );

  const posts = await Promise.all(
    mdFiles.map(f => fetchAndParse(f.name, f.download_url))
  );

  state.posts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadViaManifest() {
  const res = await fetch('./posts/posts.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('No posts.json');

  const filenames = await res.json();
  if (!Array.isArray(filenames)) throw new Error('posts.json must be an array');

  const posts = await Promise.all(
    filenames.map(name => fetchAndParse(name, null))
  );

  state.posts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function fetchAndParse(filename, downloadUrl) {
  if (typeof filename !== 'string' || !filename.endsWith('.md')) return null;

  try {
    let res = await fetch(`./${CONFIG.postsDir}/${filename}`, { cache: 'no-cache' });
    if (!res.ok && downloadUrl) res = await fetch(downloadUrl);
    if (!res.ok) return null;

    const raw = await res.text();
    return parsePost(filename, raw);
  } catch (e) {
    console.warn(`[N3E6X] Failed to load ${filename}:`, e);
    return null;
  }
}

/* ─── FRONTMATTER ─────────────────────────────────────────────── */

function parsePost(filename, raw) {
  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { meta, content } = parseFrontmatter(cleaned);
  const slug = filename.replace(/\.md$/i, '');

  return {
    slug,
    title:       sanitizeText(meta.title || slugToTitle(slug)),
    date:        sanitizeText(meta.date  || ''),
    description: sanitizeText(meta.description || ''),
    tags:        sanitizeText(meta.tags || ''),
    content,
    html:        parseMarkdown(content),
    headings:    extractHeadings(content),
    readingTime: calcReadingTime(content)
  };
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw.trim() };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    let   val = line.slice(colon + 1).trim();
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
    if (key) meta[key] = val;
  }

  return { meta, content: match[2].trim() };
}

/* ─── MARKDOWN PARSER ─────────────────────────────────────────── */

function parseMarkdown(src) {
  if (!src) return '';

  const lines  = src.split('\n');
  let   out    = '';

  let inFence    = false, fenceLang = '', fenceLines = [];
  let inUL       = false;
  let inOL       = false;
  let inTask     = false;
  let inBQ       = false, bqLines = [];
  let paraLines  = [];
  let inTable    = false, tableRows = [], tableHead = false;

  /* ── inline ──────────────────────────────────────────────── */
  function inline(s) {
    // Escape HTML entities first
    s = s.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');

    // Inline code (protect first)
    s = s.replace(/`([^`\n]+)`/g, (_, c) => `<code>${c}</code>`);

    // Images
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, src) => `<img src="${sanitizeURL(src)}" alt="${escAttr(alt)}" loading="lazy">`);

    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, href) => `<a href="${sanitizeURL(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`);

    // Footnote refs
    s = s.replace(/\[\^([^\]]+)\]/g, (_, id) =>
      `<sup class="fn-ref"><a href="#fn-${escAttr(id)}" id="fnref-${escAttr(id)}">${escAttr(id)}</a></sup>`);

    // Highlight ==text==
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');

    // Bold + Italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // Strikethrough
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Superscript ^text^
    s = s.replace(/\^([^^\n]+)\^/g, '<sup>$1</sup>');

    // Subscript ~text~
    s = s.replace(/~([^~\n]+)~/g, '<sub>$1</sub>');

    // Abbreviation (abbr)
    s = s.replace(/\[([A-Z][A-Z0-9]+)\]\(abbr: ([^)]+)\)/g,
      (_, abbr, title) => `<abbr title="${escAttr(title)}">${abbr}</abbr>`);

    return s;
  }

  function flushPara() {
    if (paraLines.length) {
      out += `<p>${inline(paraLines.join(' '))}</p>\n`;
      paraLines = [];
    }
  }

  function closeUL()  { if (inUL)   { out += '</ul>\n';  inUL   = false; } }
  function closeOL()  { if (inOL)   { out += '</ol>\n';  inOL   = false; } }
  function closeTask(){ if (inTask) { out += '</ul>\n';  inTask = false; } }

  function closeLists() { closeUL(); closeOL(); closeTask(); }

  function flushBQ() {
    if (inBQ) {
      out += '<blockquote>\n' + parseMarkdown(bqLines.join('\n')) + '</blockquote>\n';
      inBQ    = false;
      bqLines = [];
    }
  }

  function flushTable() {
    if (!tableRows.length) { inTable = false; return; }

    out += '<div class="table-wrap"><table>\n';
    let rowIdx = 0;

    for (const row of tableRows) {
      if (row === '__SEP__') { rowIdx++; continue; }
      const cells = row.split('|').map(c => c.trim()).filter((_, i, a) =>
        i > 0 || a[0] !== '' ? true : false
      );

      if (rowIdx === 0) {
        out += '<thead><tr>' +
          cells.map(c => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead>\n<tbody>\n';
      } else {
        out += '<tr>' +
          cells.map(c => `<td>${inline(c)}</td>`).join('') +
          '</tr>\n';
      }
    }

    out += '</tbody></table></div>\n';
    tableRows = [];
    inTable   = false;
  }

  function flushAll() {
    flushPara();
    closeLists();
    flushBQ();
    flushTable();
  }

  /* ── line loop ───────────────────────────────────────────── */
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trim = line.trim();

    /* Fenced code blocks */
    if (/^```/.test(trim)) {
      if (inFence) {
        const lang = fenceLang ? ` class="language-${escAttr(fenceLang)}"` : '';
        const code = escCode(fenceLines.join('\n'));
        const head = fenceLang
          ? `<div class="code-header"><span class="code-lang">${escAttr(fenceLang)}</span><button class="code-copy" aria-label="Copy code">Copy</button></div>`
          : `<div class="code-header"><span class="code-lang"></span><button class="code-copy" aria-label="Copy code">Copy</button></div>`;
        out      += `<pre>${head}<code${lang}>${code}</code></pre>\n`;
        inFence   = false;
        fenceLines = [];
        fenceLang  = '';
      } else {
        flushAll();
        inFence   = true;
        fenceLang = trim.slice(3).trim();
      }
      continue;
    }
    if (inFence) { fenceLines.push(line); continue; }

    /* Blank line */
    if (trim === '') {
      flushAll();
      continue;
    }

    /* Heading */
    const hm = trim.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      flushAll();
      const lvl = hm[1].length;
      const txt = hm[2];
      const id  = headingId(txt);
      out += `<h${lvl} id="${id}">${inline(txt)}</h${lvl}>\n`;
      continue;
    }

    /* Horizontal rule */
    if (/^(\s*[-*_]\s*){3,}$/.test(trim)) {
      flushAll();
      out += '<hr>\n';
      continue;
    }

    /* Blockquote */
    if (/^>/.test(trim)) {
      flushPara();
      closeLists();
      if (!inBQ) inBQ = true;
      bqLines.push(trim.replace(/^>\s?/, ''));
      continue;
    }
    if (inBQ) flushBQ();

    /* Table */
    if (/^\|/.test(trim)) {
      flushPara();
      closeLists();
      inTable = true;
      if (/^[\|\s\-:]+$/.test(trim)) {
        tableRows.push('__SEP__');
      } else {
        tableRows.push(trim.replace(/^\||\|$/g, ''));
      }
      continue;
    }
    if (inTable) flushTable();

    /* Task list */
    const tkm = trim.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (tkm) {
      flushPara();
      closeUL();
      closeOL();
      if (!inTask) { out += '<ul class="task-list">\n'; inTask = true; }
      const checked = tkm[1].trim() !== '';
      const icon    = checked
        ? `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="task-check__icon"><polyline points="2,6 5,9 10,3"/></svg>`
        : '';
      out += `<li><span class="task-check${checked ? ' task-check--checked' : ''}" aria-hidden="true">${icon}</span>${inline(tkm[2])}</li>\n`;
      continue;
    }

    /* Unordered list */
    const ulm = trim.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      flushPara();
      closeOL();
      closeTask();
      if (!inUL) { out += '<ul>\n'; inUL = true; }
      out += `<li>${inline(ulm[1])}</li>\n`;
      continue;
    }

    /* Ordered list */
    const olm = trim.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      flushPara();
      closeUL();
      closeTask();
      if (!inOL) { out += '<ol>\n'; inOL = true; }
      out += `<li>${inline(olm[1])}</li>\n`;
      continue;
    }

    /* Definition list */
    if (trim.startsWith(': ') && paraLines.length) {
      const term = paraLines.pop();
      if (!out.endsWith('</dl>\n')) out += '<dl>\n';
      out = out.replace(/<\/dl>\n$/, '');
      out += `<dt>${inline(term)}</dt>\n<dd>${inline(trim.slice(2))}</dd>\n</dl>\n`;
      continue;
    }

    /* Footnote definition */
    const fnm = trim.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
    if (fnm) {
      flushAll();
      out += `<div class="footnotes"><p id="fn-${escAttr(fnm[1])}"><sup>${escAttr(fnm[1])}</sup> ${inline(fnm[2])} <a href="#fnref-${escAttr(fnm[1])}" aria-label="Back to reference">↩</a></p></div>\n`;
      continue;
    }

    /* Paragraph */
    closeLists();
    paraLines.push(trim);
  }

  flushAll();
  return out;
}

/* ─── HEADING IDS ─────────────────────────────────────────────── */

function headingId(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function extractHeadings(content) {
  const headings = [];
  const re = /^(#{1,4})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    headings.push({ level: m[1].length, text: m[2].trim(), id: headingId(m[2].trim()) });
  }
  return headings;
}

/* ─── SANITIZATION ────────────────────────────────────────────── */

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escCode(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeText(s) {
  return String(s)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 500);
}

function sanitizeURL(url) {
  try {
    const u = new URL(url, location.href);
    if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return '#';
    return u.href;
  } catch {
    // Relative URL
    return url.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, '');
  }
}

/* ─── RENDERING — HOME ────────────────────────────────────────── */

function renderHome() {
  const app = document.getElementById('app');
  document.title = CONFIG.blogName;

  if (state.loading) {
    app.innerHTML = skeletonHome();
    return;
  }

  if (state.error) {
    app.innerHTML = `
      <div class="state-wrap fade-in" role="alert">
        <p class="state-error__label">Error</p>
        <h1 class="state-error__title">Something went wrong</h1>
        <p class="state-error__msg">${state.error}</p>
        <button class="btn" onclick="location.reload()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Retry
        </button>
      </div>`;
    return;
  }

  if (!state.posts.length) {
    app.innerHTML = `
      <div class="state-wrap fade-in">
        <p class="state-empty__text">No posts yet — drop <code>.md</code> files in the <code>posts/</code> folder.</p>
      </div>`;
    return;
  }

  const cards = state.posts.map(p => `
    <a href="#/post/${p.slug}" class="post-card" aria-label="${p.title}">
      <div class="post-card__body">
        <p class="post-card__tag">${p.tags || 'Article'}</p>
        <h2 class="post-card__title">${p.title}</h2>
        ${p.description ? `<p class="post-card__desc">${p.description}</p>` : ''}
      </div>
      <div class="post-card__aside">
        <span class="post-card__date">${formatDate(p.date)}</span>
        <span class="post-card__rt">${p.readingTime}</span>
        <svg class="post-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </a>`).join('');

  app.innerHTML = `
    <section class="home fade-in" aria-label="Posts">
      <header>
        <p class="home__eyebrow"><span class="home__eyebrow-line"></span>Writing</p>
        <h1 class="home__title">${CONFIG.blogName}</h1>
        <p class="home__desc">${CONFIG.blogDescription}</p>
      </header>
      <div class="home__divider" aria-hidden="true">
        <span class="home__divider-label">Posts</span>
        <span class="home__divider-rule"></span>
        <span class="home__divider-label">${state.posts.length}</span>
      </div>
      <div class="post-list" role="feed">${cards}</div>
    </section>`;
}

/* ─── RENDERING — POST ────────────────────────────────────────── */

function renderPost(slug) {
  const app = document.getElementById('app');

  if (state.loading) {
    app.innerHTML = `<div class="state-wrap">${skeletonPost()}</div>`;
    return;
  }

  const post = state.posts.find(p => p.slug === slug);

  if (!post) {
    document.title = `Not Found — ${CONFIG.blogName}`;
    app.innerHTML = `
      <div class="state-wrap fade-in" role="alert">
        <a href="#/" class="post__back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          All posts
        </a>
        <p class="state-error__label">404</p>
        <h1 class="state-error__title">Post not found</h1>
        <p class="state-error__msg">No post matching "${sanitizeText(slug)}" exists.</p>
        <a href="#/" class="btn">All posts</a>
      </div>`;
    return;
  }

  document.title = `${post.title} — ${CONFIG.blogName}`;

  /* Recommendations: exclude current, pick up to 3 */
  const recs = state.posts.filter(p => p.slug !== slug).slice(0, 3);

  const tocHTML = buildTOC(post.headings);
  const recsHTML = buildRecommendations(recs);

  app.innerHTML = `
    <div class="post-view fade-in">

      <!-- TOC (left) -->
      <aside class="toc-col" aria-label="Table of contents">
        ${tocHTML}
      </aside>

      <!-- Main content (center) -->
      <div class="article-col">
        <a href="#/" class="post__back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          All posts
        </a>
        <header class="post__header">
          <div class="post__eyebrow">
            <time class="post__date" datetime="${post.date}">${formatDate(post.date)}</time>
            <span class="post__rt">${post.readingTime}</span>
          </div>
          <h1 class="post__title">${post.title}</h1>
          ${post.description ? `<p class="post__desc">${post.description}</p>` : ''}
        </header>
        <article class="article" id="article-content">
          ${post.html}
        </article>
      </div>

      <!-- Recommendations (right) -->
      <aside class="aside-col" aria-label="More posts">
        ${recsHTML}
      </aside>

    </div>`;

  window.scrollTo({ top: 0, behavior: 'instant' });

  // Wire up copy buttons
  wireCopyButtons();

  // Wire up TOC scroll tracking
  if (post.headings.length) wireTOC();
}

/* ─── TOC ─────────────────────────────────────────────────────── */

function buildTOC(headings) {
  if (!headings.length) return '';

  const items = headings.map(h => `
    <li class="toc__item">
      <button
        class="toc__link toc__link--h${h.level}"
        data-id="${escAttr(h.id)}"
        type="button"
        aria-label="Go to section: ${escAttr(h.text)}"
      >${escAttr(h.text)}</button>
    </li>`).join('');

  return `
    <nav class="toc" aria-label="On this page">
      <p class="toc__label">On this page</p>
      <ul class="toc__list">${items}</ul>
    </nav>`;
}

function wireTOC() {
  const tocLinks = document.querySelectorAll('.toc__link');
  if (!tocLinks.length) return;

  // Scroll to section on click — does NOT navigate away
  tocLinks.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id  = btn.dataset.id;
      const el  = document.getElementById(id);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Update active state immediately
      tocLinks.forEach(l => l.classList.remove('toc__link--active'));
      btn.classList.add('toc__link--active');
    });
  });

  // Highlight on scroll via IntersectionObserver
  const headingEls = Array.from(
    document.querySelectorAll('.article h1, .article h2, .article h3, .article h4')
  );

  if (!headingEls.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(l => {
          l.classList.toggle('toc__link--active', l.dataset.id === id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  headingEls.forEach(el => observer.observe(el));
}

/* ─── RECOMMENDATIONS ─────────────────────────────────────────── */

function buildRecommendations(posts) {
  if (!posts.length) return '';

  const items = posts.map(p => `
    <a class="aside__item" href="#/post/${p.slug}" aria-label="${escAttr(p.title)}">
      <p class="aside__item-meta">${formatDate(p.date)}</p>
      <p class="aside__item-title">${p.title}</p>
    </a>`).join('');

  return `
    <div>
      <p class="aside__label">More posts</p>
      <div class="aside__list">${items}</div>
    </div>`;
}

/* ─── COPY CODE BUTTONS ───────────────────────────────────────── */

function wireCopyButtons() {
  document.querySelectorAll('.code-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('pre')?.querySelector('code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent || '');
        btn.textContent = 'Copied!';
        btn.classList.add('code-copy--copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('code-copy--copied');
        }, 2000);
      } catch {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    });
  });
}

/* ─── SKELETONS ───────────────────────────────────────────────── */

function skeletonHome() {
  const card = () => `
    <div class="skel-card">
      <div>
        <div class="skeleton skel-tag"></div>
        <div class="skeleton skel-ctitle"></div>
        <div class="skeleton skel-cdesc"></div>
      </div>
      <div class="skel-meta">
        <div class="skeleton skel-date"></div>
        <div class="skeleton skel-rt"></div>
      </div>
    </div>`;

  return `
    <div class="skel-home">
      <div class="skel-title-block">
        <div class="skeleton skel-eyebrow"></div>
        <div class="skeleton skel-h1"></div>
        <div class="skeleton skel-desc"></div>
      </div>
      ${card()}${card()}${card()}${card()}
    </div>`;
}

function skeletonPost() {
  return `
    <div style="padding-top: var(--sp-12);">
      <div class="skeleton" style="height:10px;width:64px;margin-bottom:var(--sp-10);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:10px;width:120px;margin-bottom:var(--sp-5);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:48px;width:72%;margin-bottom:var(--sp-4);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:16px;width:50%;margin-bottom:var(--sp-12);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:14px;width:90%;margin-bottom:var(--sp-3);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:var(--sp-3);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:14px;width:85%;margin-bottom:var(--sp-3);border-radius:var(--r-sm)"></div>
      <div class="skeleton" style="height:14px;width:60%;border-radius:var(--r-sm)"></div>
    </div>`;
}

/* ─── UTILITIES ───────────────────────────────────────────────── */

function formatDate(str) {
  if (!str || str === '1970-01-01') return '';
  try {
    const d = new Date(str.trim() + 'T12:00:00Z');
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch { return str; }
}

function calcReadingTime(text) {
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.ceil(words / 220));
  return `${mins} min read`;
}

function slugToTitle(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
