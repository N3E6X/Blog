/* ========================================
   N3E6X BLOG ENGINE — 2026 EDITION
   ======================================== */

const CONFIG = {
    github: {
        username: 'N3E6X',
        repo: 'Blog',
        branch: 'main'
    },
    postsDir: 'posts',
    blogName: 'N3E6X',
    blogDescription: 'Thoughts, code, and everything between.'
};

const state = {
    posts: [],
    loading: true,
    error: null,
    currentPost: null
};

/* ========================================
   INITIALIZATION
   ======================================== */

document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupRouter();
    await loadPosts();
    handleRoute();
});

/* ========================================
   THEME
   ======================================== */

function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('n3e6x-theme');
    
    if (saved === 'light') {
        document.body.classList.add('light-mode');
    }
    
    btn?.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('n3e6x-theme', isLight ? 'light' : 'dark');
    });
}

/* ========================================
   ROUTING
   ======================================== */

function setupRouter() {
    window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    
    if (hash.startsWith('/post/')) {
        const slug = hash.replace('/post/', '');
        renderPost(slug);
    } else {
        renderHome();
    }
}

function navigate(path) {
    window.location.hash = path;
}

/* ========================================
   DATA LOADING
   ======================================== */

async function loadPosts() {
    state.loading = true;
    state.error = null;
    
    try {
        await loadViaGitHubAPI();
    } catch (err) {
        console.warn('GitHub API failed:', err);
        try {
            await loadViaManifest();
        } catch (err2) {
            console.warn('Manifest failed:', err2);
            state.error = 'Unable to load posts. Check your configuration.';
        }
    }
    
    state.loading = false;
}

async function loadViaGitHubAPI() {
    const { username, repo, branch } = CONFIG.github;
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${CONFIG.postsDir}?ref=${branch}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    
    const files = await res.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');
    
    const posts = await Promise.all(
        mdFiles.map(file => fetchPost(file.name, file.download_url))
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
        filenames.map(name => fetchPost(name, null))
    );
    
    state.posts = posts
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function fetchPost(filename, downloadUrl) {
    try {
        let res = await fetch(`./${CONFIG.postsDir}/${filename}`, { cache: 'no-cache' });
        
        if (!res.ok && downloadUrl) {
            res = await fetch(downloadUrl);
        }
        
        if (!res.ok) return null;
        
        const raw = await res.text();
        return parsePost(filename, raw);
    } catch (err) {
        console.warn(`Failed to load ${filename}:`, err);
        return null;
    }
}

/* ========================================
   MARKDOWN PARSING
   ======================================== */

function parsePost(filename, raw) {
    raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    const { meta, content } = parseFrontmatter(raw);
    const slug = filename.replace(/\.md$/i, '');
    
    return {
        slug,
        filename,
        title: meta.title || toTitleCase(slug),
        date: meta.date || '1970-01-01',
        description: meta.description || '',
        content,
        html: parseMarkdown(content),
        readingTime: estimateReadingTime(content)
    };
}

function parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, content: raw };
    
    const meta = {};
    match[1].split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const key = line.slice(0, idx).trim().toLowerCase();
        let val = line.slice(idx + 1).trim();
        if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
        meta[key] = val;
    });
    
    return { meta, content: match[2].trim() };
}

