/* =============================================
   N3E6X BLOG ENGINE — 2026 EDITION
   ============================================= */

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

/* =============================================
   INITIALIZATION
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupRouter();
    setupFootnoteHandler();
    await loadPosts();
    handleRoute();
});

/* =============================================
   THEME
   ============================================= */

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

/* =============================================
   FOOTNOTE HANDLER — PREVENTS NAVIGATION
   ============================================= */
function setupFootnoteHandler() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href) return;
        
        if (href.startsWith('#') && !href.startsWith('#/')) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = href.slice(1);
            const target = document.getElementById(targetId);
            
            if (target) {
                target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
            
            return false;
        }
    }, true);
}

/* =============================================
   ROUTING
   ============================================= */

function setupRouter() {
    window.addEventListener('hashchange', (e) => {
        const newHash = window.location.hash;
        
        // Ignore footnote anchors
        if (newHash.includes('#fn-') || newHash.includes('#fnref-')) {
            e.preventDefault();
            return;
        }
        
        handleRoute();
    });
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const cleanHash = hash.split('#')[0];
    
    if (cleanHash.startsWith('/post/')) {
        const slug = cleanHash.replace('/post/', '');
        renderPost(slug);
    } else {
        renderHome();
    }
}

function navigate(path) {
    window.location.hash = path;
}

/* =============================================
   DATA LOADING
   ============================================= */

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

