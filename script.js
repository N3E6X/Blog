/* =============================================================
 *  N3E6X BLOG ENGINE — 2025/2026 EDITION
 *  =============================================================
 *
 *  FEATURES:
 *  - Three-column layout (TOC | Content | Recommendations)
 *  - Auto-generated table of contents
 *  - Reading progress indicator
 *  - Full markdown support
 *  - GitHub Pages compatible
 *  - Dark/Light mode toggle
 *
 *  ============================================================= */

const CONFIG = {
    github: {
        username: 'N3E6X',
        repo:     'Blog',
        branch:   'main'
    },
    postsDir:        'posts',
    blogName:        'N3E6X',
    blogDescription: 'Thoughts, code, and everything between.'
};

/* =============================================================
 *  STATE
 *  ============================================================= */

const state = {
    posts:   [],
    loading: true,
    error:   null,
    currentPost: null
};

/* =============================================================
 *  INIT
 *  ============================================================= */

document.addEventListener('DOMContentLoaded', async () => {
    setupThemeToggle();
    setupScrollProgress();
    window.addEventListener('hashchange', handleRoute);

    handleRoute();
    await loadPosts();
    handleRoute();
});

/* =============================================================
 *  THEME TOGGLE
 *  ============================================================= */

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    if (localStorage.getItem('n3e6x-theme') === 'light') {
        document.body.classList.add('light-mode');
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('n3e6x-theme', mode);
    });
}

/* =============================================================
 *  SCROLL PROGRESS
 *  ============================================================= */

function setupScrollProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;

        progressBar.style.width = Math.min(100, Math.max(0, scrollPercent)) + '%';
    });
}

/* =============================================================
 *  ROUTING
 *  ============================================================= */

function handleRoute() {
    const hash = (window.location.hash || '#/').replace('#', '');

    if (hash.startsWith('/post/')) {
        const slug = hash.replace('/post/', '');
        renderPost(slug);
    } else {
        renderHome();
    }
}

/* =============================================================
 *  DATA LOADING
 *  ============================================================= */

async function loadPosts() {
    state.loading = true;
    state.error = null;

    if (CONFIG.github.username === 'YOUR_USERNAME') {
        state.error = 'Configure your GitHub details in CONFIG.';
        state.loading = false;
        return;
    }

    try {
        await loadViaGitHubAPI();
    } catch (apiErr) {
        console.warn('GitHub API failed:', apiErr.message);
        try {
            await loadViaManifest();
        } catch (manErr) {
            console.warn('Manifest fallback failed:', manErr.message);
            state.error = 'Could not load posts. Check configuration.';
        }
    }

    state.loading = false;
}

