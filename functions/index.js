// functions/index.js
// AI 自动翻译框架 - 自动检测源语言，翻译成客户语言

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API 和静态资源
  if (path.startsWith('/api/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return context.next();
  }
  
  // 获取客户语言
  let targetLang = getClientLanguage(request);
  
  // 从数据库获取内容（可以是任何语言）
  const settings = await getSiteSettings(env);
  const navData = await getNavMenu(env);
  let pageContent = await getPageByPath(env, path);
  
  // 如果页面不存在
  if (!pageContent && path !== '/') {
    pageContent = await getPageByPath(env, '404');
    if (!pageContent) {
      pageContent = { 
        title: '页面未找到', 
        content: '<h1>页面未找到</h1><p>您访问的页面不存在。</p>' 
      };
    }
  }
  
  // 生成原始 HTML（后台内容原样输出）
  const originalHtml = generateHTML(settings, navData, pageContent, targetLang);
  
  // 如果客户语言是中文，直接返回原文（因为后台内容可能是中文）
  if (targetLang === 'zh') {
    return new Response(originalHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
  }
  
  // 调用 AI 翻译（自动检测源语言）
  const translatedHtml = await translateHtmlWithAI(originalHtml, targetLang, env);
  
  return new Response(translatedHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

// 获取客户语言（支持任意语言）
function getClientLanguage(request) {
  const cookieMatch = request.headers.get('Cookie')?.match(/lang=([^;]+)/);
  if (cookieMatch) {
    return cookieMatch[1];
  }
  const acceptLang = request.headers.get('Accept-Language') || '';
  const browserLang = acceptLang.split(',')[0].split('-')[0];
  return browserLang || 'en';
}

// 获取站点设置
async function getSiteSettings(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM site_settings');
    const rows = await stmt.all();
    const settings = {
      site_name: '哲觅贸易',
      site_description: '专业家居贸易公司 · 源自中国义乌'
    };
    for (const row of rows.results) {
      // 优先用中文，否则用第一个有值的字段
      settings[row.key] = row.value_zh || row.value_en || row.value;
    }
    return settings;
  } catch (e) {
    return { site_name: '哲觅贸易', site_description: '专业家居贸易公司 · 源自中国义乌' };
  }
}

// 获取导航菜单
async function getNavMenu(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order');
    const rows = await stmt.all();
    return rows.results.map(item => ({
      ...item,
      name: item.name_zh || item.name_en || item.name
    }));
  } catch (e) {
    return [];
  }
}

// 获取页面内容
async function getPageByPath(env, path) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM pages WHERE path = ? AND status = 1 LIMIT 1');
    const page = await stmt.bind(path).first();
    if (!page) return null;
    return {
      ...page,
      title: page.title_zh || page.title_en || page.title,
      content: page.content_zh || page.content_en || page.content
    };
  } catch (e) {
    return null;
  }
}