/* =============================================
   MARKDOWN PARSING
   ============================================= */

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
    let footnotes = [];
    let footnoteCounter = 0;
    let inTable = false;
    let tableLines = [];
    
    const processInline = (str) => {
        // Footnotes
        str = str.replace(/\[\^(\w+)\]/g, (match, id) => {
            const existingRef = footnotes.find(fn => fn.id === id);
            if (!existingRef) {
                footnoteCounter++;
            }
            const num = existingRef ? existingRef.num : footnoteCounter;
            return `<sup><a href="#fn-${id}" id="fnref-${id}" class="footnote-ref">${num}</a></sup>`;
        });
        
        // Inline code
        str = str.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
        
        // Images
        str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
        
        // Links
        str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Bold + Italic
        str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        
        // Bold
        str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        str = str.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        
        // Strikethrough
        str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');
        
        // Highlight
        str = str.replace(/==(.+?)==/g, '<mark>$1</mark>');
        
        return str;
    };
    
    const flushPara = () => {
        if (paraLines.length) {
            html += `<p>${processInline(paraLines.join(' '))}</p>\n`;
            paraLines = [];
        }
    };
    
    const flushList = () => {
        if (inList) {
            html += `</${listTag}>\n`;
            inList = false;
            listTag = '';
        }
    };
    
    const flushBQ = () => {
        if (inBlockquote) {
            html += `<p>${processInline(bqLines.join(' '))}</p>\n</blockquote>\n`;
            inBlockquote = false;
            bqLines = [];
        }
    };
    
    const flushTable = () => {
        if (inTable && tableLines.length > 0) {
            html += parseTable(tableLines, processInline);
            tableLines = [];
            inTable = false;
        }
    };
    
    const flushAll = () => {
        flushPara();
        flushList();
        flushBQ();
        flushTable();
    };
    
    // Language icons mapping
    const langIcons = {
        'javascript': 'fa-brands fa-js',
        'js': 'fa-brands fa-js',
        'typescript': 'fa-brands fa-js',
        'ts': 'fa-brands fa-js',
        'python': 'fa-brands fa-python',
        'py': 'fa-brands fa-python',
        'html': 'fa-brands fa-html5',
        'css': 'fa-brands fa-css3-alt',
        'react': 'fa-brands fa-react',
        'vue': 'fa-brands fa-vuejs',
        'node': 'fa-brands fa-node-js',
        'php': 'fa-brands fa-php',
        'java': 'fa-brands fa-java',
        'rust': 'fa-brands fa-rust',
        'go': 'fa-brands fa-golang',
        'swift': 'fa-brands fa-swift',
        'bash': 'fa-solid fa-terminal',
        'shell': 'fa-solid fa-terminal',
        'terminal': 'fa-solid fa-terminal',
        'sql': 'fa-solid fa-database',
        'json': 'fa-solid fa-brackets-curly',
        'yaml': 'fa-solid fa-file-code',
        'markdown': 'fa-brands fa-markdown',
        'md': 'fa-brands fa-markdown',
        'default': 'fa-solid fa-code'
    };
    
    const getLangIcon = (lang) => {
        const lower = (lang || '').toLowerCase();
        return langIcons[lower] || langIcons['default'];
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCode) {
                const codeContent = esc(codeLines.join('\n'));
                const langDisplay = codeLang || 'text';
                const langIcon = getLangIcon(codeLang);
                
                html += `
                    <div class="code-block">
                        <div class="code-block__header">
                            <span class="code-block__lang">
                                <i class="${langIcon}"></i>
                                ${langDisplay}
                            </span>
                            <button class="code-block__copy" onclick="copyCode(this)" aria-label="Copy code">
                                <i class="fa-regular fa-copy"></i>
                                <span class="copy-text">Copy</span>
                            </button>
                        </div>
                        <pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${codeContent}</code></pre>
                    </div>\n`;
                
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
        
        // Footnote definitions
        const fnDefMatch = line.match(/^\[\^(\w+)\]:\s*(.+)$/);
        if (fnDefMatch) {
            flushAll();
            const existingFn = footnotes.find(fn => fn.id === fnDefMatch[1]);
            if (!existingFn) {
                footnotes.push({
                    id: fnDefMatch[1],
                    text: fnDefMatch[2],
                    num: footnotes.length + 1
                });
            }
            continue;
        }
        
        // Table detection
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            flushPara();
            flushList();
            flushBQ();
            inTable = true;
            tableLines.push(line);
            continue;
        } else if (inTable) {
            flushTable();
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
            html += `<h${lvl} id="${id}">${processInline(text)}</h${lvl}>\n`;
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
        
        // Task list items
        // Task list items
        const taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
        if (taskMatch) {
            flushPara();
            flushBQ();
            if (!inList || listTag !== 'ul-task') {
                flushList();
                html += '<ul class="task-list">\n';
                inList = true;
                listTag = 'ul-task';
            }
            const checked = taskMatch[1].toLowerCase() === 'x';
            const statusText = checked ? 'Done' : 'To do';
            const statusClass = checked ? 'done' : 'pending';
            
            html += `<li>
                <span class="task-checkbox ${checked ? 'checked' : ''}">
                    <i class="fa-solid fa-check"></i>
                </span>
                <span class="task-text ${checked ? 'checked' : ''}">${processInline(taskMatch[2])}</span>
                <span class="task-status ${statusClass}">${statusText}</span>
            </li>\n`;
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
            html += `<li>${processInline(ulm[1])}</li>\n`;
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
            html += `<li>${processInline(olm[1])}</li>\n`;
            continue;
        }
        
        // Paragraph
        flushList();
        flushBQ();
        paraLines.push(line.trim());
    }
    
    flushAll();
    
    // Footnotes section
    // Footnotes section
    // Footnotes section
    if (footnotes.length > 0) {
        html += `<div class="footnotes">
            <div class="footnotes-header">
                <i class="fa-solid fa-asterisk"></i>
                <span>References</span>
            </div>
            <ol>\n`;
        footnotes.forEach((fn, index) => {
            html += `<li id="fn-${fn.id}">
                <span class="fn-number">${index + 1}.</span>
                <div class="fn-content">
                    <p>${processInline(fn.text)}</p>
                </div>
            </li>\n`;
        });
        html += '</ol>\n</div>\n';
    }
    
    return html;
}

function parseTable(lines, inlineProcessor) {
    if (lines.length < 2) return '';
    
    const rows = lines.map(line => {
        return line.trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map(cell => cell.trim());
    });
    
    const hasSeparator = rows[1] && rows[1].every(cell => /^:?-+:?$/.test(cell));
    
    if (!hasSeparator) {
        return lines.map(line => `<p>${inlineProcessor(line)}</p>\n`).join('');
    }
    
    const headerRow = rows[0];
    const bodyRows = rows.slice(2);
    
    let html = '<table>\n<thead>\n<tr>\n';
    headerRow.forEach(cell => {
        html += `<th>${inlineProcessor(cell)}</th>\n`;
    });
    html += '</tr>\n</thead>\n<tbody>\n';
    
    bodyRows.forEach(row => {
        html += '<tr>\n';
        row.forEach(cell => {
            html += `<td>${inlineProcessor(cell)}</td>\n`;
        });
        html += '</tr>\n';
    });
    
    html += '</tbody>\n</table>\n';
    return html;
}