async function loadViaGitHubAPI() {
    const { username, repo, branch } = CONFIG.github;
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${CONFIG.postsDir}?ref=${branch}`;

    const res = await fetch(url);
    if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error(info.message || `API ${res.status}`);
    }

    const files = await res.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');

    const posts = await Promise.all(
        mdFiles.map(file => fetchAndParsePost(file.name, file.download_url))
    );

    state.posts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadViaManifest() {
    const res = await fetch('./posts.json');
    if (!res.ok) throw new Error('No posts.json');

    const filenames = await res.json();
    const posts = await Promise.all(
        filenames.map(name => fetchAndParsePost(name, null))
    );

    state.posts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function fetchAndParsePost(filename, downloadUrl) {
    try {
        let res = await fetch(`./${CONFIG.postsDir}/${filename}`, { cache: 'no-cache' });

        if (!res.ok && downloadUrl) {
            res = await fetch(downloadUrl);
        }

        if (!res.ok) return null;

        const raw = await res.text();
        return parsePost(filename, raw);
    } catch (e) {
        console.warn(`Failed to load ${filename}:`, e);
        return null;
    }
}

/* =============================================================
 *  MARKDOWN PARSING
 *  ============================================================= */

function parsePost(filename, raw) {
    raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const { meta, content } = parseFrontmatter(raw);
    const slug = filename.replace(/\.md$/i, '');

    const post = {
        slug,
        filename,
        title:       meta.title || toTitleCase(slug),
        date:        meta.date  || '1970-01-01',
        description: meta.description || '',
        tags:        meta.tags || '',
        content,
        html:        '',
        headings:    [],
        readingTime: estimateReadingTime(content)
    };

    post.html = parseMarkdown(content, post.headings);

    return post;
}

function parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, content: raw };

    const meta = {};
    match[1].split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const key = line.slice(0, idx).trim().toLowerCase();
        let val   = line.slice(idx + 1).trim();
        if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
        meta[key] = val;
    });

    return { meta, content: match[2].trim() };
}

function parseMarkdown(text, headings = []) {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';

    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let inList = false;
    let listTag = '';
    let inBlockquote = false;
    let bqLines = [];
    let paraLines = [];
    let inTable = false;
    let tableLines = [];

    function inline(str) {
        // Footnotes
        str = str.replace(/\[\^(\w+)\]/g, '<sup class="footnote"><a href="#fn-$1">$1</a></sup>');

        // Inline code (protect first)
        str = str.replace(/`([^`]+)`/g, (_, c) => '<code>' + esc(c) + '</code>');

        // Images
        str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

        // Links
        str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Bold + Italic
        str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        str = str.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

        // Bold
        str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        str = str.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // Italic
        str = str.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        str = str.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

        // Strikethrough
        str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Highlight
        str = str.replace(/==(.+?)==/g, '<mark>$1</mark>');

        // Subscript
        str = str.replace(/~(.+?)~/g, '<sub>$1</sub>');

        // Superscript
        str = str.replace(/\^(.+?)\^/g, '<sup>$1</sup>');

        // Abbreviations
        str = str.replace(/\*\[([^\]]+)\]:\s*(.+)/g, '<abbr title="$2">$1</abbr>');

        return str;
    }

    function flushPara() {
        if (paraLines.length) {
            html += '<p>' + inline(paraLines.join(' ')) + '</p>\n';
            paraLines = [];
        }
    }

    function flushList() {
        if (inList) {
            html += '</' + listTag + '>\n';
            inList = false;
            listTag = '';
        }
    }

    function flushBQ() {
        if (inBlockquote) {
            html += '<p>' + inline(bqLines.join(' ')) + '</p>\n</blockquote>\n';
            inBlockquote = false;
            bqLines = [];
        }
    }

    function flushTable() {
        if (inTable && tableLines.length > 0) {
            html += '<table>\n';

            // Header
            const headerCells = tableLines[0].split('|').filter(c => c.trim());
            html += '<thead><tr>\n';
            headerCells.forEach(cell => {
                html += '<th>' + inline(cell.trim()) + '</th>\n';
            });
            html += '</tr></thead>\n<tbody>\n';

            // Body rows (skip separator line)
            for (let i = 2; i < tableLines.length; i++) {
                const cells = tableLines[i].split('|').filter(c => c.trim());
                html += '<tr>\n';
                cells.forEach(cell => {
                    html += '<td>' + inline(cell.trim()) + '</td>\n';
                });
                html += '</tr>\n';
            }

            html += '</tbody></table>\n';
            inTable = false;
            tableLines = [];
        }
    }

    function flushAll() {
        flushPara();
        flushList();
        flushBQ();
        flushTable();
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        /* Code blocks */
        if (line.trim().startsWith('```')) {
            if (inCode) {
                html += '<pre><code' +
                (codeLang ? ' class="language-' + codeLang + '"' : '') +
                '>' + esc(codeLines.join('\n')) + '</code></pre>\n';
                inCode = false;
                codeLines = [];
                codeLang = '';
            } else {
                flushAll();
                inCode = true;
                codeLang = line.trim().slice(3).trim();
            }
            continue;
        }
        if (inCode) {
            codeLines.push(line);
            continue;
        }

        /* Blank line */
        if (line.trim() === '') {
            flushAll();
            continue;
        }

        /* Headings */
        const hm = line.match(/^(#{1,6})\s+(.+)$/);
        if (hm) {
            flushAll();
            const lvl = hm[1].length;
            const text = hm[2].trim();
            const id = slugify(text);

            // Store heading for TOC
            headings.push({ level: lvl, text, id });

            html += `<h${lvl} id="${id}">${inline(text)}</h${lvl}>\n`;
            continue;
        }

        /* Horizontal rule */
        if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
            flushAll();
            html += '<hr>\n';
            continue;
        }

        /* Blockquote */
        const bqm = line.match(/^>\s?(.*)$/);
        if (bqm) {
            flushPara();
            flushList();
            flushTable();
            if (!inBlockquote) {
                html += '<blockquote>\n';
                inBlockquote = true;
            }
            bqLines.push(bqm[1]);
            continue;
        }
        if (inBlockquote) flushBQ();

        /* Tables */
        if (line.includes('|') && !inList) {
            flushPara();
            flushBQ();
            if (!inTable) {
                inTable = true;
            }
            tableLines.push(line);
            continue;
        }
        if (inTable) flushTable();

        /* Task list */
        const taskm = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
        if (taskm) {
            flushPara();
            flushBQ();
            if (!inList || listTag !== 'ul') {
                flushList();
                html += '<ul class="task-list">\n';
                inList = true;
                listTag = 'ul';
            }
            const checked = taskm[1].toLowerCase() === 'x';
            html += '<li><input type="checkbox"' + (checked ? ' checked' : '') + ' disabled> ' +
            inline(taskm[2]) + '</li>\n';
            continue;
        }

        /* Unordered list */
        const ulm = line.match(/^\s*[-*+]\s+(.+)$/);
        if (ulm) {
            flushPara();
            flushBQ();
            if (!inList || listTag !== 'ul') {
                flushList();
                html += '<ul>\n';
                inList = true;
                listTag = 'ul';
            }
            html += '<li>' + inline(ulm[1]) + '</li>\n';
            continue;
        }

        /* Ordered list */
        const olm = line.match(/^\s*\d+\.\s+(.+)$/);
        if (olm) {
            flushPara();
            flushBQ();
            if (!inList || listTag !== 'ol') {
                flushList();
                html += '<ol>\n';
                inList = true;
                listTag = 'ol';
            }
            html += '<li>' + inline(olm[1]) + '</li>\n';
            continue;
        }

        /* Definition list */
        const dtm = line.match(/^([^:]+)\s*$/);
        const ddm = lines[i + 1] && lines[i + 1].match(/^:\s+(.+)$/);
        if (dtm && ddm) {
            flushAll();
            html += '<dl>\n<dt>' + inline(dtm[1].trim()) + '</dt>\n';
            html += '<dd>' + inline(ddm[1]) + '</dd>\n</dl>\n';
            i++; // Skip next line
            continue;
        }

        /* Paragraph */
        flushList();
        flushBQ();
        flushTable();
        paraLines.push(line.trim());
    }

    flushAll();
    return html;
}