// 生成原始 HTML（后台内容原样输出）
function generateHTML(settings, navData, page, lang) {
  const langDisplay = getLangDisplay(lang);
  
  const topNav = navData.filter(i => i.location === 'top');
  const bottomNav = navData.filter(i => i.location === 'bottom');
  
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const topNavHtml = topParents.map(parent => {
    const children = topNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<li>
        <a href="${parent.url}">${escapeHtml(parent.name)}</a>
        <div class="dropdown">${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}</div>
      </li>`;
    }
    return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
  }).join('');
  
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  let bottomNavHtml = '';
  if (bottomParents.length) {
    bottomNavHtml = bottomParents.map(parent => {
      const children = bottomNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
      if (children.length) {
        return `<div class="footer-col">
          <h4>${escapeHtml(parent.name)}</h4>
          ${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}
        </div>`;
      }
      return `<div class="footer-col">
        <h4>${escapeHtml(parent.name)}</h4>
      </div>`;
    }).join('');
  } else {
    bottomNavHtml = `
      <div class="footer-col">
        <h4>快速链接</h4>
        <a href="/about">关于我们</a>
        <a href="/contact">联系我们</a>
      </div>
      <div class="footer-col">
        <h4>联系方式</h4>
        <a href="mailto:info@zhamit.com">info@zhamit.com</a>
        <a href="tel:+8657912345678">+86 579 12345678</a>
      </div>
    `;
  }
  
  const pageTitle = page?.title || settings.site_name;
  const pageContent = page?.content || '<h1>欢迎</h1><p>欢迎访问我们的网站。</p>';
  
  return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escapeHtml(pageTitle)} - ${escapeHtml(settings.site_name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.5; color: #1a1a1a; background: #fff; }

        @media (min-width: 768px) {
            .mobile-only { display: none !important; }
            .top-nav { background: #1a1a1a; position: sticky; top: 0; z-index: 200; padding: 0 40px; }
            .top-nav .container { max-width: 1400px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 80px; }
            .company-name { font-size: 24px; font-weight: 700; color: white; letter-spacing: 1px; }
            .nav-menu { display: flex; gap: 32px; list-style: none; margin-left: auto; margin-right: 24px; }
            .nav-menu > li { position: relative; }
            .nav-menu > li > a { color: white; text-decoration: none; font-size: 16px; font-weight: 500; padding: 8px 0; display: block; }
            .nav-menu .dropdown { position: absolute; top: 100%; left: 0; background: white; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 100; }
            .nav-menu > li:hover .dropdown { opacity: 1; visibility: visible; }
            .dropdown a { display: block; padding: 12px 16px; color: #333; text-decoration: none; font-size: 14px; }
            .dropdown a:hover { background: #f5f5f5; }
            .toolbar { display: flex; align-items: center; gap: 20px; }
            .lang-selector { position: relative; }
            .lang-btn { background: none; border: none; color: white; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-weight: 500; }
            .lang-menu { position: absolute; top: 100%; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: none; z-index: 100; min-width: 120px; }
            .lang-selector:hover .lang-menu { display: block; }
            .lang-menu a { display: block; padding: 10px 16px; color: #333; text-decoration: none; font-size: 14px; cursor: pointer; }
            .lang-menu a:hover { background: #f5f5f5; }
            .search-wrapper { position: relative; }
            .search-icon { background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center; }
            .search-icon svg { width: 20px; height: 20px; stroke: white; stroke-width: 1.5; fill: none; }
            .search-input-container { position: absolute; right: 0; top: 100%; background: white; border: 1px solid #e0e0e0; border-radius: 30px; padding: 8px 16px; width: 240px; display: none; margin-top: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .search-wrapper:hover .search-input-container { display: block; }
            .search-input-container input { border: none; outline: none; width: 100%; font-size: 14px; padding: 6px 0; }
            .footer-nav { background: #f8f8f8; padding: 60px 40px 40px; margin-top: 80px; border-top: 1px solid #e8e8e8; }
            .footer-nav .container { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 48px; }
            .footer-col { flex: 1; min-width: 160px; }
            .footer-col .footer-logo { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; display: inline-block; }
            .footer-col p { color: #666; font-size: 14px; line-height: 1.6; margin-top: 8px; }
            .footer-col h4 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px; }
            .footer-col a { display: block; color: #666; text-decoration: none; font-size: 14px; margin-bottom: 12px; transition: color 0.2s; }
            .footer-col a:hover { color: #1a1a1a; }
            .footer-bottom { max-width: 1400px; margin: 40px auto 0; padding-top: 24px; border-top: 1px solid #e8e8e8; text-align: center; font-size: 13px; color: #999; }
            main { min-height: 50vh; padding: 40px; max-width: 1200px; margin: 0 auto; }
        }

        @media (max-width: 767px) {
            .desktop-only { display: none !important; }
            .top-nav { background: #1a1a1a; position: sticky; top: 0; z-index: 200; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
            .hamburger { background: none; border: none; width: 30px; height: 30px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 6px 0; cursor: pointer; }
            .hamburger span { display: block; width: 22px; height: 2px; background: white; border-radius: 2px; }
            .mobile-logo { font-size: 20px; font-weight: 700; color: white; }
            .mobile-toolbar { display: flex; gap: 16px; align-items: center; position: relative; }
            .mobile-lang-btn, .mobile-search-btn { background: none; border: none; color: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; gap: 4px; padding: 4px; }
            .mobile-lang-btn span { font-size: 12px; }
            .mobile-search-btn svg { width: 18px; height: 18px; stroke: white; stroke-width: 1.5; fill: none; }
            .lang-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; overflow: hidden; min-width: 140px; animation: fadeIn 0.2s ease; }
            .lang-modal.show { display: block; }
            .lang-modal-option { padding: 12px 20px; cursor: pointer; text-align: center; font-size: 15px; transition: background 0.2s; }
            .lang-modal-option:hover { background: #f5f5f5; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            .search-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; padding: 8px 16px; width: 240px; animation: fadeIn 0.2s ease; }
            .search-modal.show { display: flex; align-items: center; gap: 8px; }
            .search-modal input { flex: 1; border: none; outline: none; font-size: 14px; padding: 8px 0; }
            .search-modal button { background: none; border: none; cursor: pointer; font-size: 16px; color: #666; }
            .side-menu { position: fixed; top: 0; left: 0; width: 85%; max-width: 320px; height: 100%; background: white; z-index: 300; transform: translateX(-100%); transition: transform 0.3s ease; box-shadow: 2px 0 12px rgba(0,0,0,0.1); overflow-y: auto; }
            .side-menu.open { transform: translateX(0); }
            .menu-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .menu-header h3 { font-size: 18px; }
            .close-menu { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
            .menu-list { padding: 8px 0; }
            .menu-item { border-bottom: 1px solid #f0f0f0; }
            .menu-parent { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; cursor: pointer; }
            .menu-parent span { font-size: 16px; font-weight: 500; }
            .toggle-sub { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; width: 30px; }
            .submenu { display: none; background: #f9f9f9; padding-left: 20px; }
            .submenu.open { display: block; }
            .submenu a { display: block; padding: 12px 20px; color: #666; text-decoration: none; font-size: 14px; }
            .menu-single { display: block; padding: 14px 20px; color: #333; text-decoration: none; font-size: 16px; }
            main { min-height: 50vh; padding: 20px; }
        }
        
        img { max-width: 100%; height: auto; }
        .rich-text { line-height: 1.6; }
        .rich-text h1, .rich-text h2, .rich-text h3 { margin: 1em 0 0.5em; }
        .rich-text p { margin-bottom: 1em; }
    </style>
</head>
<body>
    <!-- ========== 电脑端 ========== -->
    <div class="desktop-only">
        <div class="top-nav">
            <div class="container">
                <div class="logo-area">
                    <span class="company-name">${escapeHtml(settings.site_name)}</span>
                </div>
                <ul class="nav-menu">
                    ${topNavHtml}
                </ul>
                <div class="toolbar">
                    <div class="lang-selector">
                        <button class="lang-btn">
                            🌐 <span id="currentLangDisplay">${langDisplay}</span>
                        </button>
                        <div class="lang-menu" id="langMenu">
                            <a href="#" onclick="setLanguage('en'); return false;">English</a>
                            <a href="#" onclick="setLanguage('zh'); return false;">中文</a>
                            <a href="#" onclick="setLanguage('es'); return false;">Español</a>
                            <a href="#" onclick="setLanguage('fr'); return false;">Français</a>
                            <a href="#" onclick="setLanguage('de'); return false;">Deutsch</a>
                            <a href="#" onclick="setLanguage('ja'); return false;">日本語</a>
                            <a href="#" onclick="setLanguage('ko'); return false;">한국어</a>
                            <a href="#" onclick="setLanguage('ar'); return false;">العربية</a>
                            <a href="#" onclick="setLanguage('ru'); return false;">Русский</a>
                            <a href="#" onclick="setLanguage('pt'); return false;">Português</a>
                            <a href="#" onclick="setLanguage('it'); return false;">Italiano</a>
                        </div>
                    </div>
                    <div class="search-wrapper">
                        <button class="search-icon">
                            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
                                <circle cx="10" cy="10" r="7" />
                                <line x1="15" y1="15" x2="21" y2="21" />
                            </svg>
                        </button>
                        <div class="search-input-container">
                            <input type="text" id="searchInputDesktop" placeholder="搜索...">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <main>
            <div class="rich-text">
                ${pageContent}
            </div>
        </main>

        <div class="footer-nav">
            <div class="container">
                <div class="footer-col">
                    <div class="footer-logo">${escapeHtml(settings.site_name)}</div>
                    <p>${escapeHtml(settings.site_description)}</p>
                </div>
                ${bottomNavHtml}
            </div>
            <div class="footer-bottom">
                © 2025 ${escapeHtml(settings.site_name)}. 保留所有权利。
            </div>
        </div>
    </div>

    <!-- ========== 手机端 ========== -->
    <div class="mobile-only">
        <div class="top-nav">
            <button class="hamburger" id="hamburgerBtn">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="mobile-logo">${escapeHtml(settings.site_name)}</div>
            <div class="mobile-toolbar">
                <button class="mobile-lang-btn" id="mobileLangBtn">
                    🌐 <span id="mobileLangDisplay">${langDisplay}</span>
                </button>
                <button class="mobile-search-btn" id="mobileSearchBtn">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
                        <circle cx="10" cy="10" r="7" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                    </svg>
                </button>
            </div>
        </div>

        <div class="lang-modal" id="langModal">
            <div class="lang-modal-option" onclick="setLanguage('en')">English</div>
            <div class="lang-modal-option" onclick="setLanguage('zh')">中文</div>
            <div class="lang-modal-option" onclick="setLanguage('es')">Español</div>
            <div class="lang-modal-option" onclick="setLanguage('fr')">Français</div>
            <div class="lang-modal-option" onclick="setLanguage('de')">Deutsch</div>
            <div class="lang-modal-option" onclick="setLanguage('ja')">日本語</div>
            <div class="lang-modal-option" onclick="setLanguage('ko')">한국어</div>
            <div class="lang-modal-option" onclick="setLanguage('ar')">العربية</div>
            <div class="lang-modal-option" onclick="setLanguage('ru')">Русский</div>
            <div class="lang-modal-option" onclick="setLanguage('pt')">Português</div>
            <div class="lang-modal-option" onclick="setLanguage('it')">Italiano</div>
        </div>

        <div class="search-modal" id="searchModal">
            <input type="text" id="mobileSearchInput" placeholder="搜索...">
            <button id="mobileSearchConfirm">🔍</button>
        </div>

        <div class="side-menu" id="sideMenu">
            <div class="menu-header">
                <h3>菜单</h3>
                <button class="close-menu" id="closeMenuBtn">✕</button>
            </div>
            <div class="menu-list" id="mobileMenuList">
                ${topNavHtml}
            </div>
        </div>

        <main>
            <div class="rich-text">
                ${pageContent}
            </div>
        </main>

        <div class="footer-nav">
            <div class="container">
                <div class="footer-col">
                    <div class="footer-logo">${escapeHtml(settings.site_name)}</div>
                    <p>${escapeHtml(settings.site_description)}</p>
                </div>
                ${bottomNavHtml}
            </div>
            <div class="footer-bottom">
                © 2025 ${escapeHtml(settings.site_name)}. 保留所有权利。
            </div>
        </div>
    </div>

    <script>
        function setLanguage(lang) {
            document.cookie = 'lang=' + lang + '; path=/; max-age=2592000';
            window.location.reload();
        }
        
        // 更新当前语言显示
        const langMap = {
            'en': 'EN', 'zh': '中文', 'es': 'ES', 'fr': 'FR', 'de': 'DE',
            'ja': '日', 'ko': '韩', 'ar': 'عربي', 'ru': 'RU', 'pt': 'PT', 'it': 'IT'
        };
        const currentLang = '${lang}';
        const displayLang = langMap[currentLang] || currentLang.toUpperCase();
        document.getElementById('currentLangDisplay')?.textContent = displayLang;
        document.getElementById('mobileLangDisplay')?.textContent = displayLang;
        
        // 手机端菜单
        const hamburger = document.getElementById('hamburgerBtn');
        const sideMenu = document.getElementById('sideMenu');
        const closeBtn = document.getElementById('closeMenuBtn');
        if (hamburger && sideMenu) {
            hamburger.addEventListener('click', () => sideMenu.classList.add('open'));
            if (closeBtn) closeBtn.addEventListener('click', () => sideMenu.classList.remove('open'));
            sideMenu.addEventListener('click', (e) => { if (e.target === sideMenu) sideMenu.classList.remove('open'); });
        }
        
        // 手机端语言选择
        const mobileLangBtn = document.getElementById('mobileLangBtn');
        const langModal = document.getElementById('langModal');
        if (mobileLangBtn && langModal) {
            mobileLangBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                langModal.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!langModal.contains(e.target) && e.target !== mobileLangBtn) {
                    langModal.classList.remove('show');
                }
            });
        }
        
        // 搜索功能
        const searchIcon = document.querySelector('.search-icon');
        const searchContainer = document.querySelector('.search-input-container');
        if (searchIcon && searchContainer) {
            searchIcon.addEventListener('click', () => {
                const input = searchContainer.querySelector('input');
                if (input && input.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(input.value.trim());
                }
            });
        }
        
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const mobileSearchModal = document.getElementById('searchModal');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchConfirm = document.getElementById('mobileSearchConfirm');
        if (mobileSearchBtn && mobileSearchModal) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                mobileSearchModal.classList.toggle('show');
                if (mobileSearchInput) mobileSearchInput.focus();
            });
            const doSearch = () => {
                if (mobileSearchInput && mobileSearchInput.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(mobileSearchInput.value.trim());
                }
            };
            if (mobileSearchConfirm) mobileSearchConfirm.addEventListener('click', doSearch);
            if (mobileSearchInput) mobileSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
            document.addEventListener('click', (e) => {
                if (!mobileSearchModal.contains(e.target) && e.target !== mobileSearchBtn) {
                    mobileSearchModal.classList.remove('show');
                }
            });
        }
        
        // 电脑端搜索
        const desktopSearchInput = document.getElementById('searchInputDesktop');
        if (desktopSearchInput) {
            desktopSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && desktopSearchInput.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(desktopSearchInput.value.trim());
                }
            });
        }
    </script>
</body>
</html>`;
}

// 获取语言显示名称
function getLangDisplay(lang) {
  const map = {
    'en': 'EN', 'zh': '中文', 'es': 'ES', 'fr': 'FR', 'de': 'DE',
    'ja': '日', 'ko': '韩', 'ar': 'عربي', 'ru': 'RU', 'pt': 'PT', 'it': 'IT'
  };
  return map[lang] || lang.toUpperCase();
}

// AI 翻译 HTML - 自动检测源语言
async function translateHtmlWithAI(html, targetLang, env) {
  console.log('开始翻译，目标语言:', targetLang);
  console.log('AI 绑定存在:', !!env.AI);
  if (!env.AI) {
    console.error('AI binding not found');
    return html;
  }
  
  // 提取 body 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  const bodyContent = bodyMatch[1];
  const beforeBody = html.substring(0, bodyMatch.index);
  const afterBody = html.substring(bodyMatch.index + bodyMatch[0].length);
  
  // 提取所有文本节点
  const textBlocks = [];
  const placeholders = [];
  let tempContent = bodyContent;
  let index = 0;
  
  // 用正则提取标签外的文本
  tempContent = bodyContent.replace(/>([^<]+)</g, (match, text) => {
    const trimmed = text.trim();
    if (trimmed && !trimmed.match(/^[\d\s\W]+$/)) {
      const placeholder = `{{TEXT_${index}}}`;
      textBlocks.push(trimmed);
      placeholders.push({ placeholder, original: trimmed });
      index++;
      return `>${placeholder}<`;
    }
    return match;
  });
  
  // 批量翻译 - 不指定 source_lang，让模型自动检测
  const translatedTexts = [];
  for (const block of textBlocks) {
    try {
      const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text: block,
        target_lang: targetLang,
        // source_lang 不传，模型自动检测
      });
      translatedTexts.push(response.translated_text || block);
    } catch (e) {
      console.error('翻译失败:', block, e);
      translatedTexts.push(block);
    }
  }
  
  // 替换回翻译后的文本
  let translatedBody = tempContent;
  for (let i = 0; i < placeholders.length; i++) {
    translatedBody = translatedBody.replace(placeholders[i].placeholder, translatedTexts[i]);
  }
  
  return beforeBody + '<body>' + translatedBody + '</body>' + afterBody;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
