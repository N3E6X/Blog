/* =============================================================================
 *  N3E6X BLOG ENGINE — 2025/2026 EDITION
 *  Ultra Sleek • Secure • Performant
 *  =============================================================================
 *
 *  SETUP INSTRUCTIONS:
 *  1. Update CONFIG with your GitHub username and repository name
 *  2. Create .md files in the /posts directory with frontmatter:
 *
 *  ---
 *  title: Your Post Title
 *  date: 2025-01-15
 *  description: A brief summary of the post.
 *  tags: javascript, web
 *  ---
 *
 *  Your markdown content here...
 *
 *  3. Push to GitHub and enable GitHub Pages
 *
 *  ============================================================================= */

const CONFIG = {
    github: {
        username: 'N3E6X',      // ← Your GitHub username
        repo: 'Blog',           // ← Your repository name
        branch: 'main'
    },
    postsDir: 'posts',
    blogName: 'N3E6X',
    blogDescription: 'Exploring ideas at the intersection of technology, design, and human experience.'
};

/* =============================================================================
 *  APPLICATION STATE
 *  ============================================================================= */

const state = {
    posts: [],
    loading: true,
    error: null,
    currentPost: null,
    tocObserver: null
};

/* =============================================================================
 *  INITIALIZATION
 *  ============================================================================= */

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initReadingProgress();

    window.addEventListener('hashchange', handleRoute);

    // Initial render with loading state
    handleRoute();

    // Load posts
    await loadPosts();

    // Re-render with data
    handleRoute();
});

/* =============================================================================
 *  THEME MANAGEMENT
 *  ============================================================================= */

function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('n3e6x-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    setTheme(theme);

    toggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('n3e6x-theme', newTheme);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('n3e6x-theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.setAttribute('aria-pressed', theme === 'light');
    }
}

/* =============================================================================
 *  READING PROGRESS
 *  ============================================================================= */

function initReadingProgress() {
    const progressEl = document.getElementById('reading-progress');
    if (!progressEl) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateReadingProgress(progressEl);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

function updateReadingProgress(progressEl) {
    const article = document.querySelector('.article');
    if (!article) {
        progressEl.classList.remove('visible');
        return;
    }

    const articleRect = article.getBoundingClientRect();
    const articleTop = articleRect.top + window.scrollY;
    const articleHeight = article.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrolled = window.scrollY;

    const start = articleTop - windowHeight;
    const end = articleTop + articleHeight;
    const progress = Math.max(0, Math.min(1, (scrolled - start) / (end - start)));

    const bar = progressEl.querySelector('.reading-progress-bar');
    if (bar) {
        bar.style.width = `${progress * 100}%`;
    }

    progressEl.classList.toggle('visible', progress > 0 && progress < 1);
}

/* =============================================================================
 *  ROUTING
 *  ============================================================================= */

function handleRoute() {
    const hash = (window.location.hash || '#/').replace('#', '');

    // Clean up previous observers
    if (state.tocObserver) {
        state.tocObserver.disconnect();
        state.tocObserver = null;
    }

    if (hash.startsWith('/post/')) {
        const slug = decodeURIComponent(hash.replace('/post/', ''));
        renderPost(slug);
    } else {
        renderHome();
    }
}

/* =============================================================================
 *  DATA LOADING
 *  ============================================================================= */

async function loadPosts() {
    state.loading = true;
    state.error = null;

    if (CONFIG.github.username === 'YOUR_USERNAME') {
        state.error = 'Please configure your GitHub username and repository in script.js';
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
            try {
                await loadViaDirectFetch();
            } catch (directErr) {
                state.error = 'Unable to load posts. Please check your configuration.';
            }
        }
    }

    state.loading = false;
}