function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
}

function slugify(text) {
    return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/* =============================================================
 *  RENDERING
 *  ============================================================= */

function renderHome() {
    const app = document.getElementById('app');
    document.title = CONFIG.blogName;

    if (state.loading) {
        app.innerHTML = `<div class="home">${skeletonList(4)}</div>`;
        return;
    }

    if (state.error) {
        app.innerHTML = `
        <div class="state-error fade-in" role="alert">
        <h1 class="state-error__title">Something went wrong</h1>
        <p class="state-error__msg">${state.error}</p>
        <button class="btn" onclick="location.reload()">RETRY</button>
        </div>`;
        return;
    }

    if (!state.posts.length) {
        app.innerHTML = `
        <div class="state-empty fade-in">
        <p class="state-empty__text">No posts yet. Add .md files to the posts/ folder.</p>
        </div>`;
        return;
    }

    const cards = state.posts.map(p => `
    <a href="#/post/${p.slug}" class="post-card" aria-label="Read: ${p.title}">
    <div class="post-card__meta">
    <span>${formatDate(p.date)}</span>
    <span>${p.readingTime}</span>
    </div>
    <h2 class="post-card__title">${p.title}</h2>
    ${p.description ? `<p class="post-card__desc">${p.description}</p>` : ''}
    </a>`).join('');

    app.innerHTML = `
    <section class="home fade-in" aria-label="Blog posts">
    <h1 class="home__title">${CONFIG.blogName}</h1>
    <p class="home__desc">${CONFIG.blogDescription}</p>
    <div class="post-list" role="feed" aria-label="Posts">
    ${cards}
    </div>
    </section>`;
}

function renderPost(slug) {
    const app = document.getElementById('app');

    if (state.loading) {
        app.innerHTML = `<div class="post-layout">${skeletonPost()}</div>`;
        return;
    }

    const post = state.posts.find(p => p.slug === slug);

    if (!post) {
        document.title = 'Not Found — ' + CONFIG.blogName;
        app.innerHTML = `
        <div class="state-error fade-in" role="alert">
        <a href="#/" class="post__back">← BACK</a>
        <h1 class="state-error__title">Post not found</h1>
        <p class="state-error__msg">No post matching "${slug}" exists.</p>
        <a href="#/" class="btn">ALL POSTS</a>
        </div>`;
        return;
    }

    state.currentPost = post;
    document.title = post.title + ' — ' + CONFIG.blogName;

    // Generate TOC
    const tocHTML = generateTOC(post.headings);

    // Generate recommendations
    const recommendations = getRecommendations(post);
    const recHTML = generateRecommendations(recommendations);

    app.innerHTML = `
    <article class="post-layout fade-in">
    ${tocHTML}

    <div class="post-content">
    <a href="#/" class="post__back">← BACK</a>

    <header class="post__header">
    <div class="post__meta">
    <span>${formatDate(post.date)}</span>
    <div class="post__meta-divider"></div>
    <span>${post.readingTime}</span>
    </div>
    <h1 class="post__title">${post.title}</h1>
    ${post.description ? `<p class="post__description">${post.description}</p>` : ''}
    </header>

    <div class="article">${post.html}</div>
    </div>

    ${recHTML}
    </article>`;

    window.scrollTo(0, 0);
    setupTOCActiveStates();
}

/* =============================================================
 *  TABLE OF CONTENTS
 *  ============================================================= */

function generateTOC(headings) {
    if (!headings || headings.length === 0) {
        return '<div class="toc"></div>';
    }

    const items = headings
    .filter(h => h.level <= 4)
    .map(h => `
    <li class="toc__item">
    <a href="#${h.id}" class="toc__link toc__link--h${h.level}">${h.text}</a>
    </li>
    `).join('');

    return `
    <nav class="toc" aria-label="Table of contents">
    <h2 class="toc__title">Contents</h2>
    <ul class="toc__list">
    ${items}
    </ul>
    </nav>`;
}

function setupTOCActiveStates() {
    const headings = document.querySelectorAll('.article h1, .article h2, .article h3, .article h4');
    const tocLinks = document.querySelectorAll('.toc__link');

    if (!headings.length || !tocLinks.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                tocLinks.forEach(link => {
                    if (link.getAttribute('href') === '#' + id) {
                        tocLinks.forEach(l => l.classList.remove('active'));
                        link.classList.add('active');
                    }
                });
            }
        });
    }, {
        rootMargin: '-80px 0px -80% 0px'
    });

    headings.forEach(heading => observer.observe(heading));
}