/* =============================================
   RENDERING
   ============================================= */

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
                <div class="state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h1 class="state__title">Something went wrong</h1>
                <p class="state__desc">${state.error}</p>
                <button class="btn" onclick="location.reload()">
                    <i class="fa-solid fa-rotate-right"></i> Retry
                </button>
            </div>
        `;
        return;
    }
    
    if (!state.posts.length) {
        app.innerHTML = `
            <div class="state fade-in">
                <div class="state__icon"><i class="fa-regular fa-file-lines"></i></div>
                <h1 class="state__title">No posts yet</h1>
                <p class="state__desc">Add markdown files to your posts/ directory to get started.</p>
            </div>
        `;
        return;
    }
    
    const postsHTML = state.posts.map(p => `
        <a href="#/post/${p.slug}" class="post-card">
            <div class="post-card__meta">
                <span><i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}</span>
                <span><i class="fa-regular fa-clock"></i> ${p.readingTime}</span>
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
                <div class="state__icon"><i class="fa-solid fa-ghost"></i></div>
                <h1 class="state__title">Post not found</h1>
                <p class="state__desc">The post "${slug}" doesn't exist.</p>
                <a href="#/" class="btn">
                    <i class="fa-solid fa-house"></i> Back to Home
                </a>
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
                <h2 class="toc__title"><i class="fa-solid fa-list"></i> Contents</h2>
                <nav class="toc__list">
                    ${toc}
                </nav>
            </aside>
            
            <article class="post-content">
                <a href="#/" class="post__back">
                    <i class="fa-solid fa-arrow-left"></i> Back
                </a>
                <header class="post__header">
                    <div class="post__meta">
                        <span><i class="fa-regular fa-calendar"></i> ${formatDate(post.date)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${post.readingTime}</span>
                    </div>
                    <h1 class="post__title">${post.title}</h1>
                </header>
                <div class="article">${post.html}</div>
            </article>
            
            <aside class="post-recommendations">
                <h2 class="rec__title"><i class="fa-solid fa-sparkles"></i> More Posts</h2>
                <div class="rec__list">
                    ${recommendations}
                </div>
            </aside>
        </div>
    `;
    
    setupTOCHighlight();
    window.scrollTo(0, 0);
}

/* =============================================
   TABLE OF CONTENTS
   ============================================= */

function generateTOC(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const headings = temp.querySelectorAll('h1, h2, h3');
    if (!headings.length) return '<p style="opacity: 0.5; font-size: 0.75rem;">No headings</p>';
    
    return Array.from(headings).map(h => {
        const level = h.tagName.toLowerCase();
        const text = h.textContent;
        const id = h.id || slugify(text);
        
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
            }
        });
    });
    
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

/* =============================================
   RECOMMENDATIONS
   ============================================= */

function getRecommendations(currentSlug) {
    const others = state.posts.filter(p => p.slug !== currentSlug);
    const recommended = others.slice(0, 3);
    
    if (!recommended.length) {
        return '<p style="opacity: 0.5; font-size: 0.75rem;">No other posts</p>';
    }
    
    return recommended.map(p => `
        <a href="#/post/${p.slug}" class="rec__card">
            <h3 class="rec__card-title">${p.title}</h3>
            <div class="rec__card-meta">
                <i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}
            </div>
        </a>
    `).join('');
}

/* =============================================
   CODE COPY FUNCTIONALITY
   ============================================= */

function copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    const copyText = button.querySelector('.copy-text');
    const icon = button.querySelector('i');
    
    navigator.clipboard.writeText(code).then(() => {
        copyText.textContent = 'Copied!';
        icon.className = 'fa-solid fa-check';
        button.classList.add('copied');
        
        setTimeout(() => {
            copyText.textContent = 'Copy';
            icon.className = 'fa-regular fa-copy';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        copyText.textContent = 'Failed';
        setTimeout(() => {
            copyText.textContent = 'Copy';
        }, 2000);
    });
}

window.copyCode = copyCode;

/* =============================================
   SKELETONS
   ============================================= */

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

/* =============================================
   UTILITIES
   ============================================= */

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