async function loadViaGitHubAPI() {
    const { username, repo, branch } = CONFIG.github;
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${CONFIG.postsDir}?ref=${branch}`;

    const res = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        throw new Error(info.message || `API responded with ${res.status}`);
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
    if (!res.ok) throw new Error('No posts.json found');

    const filenames = await res.json();

    const posts = await Promise.all(
        filenames.map(name => fetchAndParsePost(name, null))
    );

    state.posts = posts
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadViaDirectFetch() {
    // Try fetching a known test file
    const res = await fetch(`./${CONFIG.postsDir}/`);
    if (!res.ok) throw new Error('Cannot access posts directory');
    throw new Error('Directory listing not supported');
}

async function fetchAndParsePost(filename, downloadUrl) {
    try {
        // Try local path first (faster, no rate limits)
        let res = await fetch(`./${CONFIG.postsDir}/${filename}`, {
            cache: 'no-cache',
            headers: { 'Accept': 'text/plain' }
        });

        // Fallback to raw GitHub URL
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

/* =============================================================================
 *  PARSING — FRONTMATTER & METADATA
 *  ============================================================================= */

function parsePost(filename, raw) {
    // Normalize line endings
    raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const { meta, content } = parseFrontmatter(raw);
    const slug = filename.replace(/\.md$/i, '');

    // Extract headings for TOC
    const headings = extractHeadings(content);

    return {
        slug,
        filename,
        title: sanitizeText(meta.title) || toTitleCase(slug),
        date: meta.date || '1970-01-01',
        description: sanitizeText(meta.description) || '',
        tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
        content,
        html: parseMarkdown(content),
        headings,
        readingTime: estimateReadingTime(content),
        wordCount: countWords(content)
    };
}

function parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, content: raw };

    const meta = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;

        const key = line.slice(0, idx).trim().toLowerCase();
        let val = line.slice(idx + 1).trim();

        // Remove surrounding quotes
        if (/^["'].*["']$/.test(val)) {
            val = val.slice(1, -1);
        }

        meta[key] = val;
    }

    return { meta, content: match[2].trim() };
}

function extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const match = line.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
            const level = match[1].length;
            const text = match[2].trim();
            const id = slugify(text);
            headings.push({ level, text, id });
        }
    }

    return headings;
}

/* =============================================================================
 *  PARSING — MARKDOWN TO HTML
 *  ============================================================================= */

function parseMarkdown(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';

    // Parser state
    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let inList = false;
    let listTag = '';
    let inBlockquote = false;
    let bqLines = [];
    let paraLines = [];
    let inTable = false;
    let tableRows = [];

    function inline(str) {
        // Escape HTML first (security)
        str = escapeHtml(str);

        // Inline code (process first to protect content)
        str = str.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);

        // Images
        str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
            const safeSrc = sanitizeUrl(src);
            const safeAlt = escapeAttr(alt);
            return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy">`;
        });

        // Links
        str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
            const safeHref = sanitizeUrl(href);
            return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        // Bold + Italic
        str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

        // Bold
        str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        str = str.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // Italic
        str = str.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        str = str.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

        // Strikethrough
        str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Highlight/Mark
        str = str.replace(/==(.+?)==/g, '<mark>$1</mark>');

        // Superscript
        str = str.replace(/\^([^\s^]+)\^/g, '<sup>$1</sup>');

        // Subscript
        str = str.replace(/~([^\s~]+)~/g, '<sub>$1</sub>');

        return str;
    }

    function flushPara() {
        if (paraLines.length) {
            html += `<p>${inline(paraLines.join(' '))}</p>\n`;
            paraLines = [];
        }
    }

    function flushList() {
        if (inList) {
            html += `</${listTag}>\n`;
            inList = false;
            listTag = '';
        }
    }

    function flushBQ() {
        if (inBlockquote) {
            html += `<p>${inline(bqLines.join(' '))}</p>\n</blockquote>\n`;
            inBlockquote = false;
            bqLines = [];
        }
    }

    function flushTable() {
        if (inTable && tableRows.length > 0) {
            let tableHtml = '<table>\n';

            // Header row
            const headerCells = tableRows[0].split('|').filter(c => c.trim());
            tableHtml += '<thead><tr>';
            for (const cell of headerCells) {
                tableHtml += `<th>${inline(cell.trim())}</th>`;
            }
            tableHtml += '</tr></thead>\n';

            // Body rows (skip separator row at index 1)
            if (tableRows.length > 2) {
                tableHtml += '<tbody>\n';
                for (let i = 2; i < tableRows.length; i++) {
                    const cells = tableRows[i].split('|').filter(c => c.trim());
                    tableHtml += '<tr>';
                    for (const cell of cells) {
                        tableHtml += `<td>${inline(cell.trim())}</td>`;
                    }
                    tableHtml += '</tr>\n';
                }
                tableHtml += '</tbody>\n';
            }

            tableHtml += '</table>\n';
            html += tableHtml;

            inTable = false;
            tableRows = [];
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

        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCode) {
                html += `<pre data-lang="${escapeAttr(codeLang)}"><code class="language-${escapeAttr(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>\n`;
                inCode = false;
                codeLines = [];
                codeLang = '';
            } else {
                flushAll();
                inCode = true;
                codeLang = line.trim().slice(3).trim() || 'text';
            }
            continue;
        }

        if (inCode) {
            codeLines.push(line);
            continue;
        }

        // Blank line
        if (line.trim() === '') {
            flushAll();
            continue;
        }

        // Table detection
        if (line.includes('|') && line.trim().startsWith('|')) {
            flushPara();
            flushList();
            flushBQ();

            if (!inTable) {
                inTable = true;
            }
            tableRows.push(line.trim());
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Headings
        const hm = line.match(/^(#{1,6})\s+(.+)$/);
        if (hm) {
            flushAll();
            const lvl = hm[1].length;
            const text = hm[2].trim();
            const id = slugify(text);
            html += `<h${lvl} id="${escapeAttr(id)}">${inline(text)}</h${lvl}>\n`;
            continue;
        }

        // Horizontal rule
        if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
            flushAll();
            html += '<hr>\n';
            continue;
        }

        // Blockquote
        const bqm = line.match(/^>\s?(.*)$/);
        if (bqm) {
            flushPara();
            flushList();
            if (!inBlockquote) {
                html += '<blockquote>\n';
                inBlockquote = true;
            }
            bqLines.push(bqm[1]);
            continue;
        }
        if (inBlockquote) flushBQ();

        // Task list
        const taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
        if (taskMatch) {
            flushPara();
            flushBQ();
            if (!inList || listTag !== 'ul') {
                flushList();
                html += '<ul class="task-list">\n';
                inList = true;
                listTag = 'ul';
            }
            const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
            html += `<li class="task-list-item"><input type="checkbox" ${checked} disabled>${inline(taskMatch[2])}</li>\n`;
            continue;
        }

        // Unordered list
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
            html += `<li>${inline(ulm[1])}</li>\n`;
            continue;
        }

        // Ordered list
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
            html += `<li>${inline(olm[1])}</li>\n`;
            continue;
        }

        // Paragraph text
        flushList();
        flushBQ();
        paraLines.push(line.trim());
    }

    flushAll();
    return html;
}