/* =============================================================
 *  RECOMMENDATIONS
 *  ============================================================= */

function getRecommendations(currentPost) {
    return state.posts
    .filter(p => p.slug !== currentPost.slug)
    .slice(0, 3);
}

function generateRecommendations(posts) {
    if (!posts || posts.length === 0) {
        return '<div class="recommendations"></div>';
    }

    const cards = posts.map(p => `
    <a href="#/post/${p.slug}" class="rec-card">
    <h3 class="rec-card__title">${p.title}</h3>
    <div class="rec-card__meta">${formatDate(p.date)}</div>
    </a>
    `).join('');

    return `
    <aside class="recommendations" aria-label="Related posts">
    <h2 class="recommendations__title">Related</h2>
    <div class="recommendations__list">
    ${cards}
    </div>
    </aside>`;
}

/* =============================================================
 *  SKELETONS
 *  ============================================================= */

function skeletonList(count) {
    const item = `
    <div class="skeleton-group">
    <div class="skeleton skeleton--overline"></div>
    <div class="skeleton skeleton--title"></div>
    <div class="skeleton skeleton--text"></div>
    </div>`;
    return item.repeat(count);
}

function skeletonPost() {
    return `
    <div style="display:none"></div>
    <div>
    <div class="skeleton skeleton--overline" style="width:48px;margin-bottom:var(--s-48)"></div>
    <div style="margin-bottom:var(--s-64);padding-bottom:var(--s-40);border-bottom:1px solid var(--color-border)">
    <div class="skeleton skeleton--overline" style="margin-bottom:var(--s-24)"></div>
    <div class="skeleton" style="height:56px;width:80%;margin-bottom:var(--s-16)"></div>
    </div>
    <div class="skeleton skeleton--text" style="margin-bottom:var(--s-24)"></div>
    <div class="skeleton skeleton--text" style="width:75%;margin-bottom:var(--s-24)"></div>
    <div class="skeleton skeleton--text" style="width:60%"></div>
    </div>
    <div style="display:none"></div>`;
}

/* =============================================================
 *  UTILITIES
 *  ============================================================= */

function formatDate(str) {
    if (!str || str === '1970-01-01') return '';
    try {
        const d = new Date(str.trim() + 'T00:00:00');
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return str;
    }
}

function estimateReadingTime(text) {
    const words = text.trim().split(/\s+/).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return mins + ' MIN READ';
}

function toTitleCase(slug) {
    return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