function parseMarkdown(text) {
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
    
    function inline(str) {
        str = str.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
        str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
        str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        str = str.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');
        str = str.replace(/==(.+?)==/g, '<mark>$1</mark>');
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
    
    function flushAll() {
        flushPara();
        flushList();
        flushBQ();
    }
    
    for (let line of lines) {
        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCode) {
                html += `<pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${esc(codeLines.join('\n'))}</code></pre>\n`;
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
        
        // Blank line
        if (line.trim() === '') {
            flushAll();
            continue;
        }
        
        // Headings
        const hm = line.match(/^(#{1,6})\s+(.+)$/);
        if (hm) {
            flushAll();
            const lvl = hm[1].length;
            const text = hm[2];
            const id = slugify(text);
            html += `<h${lvl} id="${id}">${inline(text)}</h${lvl}>\n`;
            continue;
        }
        
        // Horizontal rule
        if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
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
        
        // Paragraph
        flushList();
        flushBQ();
        paraLines.push(line.trim());
    }
    
    flushAll();
    return html;
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/* ========================================
   RENDERING
   ======================================== */

function renderHome() {
    const app = document.getElementById('app');
    document.title = CONFIG.blogName;
    
    if (state.loading) {
        app.innerHTML = skeletonHome();
        return;
    }
    
    if (state.error) {
        app.innerHTML = `
            <div class="state fade-in">
                <div class="state__icon">⚠</div>
                <h1 class="state__title">Something went wrong</h1>
                <p class="state__desc">${state.error}</p>
                <button class="btn" onclick="location.reload()">Retry</button>
            </div>
        `;
        return;
    }
    
    if (!state.posts.length) {
        app.innerHTML = `
            <div class="state fade-in">
                <div class="state__icon">���</div>
                <h1 class="state__title">No posts yet</h1>
                <p class="state__desc">Add markdown files to your posts/ directory to get started.</p>
            </div>
        `;
        return;
    }
    
    const postsHTML = state.posts.map(p => `
        <a href="#/post/${p.slug}" class="post-card">
            <div class="post-card__meta">
                <span>${formatDate(p.date)}</span>
                <span>${p.readingTime}</span>
            </div>
            <h2 class="post-card__title">${p.title}</h2>
            ${p.description ? `<p class="post-card__desc">${p.description}</p>` : ''}
        </a>
    `).join('');
    
    app.innerHTML = `
        <div class="home fade-in">
            <header class="home__header">
                <h1 class="home__title">${CONFIG.blogName}</h1>
                <p class="home__desc">${CONFIG.blogDescription}</p>
            </header>
            <div class="posts-grid">
                ${postsHTML}
            </div>
        </div>
    `;
}

function renderPost(slug) {
    const app = document.getElementById('app');
    
    if (state.loading) {
        app.innerHTML = skeletonPost();
        return;
    }
    
    const post = state.posts.find(p => p.slug === slug);
    
    if (!post) {
        document.title = 'Not Found — ' + CONFIG.blogName;
        app.innerHTML = `
            <div class="state fade-in">
                <div class="state__icon">404</div>
                <h1 class="state__title">Post not found</h1>
                <p class="state__desc">The post "${slug}" doesn't exist.</p>
                <a href="#/" class="btn">Back to Home</a>
            </div>
        `;
        return;
    }
    
    state.currentPost = post;
    document.title = `${post.title} — ${CONFIG.blogName}`;
    
    const toc = generateTOC(post.html);
    const recommendations = getRecommendations(post.slug);
    
    app.innerHTML = `
        <div class="post-layout fade-in">
            <aside class="post-toc">
                <h2 class="toc__title">Contents</h2>
                <nav class="toc__list">
                    ${toc}
                </nav>
            </aside>
            
            <article class="post-content">
                <a href="#/" class="post__back">← Back</a>
                <header class="post__header">
                    <div class="post__meta">
                        <span>${formatDate(post.date)}</span>
                        <span>${post.readingTime}</span>
                    </div>
                    <h1 class="post__title">${post.title}</h1>
                </header>
                <div class="article">${post.html}</div>
            </article>
            
            <aside class="post-recommendations">
                <h2 class="rec__title">More Posts</h2>
                <div class="rec__list">
                    ${recommendations}
                </div>
            </aside>
        </div>
    `;
    
    setupTOCHighlight();
    window.scrollTo(0, 0);
}

/* ========================================
   TABLE OF CONTENTS
   ======================================== */

function generateTOC(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const headings = temp.querySelectorAll('h1, h2, h3');
    if (!headings.length) return '<p style="opacity: 0.5; font-size: 0.75rem;">No headings</p>';
    
    return Array.from(headings).map(h => {
        const level = h.tagName.toLowerCase();
        const text = h.textContent;
        const id = h.id || slugify(text);
        h.id = id;
        
        return `
            <div class="toc__item">
                <a href="#${id}" class="toc__link toc__link--${level}" data-target="${id}">
                    ${text}
                </a>
            </div>
        `;
    }).join('');
}

function setupTOCHighlight() {
    const links = document.querySelectorAll('.toc__link');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            const target = document.getElementById(targetId);
            
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Update URL without triggering route change
                history.replaceState(null, '', `${window.location.hash.split('#')[0]}#${targetId}`);
            }
        });
    });
    
    // Highlight on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                links.forEach(link => {
                    link.classList.toggle('active', link.dataset.target === id);
                });
            }
        });
    }, { rootMargin: '-100px 0px -80% 0px' });
    
    document.querySelectorAll('.article h1, .article h2, .article h3').forEach(h => {
        if (h.id) observer.observe(h);
    });
}

/* ========================================
   RECOMMENDATIONS
   ======================================== */

function getRecommendations(currentSlug) {
    const others = state.posts.filter(p => p.slug !== currentSlug);
    const recommended = others.slice(0, 3);
    
    if (!recommended.length) {
        return '<p style="opacity: 0.5; font-size: 0.75rem;">No other posts</p>';
    }
    
    return recommended.map(p => `
        <a href="#/post/${p.slug}" class="rec__card">
            <h3 class="rec__card-title">${p.title}</h3>
            <div class="rec__card-meta">${formatDate(p.date)}</div>
        </a>
    `).join('');
}

/* ========================================
   SKELETONS
   ======================================== */

function skeletonHome() {
    return `
        <div class="skeleton-home">
            <div class="skeleton skeleton-home__title"></div>
            <div class="skeleton skeleton-home__desc"></div>
            <div class="skeleton-cards">
                ${Array(3).fill(`
                    <div class="skeleton-card">
                        <div class="skeleton skeleton-card__meta"></div>
                        <div class="skeleton skeleton-card__title"></div>
                        <div class="skeleton skeleton-card__desc"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function skeletonPost() {
    return `
        <div style="max-width: 740px; margin: 0 auto;">
            <div class="skeleton" style="height: 36px; width: 80px; margin-bottom: var(--space-10);"></div>
            <div class="skeleton" style="height: 48px; width: 70%; margin-bottom: var(--space-12);"></div>
            <div class="skeleton" style="height: 20px; width: 100%; margin-bottom: var(--space-4);"></div>
            <div class="skeleton" style="height: 20px; width: 90%; margin-bottom: var(--space-4);"></div>
            <div class="skeleton" style="height: 20px; width: 95%;"></div>
        </div>
    `;
}

/* ========================================
   UTILITIES
   ======================================== */

function formatDate(str) {
    if (!str || str === '1970-01-01') return '';
    try {
        const d = new Date(str + 'T00:00:00');
        if (isNaN(d)) return str;
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
    return `${mins} min read`;
}

function toTitleCase(slug) {
    return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