/* =============================================================================
 *  SECURITY UTILITIES
 *  ============================================================================= */

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeText(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
}

function sanitizeUrl(url) {
    if (!url) return '';

    // Allow only safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', './'];
    const lower = url.toLowerCase().trim();

    // Check for javascript: or data: URLs
    if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
        return '#';
    }

    // Relative URLs are safe
    if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/') || url.startsWith('#')) {
        return url;
    }

    // Check protocol
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            return '#';
        }
    } catch {
        // If parsing fails, it might be a relative path
        return url;
    }

    return url;
}

function slugify(text) {
    return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* =============================================================================
 *  RENDERING — HOME PAGE
 *  ============================================================================= */

function renderHome() {
    const app = document.getElementById('app');
    document.title = CONFIG.blogName;

    if (state.loading) {
        app.innerHTML = renderSkeletonList(4);
        return;
    }

    if (state.error) {
        app.innerHTML = renderErrorState(state.error);
        return;
    }

    if (!state.posts.length) {
        app.innerHTML = renderEmptyState();
        return;
    }

    const postsHtml = state.posts.map(post => `
    <a href="#/post/${encodeURIComponent(post.slug)}" class="post-card" aria-label="Read: ${escapeAttr(post.title)}">
    <div class="post-card-header">
    <div class="post-card-meta">
    <span class="post-card-date">${formatDate(post.date)}</span>
    <span class="post-card-reading">${post.readingTime}</span>
    </div>
    </div>
    <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
    ${post.description ? `<p class="post-card-description">${escapeHtml(post.description)}</p>` : ''}
    <div class="post-card-footer">
    <span class="post-card-read-more">
    Read article
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
    </span>
    </div>
    </a>
    `).join('');

    app.innerHTML = `
    <section class="home">
    <header class="home-hero">
    <div class="home-badge">Blog</div>
    <h1 class="home-title">${escapeHtml(CONFIG.blogName)}</h1>
    <p class="home-description">${escapeHtml(CONFIG.blogDescription)}</p>
    </header>

    <div class="posts-section">
    <div class="posts-section-header">
    <span class="posts-section-title">Latest Posts</span>
    <span class="posts-count">${state.posts.length} articles</span>
    </div>
    <div class="posts-grid" role="feed" aria-label="Blog posts">
    ${postsHtml}
    </div>
    </div>
    </section>
    `;
}

/* =============================================================================
 *  RENDERING — POST PAGE
 *  ============================================================================= */

function renderPost(slug) {
    const app = document.getElementById('app');

    if (state.loading) {
        app.innerHTML = renderSkeletonPost();
        return;
    }

    const post = state.posts.find(p => p.slug === slug);

    if (!post) {
        document.title = `Not Found — ${CONFIG.blogName}`;
        app.innerHTML = renderNotFoundState(slug);
        return;
    }

    document.title = `${post.title} — ${CONFIG.blogName}`;
    state.currentPost = post;

    // Generate TOC
    const tocHtml = renderTOC(post.headings);

    // Generate recommendations
    const recommendations = getRecommendations(post, state.posts, 3);
    const recommendationsHtml = renderRecommendations(recommendations);

    app.innerHTML = `
    <article class="post-layout" aria-label="${escapeAttr(post.title)}">
    <!-- Table of Contents - Left Sidebar -->
    <aside class="post-toc" aria-label="Table of contents">
    <div class="toc-header">On this page</div>
    <nav class="toc-list">
    ${tocHtml}
    </nav>
    </aside>

    <!-- Main Content - Center -->
    <div class="post-main">
    <a href="#/" class="post-back">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    Back to posts
    </a>

    <!-- Mobile TOC -->
    <div class="mobile-toc">
    <button class="mobile-toc-toggle" aria-expanded="false" aria-controls="mobile-toc-content">
    <span>Table of Contents</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M6 9l6 6 6-6"/>
    </svg>
    </button>
    <nav id="mobile-toc-content" class="mobile-toc-content" aria-label="Table of contents">
    ${tocHtml}
    </nav>
    </div>

    <header class="post-header">
    <div class="post-meta">
    <span class="post-meta-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
    ${formatDate(post.date)}
    </span>
    <span class="post-meta-divider"></span>
    <span class="post-meta-item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
    </svg>
    ${post.readingTime}
    </span>
    <span class="post-meta-divider"></span>
    <span class="post-meta-item">
    ${post.wordCount.toLocaleString()} words
    </span>
    </div>
    <h1 class="post-title">${escapeHtml(post.title)}</h1>
    ${post.description ? `<p class="post-description">${escapeHtml(post.description)}</p>` : ''}
    </header>

    <div class="article">
    ${post.html}
    </div>
    </div>

    <!-- Recommendations - Right Sidebar -->
    <aside class="post-sidebar" aria-label="Recommended posts">
    ${recommendationsHtml}
    </aside>
    </article>
    `;

    // Setup interactions
    setupTOCObserver(post.headings);
    setupMobileTOC();

    // Scroll to top
    window.scrollTo(0, 0);
}

function renderTOC(headings) {
    if (!headings || headings.length === 0) {
        return '<span class="toc-empty">No headings</span>';
    }

    return headings.map(h => {
        const levelClass = `toc-link--h${h.level}`;
        return `
        <div class="toc-item">
        <a href="#${escapeAttr(h.id)}" class="toc-link ${levelClass}" data-heading-id="${escapeAttr(h.id)}">
        ${escapeHtml(h.text)}
        </a>
        </div>
        `;
    }).join('');
}

function renderRecommendations(posts) {
    if (!posts || posts.length === 0) {
        return '';
    }

    const cardsHtml = posts.map(post => `
    <a href="#/post/${encodeURIComponent(post.slug)}" class="recommendation-card">
    <h4 class="recommendation-card-title">${escapeHtml(post.title)}</h4>
    <span class="recommendation-card-meta">${formatDate(post.date)}</span>
    </a>
    `).join('');

    return `
    <div class="sidebar-section">
    <div class="sidebar-header">Recommended</div>
    ${cardsHtml}
    </div>
    `;
}

function getRecommendations(currentPost, allPosts, count) {
    // Filter out current post and get others
    const otherPosts = allPosts.filter(p => p.slug !== currentPost.slug);

    // Simple recommendation: most recent posts (can be enhanced with tag matching)
    return otherPosts.slice(0, count);
}

function setupTOCObserver(headings) {
    if (!headings || headings.length === 0) return;

    const headingEls = headings
    .map(h => document.getElementById(h.id))
    .filter(Boolean);

    if (headingEls.length === 0) return;

    state.tocObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Remove active from all
                    document.querySelectorAll('.toc-link').forEach(link => {
                        link.classList.remove('active');
                    });

                    // Add active to current
                    const id = entry.target.getAttribute('id');
                    const activeLink = document.querySelector(`.toc-link[data-heading-id="${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        },
        {
            rootMargin: '-80px 0px -80% 0px',
            threshold: 0
        }
    );

    headingEls.forEach(el => state.tocObserver.observe(el));
}

function setupMobileTOC() {
    const toggle = document.querySelector('.mobile-toc-toggle');
    const content = document.querySelector('.mobile-toc-content');

    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
        content.classList.toggle('open', !expanded);
    });

    // Close on link click
    content.querySelectorAll('.toc-link').forEach(link => {
        link.addEventListener('click', () => {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
        });
    });
}

/* =============================================================================
 *  RENDERING — STATES
 *  ============================================================================= */

function renderSkeletonList(count) {
    const items = Array(count).fill(0).map(() => `
    <div class="skeleton-card">
    <div class="skeleton skeleton-line skeleton-line--sm"></div>
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-line skeleton-line--lg"></div>
    <div class="skeleton skeleton-line skeleton-line--md"></div>
    </div>
    `).join('');

    return `
    <section class="home">
    <header class="home-hero">
    <div class="skeleton skeleton-line skeleton-line--sm" style="width: 60px; margin-bottom: var(--space-6);"></div>
    <div class="skeleton" style="height: 3rem; width: 50%; margin-bottom: var(--space-6);"></div>
    <div class="skeleton skeleton-line skeleton-line--lg"></div>
    </header>
    <div class="posts-grid">
    ${items}
    </div>
    </section>
    `;
}

function renderSkeletonPost() {
    return `
    <div class="post-layout">
    <div class="post-toc">
    <div class="skeleton skeleton-line" style="width: 80%; margin-bottom: var(--space-3);"></div>
    <div class="skeleton skeleton-line" style="width: 60%; margin-bottom: var(--space-3);"></div>
    <div class="skeleton skeleton-line" style="width: 70%;"></div>
    </div>
    <div class="post-main">
    <div class="skeleton skeleton-line skeleton-line--sm" style="margin-bottom: var(--space-8);"></div>
    <div class="post-header" style="border: none;">
    <div class="skeleton skeleton-line skeleton-line--sm" style="margin-bottom: var(--space-4);"></div>
    <div class="skeleton" style="height: 2.5rem; width: 80%; margin-bottom: var(--space-4);"></div>
    <div class="skeleton skeleton-line skeleton-line--lg"></div>
    </div>
    <div style="margin-top: var(--space-8);">
    <div class="skeleton skeleton-line skeleton-line--xl" style="margin-bottom: var(--space-3);"></div>
    <div class="skeleton skeleton-line skeleton-line--lg" style="margin-bottom: var(--space-3);"></div>
    <div class="skeleton skeleton-line skeleton-line--md" style="margin-bottom: var(--space-3);"></div>
    <div class="skeleton skeleton-line skeleton-line--lg"></div>
    </div>
    </div>
    <div class="post-sidebar"></div>
    </div>
    `;
}

function renderErrorState(message) {
    return `
    <div class="state-message" role="alert">
    <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 8v4M12 16h.01"/>
    </svg>
    <h1 class="state-title">Something went wrong</h1>
    <p class="state-description">${escapeHtml(message)}</p>
    <button class="btn btn--primary" onclick="location.reload()">
    Try again
    </button>
    </div>
    `;
}

function renderEmptyState() {
    return `
    <div class="state-message">
    <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6M12 18v-6M9 15h6"/>
    </svg>
    <h1 class="state-title">No posts yet</h1>
    <p class="state-description">Add markdown files to the posts/ folder to get started.</p>
    </div>
    `;
}

function renderNotFoundState(slug) {
    return `
    <div class="state-message" role="alert">
    <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
    <path d="M11 8v6M8 11h6"/>
    </svg>
    <h1 class="state-title">Post not found</h1>
    <p class="state-description">No post matching "${escapeHtml(slug)}" exists.</p>
    <a href="#/" class="btn btn--primary">
    Back to posts
    </a>
    </div>
    `;
}

/* =============================================================================
 *  UTILITIES
 *  ============================================================================= */

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
    const words = countWords(text);
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
}

function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function toTitleCase(slug) {
    return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
